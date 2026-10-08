async function apiRequest(endpoint, payload, method = payload === undefined ? "GET" : "POST", file = null) {
  if (isFilePreview) throw new Error(t("filePreviewGenerateError"));
  const headers = { "x-videogen-language": activeLanguage };
  let body;
  if (file) {
    body = new FormData();
    body.append("payload", JSON.stringify(payload));
    body.append("input_reference", file, file.name);
  } else if (payload !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(payload);
  }
  const response = await fetch(endpoint, { method, headers, body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || t("requestFailed", { status: response.status }));
  return result;
}

function normalizedBaseUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return "";
    return url.href.replace(/\/+$/, "");
  } catch { return ""; }
}

function sameLane(a, b) {
  const baseUrl = normalizedBaseUrl(a?.baseUrl);
  return Boolean(baseUrl) && a?.provider === b?.provider && a?.region === b?.region && baseUrl === normalizedBaseUrl(b?.baseUrl);
}

function formatCost(cost) {
  if (!Number.isFinite(cost?.amount)) return t("unknown");
  try { return new Intl.NumberFormat(currentLocale(), { style: "currency", currency: cost.currency || "USD", maximumFractionDigits: 4 }).format(cost.amount); }
  catch { return `${cost.amount} ${cost.currency || ""}`; }
}

function canRetryJob(job) { return job.state === "failed" && job.error?.definitelyNotAccepted === true && !job.remote?.id; }
function canCancelJob(job) { return ["queued", "submitting", "running", "downloading"].includes(job.state) && !job.cancelRequested; }
function modelRetiring(model, now = Date.now()) {
  const date = Date.parse(model?.deprecatesAt || model?.deprecatedAt);
  return Number.isFinite(date) && date - now <= 30 * 86400000;
}

function insecureCredentialLane(lane, hasKey) {
  if (!hasKey) return false;
  try { const url = new URL(lane.baseUrl); return url.protocol === "http:" && !["localhost", "[::1]", "::1"].includes(url.hostname) && !/^127(?:\.\d{1,3}){3}$/.test(url.hostname); }
  catch { return false; }
}
