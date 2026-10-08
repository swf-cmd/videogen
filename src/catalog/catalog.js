const fs = require("node:fs");
const path = require("node:path");

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid catalog: ${message}`);
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
    assert(Number.isInteger(model.concurrencyDefault) && model.concurrencyDefault >= 1 && model.concurrencyDefault <= 1000, "concurrencyDefault");
    assert(Number.isFinite(model.pollIntervalSec) && model.pollIntervalSec > 0, "pollIntervalSec");
    assert(model.resultTtlHours === null || (Number.isFinite(model.resultTtlHours) && model.resultTtlHours > 0), "resultTtlHours");
    assert(Number.isFinite(model.typicalRenderSec) && model.typicalRenderSec > 0, "typicalRenderSec");
    if (model.rpm !== undefined) assert(Number.isFinite(model.rpm) && model.rpm > 0, "rpm");
    if (model.regions) assert(Array.isArray(model.regions) && model.regions.every((id) => regionIds.has(id)), "model regions");
    if (model.pricing !== null) {
      const price = model.pricing;
      assert(price && /^[A-Z]{3}$/.test(price.currency) && ["second", "token", "video"].includes(price.unit), "pricing");
      if (price.unit === "token") {
        assert(price.formula && Number.isFinite(price.formula.pricePerMillion) && price.formula.pricePerMillion >= 0, "token formula");
        assert(price.formula.tokensPerSecond && Object.values(price.formula.tokensPerSecond).every((value) => Number.isFinite(value) && value >= 0), "tokensPerSecond");
      } else assert(price.rates && Object.values(price.rates).every((value) => Number.isFinite(value) && value >= 0), "rates");
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
  const providers = fs.readdirSync(directory).filter((file) => file.endsWith(".json")).sort().map((file) => validateCatalog(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))));
  const local = dataDir && path.join(dataDir, "catalog.local.json");
  const merged = mergeCatalog({ providers }, local && fs.existsSync(local) ? JSON.parse(fs.readFileSync(local, "utf8")) : null);
  merged.providers = merged.providers.filter((provider) => includeMock || provider.provider !== "mock");
  return merged;
}

function findModel(catalog, providerId, modelId, region) {
  const provider = catalog.providers.find((item) => item.provider === providerId);
  return provider?.models.find((item) => item.id === modelId && (!region || !item.regions || item.regions.includes(region)));
}

function normalizeOpenRouterModels(response, asOf = new Date().toISOString().slice(0, 10)) {
  assert(Array.isArray(response?.data), "OpenRouter data");
  return response.data.filter((model) => model.supported_durations?.length && model.supported_resolutions?.length && model.supported_aspect_ratios?.length).map((model) => {
    const skus = model.pricing_skus || {};
    const rates = {};
    for (const resolution of model.supported_resolutions) {
      const perSecond = skus[`duration_seconds_${resolution.toLowerCase()}`] ?? skus.duration_seconds;
      const cents = skus.cents_per_second_output;
      if (perSecond !== undefined && Number.isFinite(Number(perSecond))) rates[resolution] = Number(perSecond);
      else if (cents !== undefined && Number.isFinite(Number(cents))) rates[resolution] = Number(cents) / 100;
    }
    return {
      id: model.id, label: model.name || model.id, verified: true, verifiedAt: asOf, sources: ["https://openrouter.ai/api/v1/videos/models"],
      capabilities: { durations: model.supported_durations, resolutions: model.supported_resolutions, aspectRatios: model.supported_aspect_ratios, firstFrame: false, lastFrame: false, audio: model.generate_audio === true, seed: model.seed === true },
      pricing: Object.keys(rates).length ? { currency: "USD", unit: "second", rates } : null,
      pricingSkus: skus, concurrencyDefault: 2, pollIntervalSec: 30, resultTtlHours: null, typicalRenderSec: 180,
    };
  });
}

module.exports = { loadCatalog, validateCatalog, mergeCatalog, findModel, normalizeOpenRouterModels };
