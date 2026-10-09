// Only named, understood output SKUs become estimates. In particular, a token
// price without the provider's token-count formula is never a per-second price.
function number(value) {
  return (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
}

function rate(skus, resolution, audio, image) {
  const size = String(resolution).toLowerCase();
  const sound = audio ? "with_audio" : "without_audio";
  const mode = image ? "image_to_video" : "text_to_video";
  for (const key of [`duration_seconds_${sound}_${size}`, `duration_seconds_${size}_${sound}`, `duration_seconds_${sound}`, `${mode}_duration_seconds_${size}`, `duration_seconds_${size}`, "duration_seconds", `per-video-second-${size}`, "per-video-second"]) {
    if (Object.hasOwn(skus, key)) return number(skus[key]);
  }
  for (const key of [`cents_per_second_output_${size}`, `cents_per_video_output_second_${size}`, "cents_per_second_output"]) {
    if (Object.hasOwn(skus, key)) { const value = number(skus[key]); return value === undefined ? undefined : value / 100; }
  }
  return undefined;
}

// OpenRouter documents ByteDance video tokens as
// (output height × output width × duration × 24) / 1024. Output dimensions per
// resolution/aspect ratio follow ByteDance's published Seedance tables; other
// sizes (for example 4K) stay unknown rather than guessed.
const SEEDANCE_DIMENSIONS = {
  "480p": { "16:9": [854, 480], "4:3": [752, 560], "1:1": [640, 640], "3:4": [560, 752], "9:16": [480, 854], "21:9": [992, 432], "9:21": [432, 992] },
  "720p": { "16:9": [1280, 720], "4:3": [1112, 834], "1:1": [960, 960], "3:4": [834, 1112], "9:16": [720, 1280], "21:9": [1470, 630], "9:21": [630, 1470] },
  "1080p": { "16:9": [1920, 1080], "4:3": [1664, 1248], "1:1": [1440, 1440], "3:4": [1248, 1664], "9:16": [1080, 1920], "21:9": [2206, 946], "9:21": [946, 2206] },
};

function tokenPrice(skus, resolution, audio) {
  const size = String(resolution).toLowerCase();
  for (const key of [`video_tokens_${size}`, audio ? null : "video_tokens_without_audio", "video_tokens"]) {
    if (key && Object.hasOwn(skus, key)) return number(skus[key]);
  }
  return undefined;
}

function tokenSeconds(params) {
  const sizes = SEEDANCE_DIMENSIONS[String(params.resolution).toLowerCase()];
  // First/last-frame renders may adapt to the image's ratio; the pixel area
  // per resolution tier is nearly constant, so 16:9 is a close estimate.
  const size = sizes?.[params.aspectRatio] || sizes?.["16:9"];
  return size ? size[0] * size[1] * 24 / 1024 : undefined;
}

function pricing(skus, resolutions) {
  const rates = {};
  for (const resolution of resolutions) {
    for (const audio of [true, false]) {
      const value = rate(skus, resolution, audio, false);
      if (value !== undefined) rates[`${resolution}:${audio ? "audio" : "silent"}`] = value;
    }
    const audio = rates[`${resolution}:audio`], silent = rates[`${resolution}:silent`];
    if (audio !== undefined && audio === silent) {
      rates[resolution] = audio;
      delete rates[`${resolution}:audio`]; delete rates[`${resolution}:silent`];
    }
  }
  return Object.keys(rates).length ? { currency: "USD", unit: "second", rates } : null;
}

function estimate(skus, params, modelId = "") {
  let perSecond = rate(skus, params.resolution, params.audio === true, params.frameCount > 0);
  let basis = "second";
  // The token formula is documented for ByteDance models only.
  if (perSecond === undefined && /^bytedance\//.test(String(modelId))) {
    const price = tokenPrice(skus, params.resolution, params.audio === true);
    const tokens = tokenSeconds(params);
    if (price !== undefined && tokens !== undefined) { perSecond = price * tokens; basis = "token"; }
  }
  if (perSecond === undefined) return { amount: null, currency: "USD", basis: "unknown" };
  let amount = perSecond * Number(params.durationSeconds);
  for (const key of ["cents_per_image_input", "minimum_cents_per_generation"]) {
    if (!Object.hasOwn(skus, key)) continue;
    const value = number(skus[key]);
    if (value === undefined) return { amount: null, currency: "USD", basis: "unknown" };
    if (key === "cents_per_image_input") amount += value / 100 * (params.frameCount || 0);
    else amount = Math.max(amount, value / 100);
  }
  return Number.isFinite(amount) && amount >= 0 ? { amount: Math.round(amount * 1e6) / 1e6, currency: "USD", basis } : { amount: null, currency: "USD", basis: "unknown" };
}

module.exports = { pricing, estimate, SEEDANCE_DIMENSIONS };
