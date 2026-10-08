const { ProviderError } = require("./base");

// Discovery is an untrusted provider response. Public IDs and labels do not
// imply verified generation capabilities, prices or supported parameters.
function normalizePublicModels(data, redact = value => value) {
  const rows = Array.isArray(data) ? data : data?.data || data?.models;
  if (!Array.isArray(rows)) throw new ProviderError("invalidProviderResponse", { category: "transient" });
  const models = new Map();
  for (const row of rows) {
    const id = typeof row === "string" ? row : row?.id;
    if (typeof id !== "string" || !id || id.length > 300 || /[\s\x00-\x1f\x7f-\x9f]/.test(id) || redact(id) !== id || models.has(id)) continue;
    const name = row?.label ?? row?.display_name ?? row?.name;
    const label = typeof name === "string" && name.trim() && !/[\x00-\x1f\x7f-\x9f]/.test(name) ? String(redact(name)).trim().slice(0, 300) : id;
    models.set(id, { id, label });
  }
  return [...models.values()];
}
module.exports = { normalizePublicModels };
