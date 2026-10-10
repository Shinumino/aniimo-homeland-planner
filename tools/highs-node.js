// Loads the vendored HiGHS (vendor/highs.js + highs-wasm.js) under Node, the way planner-worker.js does in the
// browser. The scripts expect browser globals, so they run in their own context; `performance` must be there
// or every solve fails with "performance is not defined".
const fs = require("fs"), path = require("path"), vm = require("vm");

module.exports = async function loadHighs() {
  const root = path.join(__dirname, "..");
  const ctx = { window: {}, atob, WebAssembly, console, setTimeout, clearTimeout, Uint8Array, Promise, TextDecoder, performance };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ["vendor/highs.js", "vendor/highs-wasm.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
  const b64 = ctx.HIGHS_WASM_B64 || ctx.window.HIGHS_WASM_B64, Module = ctx.Module || ctx.window.Module;
  const bin = Uint8Array.from(Buffer.from(b64, "base64"));
  return Module({ instantiateWasm: (imports, done) => { WebAssembly.instantiate(bin, imports).then((r) => done(r.instance)); return {}; } });
};
