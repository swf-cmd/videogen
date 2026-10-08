const fs = require('node:fs');


// Read complete records with bounded scratch memory, preserving partial UTF-8
// characters across chunks. Only a torn journal tail may be ignored.
function readRecords(filename, visit, { tailAllowed = false } = {}) {
  const fd = fs.openSync(filename, 'r');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const buffer = Buffer.alloc(64 * 1024);
  let pending = Buffer.alloc(0), consumed = 0;
  try {
    for (;;) {
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!bytes) break;
      const chunk = Buffer.concat([pending, buffer.subarray(0, bytes)]);
      let start = 0, end;
      while ((end = chunk.indexOf(10, start)) >= 0) {
        const line = chunk.subarray(start, end);
        consumed += line.length + 1;
        if (line.length) {
          let text;
          try { text = decoder.decode(line); }
          catch { throw Object.assign(new Error('invalidStore'), { code: 'invalidStore' }); }
          visit(JSON.parse(text));
        }
        start = end + 1;
      }
      pending = chunk.subarray(start);
      if (pending.length > 32 * 1024 * 1024) throw new Error('invalidStore');
    }
    if (pending.length && !tailAllowed) throw new Error('invalidStore');
    return consumed;
  } finally { fs.closeSync(fd); }
}

function* snapshotRecords(seq, jobs, batches, knownModels = []) {
  yield { v: 2, seq, type: 'snapshot' };
  const models = new Map();
  for (const model of knownModels) {
    const key = JSON.stringify(model);
    if (models.has(key)) continue;
    const ref = models.size; models.set(key, ref);
    yield { type: 'model', ref, value: model };
  }
  for (const job of jobs) {
    if (!job.modelConfig) { yield { type: 'job', value: job }; continue; }
    const key = JSON.stringify(job.modelConfig);
    let ref = models.get(key);
    if (ref === undefined) {
      ref = models.size;
      models.set(key, ref);
      yield { type: 'model', ref, value: job.modelConfig };
    }
    const { modelConfig, ...value } = job;
    yield { type: 'job', modelRef: ref, value };
  }
  for (const value of batches) yield { type: 'batch', value };
  yield { type: 'end', seq };
}
module.exports = { readRecords, snapshotRecords };
