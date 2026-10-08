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

function estimate(skus, params) {
  const perSecond = rate(skus, params.resolution, params.audio === true, params.frameCount > 0);
  if (perSecond === undefined) return { amount: null, currency: "USD", basis: "unknown" };
  let amount = perSecond * Number(params.durationSeconds);
  for (const key of ["cents_per_image_input", "minimum_cents_per_generation"]) {
    if (!Object.hasOwn(skus, key)) continue;
    const value = number(skus[key]);
    if (value === undefined) return { amount: null, currency: "USD", basis: "unknown" };
    if (key === "cents_per_image_input") amount += value / 100 * (params.frameCount || 0);
    else amount = Math.max(amount, value / 100);
  }
  return Number.isFinite(amount) && amount >= 0 ? { amount: Math.round(amount * 1e6) / 1e6, currency: "USD", basis: "second" } : { amount: null, currency: "USD", basis: "unknown" };
}

module.exports = { pricing, estimate };
