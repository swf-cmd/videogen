// No new CLI flags, HTTP imports or modern syntax: even an old Node can explain
// the supported version range before the main app is loaded.
var version = process.versions.node.split(".").map(Number);
var supported = version[0] === 22 && version[1] >= 21 || version[0] === 24 && version[1] >= 5 || version[0] > 24;
if (!supported) {
  console.error("Unsupported Node.js " + process.versions.node + ". Install Node 22.21+ (22.x) or 24.5+, or use the portable bundle. Node 23 is unsupported.");
  process.exitCode = 1;
}
