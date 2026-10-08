const { generateKeyPairSync, randomBytes, sign, X509Certificate } = require("node:crypto");

// Minimal test-only X.509 encoder. All private material is generated in memory
// per run; only the public certificate is passed to child Node trust stores.
function der(tag, ...parts) {
  const value = Buffer.concat(parts.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(part)));
  let length;
  if (value.length < 128) length = Buffer.from([value.length]);
  else {
    const bytes = [];
    for (let number = value.length; number; number >>>= 8) bytes.unshift(number & 255);
    length = Buffer.from([128 + bytes.length, ...bytes]);
  }
  return Buffer.concat([Buffer.from([tag]), length, value]);
}

function oid(value) {
  const numbers = value.split(".").map(Number);
  const out = [numbers[0] * 40 + numbers[1]];
  for (const number of numbers.slice(2)) {
    const bytes = [number & 127];
    for (let remaining = Math.floor(number / 128); remaining; remaining = Math.floor(remaining / 128)) bytes.unshift((remaining & 127) | 128);
    out.push(...bytes);
  }
  return der(6, out);
}

const sequence = (...parts) => der(0x30, ...parts);
function extension(id, body, critical = false) { return sequence(oid(id), ...(critical ? [der(1, [255])] : []), der(4, body)); }
function date(value) {
  const year = value.getUTCFullYear();
  const stamp = value.toISOString().replace(/[-:T]/g, "").replace(/\.\d{3}Z$/, "Z");
  return der(year < 2050 ? 0x17 : 0x18, Buffer.from(year < 2050 ? stamp.slice(2) : stamp));
}
function pem(label, data) { return `-----BEGIN ${label}-----\n${data.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END ${label}-----\n`; }

function createTlsFixture() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const algorithm = sequence(oid("1.2.840.113549.1.1.11"), der(5, []));
  const name = sequence(der(0x31, sequence(oid("2.5.4.3"), der(0x0c, Buffer.from("videogen ephemeral test CA")))));
  const serial = randomBytes(16);
  serial[0] = serial[0] & 0x7f | 1;
  const ipv6 = Buffer.alloc(16);
  ipv6[15] = 1;
  const extensions = sequence(
    extension("2.5.29.19", sequence(der(1, [255])), true),
    extension("2.5.29.15", der(3, [1, 0xa6]), true),
    extension("2.5.29.17", sequence(der(0x82, Buffer.from("provider.test")), der(0x82, Buffer.from("localhost")), der(0x87, [127, 0, 0, 1]), der(0x87, ipv6))),
  );
  const now = Date.now();
  const tbs = sequence(der(0xa0, der(2, [2])), der(2, serial), algorithm, name, sequence(date(new Date(now - 86400000)), date(new Date(now + 86400000))), name, publicKey.export({ type: "spki", format: "der" }), der(0xa3, extensions));
  const certificate = sequence(tbs, algorithm, der(3, Buffer.from([0]), sign("sha256", tbs, privateKey)));
  const cert = pem("CERTIFICATE", certificate);
  const parsed = new X509Certificate(cert);
  if (!parsed.verify(publicKey) || !parsed.checkHost("provider.test") || !parsed.checkIP("127.0.0.1") || !Number.isFinite(Date.parse(parsed.validTo))) throw new Error("Invalid ephemeral certificate");
  return { cert, key: privateKey.export({ type: "pkcs8", format: "pem" }) };
}

module.exports = { createTlsFixture };
