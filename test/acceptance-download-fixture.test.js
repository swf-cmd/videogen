const test = require("node:test");
const assert = require("node:assert/strict");
const { startMockServer, mockBytes } = require("./fixtures/mock-provider-server");

test("crash fixture holds a partial download until the control barrier releases it", { timeout: 5000 }, async (t) => {
  const mock = await startMockServer({ renderDelayMs: 0, holdDownloads: true });
  t.after(() => mock.close());
  const request = async (route, body) => {
    const response = await fetch(`${mock.url}${route}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(response.status, 200);
    return response.json();
  };
  const prompt = "held fixture download";
  const job = await request("/v1/videos", { prompt });
  // This fixture test controls readiness directly; it tests the body barrier.
  mock.jobs.get(job.id).status = "completed";
  mock.jobs.get(job.id).expiresAt = Date.now() + 60000;
  const response = await fetch(`${mock.url}/v1/videos/${job.id}/content`);
  const reader = response.body.getReader();
  const first = await reader.read();
  const expected = mockBytes(prompt);
  assert.deepEqual(Buffer.from(first.value), expected.subarray(0, Math.ceil(expected.length / 2)));
  let finished = false;
  const rest = reader.read().then((value) => { finished = true; return value; });
  const stats = await request("/stats");
  assert.equal(Object.keys(stats.downloadsActive).length, 1);
  assert.equal(finished, false, "the second body chunk stays blocked while the crash controller observes local output");
  await request("/control", { holdDownloads: false });
  const second = await rest;
  assert.deepEqual(Buffer.concat([Buffer.from(first.value), Buffer.from(second.value)]), expected);
  assert.equal((await reader.read()).done, true);
});
