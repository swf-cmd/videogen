const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "../..");
const filename = path.join(root, "src/providers/retry.js");

function loadLegacyServer(overrides = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const context = vm.createContext({
    require: createRequire(filename),
    module: { exports: {} },
    Date,
    setTimeout,
    ...overrides,
  });
  vm.runInContext(source, context, { filename });
  return {
    ...require("../../src/media/image"),
    ...require("../../src/files/output"),
    ...require("../../src/http/handlers/prompts"),
    ...require("../../src/http/router"),
    ...context.module.exports,
  };
}

module.exports = { loadLegacyServer, root };
