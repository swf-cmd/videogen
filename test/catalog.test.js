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
  assert.ok(models.every((model) => model.capabilities.firstFrame));
  assert.deepEqual(models.map((model) => model.capabilities.lastFrame), [false, false, true]);
  const unknown = normalizeOpenRouterModels({ data: [{ ...fixture.data[0], pricing_skus: { video_tokens: "0.000007" } }] });
  assert.equal(unknown[0].pricing, null);
  assert.throws(() => normalizeOpenRouterModels({}), /Invalid catalog/);
});

test("phase one catalog prices remain regional and token formulas use exact dimensions", () => {
  const catalog = loadCatalog();
  const gemini = findModel(catalog, "gemini", "gemini-omni-1.1-flash");
  assert.equal(normalizeParams(gemini, { audio: false }).ok, false);
  assert.equal(normalizeParams(gemini, { seed: 1 }).ok, false);
  assert.equal(normalizeParams(gemini).value.audio, true);
  assert.equal(gemini.createMode, "async");
  const wan = findModel(catalog, "dashscope", "wan3.0-video");
  for (const [region, expected] of [["beijing", 3], ["singapore", 3.7471]]) {
    assert.equal(estimateCost({ ...wan, pricing: wan.pricingByRegion[region] }, { durationSeconds: 5, resolution: "720p" }).amount, expected);
  }
  const ark = findModel(catalog, "ark", "dreamina-seedance-2-5-260628", "byteplus");
  assert.equal(normalizeParams(ark, { seed: 42 }).ok, false);
  assert.equal(findModel(catalog, "ark", ark.id, "beijing"), undefined);
  assert.deepEqual(estimateCost(ark, { durationSeconds: 5, resolution: "720p", aspectRatio: "16:9" }), { amount: 1.1556, currency: "USD", basis: "token" });
  assert.equal(estimateCost(ark, { durationSeconds: 5, resolution: "1080p", aspectRatio: "16:9" }).amount, 2.8431);
  assert.equal(estimateCost(ark, { durationSeconds: 5, resolution: "720p", aspectRatio: "adaptive" }).amount, null);
  assert.equal(estimateCost(findModel(catalog, "ark", "doubao-seedance-2-5-260628"), {}).amount, null);
});

test("catalog validates regional prices and pixel formulas instead of silently accepting malformed estimates", () => {
  const catalog = loadCatalog();
  const source = catalog.providers.find((item) => item.provider === "ark");
  for (const mutate of [
    (p) => { p.models[1].pricing.formula.dimensions["720p"]["16:9"] = [0, 720]; },
    (p) => { p.models[1].pricing.formula.pixelsPerToken = 0; },
    (p) => { p.models[1].pricing.formula.pricePerMillionByResolution["720p"] = -1; },
    (p) => { p.models[1].pricingByRegion = { wrongRegion: null }; },
    (p) => { p.models[1].capabilities.audioFixed = "yes"; },
  ]) {
    const value = structuredClone(source); mutate(value); assert.throws(() => validateCatalog(value), /Invalid catalog/);
  }
});

test("loading existing local catalog metadata tightens permissions without changing symlink targets", (t) => {
  if (process.platform === "win32") return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "videogen-catalog-mode-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const local = path.join(dir, "catalog.local.json");
  fs.writeFileSync(local, JSON.stringify({ providers: [] }), { mode: 0o644 });
  loadCatalog(dir);
  assert.equal(fs.statSync(local).mode & 0o777, 0o600);
  const target = path.join(dir, "user-managed.json");
  fs.writeFileSync(target, JSON.stringify({ providers: [] }), { mode: 0o644 });
  fs.unlinkSync(local);
  fs.symlinkSync(target, local);
  loadCatalog(dir);
  assert.equal(fs.statSync(target).mode & 0o777, 0o644);
});

test('a malformed or duplicate remote model cannot discard valid catalog entries', () => {
  const source = require('./fixtures/openrouter-models.json').data[0];
  const models = normalizeOpenRouterModels({ data: [null, { ...source, id: 'fraction', supported_durations: [7.5] }, { ...source, id: 'bad', supported_resolutions: 12 }, source, source] });
  assert.deepEqual(models.map(model => model.id), [source.id]);
});
