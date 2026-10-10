// Planner in a background thread (user, 2026-10-02: "I don't care if it takes some time to load, just don't
// freeze the browser or make the tab stop responding"). On the page's own thread, RV 20 held the tab for 11.8 s
// and then 6 s more for the best case, and still stopped HiGHS at 4 s with a plan up to 13,000 coin/h short of
// the best (cross-model audit round 2). Here the page stays usable, so HiGHS gets 30 s: RV 16-20 finish in 6-10 s.
//
// Messages: { id, kind: "plan" | "best" | "map", inputs, prismana } -> { id, ok, result } or { id, ok: false, error }.
// The page falls back to planning on its own thread when a Worker cannot start (opened from file://).
self.window = self;                                // data.js and highs-wasm.js set window.*
self.__highsTimeLimit = 30;                        // read by planner.js solveHighs (globalThis.__highsTimeLimit)
// lp.js before planner.js: planner.js takes the built-in solver (root.LP) when it loads; without it a HiGHS that
// cannot start here gave "No plan" instead of falling back (Gemini Flash + ChatGPT, round 3 re-audit)
importScripts("data.js", "lp.js", "planner.js", "layout.js", "homemap.js", "vendor/highs.js", "vendor/highs-wasm.js");
const D = self.ANIIMO_DATA, P = self.Planner;
const ready = new Promise((resolve, reject) => {
  const bin = Uint8Array.from(atob(self.HIGHS_WASM_B64), (c) => c.charCodeAt(0));
  Promise.resolve(self.Module({ instantiateWasm: (imports, done) => {
    WebAssembly.instantiate(bin, imports).then((r) => done(r.instance), reject); return {}; } })).then(resolve, reject);
}).then((h) => P.useSolver(h), () => P.useSolver(null));
self.onmessage = (e) => {
  const { id, kind, inputs, prismana } = e.data;
  ready.then(() => {
    try {
      // "map": the base map of a plan already made (homemap.js), placed off the page's thread like the plans
      const result = kind === "best" ? P.bestCase(D, inputs, prismana)
        : kind === "map" ? self.HomeMap.buildMap(D, inputs.plan, { roster: P.roster(P.released(D, inputs.unreleased), inputs.plan, prismana) })
        : P.plan(D, inputs);
      self.postMessage({ id, ok: true, result });
    } catch (err) {
      self.postMessage({ id, ok: false, error: String(err && err.message || err) });
    }
  });
};
