// Run: node --test tests/homemap.test.js
// The full base map (homemap.js) checked by an independent validator written from the game's rules only
// (tests/homemap.validate.js): open land, no overlap, climate plots under their own device only, one power
// network, counts equal to the plan, Storage Units at the RV's maximum.
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../data.js");
const P = require("../planner.js");
const M = require("../homemap.js");
const { validate } = require("./homemap.validate.js");
const { planSetup } = require("../tools/run-setup.js");

const S = require("./fixtures/setup-rv12.json");
const mapOf = async (setup) => {
  const plan = await planSetup(setup);
  assert.equal(plan.status, "optimal");
  return { plan, map: M.buildMap(D, plan, { roster: P.roster(P.released(D, setup.unreleased), plan, false) }) };
};
const check = (map, plan, name) => {
  const v = validate(map, plan, D);
  assert.deepEqual(v.errors, [], name);
  assert.deepEqual(map.unplaced, [], name + ": everything placed");
  assert.deepEqual(map.unpowered, [], name + ": every E-mode machine powered");
};

test("land: plot n opens at RV n, 4 x 4 plots of 20 x 15", () => {
  assert.deepEqual(M.landPlots(1).map((p) => p.n), [1]);
  assert.equal(M.landPlots(12).length, 12);
  assert.equal(M.landPlots(20).length, 16);
  const one = M.landPlots(1)[0];
  assert.deepEqual([one.x, one.y, one.w, one.h], [40, 45, 20, 15]);    // bottom row, second from the right
});

test("real setups give valid maps (RV 12 and the same layout at RV 7, 16 and 20; devices off; power off)", async () => {
  const variants = [["rv12", S], ["rv7", Object.assign({}, S, { rv: 7 })], ["rv16", Object.assign({}, S, { rv: 16 })], ["rv20", Object.assign({}, S, { rv: 20 })],
    ["devices off", Object.assign({}, S, { devices: false })], ["power off", Object.assign({}, S, { power: false })]];
  for (const [name, setup] of variants) {
    const { plan, map } = await mapOf(setup);
    check(map, plan, name);
  }
});

test("the map never changes the plan's numbers", async () => {
  const plan = await planSetup(S);
  const before = JSON.stringify(plan);
  M.buildMap(D, plan, { roster: P.roster(P.released(D, S.unreleased), plan, false) });
  assert.equal(JSON.stringify(plan), before);
});

// code review 2026-10-09: two generators were placed apart (two networks) and the machines split between them,
// while the plan counts every generator as one network
const crop = (fac, rid, n, zone) => ({ facility: fac, recipeId: rid, count: n, kind: "crop", zone: zone || null, benches: null, cyclesPerHour: n * 0.5, cropJobs: {} });
const bench = (fac, rid, n, kind) => ({ facility: fac, recipeId: rid, count: n, kind: kind || "bench", zone: null, benches: n, cyclesPerHour: n * 2, worker: "x" });
const COCONUT = 4020044, MINE = 4001052;
test("several generators form one network", () => {
  for (const [rv, gens, mines] of [[16, 2, 6], [16, 3, 11], [18, 3, 13]]) {
    const plan = { inputs: { rv }, devices: [], power: { generators: gens }, lines: [crop("Woodland", COCONUT, 36), bench("Mine", MINE, mines, "electric")] };
    const map = M.buildMap(D, plan, {});
    check(map, plan, `RV ${rv}, ${gens} generators, ${mines} Mines`);
    const net = M.linked(map.items);
    assert.equal(net.filter((it) => it.type === "generator").length, gens, "all generators linked");
  }
});

test("plots a device cannot hold are reported, not dropped", () => {
  const STRAW = 4020057;
  const plan = { inputs: { rv: 12 }, devices: [{ facility: "Heat Furnace", setting: "Warm +1", place: 1 }], lines: [crop("Farmland", STRAW, 28, "Heat Furnace (Warm +1)")] };
  const map = M.buildMap(D, plan, {});
  const lost = map.unplaced.filter((u) => u.reason === "device").reduce((a, u) => a + u.count, 0);
  assert.equal(lost, 4, "24 fit around one device, 4 are reported");
});
