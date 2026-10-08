const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');

function parseRange(value, size) {
  if (!value) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || !size || (!match[1] && !match[2])) return null;
  let start, end;
  if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix <= 0) return null; start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1), partial: true };
}
async function serveMedia(req, res, job) {
  if (!job || job.state !== 'succeeded' || !job.output?.path) throw Object.assign(new Error('mediaUnavailable'), { status: 404 });
  // Only persisted completed outputs are readable. No request-supplied paths.
  const filename = path.resolve(job.output.path);
  let handle;
  try {
    const canonical = path.join(await fsp.realpath(path.dirname(filename)), path.basename(filename));
    if (await fsp.realpath(filename) !== canonical) throw new Error('unsafe');
    const before = await fsp.lstat(filename);
    if (!before.isFile() || before.isSymbolicLink()) throw new Error('unsafe');
    handle = await fsp.open(canonical, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino || stat.size !== job.output.bytes || !stat.size) throw new Error('unsafe');
    const range = parseRange(req.headers.range, stat.size);
    const headers = { 'accept-ranges': 'bytes', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin', 'content-type': job.output.contentType === 'video/webm' ? 'video/webm' : 'video/mp4' };
    if (!range) { res.writeHead(416, { ...headers, 'content-range': `bytes */${stat.size}` }); res.end(); return; }
    headers['content-length'] = range.end - range.start + 1;
    if (range.partial) headers['content-range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
    res.writeHead(range.partial ? 206 : 200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    await pipeline(handle.createReadStream({ start: range.start, end: range.end, autoClose: false }), res);
  } catch (error) {
    if (!res.headersSent) throw Object.assign(new Error('mediaUnavailable'), { status: 404 });
    if (!res.destroyed) res.destroy();
  } finally { await handle?.close(); }
}
module.exports = { serveMedia, parseRange };
