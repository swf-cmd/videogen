/* One dimension calculation for browser image fitting and provider requests. */
(function (root) {
  "use strict";
  function pixelSize({ resolution, aspectRatio } = {}) {
    const explicit = /^(\d+)x(\d+)$/.exec(String(resolution || ""));
    if (explicit) return explicit.slice(1).every((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0) ? resolution : "";
    const edge = /^4k$/i.test(resolution) ? 2160 : Number(/^(\d+)p$/i.exec(resolution)?.[1]);
    const ratio = /^(\d+):(\d+)$/.exec(String(aspectRatio || ""));
    if (!Number.isFinite(edge) || edge <= 0 || !ratio) return "";
    const [a, b] = ratio.slice(1).map(Number), short = Math.min(a, b);
    if (!short) return "";
    const dimensions = [a, b].map((value) => Math.round(edge * value / short / 2) * 2);
    return dimensions.every((value) => Number.isSafeInteger(value) && value > 0) ? dimensions.join("x") : "";
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { pixelSize };
  else root.VideoDimensions = { pixelSize };
})(typeof globalThis !== "undefined" ? globalThis : this);
