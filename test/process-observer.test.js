const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { observeProcess } = require("./fixtures/process-observer.cjs");

function fakeChild() {
  const child = new EventEmitter();
  Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null, connected: false });
  child.kill = signal => { child.signalCode = signal; child.emit("exit", null, signal); };
  return child;
}

test("process readiness deadline rejects missing readiness with safe process diagnostics", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = fakeChild();
  const privatePath = "C:\\Users\\fixture\\private";
  const observed = observeProcess(child, { label: "missing ready", paths: [privatePath], secrets: ["fixture-secret"] });
  child.stderr.write(`authorization: Bearer fixture-secret\n${privatePath}\n`);
  const rejection = assert.rejects(observed.ready(/Ready at /), error => {
    assert.match(error.message, /deadline exceeded \(15000 ms\)/);
    assert.match(error.message, /"exitCode":null/);
    assert.match(error.message, /\[REDACTED\]/);
    assert.match(error.message, /\[PATH\]/);
    assert.doesNotMatch(error.message, /fixture-secret|Users|private/);
    return true;
  });
  t.mock.timers.tick(15000);
  await rejection;
});

test("an exited child rejects readiness immediately instead of waiting for its deadline", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = fakeChild(), observed = observeProcess(child);
  const rejection = assert.rejects(observed.readyMessage("videogen:ready"), /child exited before readiness.*"exitCode":7/);
  child.exitCode = 7; child.emit("exit", 7, null);
  await rejection;
  // A stale deadline must not leave another pending observer callback.
  t.mock.timers.tick(15000);
});

test("close observation retains final output and UTF-8 split across chunks", async () => {
  const child = fakeChild(), observed = observeProcess(child);
  let settled = false;
  const waiting = observed.waitForClose().then(() => { settled = true; });
  child.exitCode = 0; child.emit("exit", 0, null);
  await Promise.resolve(); assert.equal(settled, false);
  const text = Buffer.from("日本語 complete\n");
  child.stdout.write(text.subarray(0, 2)); child.stdout.write(text.subarray(2));
  child.emit("close", 0, null);
  await waiting;
  assert.equal(observed.stdout, "日本語 complete\n");
  assert.equal(JSON.parse(observed.diagnostics()).closed, true);
});

test("a received IPC readiness signal cannot be lost before the waiter attaches", async () => {
  const child = fakeChild(), observed = observeProcess(child);
  child.emit("message", { type: "videogen:ready" });
  await observed.readyMessage("videogen:ready");
});

test("cleanup deadline retains the original failure when child pipes never close", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = fakeChild(), observed = observeProcess(child);
  const primaryError = new Error("original readiness failure");
  const rejection = assert.rejects(observed.cleanup({ timeoutMs: 100, primaryError }), error => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors[0], primaryError);
    assert.match(error.errors[1].message, /deadline exceeded \(100 ms\)/);
    assert.match(error.message, /cleanup failed/);
    return true;
  });
  t.mock.timers.tick(100);
  await rejection;
  assert.equal(child.signalCode, "SIGKILL");
});
