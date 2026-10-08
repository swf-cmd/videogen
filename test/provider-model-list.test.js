const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePublicModels } = require("../src/providers/models");

test("public model discovery returns only deduplicated IDs and labels without raw provider metadata", () => {
  const secret = "provider-private-secret-12345";
  const clean = text => text.split(secret).join("[REDACTED]");
  const models = normalizePublicModels({ data: [
    { id: "video-v1", name: "Video One", api_key: secret, credentials: { password: secret }, capabilities: { trusted: true }, pricing: { free: true } },
    { id: "video-v1", label: "duplicate" },
    { id: "video-v2", display_name: `Video ${secret}` },
    { id: secret, name: "must not echo credential" },
    { id: "bad\nmodel" }, { id: "x".repeat(301) }, { id: 4 }, null,
  ] }, clean);
  assert.deepEqual(models, [{ id: "video-v1", label: "Video One" }, { id: "video-v2", label: "Video [REDACTED]" }]);
  assert.equal(JSON.stringify(models).includes(secret), false);
  assert.deepEqual(normalizePublicModels({ models: ["video-v3"] }), [{ id: "video-v3", label: "video-v3" }]);
  assert.throws(() => normalizePublicModels({ error: { api_key: secret } }), { message: "invalidProviderResponse" });
});
