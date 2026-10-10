// Full base map: every facility the plan uses, placed on the open land plots of the production zone.
//
// Pure functions, no DOM, like planner.js and layout.js. Drawing only: the plan's numbers do not change (user,
// 2026-10-09: "only the layout, no change to coin/h or production"). The placement keeps the game's rules
// (nothing overlaps, everything on open land, each climate plot under its own device only, E-mode machines
// on the power network) and then shortens walking: an Aniimo walks 3 tiles a second in a straight line, a
// part-time Aniimo walks between the facilities of its jobs, and haulers carry output to the nearest Storage
// Unit. What is drawn is one good arrangement, not the only one.
//
// Coordinates: tiles, x = 0..80 left to right, y = 0..60 top to bottom (the 4 x 4 plots of 20 x 15).
(function (root) {
  const Layout = typeof module !== "undefined" ? require("./layout.js") : root.Layout;

  // Size in tiles, w x h (game data; the same at every level)
  const SIZE = {
    Farmland: [2, 2], Woodland: [4, 4], Mine: [5, 5], Well: [2, 2], "Nimbus Bed": [5, 5], "Dewy House": [2, 2],
    "Starfall Hammock": [5, 5], "Tidewhisper Sandcastle": [5, 5], "Floral Windmill": [5, 5], "Carousel Mill": [5.5, 5.5],
    "Crafting Table": [4, 4], "Jukebox Dryer": [2.5, 2.5], "Claw Game Cooker": [3.5, 3.5], "Joy Wheel Loom": [4, 4],
    "Phonolfactory Table": [3.5, 3.5], "Bouncy Brew Keg": [3, 3], "Simmering Pot": [1.5, 1.5], "Blazing Stove": [2.5, 1.75],
    "Woodworking Bench": [2, 1.5], "Chimney Kiln": [5.5, 5.5], "Pickling Jar": [2.5, 2], "Aniipod Maker": [4.5, 4.5],
    "Dance Pad Polisher": [2.5, 2.5], "Crackle Power Pole": [1.5, 1.5], "Crackle Generator": [2, 2], "Heat Furnace": [1, 1],
    "Cooling Unit": [2, 2], Sunlamp: [1, 1], Hatchinator: [2, 2], "Storage Unit": [2, 2],
  };
  // Land: 16 plots of 20 x 15; plot n opens at RV n (plot 1 from the start), each after the one before it
  const PLOT_W = 20, PLOT_H = 15;
  const PLOT_GRID = [[13, 14, 15, 16], [12, 7, 8, 9], [11, 4, 3, 6], [10, 2, 1, 5]];   // rows top to bottom
  const STORAGE_MAX = [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 8];     // by RV 1..20
  const poleMax = (rv) => (rv >= 20 ? 30 : rv >= 18 ? 24 : rv >= 16 ? 18 : rv >= 14 ? 12 : rv >= 12 ? 6 : 0);
  const AREA = { device: 9, "Crackle Generator": 11, "Crackle Power Pole": 7 };
  const WALK_SPEED = 3;                            // tiles per second, every Aniimo, straight line
  const HAUL_PER_TRIP = 60;                        // items a level-1 hauler carries (80/100/120 at levels 2-4)
  const TO_BAG = ["Aniipod Maker", "Dance Pad Polisher"];   // their output goes straight to the bag: no hauling
  const DEVICES = ["Heat Furnace", "Cooling Unit", "Sunlamp"];
  // things a device area changes (temperature / light): they must sit under their own device only
  const CLIMATE = new Set(["Farmland", "Woodland", "Starfall Hammock", "Tidewhisper Sandcastle", "Floral Windmill"]);

  // ---- occupancy on a half-tile grid (every size is a multiple of 0.5 but the Blazing Stove's 1.75: rounded up)
  const HG = 2, GW = 80 * HG, GH = 60 * HG;
  function Layer() {
    const a = new Int32Array(GW * GH), p = new Int32Array((GW + 1) * (GH + 1));
    let dirty = true;
    const cells = (r) => [Math.round(r.x * HG), Math.round(r.y * HG), Math.ceil(r.w * HG - 1e-9), Math.ceil(r.h * HG - 1e-9)];
    return {
      add(r, v) {
        const [x0, y0, w, h] = cells(r);
        for (let y = Math.max(0, y0); y < Math.min(GH, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(GW, x0 + w); x++) a[y * GW + x] += v;
        dirty = true;
      },
      sum(r) {                                     // cells outside the zone count as 1 each
        if (dirty) {
          for (let y = 0; y < GH; y++) { let row = 0; for (let x = 0; x < GW; x++) { row += a[y * GW + x]; p[(y + 1) * (GW + 1) + x + 1] = p[y * (GW + 1) + x + 1] + row; } }
          dirty = false;
        }
        let [x0, y0, w, h] = cells(r), out = 0;
        const x1 = Math.min(GW, x0 + w), y1 = Math.min(GH, y0 + h);
        if (x0 < 0 || y0 < 0 || x0 + w > GW || y0 + h > GH) out += 1;
        x0 = Math.max(0, x0); y0 = Math.max(0, y0);
        if (x1 <= x0 || y1 <= y0) return out;
        return out + p[y1 * (GW + 1) + x1] - p[y0 * (GW + 1) + x1] - p[y1 * (GW + 1) + x0] + p[y0 * (GW + 1) + x0];
      },
      inside(r) {                                  // the same, but the outside of the zone counts as empty
        const [x0, y0, w, h] = cells(r);
        const cx = Math.max(0, x0), cy = Math.max(0, y0), cw = Math.min(GW, x0 + w) - cx, ch = Math.min(GH, y0 + h) - cy;
        return cw > 0 && ch > 0 ? this.sum({ x: cx / HG, y: cy / HG, w: cw / HG, h: ch / HG }) : 0;
      },
    };
  }

  function landPlots(rv) {
    const open = Math.max(1, Math.min(16, Number(rv) || 1));
    const out = [];
    PLOT_GRID.forEach((row, r) => row.forEach((n, c) => { if (n <= open) out.push({ n, x: c * PLOT_W, y: r * PLOT_H, w: PLOT_W, h: PLOT_H }); }));
    return out.sort((a, b) => a.n - b.n);
  }

  const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const overlaps = (a, b) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
  const areaAround = (r, size) => { const [cx, cy] = centre(r); return { x: cx - size / 2, y: cy - size / 2, w: size, h: size }; };

  // Which facilities each part-time Aniimo walks between: the roster's jobs, matched to the facilities that
  // need them (the page's jobFacilities). A full-time Aniimo (one job, whole) never walks.
  function relations(plan, roster) {
    const jobFac = {};
    const add = (job, fac) => { if (job && fac) (jobFac[job] = jobFac[job] || new Set()).add(fac); };
    for (const l of plan.lines || []) {
      if (l.kind === "crop") for (const k of Object.keys(l.cropJobs || {})) add(k, l.facility);
      else if (l.kind !== "electric") add(l.worker, l.facility);
    }
    for (const d of plan.devices || []) add(d.worker, d.facility);
    if (plan.power && plan.power.generators) add(plan.power.worker, "Crackle Generator");
    for (const h of plan.byHand || []) add(h.worker, h.facility);
    const w = new Map();                           // "a|b" -> weight
    for (const m of (roster && roster.members) || []) {
      const facs = new Set();
      for (const j of m.jobs || []) for (const f of jobFac[j.job] || []) facs.add(f);
      const list = [...facs];
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i++) for (let k = i + 1; k < list.length; k++) {
        for (const key of [list[i] + "|" + list[k], list[k] + "|" + list[i]]) w.set(key, (w.get(key) || 0) + (m.count || 1));
      }
    }
    return w;
  }

  // Items per hour leaving one facility (or plot) for the store: what haulers carry
  function outPerHour(l, n) {
    if (!n || TO_BAG.includes(l.facility)) return 0;
    const r = l._recipe;
    const items = r ? r.out.reduce((a, [, q]) => a + q, 0) : 0;
    return (l.cyclesPerHour || 0) * items / n;
  }

  // Units to place: rigid blocks (a device with its plots, a crop's open plots) and single facilities
  function units(D, plan) {
    const out = [];
    const recipe = (id) => D.recipes.find((r) => r.id === id);
    const lines = (plan.lines || []).map((l) => Object.assign({}, l, { _recipe: recipe(l.recipeId) }));
    // device areas, as layout.js draws them (plots and climate pens)
    const cards = Layout.deviceLayouts(plan, D);
    const drawnPens = new Map(), overflow = [];
    cards.forEach((c, g) => {
      for (const o of c.overflow) overflow.push({ facility: o.facility, recipeId: o.recipeId, count: o.count, reason: "device" });
      const members = [{ type: "device", facility: c.facility, setting: c.setting, x: 0, y: 0, w: c.size, h: c.size }];
      for (const q of c.plots) {
        const pen = !["Farmland", "Woodland"].includes(q.facility);
        members.push({ type: pen ? "pen" : "plot", facility: q.facility, recipeId: q.recipeId, x: q.x, y: q.y, w: q.size, h: q.size });
        if (pen) drawnPens.set(q.facility + "|" + q.recipeId, (drawnPens.get(q.facility + "|" + q.recipeId) || 0) + 1);
      }
      const area = { x: c.area.x, y: c.area.y, w: c.area.size, h: c.area.size };
      out.push({ kind: "block", group: "g" + (g + 1), members, area, step: 1 });
    });
    // haul per member, from the lines
    const perPlot = new Map();                     // "fac|recipe|zone" -> items/h per plot
    for (const l of lines) if (l.kind === "crop") perPlot.set(l.facility + "|" + l.recipeId + "|" + (l.zone || ""), outPerHour(l, Math.round(l.count)));
    for (const u of out) {
      const zone = u.members[0].facility + " (" + u.members[0].setting + ")";
      for (const m of u.members) {
        if (m.type === "plot") m.haul = perPlot.get(m.facility + "|" + m.recipeId + "|" + zone) || 0;
        if (m.type === "pen") {                    // its share of the pen line's output
          const l = lines.find((x) => x.facility === m.facility && x.recipeId === m.recipeId && x.kind !== "crop");
          if (l) m.haul = outPerHour(l, Math.round(l.benches != null ? l.benches : Math.ceil(l.count - 1e-6)));
        }
      }
    }
    // open plots: one compact block per crop
    for (const l of lines) {
      if (l.kind !== "crop" || l.zone) continue;
      const n = Math.round(l.count);
      if (n <= 0) continue;
      const s = SIZE[l.facility][0], cols = Math.ceil(Math.sqrt(n)), members = [];
      for (let k = 0; k < n; k++) members.push({ type: "plot", facility: l.facility, recipeId: l.recipeId, x: (k % cols) * s, y: Math.floor(k / cols) * s, w: s, h: s, haul: outPerHour(l, n) });
      out.push({ kind: "block", members, step: 1, split: true });
    }
    // every other facility the plan sets, one unit per machine
    for (const l of lines) {
      if (l.kind === "crop") continue;
      let n = Math.round(l.benches != null ? l.benches : Math.ceil(l.count - 1e-6));
      const key = l.facility + "|" + l.recipeId;
      const drawn = Math.min(n, drawnPens.get(key) || 0);
      if (drawn) drawnPens.set(key, (drawnPens.get(key) || 0) - drawn);
      n -= drawn;
      const sz = SIZE[l.facility] || [2, 2];
      for (let k = 0; k < n; k++) {
        out.push({ kind: "single", type: Layout.PENS.includes(l.facility) ? "pen" : "facility", facility: l.facility, recipeId: l.recipeId,
          w: sz[0], h: sz[1], electric: l.kind === "electric", haul: outPerHour(l, n + drawn) });
      }
    }
    for (const h of plan.byHand || []) {
      const sz = SIZE[h.facility] || [2, 2];
      out.push({ kind: "single", type: "facility", facility: h.facility, recipeId: h.recipeId, w: sz[0], h: sz[1], electric: h.mode === "E-mode", haul: 0 });
    }
    out.overflow = overflow;
    return out;
  }

  function buildMap(D, plan, opts) {
    opts = opts || {};
    const rv = Number((plan && plan.inputs && plan.inputs.rv) || opts.rv || 1);
    const plots = landPlots(rv);
    const land = Layer(), occ = Layer(), ban = Layer(), climate = Layer();
    land.add({ x: 0, y: 0, w: 80, h: 60 }, 1);
    for (const p of plots) land.add(p, -1);      // land.sum(rect) == 0: the whole rect is on open plots
    const anchor = plots.reduce((a, p) => [a[0] + (p.x + p.w / 2) / plots.length, a[1] + (p.y + p.h / 2) / plots.length], [0, 0]);
    const rel = relations(plan, opts.roster);
    const items = [], unplaced = [], storages = [];
    let nextId = 0;

    const isClimate = (it) => CLIMATE.has(it.facility) && (it.type === "plot" || it.type === "pen" || it.facility === "Floral Windmill");
    const mark = (it, v) => { occ.add(it, v); if (isClimate(it)) climate.add(it, v); if (it.type === "device") ban.add(it.area, v); };
    const put = (it) => {
      // the occupancy grid is in half tiles: a spot off it would let two things overlap unseen
      if (Math.abs(it.x * HG - Math.round(it.x * HG)) > 1e-9 || Math.abs(it.y * HG - Math.round(it.y * HG)) > 1e-9) throw new Error("off-grid spot for " + it.facility);
      it.id = "i" + nextId++; items.push(it); mark(it, 1); return it;
    };
    const fits = (r, climateItem) => land.sum(r) === 0 && occ.sum(r) === 0 && (!climateItem || ban.inside(r) === 0);
    const nearestStore = (c) => storages.reduce((b, s) => Math.min(b, dist(c, centre(s))), Infinity);
    const powered = (r, areas) => areas.some((a) => overlaps(r, a));
    const networkAreas = () => linked(items).map((it) => it.area);
    const sameCount = new Map();

    // what a unit's position costs: walking to the facilities it shares a part-time Aniimo with, hauling to the
    // nearest store, being off the power network, and a small pull to the middle of the land (keeps it compact)
    const context = (u, skip) => {
      const facs = u.kind === "block" ? [...new Set(u.members.map((m) => m.facility))] : [u.facility];
      const near = [];
      for (const it of items) {
        if (it === skip) continue;
        let w = 0;
        for (const f of facs) w += rel.get(f + "|" + it.facility) || 0;
        if (w) near.push([centre(it), w / Math.max(1, sameCount.get(it.facility) || 1)]);
      }
      const haul = u.kind === "block" ? u.members.reduce((a, m) => a + (m.haul || 0), 0) : u.haul || 0;
      return { near, haul, areas: u.electric ? networkAreas() : null };
    };
    const costAt = (ctx, c, r) => {
      let cost = 0.02 * dist(c, anchor);
      for (const [p, w] of ctx.near) cost += w * dist(c, p);
      if (ctx.haul && storages.length) cost += 2 * ctx.haul / HAUL_PER_TRIP * nearestStore(c);
      if (ctx.areas && !powered(r, ctx.areas)) cost += 1e6;
      return cost;
    };
    // best free spot for a unit, scanning the open land at its step; a single may turn 90 degrees
    const bestSpot = (u, stepOverride) => {
      const ctx = context(u);
      const step = stepOverride || u.step || 0.5;
      let best = null;
      if (u.kind === "block") {
        const x0 = Math.min(...u.members.map((m) => m.x)), y0 = Math.min(...u.members.map((m) => m.y));
        const bw = Math.max(...u.members.map((m) => m.x + m.w)) - x0, bh = Math.max(...u.members.map((m) => m.y + m.h)) - y0;
        for (let y = 0; y + bh <= 60; y += step) for (let x = 0; x + bw <= 80; x += step) {
          const ox = x - x0, oy = y - y0;
          if (land.sum({ x, y, w: bw, h: bh }) > 0 && !u.area) continue;   // a block without gaps must sit on land
          if (u.area && climate.inside({ x: ox + u.area.x, y: oy + u.area.y, w: u.area.w, h: u.area.h }) !== 0) continue;
          let ok = true;
          for (const m of u.members) {
            const r = { x: ox + m.x, y: oy + m.y, w: m.w, h: m.h };
            if (land.sum(r) !== 0 || occ.sum(r) !== 0 || (m.type !== "device" && ban.inside(r) !== 0)) { ok = false; break; }
          }
          if (!ok) continue;
          const cost = costAt(ctx, [x + bw / 2, y + bh / 2], null);
          if (!best || cost < best.cost - 1e-9) best = { cost, ox, oy };
        }
        return best;
      }
      const shapes = u.w !== u.h ? [[u.w, u.h], [u.h, u.w]] : [[u.w, u.h]];
      for (const [w, h] of shapes) for (let y = 0; y + h <= 60; y += step) for (let x = 0; x + w <= 80; x += step) {
        const r = { x, y, w, h };
        if (!fits(r, isClimate(u))) continue;
        const cost = costAt(ctx, centre(r), r);
        if (!best || cost < best.cost - 1e-9) best = { cost, x, y, w, h };
      }
      return best;
    };
    const placeBlock = (u, spot) => {
      for (const m of u.members) {
        const it = { type: m.type, facility: m.facility, x: spot.ox + m.x, y: spot.oy + m.y, w: m.w, h: m.h };
        if (m.recipeId != null) it.recipeId = m.recipeId;
        if (u.group) it.group = u.group;
        if (m.setting) it.setting = m.setting;
        if (m.haul) it.haul = m.haul;
        if (m.type === "device") it.area = areaAround(it, AREA.device);
        put(it);
      }
    };
    const placeSingle = (u, spot) => {
      const it = { type: u.type, facility: u.facility, x: spot.x, y: spot.y, w: spot.w, h: spot.h };
      if (u.recipeId != null) it.recipeId = u.recipeId;
      if (u.electric) it.electric = true;
      if (u.haul) it.haul = u.haul;
      if (AREA[u.facility]) it.area = areaAround(it, AREA[u.facility]);
      return put(it);
    };

    const all = units(D, plan);
    const footprint = (u) => (u.kind === "block" ? u.members.reduce((a, m) => a + m.w * m.h, 0) + (u.area ? 40 : 0) : u.w * u.h);
    const blocks = all.filter((u) => u.kind === "block").sort((a, b) => (b.area ? 1 : 0) - (a.area ? 1 : 0) || footprint(b) - footprint(a));
    for (const o of all.overflow || []) unplaced.push(o);      // plots a device area could not hold (layout.js)
    const singles = all.filter((u) => u.kind === "single");

    // 1. device areas with their plots, then the open crops (a crop that does not fit as one block goes plot by plot)
    for (const u of blocks) {
      const spot = bestSpot(u);
      if (spot) placeBlock(u, spot);
      else if (u.split) for (const m of u.members) singles.push({ kind: "single", type: "plot", facility: m.facility, recipeId: m.recipeId, w: m.w, h: m.h, haul: m.haul, step: 1 });
      else unplaced.push(u);
    }
    // how many of each facility pull on a walker: a 36-plot crop pulls like one facility, not 36
    for (const u of singles) sameCount.set(u.facility, (sameCount.get(u.facility) || 0) + 1);
    for (const it of items) sameCount.set(it.facility, (sameCount.get(it.facility) || 0) + 1);
    // 2. the generators (E-mode machines must reach their network), then the E-mode machines, then the rest, big first
    const needPower = singles.some((u) => u.electric);
    const gens = Math.max(needPower ? 1 : 0, Number(plan.power && plan.power.generators) || 0);
    // The plan sizes the generators for the whole draw, so they must form ONE network (an overloaded one slows
    // every machine on it): the first goes where it is best, every next one where its area overlaps the network.
    for (let k = 0; k < gens; k++) {
      const u = { kind: "single", type: "generator", facility: "Crackle Generator", w: 2, h: 2, haul: 0 };
      let spot = null;
      if (k === 0) spot = bestSpot(u);
      else {
        const net = networkAreas(), ctx = context(u);
        for (let y = 0; y + 2 <= 60; y += 0.5) for (let x = 0; x + 2 <= 80; x += 0.5) {
          const r = { x, y, w: 2, h: 2 };
          if (!fits(r, false) || !net.some((a) => overlaps(areaAround(r, AREA["Crackle Generator"]), a))) continue;
          const cost = costAt(ctx, centre(r), r);
          if (!spot || cost < spot.cost) spot = { cost, x, y, w: 2, h: 2 };
        }
      }
      if (spot) placeSingle(u, spot); else unplaced.push(Object.assign(u, { reason: "power" }));
    }
    // An E-mode machine with no powered spot left gets a pole and its spot chosen together: every free pole
    // spot linked to the network, and for each one the machine's best spot touching that pole's area.
    let poles = 0;
    const withPole = (u) => {
      if (poles >= poleMax(rv)) return null;
      const ctx = Object.assign(context(u), { areas: null });
      const net = networkAreas();
      const pw = 1.5, pa = AREA["Crackle Power Pole"];
      let best = null;
      for (let py = 0; py + pw <= 60; py += 1) for (let px = 0; px + pw <= 80; px += 1) {
        const pr = { x: px, y: py, w: pw, h: pw };
        if (!fits(pr, false)) continue;
        const a = areaAround(pr, pa);
        if (!net.some((b) => overlaps(a, b))) continue;
        for (const [w, h] of u.w !== u.h ? [[u.w, u.h], [u.h, u.w]] : [[u.w, u.h]]) {
          // on the half-tile grid like every other spot (the pole's area sits on quarter tiles)
          const sy = Math.max(0, Math.floor((a.y - h) * 2) / 2), sx = Math.max(0, Math.floor((a.x - w) * 2) / 2);
          for (let y = sy; y < a.y + a.h && y + h <= 60; y += 0.5) for (let x = sx; x < a.x + a.w && x + w <= 80; x += 0.5) {
            const r = { x, y, w, h };
            if (!overlaps(r, a) || overlaps(r, pr) || !fits(r, false)) continue;
            const cost = costAt(ctx, centre(r), r);
            if (!best || cost < best.cost) best = { cost, pole: { x: px, y: py, w: pw, h: pw }, spot: { x, y, w, h } };
          }
        }
      }
      if (!best) return null;
      placeSingle({ type: "pole", facility: "Crackle Power Pole" }, best.pole);
      poles++;
      return best.spot;
    };
    const order = singles.slice().sort((a, b) => (b.electric ? 1 : 0) - (a.electric ? 1 : 0) || b.w * b.h - a.w * a.h);
    for (const u of order) {
      let spot = bestSpot(u);
      if (u.electric && (!spot || spot.cost >= 1e6)) spot = withPole(u) || spot;
      if (spot) u.item = placeSingle(u, spot); else unplaced.push(u);
    }
    // 3. the Storage Units, one at a time where they shorten hauling most
    const maxStore = STORAGE_MAX[Math.min(20, Math.max(1, rv)) - 1];
    for (let k = 0; k < maxStore; k++) {
      const hauled = items.filter((it) => it.haul).map((it) => [centre(it), it.haul, nearestStore(centre(it))]);
      let best = null;
      for (let y = 0; y + 2 <= 60; y += 1) for (let x = 0; x + 2 <= 80; x += 1) {
        const r = { x, y, w: 2, h: 2 };
        if (!fits(r, false)) continue;
        const c = centre(r);
        let cost = 0.001 * dist(c, anchor);
        for (const [p, h, d] of hauled) cost += h * Math.min(d, dist(p, c));
        if (!best || cost < best.cost) best = { cost, x, y };
      }
      if (!best) break;
      storages.push(put({ type: "storage", facility: "Storage Unit", x: best.x, y: best.y, w: 2, h: 2 }));
    }
    // 4. moving each single facility to its best spot, now that the rest and the stores are down
    for (let round = 0; round < (opts.fast ? 1 : 2); round++) {
      for (const u of order) {
        const it = u.item;
        if (!it) continue;
        mark(it, -1);
        items.splice(items.indexOf(it), 1);
        const before = costAt(context(u), centre(it), it);
        const spot = bestSpot(u, 1);
        if (spot && spot.cost < before - 1e-6) {
          Object.assign(it, { x: spot.x, y: spot.y, w: spot.w, h: spot.h });
          if (it.area) it.area = areaAround(it, AREA[it.facility]);
        }
        items.push(it);
        mark(it, 1);
      }
    }
    // 4b. each store again, now that the facilities moved (measured: 8-16% less hauling at RV 12-16)
    const placeStore = () => {
      const hauled = items.filter((it) => it.haul).map((it) => [centre(it), it.haul, nearestStore(centre(it))]);
      let best = null;
      for (let y = 0; y + 2 <= 60; y += 1) for (let x = 0; x + 2 <= 80; x += 1) {
        const r = { x, y, w: 2, h: 2 };
        if (!fits(r, false)) continue;
        const c = centre(r);
        let cost = 0.001 * dist(c, anchor);
        for (const [p, h, d] of hauled) cost += h * Math.min(d, dist(p, c));
        if (!best || cost < best.cost) best = { cost, x, y };
      }
      return best;
    };
    for (let round = 0; round < (opts.fast ? 0 : 2); round++) {
      for (const st of storages.slice()) {
        mark(st, -1);
        items.splice(items.indexOf(st), 1);
        storages.splice(storages.indexOf(st), 1);
        const best = placeStore();
        if (best) Object.assign(st, { x: best.x, y: best.y });
        items.push(st); storages.push(st); mark(st, 1);
      }
    }
    // 4c. swap two facilities of the same size when that shortens walking (same footprint: the grid stays valid;
    // the same climate kind: no pen lands in a device area; E-mode machines keep power through the cost)
    if (!opts.fast) {
      const movable = order.filter((u) => u.item);
      for (let i = 0; i < movable.length; i++) for (let k = i + 1; k < movable.length; k++) {
        const a = movable[i], b = movable[k], A = a.item, B = b.item;
        if (A.w !== B.w || A.h !== B.h || isClimate(A) !== isClimate(B) || A.facility === B.facility) continue;
        const ca = context(a, B), cb = context(b, A);
        const now = costAt(ca, centre(A), A) + costAt(cb, centre(B), B);
        const then = costAt(ca, centre(B), B) + costAt(cb, centre(A), A);
        if (then >= now - 1e-6) continue;
        const ax = A.x, ay = A.y;
        Object.assign(A, { x: B.x, y: B.y }); Object.assign(B, { x: ax, y: ay });
        for (const it of [A, B]) if (it.area) it.area = areaAround(it, AREA[it.facility]);
      }
    }
    // 5. power poles for any E-mode machine still off the network, each linked to the network
    for (let guard = 0; guard < 60 && poles < poleMax(rv); guard++) {
      const areas = networkAreas();
      const off = items.filter((it) => it.electric && !powered(it, areas));
      if (!off.length) break;
      let best = null;
      for (let y = 0; y + 1.5 <= 60; y += 0.5) for (let x = 0; x + 1.5 <= 80; x += 0.5) {
        const r = { x, y, w: 1.5, h: 1.5 };
        if (!fits(r, false)) continue;
        const a = areaAround(r, AREA["Crackle Power Pole"]);
        if (!areas.some((b) => overlaps(a, b))) continue;
        const reach = off.filter((it) => overlaps(it, a)).length;
        const cost = -1000 * reach + Math.min(...off.map((it) => dist(centre(r), centre(it))));
        if (!best || cost < best.cost) best = { cost, x, y };
      }
      if (!best) break;
      placeSingle({ type: "pole", facility: "Crackle Power Pole" }, { x: best.x, y: best.y, w: 1.5, h: 1.5 });
      poles++;
    }
    const areas = networkAreas();
    const unpowered = items.filter((it) => it.electric && !powered(it, areas)).map((it) => it.id);
    // informative: tiles and minutes a level-1 hauler walks per hour (to the nearest store and back)
    const haulTiles = storages.length ? items.reduce((a, it) => a + (it.haul ? 2 * it.haul / HAUL_PER_TRIP * nearestStore(centre(it)) : 0), 0) : 0;
    return { rv, plots, items, unplaced, unpowered,
      walk: { haulMinPerHour: storages.length ? haulTiles / WALK_SPEED / 60 : null, haulTilesPerHour: haulTiles, speed: WALK_SPEED, perTrip: HAUL_PER_TRIP } };
  }

  // ONE network: the first generator and every generator or pole whose area overlaps it, chained. A generator
  // standing alone is a second network and powers nothing here (the plan counts all generators as one).
  function linked(items) {
    const first = items.find((it) => it.type === "generator");
    if (!first) return [];
    const net = [first];
    const rest = items.filter((it) => (it.type === "generator" || it.type === "pole") && it !== first);
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of rest) if (!net.includes(p) && net.some((n) => overlaps(n.area, p.area))) { net.push(p); grew = true; }
    }
    return net;
  }

  const api = { SIZE, PLOT_GRID, STORAGE_MAX, poleMax, landPlots, buildMap, linked, WALK_SPEED, HAUL_PER_TRIP };
  if (typeof module !== "undefined") module.exports = api; else root.HomeMap = api;
})(this);
