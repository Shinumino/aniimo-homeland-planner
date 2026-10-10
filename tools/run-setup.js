// Plans a saved setup file (the page's "Save setup to file") under Node, the way the page does it:
// index.html run() builds the planner inputs, planner-worker.js solves them with HiGHS.
// Run: node tools/run-setup.js <setup.json>
const fs = require("fs"), path = require("path");
const loadHighs = require("./highs-node.js");
const D = require("../data.js");
const P = require("../planner.js");

const BY_HAND = ["Aniipod Maker", "Dance Pad Polisher"];

// index.html run(): the "fastest upgrade" tick plans for the goal level (blank = the next RV), `keep` is not
// sent, and benches ticked under "made by hand" leave the coin plan
function pageInputs(S) {
  const goal = S.rvGoal && S.rvGoal.level !== "" && S.rvGoal.level != null ? Number(S.rvGoal.level) : Math.min(20, Number(S.rv) + 1);
  const inp = Object.assign({}, S, { homeAniimo: S.homeAniimo === "" ? null : S.homeAniimo,
    workerMaxLevel: Number(S.workerMaxLevel) || 3, fastRv: S.fastRv ? goal : null });
  const recipe = (id) => D.recipes.find((r) => r.id === id);
  const byHandFac = (r) => BY_HAND.find((f) => r.fac.some(([g]) => g === f));
  const pods = (S.aniipods || []).filter((id) => { const r = recipe(id); return r && byHandFac(r); });
  const facs = {};
  for (const [n, f] of Object.entries(S.facilities || {})) if (f.count > 0) facs[n] = f;
  inp.byHandLevels = Object.fromEntries(BY_HAND.filter((f) => (S.facilities || {})[f]).map((f) => [f, S.facilities[f].level]));
  for (const f of BY_HAND) {
    const n = pods.filter((id) => byHandFac(recipe(id)) === f).length;
    if (!n || !facs[f]) continue;
    if (facs[f].count - n > 0) facs[f] = Object.assign({}, facs[f], { count: facs[f].count - n }); else delete facs[f];
  }
  inp.facilities = facs; inp.keep = {}; inp.byHand = pods;
  return inp;
}

let ready = null;
async function planSetup(S) {
  if (!ready) ready = loadHighs().then((h) => { P.useSolver(h); globalThis.__highsTimeLimit = 30; });
  await ready;
  return P.plan(D, pageInputs(S));
}

module.exports = { pageInputs, planSetup };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node tools/run-setup.js <setup.json>"); process.exit(2); }
  const S = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const t = Date.now();
  planSetup(S).then((p) => {
    const name = (i) => (D.items[i] ? D.items[i].n : i);
    console.log("status:", p.status, p.capped ? "(time cap hit)" : "", "|", ((Date.now() - t) / 1000).toFixed(1), "s");
    console.log("coin/h:", Math.round(p.coinPerHour));
    for (const l of p.lines || []) {
      const r = D.recipes.find((x) => x.id === l.recipeId);
      console.log(" ", l.facility.padEnd(22), String(+(l.benches ?? l.count).toFixed(2)).padStart(5), "x",
        r.out.map(([i, q]) => q + " " + name(i)).join(" + "), l.zone ? "[" + l.zone + "]" : "");
    }
    if ((p.warnings || []).length) console.log("warnings:", p.warnings.join(" | "));
  }).catch((e) => { console.error(e); process.exit(1); });
}
