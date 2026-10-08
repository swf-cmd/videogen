const { ProviderError } = require("./base");

function validateAssets(model, params, roles = [], { lastFrame = true } = {}) {
  if (!Array.isArray(roles) || roles.length > 2 || roles.some((role) => !["first_frame", "last_frame"].includes(role)) || new Set(roles).size !== roles.length) return "invalidAsset";
  if (roles.includes("first_frame") && model?.capabilities?.firstFrame === false) return "unsupportedFirstFrame";
  if (roles.includes("last_frame") && (!lastFrame || model?.capabilities?.lastFrame === false)) return "unsupportedLastFrame";
  if (roles.includes("last_frame") && !roles.includes("first_frame")) return "firstFrameRequired";
  return null;
}

function frameAssets(ctx, job, options = {}) {
  const model = ctx.catalog?.models?.find((item) => item.id === job?.model) || ctx.catalog;
  const assets = ctx.assets.map((asset) => ({ ...asset, role: asset.role || "first_frame" }));
  const error = validateAssets(model, job?.params, assets.map((asset) => asset.role), options);
  if (error) throw new ProviderError(error, { code: error, category: "invalid_request", accepted: false });
  if (job?.assets?.length && job.assets.length !== assets.length) throw new ProviderError("invalidAsset", { code: "invalidAsset", category: "invalid_request", accepted: false });
  return assets.sort((a, b) => (a.role === "first_frame" ? 0 : 1) - (b.role === "first_frame" ? 0 : 1));
}

module.exports = { validateAssets, frameAssets };
