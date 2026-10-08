const fs = require("node:fs");
const path = require("node:path");
const openRouterPricing = require("./openrouter-pricing");

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid catalog: ${message}`);
}

function validatePricing(price) {
  if (price === null) return;
  const nonnegative = (value) => Number.isFinite(value) && value >= 0;
  assert(price && /^[A-Z]{3}$/.test(price.currency) && ["second", "token", "video"].includes(price.unit), "pricing");
  if (price.unit !== "token") {
    assert(price.rates && Object.values(price.rates).every(nonnegative), "rates");
    return;
  }
  const formula = price.formula;
  assert(formula && typeof formula === "object", "token formula");
  if (formula.tokensPerSecond) {
    assert(nonnegative(formula.pricePerMillion) && Object.values(formula.tokensPerSecond).every(nonnegative), "tokensPerSecond");
  } else {
    assert(formula.pricePerMillionByResolution && Object.values(formula.pricePerMillionByResolution).every(nonnegative), "token prices");
    assert(Number.isFinite(formula.frameRate) && formula.frameRate > 0 && Number.isFinite(formula.pixelsPerToken) && formula.pixelsPerToken > 0, "pixel token formula");
    assert(formula.dimensions && Object.values(formula.dimensions).every((ratios) => ratios && typeof ratios === "object" && Object.values(ratios).every((size) => Array.isArray(size) && size.length === 2 && size.every((value) => Number.isInteger(value) && value > 0))), "token dimensions");
  }
}

function validateCatalog(provider) {
  assert(provider && provider.schemaVersion === 1, "schemaVersion");
  assert(typeof provider.provider === "string" && /^[a-z][a-z0-9-]*$/.test(provider.provider), "provider");
  assert(typeof provider.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(provider.asOf), "asOf");
  assert(Array.isArray(provider.sources) && provider.sources.every((source) => typeof source === "string"), "sources");
  assert(Array.isArray(provider.regions) && provider.regions.length > 0, "regions");
  assert(Array.isArray(provider.models), "models");
  const regionIds = new Set();
  for (const region of provider.regions) {
    assert(region && typeof region.id === "string" && !regionIds.has(region.id), "region id");
    regionIds.add(region.id);
    let url;
    try { url = new URL(region.baseUrl); } catch {}
    assert(url && ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, "region baseUrl");
  }
  const modelIds = new Set();
  for (const model of provider.models) {
    assert(model && typeof model.id === "string" && model.id.length > 0 && !modelIds.has(model.id), "model id");
    modelIds.add(model.id);
    assert(typeof model.label === "string" && typeof model.verified === "boolean", "model identity");
    assert(Array.isArray(model.sources), "model sources");
    const caps = model.capabilities;
    assert(caps && Array.isArray(caps.durations) && caps.durations.length > 0 && caps.durations.every((value) => Number.isInteger(value) && value > 0), "durations");
    for (const key of ["resolutions", "aspectRatios"]) assert(Array.isArray(caps[key]) && caps[key].length > 0 && caps[key].every((value) => typeof value === "string" && value.length > 0), key);
    for (const key of ["firstFrame", "lastFrame", "audio"]) assert(typeof caps[key] === "boolean", key);
    if (caps.audioFixed !== undefined) assert(typeof caps.audioFixed === "boolean" && (!caps.audioFixed || caps.audio), "audioFixed");
    if (model.createMode !== undefined) assert(["async", "blocking"].includes(model.createMode), "createMode");
    assert(Number.isInteger(model.concurrencyDefault) && model.concurrencyDefault >= 1 && model.concurrencyDefault <= 1000, "concurrencyDefault");
    assert(Number.isFinite(model.pollIntervalSec) && model.pollIntervalSec > 0, "pollIntervalSec");
    assert(model.resultTtlHours === null || (Number.isFinite(model.resultTtlHours) && model.resultTtlHours > 0), "resultTtlHours");
    assert(Number.isFinite(model.typicalRenderSec) && model.typicalRenderSec > 0, "typicalRenderSec");
    if (model.rpm !== undefined) assert(Number.isFinite(model.rpm) && model.rpm > 0, "rpm");
    if (model.regions) assert(Array.isArray(model.regions) && model.regions.every((id) => regionIds.has(id)), "model regions");
    validatePricing(model.pricing);
    if (model.pricingByRegion !== undefined) {
      assert(model.pricingByRegion && typeof model.pricingByRegion === "object" && !Array.isArray(model.pricingByRegion), "pricingByRegion");
      for (const [region, pricing] of Object.entries(model.pricingByRegion)) {
        assert(regionIds.has(region), "pricing region");
        validatePricing(pricing);
      }
    }
  }
  return provider;
}

function mergeCatalog(catalog, overrides) {
  const result = structuredClone(catalog);
  if (!overrides) return result;
  const additions = Array.isArray(overrides) ? overrides : overrides.providers || [overrides];
  for (const patch of additions) {
    assert(patch && typeof patch.provider === "string", "override provider");
    const existing = result.providers.find((item) => item.provider === patch.provider);
    if (!existing) result.providers.push(validateCatalog(structuredClone(patch)));
    else {
      for (const [key, value] of Object.entries(patch)) {
        if (key === "models" || key === "regions") {
          assert(Array.isArray(value), `override ${key}`);
          for (const item of value) {
            const at = existing[key].findIndex((candidate) => candidate.id === item.id);
            if (at < 0) existing[key].push(structuredClone(item));
            else existing[key][at] = { ...existing[key][at], ...structuredClone(item), ...(item.capabilities ? { capabilities: { ...existing[key][at].capabilities, ...item.capabilities } } : {}) };
          }
        } else existing[key] = structuredClone(value);
      }
      validateCatalog(existing);
    }
  }
  return result;
}

function loadCatalog(dataDir, { directory = path.join(__dirname, "../../data/catalog"), includeMock = process.env.VIDEOGEN_DEV === "1" } = {}) {
  const providers = ["ark", "dashscope", "gemini", "mock", "openai-compatible", "openrouter"].map(id => `${id}.json`).filter(file => fs.existsSync(path.join(directory, file))).map((file) => validateCatalog(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))));
  const cached = dataDir && path.join(dataDir, "openrouter-models.cache.json");
  if (cached && fs.existsSync(cached)) {
    try {
      const saved = validateCatalog(JSON.parse(readLocal(cached)).provider);
      const index = providers.findIndex((provider) => provider.provider === "openrouter");
      if (saved.provider === "openrouter" && saved.models.length && index >= 0) providers[index] = saved;
    } catch { /* A cache failure falls back to the bundled snapshot. */ }
  }
  const local = dataDir && path.join(dataDir, "catalog.local.json");
  const merged = mergeCatalog({ providers }, local && fs.existsSync(local) ? JSON.parse(readLocal(local)) : null);
  merged.providers = merged.providers.filter((provider) => includeMock || provider.provider !== "mock");
  return merged;
}

function readLocal(filename) {
  // Tighten local metadata permissions without chmod following a user symlink.
  if (process.platform !== "win32" && fs.lstatSync(filename).isFile()) fs.chmodSync(filename, 0o600);
  return fs.readFileSync(filename, "utf8");
}

function findModel(catalog, providerId, modelId, region) {
  const provider = catalog.providers.find((item) => item.provider === providerId);
  return provider?.models.find((item) => item.id === modelId && (!region || !item.regions || item.regions.includes(region)));
}

function normalizeOpenRouterModels(response, asOf = new Date().toISOString().slice(0, 10)) {
  assert(Array.isArray(response?.data), "OpenRouter data");
  const models = response.data.flatMap((model) => {
    try {
    if (![model?.supported_durations, model?.supported_resolutions, model?.supported_aspect_ratios].every(value => Array.isArray(value) && value.length)) return [];
    const skus = model.pricing_skus || {};
    const frames = Array.isArray(model.supported_frame_images) ? model.supported_frame_images : [];
    return {
      id: model.id, label: model.name || model.id, verified: true, verifiedAt: asOf, sources: ["https://openrouter.ai/api/v1/videos/models"],
      capabilities: { durations: model.supported_durations, resolutions: model.supported_resolutions, aspectRatios: model.supported_aspect_ratios, firstFrame: frames.includes("first_frame"), lastFrame: frames.includes("last_frame"), audio: model.generate_audio === true, seed: model.seed === true },
      pricing: openRouterPricing.pricing(skus, model.supported_resolutions),
      pricingSkus: skus, concurrencyDefault: 2, pollIntervalSec: 30, resultTtlHours: null, typicalRenderSec: 180,
    };
    } catch { return []; }
  });
  const ids = new Set();
  return models.filter(model => {
    try {
      validateCatalog({ schemaVersion: 1, provider: "openrouter", asOf, sources: [], regions: [{ id: "global", baseUrl: "https://openrouter.ai/api/v1" }], models: [model] });
      if (ids.has(model.id)) return false;
      ids.add(model.id);
      return true;
    } catch { return false; }
  });
}

module.exports = { loadCatalog, validateCatalog, mergeCatalog, findModel, normalizeOpenRouterModels };
