"use strict";
// Independent validator for the base-map generator (homemap.js buildMap(D, plan, opts) result).
// Written from the map spec only, without looking at the generator, so it can catch its mistakes.
//
//   const { validate, haulDistance } = require("./homemap.validate.js");
//   const { ok, errors, warnings, stats } = validate(map, plan, D);
//
// Every error string starts with a tag naming the check: [map] [plots] [item] [outside] [size] [overlap]
// [device-area] [count] [power] [storage]. Warnings ([warn-...]) do not make ok false.
// Run this file directly (node tests/homemap.validate.js) for a self-test on hand-made maps.

const EPS = 1e-6;

// Footprints from the spec (w x h tiles; rotation may swap them).
const SIZE = {
  "Farmland": [2, 2], "Woodland": [4, 4], "Mine": [5, 5], "Well": [2, 2], "Nimbus Bed": [5, 5], "Dewy House": [2, 2],
  "Starfall Hammock": [5, 5], "Tidewhisper Sandcastle": [5, 5], "Floral Windmill": [5, 5], "Carousel Mill": [5.5, 5.5],
  "Crafting Table": [4, 4], "Jukebox Dryer": [2.5, 2.5], "Claw Game Cooker": [3.5, 3.5], "Joy Wheel Loom": [4, 4],
  "Phonolfactory Table": [3.5, 3.5], "Bouncy Brew Keg": [3, 3], "Simmering Pot": [1.5, 1.5], "Blazing Stove": [2.5, 1.75],
  "Woodworking Bench": [2, 1.5], "Chimney Kiln": [5.5, 5.5], "Pickling Jar": [2.5, 2], "Aniipod Maker": [4.5, 4.5],
  "Dance Pad Polisher": [2.5, 2.5], "Crackle Power Pole": [1.5, 1.5], "Crackle Generator": [2, 2], "Heat Furnace": [1, 1],
  "Cooling Unit": [2, 2], "Sunlamp": [1, 1], "Hatchinator": [2, 2], "Storage Unit": [2, 2],
};

const ZONE_W = 80, ZONE_H = 60, PLOT_W = 20, PLOT_H = 15;
// Plot numbers on the 4x4 grid, rows top to bottom.
const GRID = [[13, 14, 15, 16], [12, 7, 8, 9], [11, 4, 3, 6], [10, 2, 1, 5]];
const STORAGE_MAX = [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 8];   // RV 1..20
const DEVICE_FACS = new Set(["Heat Furnace", "Cooling Unit", "Sunlamp"]);
const PLOT_FACS = new Set(["Farmland", "Woodland"]);
const NO_HAUL = new Set(["Aniipod Maker", "Dance Pad Polisher"]);
const TYPES = new Set(["device", "plot", "pen", "facility", "generator", "pole", "storage"]);
const AREA = { device: 9, generator: 11, pole: 7 };

function poleMax(rv) {
  if (rv >= 20) return 30;
  if (rv >= 18) return 24;
  if (rv >= 16) return 18;
  if (rv >= 14) return 12;
  if (rv >= 12) return 6;
  return 0;
}
function storageMax(rv) { return STORAGE_MAX[Math.max(1, Math.min(20, rv)) - 1]; }

// Expected plot rectangle for plot n (map coords).
function plotRect(n) {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (GRID[r][c] === n) return { x: c * PLOT_W, y: r * PLOT_H, w: PLOT_W, h: PLOT_H };
  return null;
}

const num = (v) => typeof v === "number" && Number.isFinite(v);
const near = (a, b) => Math.abs(a - b) < EPS;
const rectOk = (r) => r && num(r.x) && num(r.y) && num(r.w) && num(r.h) && r.w > 0 && r.h > 0;
// Strict (positive-area) overlap; touching edges do not count.
function overlaps(a, b) {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
}
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const isClimate = (it) => it.type === "plot" || it.type === "pen" || it.facility === "Floral Windmill";
const fmt = (v) => Math.round(v * 1000) / 1000;

// Sum over hauled facilities (type "facility" or "pen", except Aniipod Maker / Dance Pad Polisher) of the
// straight-line distance from its centre to the nearest Storage Unit centre. null if something must be hauled
// but the map has no Storage Unit.
function haulDistance(map) {
  const items = (map && map.items) || [];
  const stores = items.filter((it) => it.type === "storage" && rectOk(it)).map(centre);
  const hauled = items.filter((it) => (it.type === "facility" || it.type === "pen") && !NO_HAUL.has(it.facility) && rectOk(it));
  if (!hauled.length) return 0;
  if (!stores.length) return null;
  let sum = 0;
  for (const it of hauled) {
    const c = centre(it);
    sum += Math.min(...stores.map((s) => Math.hypot(s.x - c.x, s.y - c.y)));
  }
  return sum;
}

function validate(map, plan, D) {
  const errors = [], warnings = [];
  const err = (tag, msg) => errors.push("[" + tag + "] " + msg);
  const warn = (tag, msg) => warnings.push("[warn-" + tag + "] " + msg);
  const stats = { byType: {}, byFacility: {}, haulDistance: null, deviceSettingMissing: false, poweredItems: 0,
    electricItems: 0, generators: 0, poles: 0, storage: 0, openPlots: 0 };

  if (!map || typeof map !== "object") { err("map", "map is not an object"); return { ok: false, errors, warnings, stats }; }
  const rv = map.rv;
  if (!Number.isInteger(rv) || rv < 1 || rv > 20) err("map", "map.rv must be an integer 1..20, got " + JSON.stringify(rv));
  const rvN = Number.isInteger(rv) ? Math.max(1, Math.min(20, rv)) : 1;
  const openN = Math.min(rvN, 16);
  stats.openPlots = openN;
  plan = plan || {};

  // ---- 1. plots -------------------------------------------------------------------------------------------
  const plots = Array.isArray(map.plots) ? map.plots : [];
  if (!Array.isArray(map.plots)) err("plots", "map.plots is not an array");
  const seenPlot = new Map();
  for (const p of plots) {
    if (!p || !Number.isInteger(p.n)) { err("plots", "plot without an integer n: " + JSON.stringify(p)); continue; }
    if (seenPlot.has(p.n)) err("plots", "plot " + p.n + " listed twice");
    seenPlot.set(p.n, p);
    if (p.n < 1 || p.n > openN) { err("plots", "plot " + p.n + " is listed but not unlocked at RV " + rv + " (open: 1.." + openN + ")"); continue; }
    const e = plotRect(p.n);
    if (!near(p.x, e.x) || !near(p.y, e.y) || !near(p.w, e.w) || !near(p.h, e.h))
      err("plots", "plot " + p.n + " at x " + p.x + ", y " + p.y + ", " + p.w + "x" + p.h + "; expected x " + e.x + ", y " + e.y + ", 20x15");
  }
  for (let n = 1; n <= openN; n++) if (!seenPlot.has(n)) err("plots", "plot " + n + " is unlocked at RV " + rv + " but missing");
  // which grid cells are open (from the spec, not from map.plots, so a wrong plot list cannot widen the land)
  const openCell = GRID.map((row) => row.map((n) => n <= openN));

  // ---- items: basic shape ------------------------------------------------------------------------------------
  const items = Array.isArray(map.items) ? map.items : [];
  if (!Array.isArray(map.items)) err("map", "map.items is not an array");
  const ids = new Set();
  const good = [];                                   // items with a usable rectangle
  for (const it of items) {
    const id = it && it.id;
    if (!it || typeof it !== "object") { err("item", "non-object item " + JSON.stringify(it)); continue; }
    if (id == null || ids.has(id)) err("item", "item id " + JSON.stringify(id) + " missing or duplicated (" + it.facility + ")");
    ids.add(id);
    if (!TYPES.has(it.type)) err("item", id + " has unknown type " + JSON.stringify(it.type));
    stats.byType[it.type] = (stats.byType[it.type] || 0) + 1;
    stats.byFacility[it.facility] = (stats.byFacility[it.facility] || 0) + 1;
    if (!rectOk(it)) { err("item", id + " (" + it.facility + ") has no valid x/y/w/h"); continue; }
    // type <-> facility consistency
    const fac = it.facility;
    if (it.type === "device" && !DEVICE_FACS.has(fac)) err("item", id + " is a device but facility is " + fac);
    if (it.type === "plot" && !PLOT_FACS.has(fac)) err("item", id + " is a plot but facility is " + fac);
    if (it.type === "generator" && fac !== "Crackle Generator") err("item", id + " is a generator but facility is " + fac);
    if (it.type === "pole" && fac !== "Crackle Power Pole") err("item", id + " is a pole but facility is " + fac);
    if (it.type === "storage" && fac !== "Storage Unit") err("item", id + " is storage but facility is " + fac);
    if ((it.type === "facility" || it.type === "pen") && (DEVICE_FACS.has(fac) || PLOT_FACS.has(fac) || fac === "Crackle Generator"
      || fac === "Crackle Power Pole" || fac === "Storage Unit")) err("item", id + " (" + fac + ") has type " + it.type);
    if (it.type === "plot" && it.recipeId == null) err("item", id + " (" + fac + ") is a plot without recipeId");
    if (it.electric && it.type !== "facility") err("item", id + " (" + fac + ") has electric:true but type " + it.type);
    // ---- 2. footprint size ----
    const s = SIZE[fac];
    if (!s) err("size", id + ": unknown facility " + JSON.stringify(fac));
    else if (!((near(it.w, s[0]) && near(it.h, s[1])) || (near(it.w, s[1]) && near(it.h, s[0]))))
      err("size", id + " (" + fac + ") is " + it.w + "x" + it.h + ", expected " + s[0] + "x" + s[1]);
    good.push(it);
  }

  // ---- 2. inside open land ---------------------------------------------------------------------------------
  for (const it of good) {
    if (it.x < -EPS || it.y < -EPS || it.x + it.w > ZONE_W + EPS || it.y + it.h > ZONE_H + EPS) {
      err("outside", it.id + " (" + it.facility + ") at " + fmt(it.x) + "," + fmt(it.y) + " leaves the 80x60 production zone");
      continue;
    }
    const closed = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      if (openCell[r][c]) continue;
      if (overlaps(it, { x: c * PLOT_W, y: r * PLOT_H, w: PLOT_W, h: PLOT_H })) closed.push(GRID[r][c]);
    }
    if (closed.length) err("outside", it.id + " (" + it.facility + ") at " + fmt(it.x) + "," + fmt(it.y) + " lies on locked plot(s) " + closed.join(", "));
  }

  // ---- 3. no overlaps ----------------------------------------------------------------------------------------
  for (let i = 0; i < good.length; i++) for (let j = i + 1; j < good.length; j++) {
    const a = good[i], b = good[j];
    if (overlaps(a, b)) err("overlap", a.id + " (" + a.facility + ") overlaps " + b.id + " (" + b.facility + ")");
  }

  // ---- area rectangles (devices, generators, poles) ----------------------------------------------------------
  const areaOk = (it) => {
    const size = AREA[it.type];
    if (!size) return false;
    const c = centre(it), a = it.area;
    if (!rectOk(a)) { err(it.type === "device" ? "device-area" : "power", it.id + " (" + it.facility + ") has no valid area"); return false; }
    if (!near(a.w, size) || !near(a.h, size) || !near(a.x, c.x - size / 2) || !near(a.y, c.y - size / 2)) {
      err(it.type === "device" ? "device-area" : "power", it.id + " (" + it.facility + ") area is " + fmt(a.x) + "," + fmt(a.y) + " " + a.w + "x" + a.h
        + "; expected " + size + "x" + size + " centred at " + fmt(c.x) + "," + fmt(c.y) + " (x " + fmt(c.x - size / 2) + ", y " + fmt(c.y - size / 2) + ")");
    }
    return true;
  };

  // ---- 4. device areas ---------------------------------------------------------------------------------------
  const devices = good.filter((it) => it.type === "device");
  const devArea = new Map();                         // id -> area (spec-computed, so a wrong area field cannot hide a problem)
  for (const d of devices) {
    areaOk(d);
    const c = centre(d);
    devArea.set(d.id, { x: c.x - 4.5, y: c.y - 4.5, w: 9, h: 9 });
    if (d.group == null) err("device-area", d.id + " (" + d.facility + ") has no group");
    if (d.setting == null) stats.deviceSettingMissing = true;
  }
  // devices of one group must share facility + setting (one zone per group)
  const groupDevs = new Map();
  for (const d of devices) if (d.group != null) {
    if (!groupDevs.has(d.group)) groupDevs.set(d.group, []);
    groupDevs.get(d.group).push(d);
  }
  const groupZone = new Map();                       // group -> zone key
  const devZone = (d) => (d.setting != null ? d.facility + " (" + d.setting + ")" : d.facility);
  for (const [g, ds] of groupDevs) {
    const zs = [...new Set(ds.map(devZone))];
    if (zs.length > 1) err("device-area", "group " + g + " mixes devices " + zs.join(" / ") + " (" + ds.map((d) => d.id).join(", ") + ")");
    groupZone.set(g, zs[0]);
  }
  const climate = good.filter(isClimate);
  const groupHasClimate = new Set();
  for (const it of climate) {
    const under = devices.filter((d) => overlaps(it, devArea.get(d.id)));
    if (it.group != null) {
      if (!groupDevs.has(it.group)) { err("device-area", it.id + " (" + it.facility + ") has group " + it.group + " but no device has that group"); continue; }
      if (it.type === "plot" || it.type === "pen") groupHasClimate.add(it.group);
      if (!under.some((d) => d.group === it.group))
        err("device-area", it.id + " (" + it.facility + ") is in group " + it.group + " but under none of its devices (" + groupDevs.get(it.group).map((d) => d.id).join(", ") + ")");
      const foreign = under.filter((d) => d.group !== it.group);
      if (foreign.length) err("device-area", it.id + " (" + it.facility + ", group " + it.group + ") is also under foreign device(s) " + foreign.map((d) => d.id + " (group " + d.group + ")").join(", "));
    } else if (under.length) {
      err("device-area", it.id + " (" + it.facility + ", no group) is under device(s) " + under.map((d) => d.id).join(", "));
    }
  }
  for (const [g, ds] of groupDevs) if (!groupHasClimate.has(g))
    err("device-area", "group " + g + " (devices " + ds.map((d) => d.id).join(", ") + ") has no plot or pen");
  for (const it of good) if (it.group != null && !isClimate(it) && it.type !== "device")
    warn("group", it.id + " (" + it.facility + ", type " + it.type + ") carries a group but is not a climate item");

  // ---- 5. counts vs plan --------------------------------------------------------------------------------------
  // Zone key of an item: its group's zone ("Facility (Setting)", or "Facility" when devices lack setting).
  const itemZone = (it) => (it.group != null && groupZone.has(it.group) ? groupZone.get(it.group) : null);
  const lineZone = (z) => {
    if (z == null) return null;
    if (!stats.deviceSettingMissing) return z;
    const m = /^(.+) \((.+)\)$/.exec(z);
    return m ? m[1] : z;
  };
  const lines = Array.isArray(plan.lines) ? plan.lines : [];
  // crops: key facility|recipeId|zone
  const cropKey = (fac, rid, zone) => fac + "|" + rid + "|" + (zone == null ? "-" : zone);
  const want = new Map(), have = new Map(), haveIds = new Map();
  const bump = (m, k, n) => m.set(k, (m.get(k) || 0) + n);
  for (const l of lines) if (l.kind === "crop") bump(want, cropKey(l.facility, l.recipeId, lineZone(l.zone)), Math.round(l.count));
  for (const it of good) if (it.type === "plot") {
    const k = cropKey(it.facility, it.recipeId, itemZone(it));
    bump(have, k, 1);
    if (!haveIds.has(k)) haveIds.set(k, []);
    haveIds.get(k).push(it.id);
  }
  const describeKey = (k) => { const [f, r, z] = k.split("|"); return f + " recipe " + r + (z === "-" ? " (no device)" : " in " + z); };
  for (const k of new Set([...want.keys(), ...have.keys()])) {
    const w = want.get(k) || 0, h = have.get(k) || 0;
    if (w !== h) err("count", describeKey(k) + ": plan wants " + w + " plot(s), map has " + h + (h ? " (" + haveIds.get(k).join(", ") + ")" : ""));
  }
  // non-crop: key facility|recipeId|electric|zone ; benches, or Math.round(count) when benches is null
  const ncKey = (fac, rid, el, zone) => fac + "|" + rid + "|" + (el ? "E" : "-") + "|" + (zone == null ? "-" : zone);
  const ncWant = new Map(), ncHave = new Map(), ncIds = new Map();
  for (const l of lines) if (l.kind !== "crop")
    bump(ncWant, ncKey(l.facility, l.recipeId, l.kind === "electric", lineZone(l.zone)), l.benches != null ? l.benches : Math.round(l.count));
  // A climate pen the plan runs with no device (zone null) may be DRAWN under a device whose temperature is
  // exactly its recipe's (user, 2026-10-09: the Hammock goes under Cool -1 in the drawing, the numbers stay):
  // it counts for the no-device line. Under any other temperature it stays a mismatch.
  const TEMP = { "Warm +1": 1, "Scorching +2": 2, "Cool -1": -1, "Cold -2": -2 };
  const penZone = (it) => {
    const z = itemZone(it);
    if (it.type !== "pen" || z == null) return z;
    const m = /\((.+)\)$/.exec(z), rec = D && D.recipes.find((x) => x.id === it.recipeId);
    const lineHasZone = lines.some((l) => l.facility === it.facility && l.recipeId === it.recipeId && l.zone);
    return m && rec && rec.temp != null && TEMP[m[1]] === rec.temp && !lineHasZone ? null : z;
  };
  for (const it of good) if (it.type === "facility" || it.type === "pen") {
    const k = ncKey(it.facility, it.recipeId, !!it.electric, penZone(it));
    bump(ncHave, k, 1);
    if (!ncIds.has(k)) ncIds.set(k, []);
    ncIds.get(k).push(it.id);
  }
  const describeNc = (k) => { const [f, r, e, z] = k.split("|"); return f + " recipe " + r + (e === "E" ? " (E-mode)" : "") + (z === "-" ? "" : " in " + z); };
  const planned = new Set(lines.filter((l) => l.kind !== "crop").map((l) => l.facility + "|" + l.recipeId));
  for (const k of new Set([...ncWant.keys(), ...ncHave.keys()])) {
    const w = ncWant.get(k) || 0, h = ncHave.get(k) || 0;
    if (w === h) continue;
    const [f, r] = k.split("|");
    const msg = describeNc(k) + ": plan wants " + w + ", map has " + h + (h ? " (" + ncIds.get(k).join(", ") + ")" : "");
    // an item whose facility+recipe is in no line at all (e.g. a hand-ticked facility) is only a warning
    if (w === 0 && !planned.has(f + "|" + r)) warn("unplanned", msg);
    else err("count", msg);
  }
  // devices per zone = place
  const devWant = new Map(), devHave = new Map();
  for (const d of Array.isArray(plan.devices) ? plan.devices : [])
    bump(devWant, stats.deviceSettingMissing ? d.facility : d.facility + " (" + d.setting + ")", d.place || 0);
  for (const d of devices) bump(devHave, devZone(d), 1);
  for (const k of new Set([...devWant.keys(), ...devHave.keys()])) {
    const w = devWant.get(k) || 0, h = devHave.get(k) || 0;
    if (w !== h) err("count", "devices " + k + ": plan places " + w + ", map has " + h);
  }

  // ---- 6. power -----------------------------------------------------------------------------------------------
  const gens = good.filter((it) => it.type === "generator");
  const poles = good.filter((it) => it.type === "pole");
  stats.generators = gens.length; stats.poles = poles.length;
  const nodes = gens.concat(poles);
  const nodeArea = new Map();
  for (const n of nodes) {
    areaOk(n);
    const c = centre(n), s = AREA[n.type];
    nodeArea.set(n.id, { x: c.x - s / 2, y: c.y - s / 2, w: s, h: s });
  }
  // ONE network, grown from the first generator: the plan sizes all generators for the whole draw, so a generator
  // on its own (a second network) would leave the first one overloaded (code review, 2026-10-09)
  const linked = new Set(gens.length ? [gens[0].id] : []);
  const queue = gens.slice(0, 1);
  while (queue.length) {
    const a = queue.shift();
    for (const b of nodes) if (!linked.has(b.id) && overlaps(nodeArea.get(a.id), nodeArea.get(b.id))) { linked.add(b.id); queue.push(b); }
  }
  for (const g of gens) if (!linked.has(g.id)) err("power", "generator " + g.id + " is not on the same network as generator " + gens[0].id);
  for (const p of poles) if (!linked.has(p.id)) err("power", "pole " + p.id + " is not linked to any generator");
  const electric = good.filter((it) => it.electric);
  stats.electricItems = electric.length;
  if (electric.length && !gens.length) err("power", electric.length + " E-mode item(s) but no Crackle Generator");
  for (const it of electric) {
    const by = nodes.filter((n) => linked.has(n.id) && overlaps(it, nodeArea.get(n.id)));
    if (by.length) stats.poweredItems++;
    else err("power", it.id + " (" + it.facility + ", E-mode) is not powered: its footprint is in no linked generator/pole area");
  }
  if (poles.length > poleMax(rvN)) err("power", poles.length + " poles; RV " + rv + " allows " + poleMax(rvN));
  const planGen = plan.power && num(plan.power.generators) ? plan.power.generators : null;
  if (planGen != null && gens.length > planGen) err("power", gens.length + " generators; plan has " + planGen);

  // ---- 7. storage ---------------------------------------------------------------------------------------------
  const stores = good.filter((it) => it.type === "storage");
  stats.storage = stores.length;
  if (stores.length !== storageMax(rvN)) err("storage", stores.length + " Storage Unit(s); RV " + rv + " allows (and the map should use) " + storageMax(rvN));

  // ---- game caps from data.js (warnings: the plan, not the generator, decides these counts) ----------------
  if (D && D.facilities) for (const [fac, n] of Object.entries(stats.byFacility)) {
    const f = D.facilities[fac];
    const cap = f && Array.isArray(f.maxCount) ? f.maxCount[rvN - 1] : null;
    if (num(cap) && n > cap) warn("cap", n + " " + fac + "; data.js maxCount at RV " + rv + " is " + cap);
  }

  // ---- 8. stats -----------------------------------------------------------------------------------------------
  stats.haulDistance = haulDistance(map);
  stats.items = items.length;
  stats.groups = groupDevs.size;
  return { ok: errors.length === 0, errors, warnings, stats };
}

module.exports = { validate, haulDistance, SIZE, plotRect, poleMax, storageMax, overlaps };

// ---- self-test ----------------------------------------------------------------------------------------------------
if (require.main === module) {
  const path = require("path");
  let D = null;
  try { D = require(path.join(__dirname, "..", "data.js")); } catch (e) { console.log("(data.js not loaded: " + e.message + ")"); }

  // RV 12: plots 1..12 open, 4 Storage Units, up to 6 poles. Everything is drawn on plot 1 (x 40..60, y 45..60)
  // and plot 3 above it (x 40..60, y 30..45).
  const ROSE = 1, WHEAT = 2, PLANK = 3, STAR = 4;
  const area = (x, y, w, h, s) => ({ x: x + w / 2 - s / 2, y: y + h / 2 - s / 2, w: s, h: s });
  const plotsFor = (rv) => Array.from({ length: Math.min(rv, 16) }, (_, k) => Object.assign({ n: k + 1 }, plotRect(k + 1)));
  const validMap = () => ({
    rv: 12,
    plots: plotsFor(12),
    items: [
      { id: "cu1", type: "device", facility: "Cooling Unit", setting: "Cool -1", x: 44, y: 48, w: 2, h: 2, group: "g1", area: area(44, 48, 2, 2, 9) },
      { id: "f1", type: "plot", facility: "Farmland", recipeId: ROSE, x: 40, y: 46, w: 2, h: 2, group: "g1" },
      { id: "f2", type: "plot", facility: "Farmland", recipeId: ROSE, x: 42, y: 46, w: 2, h: 2, group: "g1" },
      { id: "f3", type: "plot", facility: "Farmland", recipeId: ROSE, x: 40, y: 51, w: 2, h: 2, group: "g1" },
      { id: "pen1", type: "pen", facility: "Starfall Hammock", recipeId: STAR, x: 46, y: 50, w: 5, h: 5, group: "g1" },
      { id: "w1", type: "plot", facility: "Farmland", recipeId: WHEAT, x: 52, y: 56, w: 2, h: 2 },
      { id: "w2", type: "plot", facility: "Farmland", recipeId: WHEAT, x: 54, y: 56, w: 2, h: 2 },
      { id: "s1", type: "storage", facility: "Storage Unit", x: 56, y: 46, w: 2, h: 2 },
      { id: "s2", type: "storage", facility: "Storage Unit", x: 58, y: 46, w: 2, h: 2 },
      { id: "s3", type: "storage", facility: "Storage Unit", x: 56, y: 48, w: 2, h: 2 },
      { id: "s4", type: "storage", facility: "Storage Unit", x: 58, y: 48, w: 2, h: 2 },
      { id: "ct1", type: "facility", facility: "Crafting Table", recipeId: PLANK, x: 40, y: 55, w: 4, h: 4 },
      { id: "ct2", type: "facility", facility: "Crafting Table", recipeId: PLANK, electric: true, x: 52, y: 50, w: 4, h: 4 },
      { id: "gen1", type: "generator", facility: "Crackle Generator", x: 52, y: 46, w: 2, h: 2, area: area(52, 46, 2, 2, 11) },
      { id: "pole1", type: "pole", facility: "Crackle Power Pole", x: 44, y: 42, w: 1.5, h: 1.5, area: area(44, 42, 1.5, 1.5, 7) },
    ],
    walk: {},
  });
  const plan = {
    lines: [
      { facility: "Farmland", kind: "crop", zone: "Cooling Unit (Cool -1)", recipeId: ROSE, count: 3.2, benches: null },
      { facility: "Farmland", kind: "crop", zone: null, recipeId: WHEAT, count: 1.6, benches: null },
      { facility: "Starfall Hammock", kind: "dedicated", zone: "Cooling Unit (Cool -1)", recipeId: STAR, count: 1, benches: 1 },
      { facility: "Crafting Table", kind: "bench", zone: null, recipeId: PLANK, count: 0.4, benches: 1 },
      { facility: "Crafting Table", kind: "electric", zone: null, recipeId: PLANK, count: 1, benches: 1 },
    ],
    devices: [{ facility: "Cooling Unit", setting: "Cool -1", place: 1 }],
    power: { generators: 1 },
    inputs: { rv: 12 },
  };
  const find = (m, id) => m.items.find((it) => it.id === id);
  const cases = [
    { name: "valid map", mutate: () => {}, expect: null },
    { name: "overlap (w2 moved onto w1)", mutate: (m) => { find(m, "w2").x = 53; }, expect: "[overlap] w1" },
    { name: "outside land (ct1 on locked plot 13)", mutate: (m) => { Object.assign(find(m, "ct1"), { x: 2, y: 2 }); }, expect: "[outside] ct1" },
    { name: "unpowered machine (ct2 moved out of reach)", mutate: (m) => { Object.assign(find(m, "ct2"), { x: 44, y: 55 }); },
      expect: "[power] ct2" },
    { name: "plot under a foreign device", mutate: (m) => {
        m.items.push({ id: "hf1", type: "device", facility: "Heat Furnace", setting: "Warm +1", x: 41, y: 49, w: 1, h: 1, group: "g2", area: area(41, 49, 1, 1, 9) });
      }, expect: "foreign device(s) hf1" },
    { name: "groupless plot under a device", mutate: (m) => { Object.assign(find(m, "w1"), { x: 42, y: 43 }); }, expect: "[device-area] w1" },
    { name: "count off (one Rose plot missing)", mutate: (m) => { m.items = m.items.filter((it) => it.id !== "f3"); }, expect: "[count] Farmland recipe 1" },
    { name: "wrong footprint (Well drawn 3x3)", mutate: (m) => { m.items.push({ id: "wl", type: "facility", facility: "Well", recipeId: 9, x: 70, y: 46, w: 3, h: 3 }); },
      expect: "[size] wl" },
    { name: "pole not linked", mutate: (m) => { Object.assign(find(m, "pole1"), { x: 30, y: 31, area: area(30, 31, 1.5, 1.5, 7) }); }, expect: "[power] pole pole1" },
    { name: "wrong storage count", mutate: (m) => { m.items = m.items.filter((it) => it.id !== "s4"); }, expect: "[storage]" },
    { name: "missing plot / wrong plot position", mutate: (m) => { m.plots = m.plots.filter((p) => p.n !== 12); m.plots[0].x = 0; }, expect: "[plots] plot 12" },
  ];
  let failed = 0;
  for (const c of cases) {
    const m = validMap();
    c.mutate(m);
    const r = validate(m, plan, D);
    const pass = c.expect == null ? r.ok : !r.ok && r.errors.some((e) => e.includes(c.expect));
    if (!pass) failed++;
    console.log((pass ? "PASS " : "FAIL ") + c.name + (c.expect == null ? " -> ok=" + r.ok + ", haul " + fmt(r.stats.haulDistance) : " -> caught"));
    for (const e of r.errors) console.log("       " + e);
    for (const w of r.warnings) console.log("       " + w);
  }
  console.log(failed ? failed + " self-test case(s) FAILED" : "all " + cases.length + " self-test cases passed");
  process.exitCode = failed ? 1 : 0;
}
