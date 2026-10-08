const { redact } = require("../../queue/keys");
const { redactLocalPaths } = require("../errors");

function serializeEvent(event, type = "change") {
  if (!Number.isSafeInteger(event.seq) || event.seq < 0) throw new Error("invalidEvent");
  return `id: ${event.seq}\nevent: ${type}\ndata: ${JSON.stringify(redactLocalPaths(redact(event)))}\n\n`;
}

class EventStream {
  constructor(store, { capacity = 2000, maxBytes = 8 * 1024 * 1024, heartbeatMs = 15000 } = {}) {
    this.store = store;
    this.capacity = capacity;
    this.maxBytes = maxBytes;
    this.heartbeatMs = heartbeatMs;
    this.buffer = [];
    this.bytes = 0;
    this.clients = new Set();
    this.listener = (event) => this.publish(event);
    store.on("event", this.listener);
  }

  publish(event) {
    const text = serializeEvent(event);
    const bytes = Buffer.byteLength(text);
    this.buffer.push({ seq: event.seq, text, bytes });
    this.bytes += bytes;
    while (this.buffer.length > this.capacity || this.bytes > this.maxBytes) this.bytes -= this.buffer.shift().bytes;
    for (const res of this.clients) this.write(res, text);
  }

  write(res, text) {
    if (res.destroyed || res.writableLength > 1024 * 1024) { res.destroy(); this.clients.delete(res); return; }
    res.write(text);
  }

  connect(req, res) {
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    res.flushHeaders?.();
    const raw = req.headers["last-event-id"];
    const after = raw === undefined ? null : Number(raw);
    if (after !== null) {
      const first = this.buffer[0]?.seq ?? this.store.seq + 1;
      if (!Number.isSafeInteger(after) || after < 0 || after > this.store.seq || after < first - 1) {
        this.write(res, serializeEvent({ seq: this.store.seq, reason: "replay_gap" }, "resync"));
      } else for (const event of this.buffer) if (event.seq > after) this.write(res, event.text);
    } else this.write(res, serializeEvent({ seq: this.store.seq }, "ready"));
    this.clients.add(res);
    const heartbeat = setInterval(() => this.write(res, ": heartbeat\n\n"), this.heartbeatMs);
    heartbeat.unref?.();
    res.on("close", () => { clearInterval(heartbeat); this.clients.delete(res); });
  }

  close() {
    this.store.off("event", this.listener);
    for (const res of this.clients) res.end();
    this.clients.clear();
  }
}

module.exports = { EventStream, serializeEvent };
