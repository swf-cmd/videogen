// Keep this module free of HTTP imports: native agents parse proxy URLs at load
// time, and their invalid-URL errors can contain proxy credentials.
const LOOPBACK_HOSTS = ["localhost", "localhost.", "127.0.0.1", "[::1]", "::1"];
const { st, normalizeLanguage } = require("./i18n/server-messages");

function supportsRuntime(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major === 22 && minor >= 21 || major === 24 && minor >= 5 || major > 24;
}

function runtimeError(code) { return Object.assign(new Error(code), { code }); }
function runtimeErrorMessage(error, env = process.env) {
  const language = String(env.VIDEOGEN_LANGUAGE || env.LC_ALL || env.LC_MESSAGES || env.LANG || "zh").slice(0, 2).toLowerCase();
  return st(normalizeLanguage(language), ["unsupportedRuntime", "runtimeStartFailed"].includes(error?.code) ? error.code : "invalidProxy");
}

function validateProxy(value) {
  if (!value) return null;
  try {
    if (/[\s\x00-\x1f\x7f]/.test(value)) throw runtimeError("invalidProxy");
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.search || url.hash) throw runtimeError("invalidProxy");
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    return url;
  } catch { throw runtimeError("invalidProxy"); }
}

function configureProxyEnvironment(env = process.env) {
  // Native http and fetch differ for empty lower-case values. Normalize once so
  // every client, and the displayed status, use the same effective settings.
  const http = env.http_proxy || env.HTTP_PROXY || "";
  const https = env.https_proxy || env.HTTPS_PROXY || "";
  validateProxy(http);
  validateProxy(https);
  env.HTTP_PROXY = env.http_proxy = http;
  env.HTTPS_PROXY = env.https_proxy = https;
  const entries = String(env.no_proxy || env.NO_PROXY || "").split(/[,\s]+/).filter(Boolean);
  env.NO_PROXY = env.no_proxy = [...new Set([...entries, ...LOOPBACK_HOSTS])].join(",");
  return env;
}

function proxyEnabled(env = process.env, argv = process.execArgv) {
  let enabled = env.NODE_USE_ENV_PROXY === "1";
  const options = [...String(env.NODE_OPTIONS || "").matchAll(/(?:^|\s)(?:"(--(?:no-)?use-env-proxy)"|(--(?:no-)?use-env-proxy))(?=\s|$)/g)].map((match) => match[1] || match[2]);
  for (const option of [...options, ...argv]) {
    if (option === "--use-env-proxy") enabled = true;
    if (option === "--no-use-env-proxy") enabled = false;
  }
  return enabled;
}

function publicProxy(value) {
  const url = validateProxy(value);
  if (!url) return null;
  return `${url.protocol}//${url.username || url.password ? "[REDACTED]@" : ""}${url.host}`;
}

function proxyInfo(env = process.env, argv = process.execArgv) {
  const http = env.http_proxy || env.HTTP_PROXY || "";
  const https = env.https_proxy || env.HTTPS_PROXY || http;
  return { enabled: proxyEnabled(env, argv) && Boolean(http || https), http: publicProxy(http), https: publicProxy(https), noProxy: env.no_proxy || env.NO_PROXY || "" };
}

function initializeRuntime() {
  if (!supportsRuntime(process.versions.node)) throw runtimeError("unsupportedRuntime");
  configureProxyEnvironment();
  return proxyInfo();
}

module.exports = { LOOPBACK_HOSTS, supportsRuntime, runtimeErrorMessage, configureProxyEnvironment, proxyInfo, initializeRuntime };
