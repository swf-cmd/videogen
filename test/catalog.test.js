const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadCatalog, validateCatalog, mergeCatalog, normalizeOpenRouterModels, findModel } = require("../src/catalog/catalog");
const { normalizeParams, estimateCost } = require("../src/providers/base");

test("bundled catalog validates and development models stay hidden", () => {
  const catalog = loadCatalog(undefined, { includeMock: false });
  assert.ok(catalog.providers.some((provider) => provider.provider === "openrouter"));
  assert.ok(!catalog.providers.some((provider) => provider.provider === "mock"));
  for (const provider of catalog.providers) assert.equal(validateCatalog(provider), provider);
  assert.ok(loadCatalog(undefined, { includeMock: true }).providers.some((provider) => provider.provider === "mock"));
});

test("local model override merges capabilities without mutating shipped catalog", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-catalog-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "catalog.local.json"), JSON.stringify({ providers: [{ provider: "openai-compatible", models: [{ id: "custom-model", requestFormat: "multipart", capabilities: { durations: [6] } }] }] }));
  const model = findModel(loadCatalog(dir), "openai-compatible", "custom-model");
  assert.deepEqual(model.capabilities.durations, [6]);
  assert.deepEqual(model.capabilities.resolutions, ["720p"]);
  assert.equal(model.requestFormat, "multipart");
  assert.deepEqual(findModel(loadCatalog(), "openai-compatible", "custom-model").capabilities.durations, [5, 10]);
});

test("invalid schema, credentials in URLs, prices and limits fail immediately", () => {
  const source = loadCatalog().providers[0];
  for (const mutate of [(p) => { p.schemaVersion = 2; }, (p) => { p.regions[0].baseUrl = "https://user:secret@host/v1"; }, (p) => { p.models[0].capabilities.durations = [-1]; }, (p) => { p.models[0].concurrencyDefault = 0; }, (p) => { p.models[0].pricing = { currency: "USD", unit: "second", rates: { default: -1 } }; }]) {
    const value = structuredClone(source); mutate(value); assert.throws(() => validateCatalog(value), /Invalid catalog/);
  }
  assert.throws(() => mergeCatalog({ providers: [source] }, { providers: [{ provider: source.provider, models: [{ id: source.models[0].id, pollIntervalSec: 0 }] }] }), /Invalid catalog/);
});

test("parameter normalization rejects unsupported capabilities before create", () => {
  const model = findModel(loadCatalog(), "openrouter", "alibaba/wan-3.0");
  assert.equal(normalizeParams(model, { durationSeconds: 2, resolution: "480p", aspectRatio: "16:9", audio: true }).ok, true);
  assert.equal(normalizeParams(model, { durationSeconds: 31, resolution: "4k", aspectRatio: "3:2" }).ok, false);
  assert.equal(normalizeParams(model, { durationSeconds: 2.5 }).ok, false);
  assert.equal(normalizeParams(model, { seed: Infinity }).ok, false);
});

test("second and token estimates preserve currencies and unknown prices", () => {
  const model = findModel(loadCatalog(), "openrouter", "alibaba/wan-3.0");
  assert.deepEqual(estimateCost(model, { durationSeconds: 5, resolution: "720p", audio: true }), { amount: 0.5, currency: "USD", basis: "second" });
  assert.equal(estimateCost({ pricing: null }, {}).amount, null);
  assert.equal(estimateCost({ pricing: { currency: "CNY", unit: "second", rates: {} } }, { durationSeconds: 5 }).amount, null);
  const gemini = { pricing: { currency: "USD", unit: "token", formula: { pricePerMillion: 17.5, tokensPerSecond: { "720p": 5792 } } } };
  assert.deepEqual(estimateCost(gemini, { durationSeconds: 5, resolution: "720p" }), { amount: 0.5068, currency: "USD", basis: "token" });
  assert.equal(estimateCost(gemini, { durationSeconds: 5, resolution: "4k" }).amount, null);
});

test("OpenRouter public fixture normalizes variable SKUs conservatively", () => {
  const fixture = require("./fixtures/openrouter-models.json");
  const models = normalizeOpenRouterModels(fixture, fixture.asOf);
  assert.equal(models.length, 3);
  assert.equal(models.find((model) => model.id === "runway/gen-4.5").pricing.rates["720p"], 0.12);
  assert.ok(models.every((model) => !model.capabilities.firstFrame));
  const unknown = normalizeOpenRouterModels({ data: [{ ...fixture.data[0], pricing_skus: { video_tokens: "0.000007" } }] });
  assert.equal(unknown[0].pricing, null);
  assert.throws(() => normalizeOpenRouterModels({}), /Invalid catalog/);
});
