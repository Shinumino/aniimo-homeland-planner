// Run: node --test tests/layout.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../layout.js");
const D = require("../data.js");
const { planSetup } = require("../tools/run-setup.js");

// planner.js PACK: with e Woodland-equivalents (Woodland + 5x5 pens), this much Farmland fits around one device
const MAX_F = [24, 23, 22, 21, 20, 18, 16, 14, 12];
// squares that count as inside the area (tools/pack-patterns.js): 1x1 device -4..4, 2x2 device -3..4
const INSIDE = { 1: [-4, 5], 2: [-3, 5] };

function squares(x, y, size) {
  const out = [];
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) out.push([x + i, y + j]);
  return out;
}

// every plot: off the device, no overlap, at least one whole square inside the area
function checkArrangement(s, plots) {
  const [lo, hi] = INSIDE[s];
  const used = new Set();
  for (const p of plots) {
    const sq = squares(p.x, p.y, p.size);
    assert.ok(sq.some(([x, y]) => x >= lo && x < hi && y >= lo && y < hi), `plot at ${p.x},${p.y} has no square inside`);
    for (const [x, y] of sq) {
      assert.ok(!(x >= 0 && x < s && y >= 0 && y < s), `plot at ${p.x},${p.y} is on the device`);
      assert.ok(!used.has(x + "," + y), `plots overlap at ${x},${y}`);
      used.add(x + "," + y);
    }
  }
}

test("patterns reach the planner's packing limits and are valid", () => {
  for (const s of [1, 2]) {
    assert.equal(L.PATTERNS[s].length, 3, "0..2 pens");
    L.PATTERNS[s].forEach((byK, p) => {
      assert.equal(byK.length, 9 - p, `size ${s}, ${p} pens: Woodland 0..${8 - p}`);
      byK.forEach((q, k) => {
        assert.equal(q.P.length, p);
        assert.equal(q.W.length, k);
        assert.equal(q.F.length, MAX_F[p + k], `size ${s}, ${p} pens, ${k} Woodland: Farmland count`);
        checkArrangement(s, q.P.map(([x, y]) => ({ x, y, size: 5 }))
          .concat(q.W.map(([x, y]) => ({ x, y, size: 4 })), q.F.map(([x, y]) => ({ x, y, size: 2 }))));
      });
    });
  }
});

test("split holds exactly what the planner allows for n devices", () => {
  for (const device of ["Heat Furnace", "Cooling Unit"]) {
    for (let n = 1; n <= 3; n++) {
      for (let pens = 0; pens <= 2; pens++) {
        for (let w = 0; w <= 8 * n + 1; w++) {
          for (let f = 0; f <= 24 * n + 1; f++) {
            // planner.js PACK for n devices, a pen as one Woodland; at most 2 pens per device (PATTERNS)
            const e = w + pens, fits = e <= 8 * n && e + f <= 24 * n && 2 * e + f <= 28 * n && pens <= 2 * n;
            const sp = L.split(device, n, w, f, pens);
            const drawn = sp.overflowFarmland === 0 && sp.overflowWoodland === 0 && sp.overflowPens === 0;
            assert.equal(drawn, fits, `${device} n=${n} pens=${pens} w=${w} f=${f}`);
          }
        }
      }
    }
  }
});

test("draws every plot of a real plan where it counts, and its Hammock under Cool -1", async () => {
  const S = require("./fixtures/setup-rv12.json");
  const TEMP = { "Warm +1": 1, "Scorching +2": 2, "Cool -1": -1, "Cold -2": -2 };
  for (const variant of [S, Object.assign({}, S, { fastRv: false }), Object.assign({}, S, { power: false })]) {
    const p = await planSetup(variant);
    assert.equal(p.status, "optimal");
    const drawn = L.deviceLayouts(p, D);
    assert.ok(drawn.length > 0, "the plan places devices");
    for (const d of drawn) {
      assert.equal(d.overflow.length, 0, `${d.facility} (${d.setting}) left plots out`);
      assert.ok(!d.approx);
      checkArrangement(d.size, d.plots);
      // a pen only in the area of a device with exactly its recipe's temperature
      for (const q of d.plots.filter((q) => L.PENS.includes(q.facility))) {
        assert.equal(D.recipes.find((r) => r.id === q.recipeId).temp, TEMP[d.setting], `${q.facility} under ${d.setting}`);
      }
    }
    // per crop and device setting, the drawing has as many plots as the plan
    for (const l of p.lines.filter((l) => l.kind === "crop" && l.zone)) {
      const n = drawn.filter((d) => d.facility + " (" + d.setting + ")" === l.zone)
        .reduce((a, d) => a + d.plots.filter((q) => q.recipeId === l.recipeId && q.facility === l.facility).length, 0);
      assert.equal(n, Math.round(l.count), `${l.facility} ${l.makes} under ${l.zone}`);
    }
    // the plan runs a Hammock and places a Cooling Unit on Cool -1: the Hammock is drawn in its area
    const star = p.lines.find((l) => l.facility === "Starfall Hammock");
    if (star && drawn.some((d) => d.setting === "Cool -1")) {
      const inArea = drawn.filter((d) => d.setting === "Cool -1").reduce((a, d) => a + d.plots.filter((q) => q.facility === "Starfall Hammock").length, 0);
      const left = drawn.filter((d) => d.setting === "Cool -1").reduce((a, d) => a + d.pensLeft.reduce((b, x) => b + x.count, 0), 0);
      assert.equal(inArea + left, Math.round(star.benches != null ? star.benches : star.count), "every Hammock drawn or listed");
      assert.ok(inArea >= 1, "the Hammock fits beside the RV 12 plots");
    }
  }
});

test("a pen that does not fit beside the plan's plots is listed, never drawn over them", () => {
  const star = D.recipes.find((r) => r.fac.some(([f]) => f === "Starfall Hammock")).id;
  const rose = D.recipes.find((r) => r.k === "production" && r.fac.some(([f]) => f === "Farmland")).id;
  const plan = { devices: [{ facility: "Cooling Unit", setting: "Cool -1", place: 1 }],
    lines: [{ facility: "Farmland", kind: "crop", zone: "Cooling Unit (Cool -1)", recipeId: rose, count: 24 },
            { facility: "Starfall Hammock", kind: "dedicated", zone: null, recipeId: star, count: 1, benches: 1 }] };
  const [d] = L.deviceLayouts(plan, D);
  assert.equal(d.plots.filter((q) => q.facility === "Farmland").length, 24);
  assert.equal(d.plots.filter((q) => q.facility === "Starfall Hammock").length, 0);
  assert.deepEqual(d.pensLeft.map((x) => [x.facility, x.count]), [["Starfall Hammock", 1]]);
  // with 23 Farmland it fits
  plan.lines[0].count = 23;
  const [e] = L.deviceLayouts(plan, D);
  assert.equal(e.plots.filter((q) => q.facility === "Starfall Hammock").length, 1);
  assert.equal(e.pensLeft.length, 0);
  checkArrangement(2, e.plots);
});
