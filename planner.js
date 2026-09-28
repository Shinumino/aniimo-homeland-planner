// Homeland planner engine: user inputs + game data -> the plan with the most Home Coin per hour.
//
// Pure functions, no DOM: the page calls plan() on every input change, and tests run it under Node.
// Every rule here was either read from the game code or confirmed on the user's screen; the source is
// named next to each one. Anything the user can know better than the data is an input, not a constant.
//
// Model (a linear program, solved by lp.js):
//   x[r@f]   how many facilities of type f run recipe r all the time (fractional: 0.3 = 30% of one)
//   sell[i]  items sold per hour (only items with a sell price, or a value the user gave them)
//   buy[i]   seeds bought per hour, at their shop price (shop_commodity_data), in Home Coin or in a
//            currency the user gave a coin value (e.g. Moonray Wheat for event seeds)
//   eat[i]   food eaten per hour
//   maximize  sum(price * sell) - sum(cost * buy)
//   subject to
//     facilities:  sum of x over recipes of a type <= how many the user has
//     one recipe:  (default) a bench is set to ONE recipe and left: y[r@f] = whole benches set to r,
//                  x <= y, sum of y <= how many the user has, y integer (branch and bound below)
//     routing:     (with one recipe) an ingredient a bench uses goes to ONE bench recipe, all of it:
//                  never sold or eaten, never raced for by two recipes (see planOnce)
//     devices:     the planner decides how many Heat Furnaces / Cooling Units / Sunlamps to place (up to
//                  the RV's limit) and on which setting; crops under a device <= what it covers
//     materials:   sold + eaten + used <= made + bought, for every item
//     food:        sum(eaten * food value) >= Aniimo in home * 10 per minute (HomeFoodSlotList: the home
//                  eats the sum of every Aniimo's homeFoodCostSpeed per minute; unfed Aniimo work at 50%)
//     Aniimo:      dedicated seats + zone device seats + busy bench workers + crop work
//                  <= cap - reserved - haulers
(function (root) {
  const LP = typeof module !== "undefined" ? require("./lp.js") : root.LP;

  // Common/Const/Const.lua and Data/formula_data.lua (3013 / 3054); confirmed by kiln, mine and
  // Aniipod readings in game (see CHECKS.md).
  const ATK = [120, 150, 180, 210];
  const DEF = [60, 75, 90, 105];

  function workPerMinute(need, pet, formula, match) {
    if (need == null) return 60;
    const m = match ? 1 : 0;
    if (formula === 3054) {
      const r = need < pet ? 2 + pet - need : 1 + 0.25 * (pet - need);
      return 60 * r * (1 + 0.2 * m);
    }
    if (pet < 1 || pet > 4 || need < 1 || need > 4) return 0;
    const base = ATK[pet - 1] - DEF[need - 1];
    return formula === 3013 ? base * (1 + 0.2 * m) : base * (match ? 1.2 : 1);
  }

  const WATERING = { ab: "Water", lv: 1, f: 3013, wl: 6 };

  // Pen facilities take one evolution family only (recipe `fam`, from the recipe's `pet`; user confirmed
  // Sandcastle = Susuta family and Nimbus Bed = Nimbi family in game). Their job is named with the family,
  // "Leisure 1+ Susuta family", so every list of "who can do this job" can filter on it.
  // Aniimo the user says are not in the game yet (user, 2026-09-28: Jabster). The files have no release
  // flag: the handbook map also leaves out Aniimo the user owns. Species names; every form is dropped.
  function released(D, names) {
    if (!names || !names.length) return D;
    const off = new Set(names);
    return Object.assign({}, D, { aniimo: (D.aniimo || []).filter((a) => !off.has(a.n)) });
  }

  // RV upgrade (user, 2026-09-28: "add the recipe necessary to make the material to advance the RV").
  // D.rvLevels[N] = cost of going from N-1 to N. Each material is expanded through the one recipe that
  // makes it (Standard Planks <- 8 Rough Lumber <- 8 Wood Block each) down to an item several recipes
  // make (Wood Block: every Woodland crop; Mineral Sand: the Mines); that is the raw material.
  function rvChain(D, level) {
    const L = (D.rvLevels || {})[level];
    if (!L) return null;
    const makers = (i) => D.recipes.filter((r) => r.out.some(([o]) => o === i));
    const steps = [], raw = new Map();
    const expand = (i, qty, depth) => {
      const ms = makers(i);
      if (ms.length !== 1 || ms[0].k === "production" || depth > 6) { raw.set(i, (raw.get(i) || 0) + qty); return; }
      const r = ms[0];
      const per = r.out.find(([o]) => o === i)[1];
      const runs = Math.ceil(qty / per);
      steps.push({ item: i, qty, recipeId: r.id, fac: r.fac[0], runs, inputs: r.in.map(([x, q]) => [x, q * runs]), depth });
      for (const [x, q] of r.in) expand(x, q * runs, depth + 1);
    };
    for (const [i, n] of L.mats) expand(i, n, 0);
    return { level, coin: L.coin, cur: L.cur, secs: L.secs, mats: L.mats, steps, raw: [...raw] };
  }

  // How long until the next RV with this plan (user, 2026-09-28: "if the best Aniimo makes the recipes,
  // how long to upgrade; the plan already plants the Woodland"). Per material the slowest of:
  //   raw:    what the chain needs (58,240 Wood Block) / what the plan makes per hour that nothing
  //           else takes (made - used - sold - eaten - kept)
  //   benches: the chain's workload done by the best Aniimo for it on the benches
  //           the plan leaves free: as many free benches as stages run side by side, one runs them in turn
  // and for the upgrade as a whole also the coin at the plan's income. The upgrade time comes after.
  // Personality +20% only when the user ticked it (user: it gives more materials): the raw side already
  // follows it, since the plan was made with the same inputs.
  // Assumes an Aniimo is free for those benches: the plan's budget does not include them.
  function rvTime(D, result, level, includePrismana) {
    const c = rvChain(D, level);
    if (!c || !result || result.status !== "optimal") return null;
    const inp = result.inputs;
    const best = bestAbilityLevels(D, includePrismana);
    const net = new Map();
    const add = (i, v) => net.set(i, (net.get(i) || 0) + v);
    for (const l of result.lines) {
      const r = D.recipes.find((x) => x.id === l.recipeId);
      for (const [i, q] of r.out) add(i, q * l.cyclesPerHour);
      for (const [i, q] of r.in) add(i, -q * l.cyclesPerHour);
    }
    for (const x of result.sold) add(x.id, -x.perHour);
    for (const x of result.eaten) add(x.id, -x.perHour);
    for (const x of result.kept || []) add(x.id, -x.perDay / 24);
    const taken = {};                              // benches the plan already set
    for (const l of result.lines) if (l.kind !== "crop") taken[l.facility] = (taken[l.facility] || 0) + (l.benches != null ? l.benches : Math.ceil(l.count - 1e-6));
    const mats = [];
    for (const st of c.steps) { if (st.depth === 0) mats.push({ item: st.item, need: st.qty, stages: [] }); mats[mats.length - 1].stages.push(st); }
    for (const m of mats) {
      m.blocked = [];
      const made = new Set(m.stages.map((st) => st.item));
      m.raw = [];
      for (const st of m.stages) for (const [i, q] of st.inputs) if (!made.has(i)) {
        const perHour = Math.max(0, net.get(i) || 0);
        m.raw.push({ item: i, need: q, perHour, hours: perHour > 1e-9 ? q / perHour : Infinity });
        if (!(perHour > 1e-9)) m.blocked.push("the plan makes no spare " + (D.items[i] ? D.items[i].n : i));
      }
      const byFac = {};
      for (const st of m.stages) {
        const r = D.recipes.find((x) => x.id === st.recipeId);
        const op = mainOp(r);
        const rate = op ? workPerMinute(op.lv, Math.max(op.lv, best[op.ab] || op.lv), op.f, !!inp.personality) : 60;
        st.hours = st.runs * r.wl / rate / 60;
        st.worker = op ? op.ab + " " + (best[op.ab] || op.lv) : null;
        const f = st.fac[0], have = inp.facilities[f];
        if (!have || !(have.count > 0)) { m.blocked.push("no " + f); continue; }
        if ((have.level || 0) < st.fac[1]) { m.blocked.push(f + " Lv " + st.fac[1] + " needed"); continue; }
        (byFac[f] = byFac[f] || []).push(st);
      }
      m.benchHours = 0;
      for (const [f, sts] of Object.entries(byFac)) {
        const free = inp.facilities[f].count - (taken[f] || 0);
        if (free <= 0) { m.blocked.push("every " + f + " is set to another recipe"); continue; }
        const h = free >= sts.length ? Math.max(...sts.map((st) => st.hours)) : sts.reduce((a, st) => a + st.hours, 0);
        m.benchHours = Math.max(m.benchHours, h);
      }
      m.hours = m.blocked.length ? Infinity : Math.max(m.benchHours, ...m.raw.map((x) => x.hours));
    }
    const coinHours = c.cur === 1010 ? (result.coinPerHour > 0 ? c.coin / result.coinPerHour : Infinity) : null;
    const readyHours = Math.max(coinHours || 0, ...mats.map((m) => m.hours));
    return { level, mats, coin: c.coin, coinHours, readyHours, upgradeHours: c.secs / 3600, totalHours: readyHours + c.secs / 3600 };
  }

  function jobName(D, ab, lv, fam) {
    return ab + " " + lv + "+" + (fam ? " " + ((D.families || {})[fam] || fam) + " family" : "");
  }
  function parseJob(D, job) {
    const m = /^(\S+) (\d)\+(?: (.+) family)?/.exec(job || "");
    if (!m) return null;
    const fam = m[3] ? Number(Object.keys(D.families || {}).find((k) => D.families[k] === m[3])) : null;
    return { ab: m[1], lv: Number(m[2]), fam: Number.isFinite(fam) ? fam : null };
  }
  // Highest level of an ability inside one family (the most a pen can get)
  function familyBest(D, fam, ab, includePrismana) {
    let best = 0;
    for (const a of D.aniimo || []) if (a.fam === fam && (includePrismana || !a.prismana)) best = Math.max(best, a.ab[ab] || 0);
    return best;
  }   // operation 100211, 2 per crop cycle

  // Utils.calcTemperatureDiffWorkRatio with homeland_config envDiffWorkRatioInfo [1, 0.8, 0.5, 0.2].
  // Applied as a growth-speed multiplier (time / ratio): the direction is inferred, not yet measured.
  const ENV_RATIO = [1, 0.8, 0.5, 0.2];
  // Heat Furnace formulas 45/46 (Fire 1), Cooling Unit 54 (Ice 1) / 55 (Ice 2), Sunlamp 61 (Light 1);
  // each keeps one Aniimo busy all the time (unitWorkload, type 1).
  const DEVICES = [
    { fac: "Heat Furnace", settings: [{ name: "Warm +1", temp: 1, worker: "Fire 1+" }, { name: "Scorching +2", temp: 2, worker: "Fire 1+" }] },
    { fac: "Cooling Unit", settings: [{ name: "Cool -1", temp: -1, worker: "Ice 1+" }, { name: "Cold -2", temp: -2, worker: "Ice 2+" }] },
    { fac: "Sunlamp", settings: [{ name: "Light", temp: 0, light: true, worker: "Light 1+" }] },
  ];

  function zoneRatio(r, zone) {
    if (r.light && r.force && !zone.light) return 0;          // forceEnvRequire: cannot grow at all
    if (r.temp == null) return 1;
    return ENV_RATIO[Math.min(Math.abs(r.temp - (zone.temp || 0)), 3)];
  }

  function defaults(D) {
    return {
      rv: 11,
      facilities: {},              // name -> {count, level}
      modules: {},                 // name -> level
      cap: D.rvCaps[11] || 30,     // the user's screen wins over the data (user has 32 at RV 11)
      reserved: 0,                 // Aniimo kept out of production (e.g. star farming at home)
      haulers: 2,
      // Starfall Hammock (RV 12) and Floral Windmill (RV 18) are the same kind of "play" facility (review)
      dedicated: ["Mine", "Well", "Tidewhisper Sandcastle", "Dewy House", "Nimbus Bed", "Starfall Hammock", "Floral Windmill"],
      notes: [],                   // owned Recipe Notes, or ["all"]
      watered: true,
      // Highest homeland ability level among the user's Aniimo (user 2026-09-28: "level 1, level 2 and
      // below, level 3 and below, level 4 and below"). Every job gets the best Aniimo, i.e. this level,
      // even when a recipe needs more: under-levelled work is slower (3054: 1 - 0.25 per missing level,
      // 3013: ATK[level] - DEF[need]), which is how the game computes it. null = exactly the requirement.
      workerMaxLevel: 3,
      workerBonus: 0,              // legacy: levels above the requirement, used only if workerMaxLevel is null
      abilityLevels: null,         // per ability ("Fire" -> 4): overrides workerMaxLevel (used by the best case)
      personality: false,          // assume every worker's personality matches its bench (+20%)
      cropOpOverhead: 0.5,         // minutes of walking per crop operation (not in the data; a guess)
      values: {},                  // itemId -> coin value for things you keep (Aniipods), or for a
                                   // currency (e.g. Moonray Wheat) so seeds priced in it can be bought
      disabledRecipes: [],         // recipe ids the user does not have (not everyone has every recipe)
      keep: {},                    // itemId -> how many per DAY to make for yourself (e.g. Aniipods), not sold
      moonrayWheat: false,         // event seeds cost Moonray Wheat (item 4040033), not Home Coin: allow them
      feed: true,                  // plan food for every Aniimo in the home
      homeAniimo: null,            // Aniimo that eat; null = cap (every Aniimo in the home eats)
      minFoodPerItem: 0,           // only feed items worth at least this much food each (fewer refills:
                                   // one cooked dish ~45,000 = 45 Energy Bites; user asked 2026-09-28)
      eventSeeds: true,            // allow time-limited event seeds (if you can still buy them)
      // Environment devices are chosen by the planner (user, 2026-09-28: "the planner needs to inform
      // what to use, not the user"). Plots one device covers: its envBounds is 9 x 9, a Farmland plot
      // is 2 x 2 and a Woodland 4 x 4, so floor(9/2)^2 = 16 and floor(9/4)^2 = 4. ESTIMATE from the
      // footprints (assumes 9 is the side of a square, not a radius): editable, confirm in game.
      devices: true,
      deviceCoverage: { Farmland: 16, Woodland: 4 },
      // A bench holds one recipe (user, 2026-09-28: "all benches can craft only one recipe"; they can
      // change it by hand, but want a plan they can set and leave). Off = time-share a bench between
      // recipes, which only works if you switch them yourself.
      oneRecipePerBench: true,
      unreleased: [],              // species not in the game yet: never planned, listed or suggested
    };
  }

  // Recipes the user can run: facility level, RV module, Recipe Note, and their own on/off list.
  function available(D, inp, ignoreDisabled) {
    const owned = new Set((inp.notes || []).map((n) => n.toLowerCase()));
    const off = new Set(ignoreDisabled ? [] : (inp.disabledRecipes || []).map(Number));
    const out = [];
    for (const r of D.recipes) {
      if (off.has(r.id)) continue;
      if (r.note && !owned.has("all") && !owned.has(r.note.toLowerCase())) continue;
      if (r.mod && (inp.modules[r.mod[0]] || 0) < Number(r.mod[1])) continue;
      for (const [fac, minLv] of r.fac) {
        const have = inp.facilities[fac];
        if (!have || !(have.count > 0) || (have.level || 0) < minLv) continue;
        out.push({ r, fac });
      }
    }
    return out;
  }

  function mainOp(r) { return r.ops.find((o) => o.ph === "post" && o.ab) || null; }

  function describe(D, r) {
    return r.out.map(([i, n]) => (D.items[i] ? D.items[i].n : i) + " x" + n).join(" + ");
  }

  function price(D, inp, i) {
    if (inp.values && inp.values[i] != null && inp.values[i] !== "") return Number(inp.values[i]);
    const it = D.items[i];
    return it && it.p ? it.p : 0;
  }

  // One variable per (recipe, facility): cycle length, per-hour flows, and Aniimo time it costs.
  function buildColumn(D, inp, r, fac, zone) {
    const dedicated = inp.dedicated.includes(fac);
    const general = (need, ab) => {
      if (inp.abilityLevels && ab && inp.abilityLevels[ab] != null) return Math.max(1, Math.min(4, inp.abilityLevels[ab]));
      if (inp.workerMaxLevel != null && inp.workerMaxLevel !== "") return Math.max(1, Math.min(4, Number(inp.workerMaxLevel)));
      if (inp.workerBonus === "max") return 4;
      return Math.min(4, (need || 1) + (Number(inp.workerBonus) || 0));
    };
    // a pen is worked by its family only: no better than that family's best (best case: exactly it)
    const petLv = (need, ab) => {
      if (!r.fam) return general(need, ab);
      const top = (inp.familyLevels || {})[r.fam];
      if (top != null) return Math.max(1, top);
      return Math.max(1, Math.min(general(need, ab), familyBest(D, r.fam, ab, false) || 1));
    };
    const fed = inp.feed !== false ? 1 : (D.noFoodRatio != null ? D.noFoodRatio : 0.2);
    const opRate = (o) => workPerMinute(o.lv, petLv(o.lv, o.ab), o.f, inp.personality) * fed;
    let minutes, workerHours, kind, cropJobs = null;
    if (r.k === "production") {
      const ratio = zoneRatio(r, zone);
      if (!(ratio > 0)) return null;
      minutes = (r.t - (inp.watered ? r.wc : 0)) / 60 / ratio;
      const ops = r.ops.filter((o) => o.wl).concat(inp.watered && r.wc ? [WATERING, WATERING] : []);
      cropJobs = {};                               // Aniimo-hours per plot-hour, by job ("Earth 1+")
      for (const o of ops) {
        const key = o.ab + " " + o.lv + "+";
        cropJobs[key] = (cropJobs[key] || 0) + (o.wl / opRate(o) + inp.cropOpOverhead) / minutes;
      }
      workerHours = Object.values(cropJobs).reduce((a, b2) => a + b2, 0);
      kind = "crop";
    } else {
      const op = mainOp(r);
      const rate = op ? opRate(op) : 60;
      minutes = r.wl / rate;
      workerHours = 1;                             // one Aniimo per running facility (user, in game)
      kind = dedicated ? "dedicated" : "bench";
    }
    if (!(minutes > 0)) return null;
    const perHour = 60 / minutes;
    return { r, fac, zone: r.k === "production" ? zone : null, kind, minutes, perHour, workerHours, cropJobs,
             op: r.k === "production" ? null : mainOp(r) };
  }

  // A real device has one setting and locks one whole Aniimo, but the LP places fractions. So: re-solve
  // with the smaller setting banned while a type exceeds its limit, then force every device in use to a
  // whole number (placed >= ceil) so the budget pays a full Aniimo for each one (Fable review: a Sunlamp
  // for one plot cost 0.06 Aniimo). A device not worth a whole Aniimo is dropped by the next solve.
  // Fastest upgrade (user, 2026-09-28, "plan for the fastest upgrade instead of the most coin"). The LP
  // gets one more variable t = upgrades per hour: the RV materials must pile up at need * t and the income
  // must cover coin * t. Step 1 maximizes t; step 2 keeps 99.9% of that t and maximizes coin. Time to be
  // ready = 1 / t hours; the chain benches and their Aniimo are inside the plan.
  function plan(D, userInputs) {
    D = released(D, (userInputs || {}).unreleased);
    const level = userInputs && userInputs.fastRv;
    const chain = level ? rvChain(D, Number(level)) : null;
    if (!chain) return planCore(D, userInputs);
    const rv = { mats: chain.mats, coin: chain.cur === 1010 ? chain.coin : 0 };
    const fastest = planCore(D, Object.assign({}, userInputs, { _rv: rv }));
    const t = fastest.status === "optimal" ? fastest.rvRate : 0;
    if (!(t > 1e-9)) {
      const p = planCore(D, userInputs);
      p.warnings = (p.warnings || []).concat("This layout cannot make the RV " + chain.level + " materials: see Next RV level.");
      return Object.assign(p, { fastRv: { level: chain.level, reachable: false } });
    }
    const p = planCore(D, Object.assign({}, userInputs, { _rv: Object.assign({}, rv, { min: t * 0.999 }) }));
    const rate = p.status === "optimal" ? p.rvRate : t;
    return Object.assign(p.status === "optimal" ? p : fastest, { fastRv: { level: chain.level, reachable: true, rate,
      readyHours: 1 / rate, upgradeHours: chain.secs / 3600, perHour: chain.mats.map(([i, n]) => [i, n * rate]),
      coinForUpgrade: rv.coin * rate } });
  }

  function planCore(D, userInputs) {
    // Devices are decided on the split-bench LP (4 ms a solve); the whole-bench search (one recipe per
    // bench, up to BB_NODE_LIMIT solves) runs once, at the end, with those device decisions.
    const whole = Object.assign(defaults(D), userInputs || {}).oneRecipePerBench !== false;
    const inputs = Object.assign({}, userInputs, { oneRecipePerBench: false });
    const banned = [];
    let deviceMin = {};
    let result = planOnce(D, inputs);
    for (let round = 0; round < 8 && result.status === "optimal"; round++) {
      let changed = false;
      for (const d of DEVICES) {
        const used = result.devices.filter((x) => x.facility === d.fac);
        const whole = used.reduce((acc, x) => acc + x.place, 0);
        if (used.length > 1 && whole > used[0].max) {
          used.sort((a, b2) => b2.count - a.count);  // keep the setting that carries the most
          for (const x of used.slice(1)) banned.push(d.fac + "|" + x.setting);
          changed = true;
        }
      }
      if (!changed) {
        const next = {};
        for (const x of result.devices) if (x.count < x.place - 1e-6) next[x.facility + "|" + x.setting] = x.place;
        if (!Object.keys(next).length) break;
        deviceMin = Object.assign({}, deviceMin, next);
        const forced = planOnce(D, Object.assign({}, inputs, { _banned: banned.slice(), _deviceMin: deviceMin }));
        // a whole device may not be worth its Aniimo: compare with the plan that bans that setting
        const without = planOnce(D, Object.assign({}, inputs, { _banned: banned.concat(Object.keys(next)) }));
        if (forced.status === "optimal" && (without.status !== "optimal" || forced.coinPerHour >= without.coinPerHour)) {
          result = forced;
        } else {
          banned.push(...Object.keys(next));
          for (const k of Object.keys(next)) delete deviceMin[k];
          result = without;
        }
        continue;
      }
      result = planOnce(D, Object.assign({}, inputs, { _banned: banned.slice(), _deviceMin: deviceMin }));
    }
    if (!whole || result.status !== "optimal") return result;
    // devices exactly as decided above (same settings, same whole counts): left free, the bench search
    // re-opened them and placed a second Cooling Unit setting
    const fix = {};
    for (const d of result.devices) fix[d.facility + "|" + d.setting] = d.place;
    const final = planOnce(D, Object.assign({}, userInputs, { _deviceFix: fix }));
    return final.status === "optimal" ? final : result;
  }

  // Branch and bound over the whole-bench variables. The LP relaxation (a bench split between recipes)
  // is an upper bound, but a loose one: on the RV 11 layout it is ~8% above the best whole plan, so plain
  // depth-first search needed 600+ LPs (13 s). Two things make it fast:
  //   - best-first: always expand the branch with the highest bound, stop when no bound beats the best
  //     whole plan by more than BB_GAP;
  //   - a rounding heuristic at every node: give each facility type's benches to the recipes the
  //     relaxation used most (largest remainder), re-solve with y capped there. Any such plan is a real
  //     whole-bench plan, so it is a valid incumbent from the first node on.
  // Bounds are extra rows (a ">=" row is -y <= -k, big-M in lp.js). Past the node cap the best whole
  // plan found is used. Measured 2026-09-28 with routing, 80 nodes vs 400: the plan is the same to 0.1%
  // (RV 11 and RV 15), the best case with Prismana can be ~6% low (57,647 vs 61,534). Tried and dropped:
  // a local search of single swaps and a dive; neither beat plain best-first at the same cost.
  // HiGHS (highs-js, MIT; web/vendor): a real MIP solver compiled to WebAssembly. When the page (or a test)
  // hands it over with useSolver(), every plan is solved by it: whole benches, one recipe per ingredient and
  // devices exactly, no node cap (the hand-written search below left the best case up to 6% short and took
  // 7 s a solve at RV 15). The hand-written solver stays as the fallback if HiGHS is missing or fails.
  let HIGHS = null;
  function useSolver(h) { HIGHS = h || null; }
  const HIGHS_OPTIONS = { output_flag: false, time_limit: 20, mip_rel_gap: 1e-4 };
  function solveHighs(obj, rows, b, ints, ones) {
    const num = (v) => String(+Number(v).toPrecision(15));
    const term = (v, j) => (v < 0 ? " - " : " + ") + num(Math.abs(v)) + " x" + j;
    const out = ["Maximize"];
    const o = obj.map((v, j) => (v ? term(v, j) : "")).join("");
    out.push(" obj:" + (o || " 0 x0"), "Subject To");
    for (let i = 0; i < rows.length; i++) {
      let line = " r" + i + ":", k = 0;
      const r = rows[i];
      for (let j = 0; j < r.length; j++) if (r[j]) { line += term(r[j], j); if (++k % 8 === 0) line += "\n  "; }
      if (!k) { if (b[i] < -1e-9) return { status: "infeasible" }; continue; }
      out.push(line + " <= " + num(b[i]));
    }
    if (ones.length) out.push("Bounds", ...ones.map((j) => " x" + j + " <= 1"));
    if (ints.length) out.push("General", " " + ints.map((j) => "x" + j).join(" "));
    out.push("End");
    let r;
    try { r = HIGHS.solve(out.join("\n"), HIGHS_OPTIONS); } catch (e) { return null; }
    if (r.Status === "Infeasible") return { status: "infeasible" };
    if (r.Status === "Unbounded") return { status: "unbounded" };
    const have = r.Status === "Optimal" || (r.Status === "Time limit reached" && isFinite(r.ObjectiveValue) && r.Columns);
    if (!have) return null;
    const x = new Array(obj.length).fill(0);
    for (const [k, c] of Object.entries(r.Columns)) x[Number(k.slice(1))] = c.Primal;
    for (const j of ints) x[j] = Math.round(x[j]);
    const value = obj.reduce((a, v, j) => a + v * x[j], 0);
    return { status: "optimal", x, value, capped: r.Status !== "Optimal" };
  }

  const BB_NODE_LIMIT = (typeof globalThis !== "undefined" && globalThis.__bbLimit) || 80, BB_GAP = 0.001;
  function solveWhole(obj, rows, b, groups, xOfY, route) {
    const n = obj.length;
    route = route || { us: [], multi: [], ysOf: new Map(), allU: [] };
    const ints = groups.flatMap((g) => g.ys).concat(route.us.map((u) => u[0]));
    // "no bench runs recipe j" drops the recipe's two columns instead of adding a row: the tableau stays
    // the size of the root LP, and most branches (and most of the rounding caps) are exactly that
    const lp = (node) => {
      // a dropped y takes its recipe column x with it; a dropped u / r has no partner
      const cols = [...node.off].flatMap((y) => (xOfY.has(y) ? [y, xOfY.get(y)] : [y]));
      const A = cols.length ? rows.map((r) => { const c = r.slice(); for (const k of cols) c[k] = 0; return c; }) : rows;
      const c = cols.length ? obj.slice() : obj;
      for (const k of cols) c[k] = 0;
      const r = LP.solve(c, A.concat(node.extra.map((e) => e[0])), b.concat(node.extra.map((e) => e[1])));
      if (r.status === "optimal") for (const k of cols) r.x[k] = 0;
      return r;
    };
    const bound = (j, k, atLeast) => { const r = new Array(n).fill(0); r[j] = atLeast ? -1 : 1; return [r, atLeast ? -k : k]; };
    const withBound = (node, j, k, atLeast) => (!atLeast && k === 0
      ? { off: new Set([...node.off, j]), extra: node.extra }
      : { off: node.off, extra: node.extra.concat([bound(j, k, atLeast)]) });
    let best = null, nodes = 0, capped = false;
    const tryRounding = (res, node) => {
      let trial = node;
      const caps = new Map();
      for (const g of groups) {
        const ys = g.ys.map((j) => [j, res.x[j]]);
        const give = new Map(ys.map(([j, v]) => [j, Math.floor(v + 1e-7)]));
        let left = g.count - [...give.values()].reduce((a, c) => a + c, 0);
        const frac = (v) => v - Math.floor(v + 1e-7);
        for (const [j, v] of ys.slice().sort((a, c) => frac(c[1]) - frac(a[1]))) {
          if (left <= 0) break;
          if (frac(v) > 1e-6) { give.set(j, give.get(j) + 1); left--; }
        }
        for (const [j, k] of give) caps.set(j, k);
      }
      // routing: an ingredient raced for by two set recipes keeps only the one the relaxation ran most;
      // a set recipe's switch is fixed at 1 (so its ingredients cannot also be sold), the others at 0
      const on = (u) => (route.ysOf.get(u) || [u]).some((y) => (caps.get(y) || 0) > 0);
      const ran = (u) => (route.ysOf.get(u) || [u]).reduce((s2, y) => s2 + (xOfY.has(y) ? res.x[xOfY.get(y)] : 0), 0);
      for (const us of route.multi) {
        const live = us.filter(on).sort((a, c) => ran(c) - ran(a));
        for (const u of live.slice(1)) for (const y of route.ysOf.get(u) || [u]) caps.set(y, 0);
      }
      const fixed = new Map();
      for (const [u] of route.us) fixed.set(u, on(u) ? 1 : 0);
      // a count-1 bench's switch is its y: a set one is fixed at exactly 1, or the LP could run it at 0.9
      // and sell the rest of its ingredient
      for (const u of route.allU) if (!fixed.has(u) && on(u)) fixed.set(u, caps.get(u));
      for (const [j, k] of caps) if (!trial.off.has(j) && !(fixed.has(j) && fixed.get(j) > 0)) trial = withBound(trial, j, k, false);
      for (const [j, k] of fixed) if (!trial.off.has(j)) trial = k ? withBound(withBound(trial, j, k, true), j, k, false) : withBound(trial, j, 0, false);
      nodes++;
      const r = lp(trial);
      if (r.status === "optimal" && (!best || r.value > best.value)) {
        for (const g of groups) for (const j of g.ys) r.x[j] = Math.ceil(r.x[j] - 1e-7);   // the benches set are whole
        for (const [j, k] of fixed) r.x[j] = k;
        best = r;
      }
    };
    const open = [{ off: new Set(), extra: [], bound: Infinity }];
    const beats = (v) => !best || v > best.value + Math.max(1e-6, Math.abs(best.value) * BB_GAP);
    while (open.length) {
      open.sort((a, c) => c.bound - a.bound);
      const node = open.shift();
      if (!beats(node.bound)) break;
      if (nodes >= BB_NODE_LIMIT) { capped = true; break; }
      nodes++;
      const res = lp(node);
      if (res.status !== "optimal" || !beats(res.value)) continue;
      let pick = -1, far = 1e-6;
      for (const j of ints) {
        const f = res.x[j] - Math.floor(res.x[j] + 1e-7);
        if (Math.min(f, 1 - f) > far) { far = Math.min(f, 1 - f); pick = j; }
      }
      if (pick < 0) { best = res; continue; }
      tryRounding(res, node);
      const v = res.x[pick];
      open.push(Object.assign(withBound(node, pick, Math.floor(v), false), { bound: res.value }),
                Object.assign(withBound(node, pick, Math.ceil(v), true), { bound: res.value }));
    }
    if (typeof globalThis !== "undefined") globalThis.__bbNodes = (globalThis.__bbNodes || 0) + nodes;
    return best ? Object.assign(best, { capped }) : { status: capped ? "iteration_limit" : "infeasible" };
  }

  function planOnce(D, userInputs) {
    const inp = Object.assign(defaults(D), userInputs || {});
    // never trust inputs (a loaded setup file skips the page's min="0"): negative walking time would free
    // Aniimo, a coverage of 0 would silently become 1
    const nn = (v, d) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : d);
    inp.cap = nn(inp.cap, 0); inp.reserved = nn(inp.reserved, 0); inp.haulers = nn(inp.haulers, 0);
    inp.cropOpOverhead = nn(inp.cropOpOverhead, 0.5); inp.minFoodPerItem = nn(inp.minFoodPerItem, 0);
    if (inp.workerMaxLevel != null && inp.workerMaxLevel !== "") inp.workerMaxLevel = Math.max(1, Math.min(4, Math.round(Number(inp.workerMaxLevel)) || 1));
    const warnings = [];
    const pool = inp.cap - inp.reserved - inp.haulers;
    if (pool <= 0) warnings.push("No Aniimo left for production: cap - reserved - haulers is " + pool + ".");
    const limits = rvLimits(D, inp.rv);
    const facilities = {};
    for (const [name, f] of Object.entries(inp.facilities)) {
      const fd = D.facilities[name];
      const lvl = fd && fd.levels.find((l) => l.lv === f.level);
      if (lvl && lvl.rv != null && lvl.rv > inp.rv) warnings.push(name + " level " + f.level + " needs RV " + lvl.rv + ".");
      const max = limits.counts[name];
      let count = f.count;
      if (max != null && count > max) {
        warnings.push("RV " + inp.rv + " allows " + max + " " + name + ", not " + count + ": planning with " + max + ".");
        count = max;
      }
      facilities[name] = { count, level: f.level };
    }
    inp.facilities = facilities;

    const neutral = { name: "No device", temp: 0, light: false };
    const zones = [neutral];
    if (inp.devices) {
      for (const d of DEVICES) {
        const max = limits.counts[d.fac];
        if (!max) continue;                        // not unlocked, or not placeable at this RV
        for (const st of d.settings) if (!(inp._banned || []).includes(d.fac + "|" + st.name)
          && (!inp._deviceFix || inp._deviceFix[d.fac + "|" + st.name])) zones.push({ name: d.fac + " (" + st.name + ")", fac: d.fac, setting: st.name, temp: st.temp, light: !!st.light, worker: st.worker, max });
      }
    }
    const cols = [];
    const needsEnv = (r) => r.temp != null || r.light;
    const coverOf = (fac) => Number((inp.deviceCoverage || {})[fac]) || 0;
    for (const { r, fac } of available(D, inp)) {
      // a device only helps crops that ask for a temperature or light; others stay off device plots,
      // and a facility the devices cannot cover (coverage 0) only gets the no-device zone
      const zs = r.k === "production" ? (needsEnv(r) && coverOf(fac) > 0 ? zones : [neutral]) : [null];
      for (const z of zs) { const c = buildColumn(D, inp, r, fac, z); if (c) cols.push(c); }
    }
    const items = new Map();                       // itemId -> row index
    const itemRow = (i) => { if (!items.has(i)) items.set(i, items.size); return items.get(i); };
    for (const c of cols) for (const [i] of c.r.in.concat(c.r.out)) itemRow(i);
    const keep = Object.entries(inp.keep || {}).map(([i, perDay]) => [Number(i), Number(perDay) / 24]).filter(([, h]) => h > 0);
    for (const [i] of keep) if (!items.has(i)) warnings.push("Nothing in your layout can make " + (D.items[i] ? D.items[i].n : i) + ".");

    // seeds: cheapest shop row the user can use (RV, on sale or event, currency with a coin value)
    const seedCost = new Map();
    for (const c of cols) {
      if (c.r.k !== "production") continue;
      for (const [i] of c.r.in) {
        let best = null;
        for (const row of (D.seedShop && D.seedShop[i]) || []) {
          if (row.rv != null && row.rv > inp.rv) continue;
          if (row.limited && !inp.eventSeeds) continue;
          if (!row.onSale && !row.limited) continue;
          const v = inp.values[row.cur];
          // Moonray Wheat is event currency, not Home Coin: when the user says they have it, the seed
          // costs no coin; otherwise only an explicit coin value makes it buyable
          const coinPerUnit = row.cur === 1010 ? 1 : (row.cur === 4040033 && inp.moonrayWheat) ? 0
            : (v != null && v !== "" ? Number(v) : null);
          if (coinPerUnit == null) continue;
          const cost = row.amt * coinPerUnit / (row.per || 1);
          if (best == null || cost < best) best = cost;
        }
        if (best != null) seedCost.set(i, best);
      }
    }
    const eaters = inp.homeAniimo != null && inp.homeAniimo !== "" ? Number(inp.homeAniimo) : inp.cap;
    const foodNeed = inp.feed ? eaters * (D.foodPerAniimoPerMin || 10) * 60 : 0;
    if (foodNeed > 0) for (const i of Object.keys(D.items)) if (D.items[i].f > 0 && items.has(Number(i))) { /* already a row */ }
    const minFood = Number(inp.minFoodPerItem) || 0;
    const foods = foodNeed > 0 ? [...items.keys()].filter((i) => D.items[i] && D.items[i].f > 0 && D.items[i].f >= minFood) : [];

    const sellable = [...items.keys()].filter((i) => price(D, inp, i) > 0);
    const buyable = [...seedCost.keys()];
    const facNames = [...new Set(cols.map((c) => c.fac))];

    const zoneList = zones.slice(1);               // one variable per device setting: how many to place
    const nx = cols.length, ns = sellable.length, nb = buyable.length, ne = foods.length, nz = zoneList.length;
    const zBase = nx + ns + nb + ne;
    // one whole-bench variable per non-crop column (crops are plots, rounded by wholeCounts instead)
    const whole = inp.oneRecipePerBench !== false ? cols.map((c, j) => (c.kind === "crop" ? -1 : j)).filter((j) => j >= 0) : [];
    const yBase = zBase + nz, yOf = new Map(whole.map((j, k) => [j, yBase + k]));
    // Routing (user, 2026-09-28): once an ingredient is in storage "the Aniimo decide" where it goes, the
    // first one to arrive takes it. So an ingredient a set bench uses goes to that one bench recipe, all
    // of it: never sold or eaten, and never raced for by a second recipe ("lemon goes to the one worth
    // more; use the Farmland to grow something for another bench"). Items you keep (Aniipods) never
    // feed a bench.
    //   u[j] = 1 when recipe j is set on some bench. For a facility you have one of, u is y itself;
    //   otherwise its own 0/1 variable with y <= count * u.
    //   routed(i) = sum of u over the recipes that use i  (<= 1: one recipe per ingredient)
    //   sold(i) + eaten(i) <= M * (1 - routed(i))
    // (An r[i] variable per item and u <= 1 rows made it 550 rows and 14 s; this form is ~300.)
    const consumers = new Map();                   // item -> bench columns that use it
    for (const j2 of whole) for (const [i2] of cols[j2].r.in) { if (!consumers.has(i2)) consumers.set(i2, []); if (!consumers.get(i2).includes(j2)) consumers.get(i2).push(j2); }
    const usedCols = [...new Set([...consumers.values()].flat())];
    const ownU = usedCols.filter((j2) => inp.facilities[cols[j2].fac].count > 1);
    const uBase = yBase + whole.length, uOwn = new Map(ownU.map((j2, k) => [j2, uBase + k]));
    const uOf = new Map(usedCols.map((j2) => [j2, uOwn.has(j2) ? uOwn.get(j2) : yOf.get(j2)]));
    // fastest upgrade: t = upgrades per hour (see plan)
    const rv = inp._rv || null;
    const tIdx = rv ? uBase + ownU.length : -1;
    const n = uBase + ownU.length + (rv ? 1 : 0);
    const rows = [], b = [];
    for (const f of facNames) {                    // facility counts (whole benches when one recipe each)
      const row = new Array(n).fill(0);
      cols.forEach((c, j) => { if (c.fac === f) row[yOf.has(j) ? yOf.get(j) : j] = 1; });
      rows.push(row); b.push(inp.facilities[f].count);
    }
    for (const [j, y] of yOf) {                    // runs no more than the benches set to that recipe
      const row = new Array(n).fill(0);
      row[j] = 1; row[y] = -1;
      rows.push(row); b.push(0);
    }
    const cover = inp.deviceCoverage || {};
    zoneList.forEach((z, k) => {                   // crops under a device setting <= what those devices cover
      const row = new Array(n).fill(0);
      cols.forEach((c, j) => { if (c.zone === z) row[j] = 1 / coverOf(c.fac); });
      row[zBase + k] = -1;
      rows.push(row); b.push(0);
    });
    zoneList.forEach((z, k) => {                   // fixed devices: placed <= the count decided
      const fixed = (inp._deviceFix || {})[z.fac + "|" + z.setting];
      if (!fixed) return;
      const row = new Array(n).fill(0);
      row[zBase + k] = 1;
      rows.push(row); b.push(fixed);
    });
    zoneList.forEach((z, k) => {                   // whole devices: placed >= what an earlier pass rounded up to
      const min = (inp._deviceMin || {})[z.fac + "|" + z.setting] || (inp._deviceFix || {})[z.fac + "|" + z.setting];
      if (!min) return;
      const row = new Array(n).fill(0);
      row[zBase + k] = -1;
      rows.push(row); b.push(-min);
    });
    for (const d of DEVICES) {                     // devices of a type <= how many the RV lets you place
      const ks = zoneList.map((z, k) => (z.fac === d.fac ? k : -1)).filter((k) => k >= 0);
      if (!ks.length) continue;
      const row = new Array(n).fill(0);
      for (const k of ks) row[zBase + k] = 1;
      rows.push(row); b.push(zoneList[ks[0]].max);
    }
    const itemBase = rows.length;
    const keepOf = new Map(keep);
    for (const [i, k] of items) { rows.push(new Array(n).fill(0)); b.push(-(keepOf.get(i) || 0)); }  // made >= used + sold + kept
    cols.forEach((c, j) => {
      for (const [i, q] of c.r.in) rows[itemBase + items.get(i)][j] += q * c.perHour;
      for (const [i, q] of c.r.out) rows[itemBase + items.get(i)][j] -= q * c.perHour;
    });
    sellable.forEach((i, k) => { rows[itemBase + items.get(i)][nx + k] = 1; });
    buyable.forEach((i, k) => { rows[itemBase + items.get(i)][nx + ns + k] = -1; });
    foods.forEach((i, k) => { rows[itemBase + items.get(i)][nx + ns + nb + k] = 1; });
    if (foodNeed > 0) {                            // eaten food value >= need, written as -sum <= -need
      const row = new Array(n).fill(0);
      foods.forEach((i, k) => { row[nx + ns + nb + k] = -D.items[i].f; });
      rows.push(row); b.push(-foodNeed);
    }
    const workerRow = new Array(n).fill(0);        // Aniimo budget: every placed device keeps one busy
    cols.forEach((c, j) => { workerRow[j] = c.workerHours; });
    zoneList.forEach((z, k) => { workerRow[zBase + k] = 1; });
    rows.push(workerRow); b.push(Math.max(0, pool));

    for (const [j2, u] of uOwn) {                  // y <= count * u
      const row = new Array(n).fill(0); row[yOf.get(j2)] = 1; row[u] = -inp.facilities[cols[j2].fac].count; rows.push(row); b.push(0);
    }
    // most of an item one hour can hold: everything that makes it, flat out (the M of the sell rows)
    const most = (i2) => cols.reduce((acc, c) => acc + c.r.out.filter(([o]) => o === i2).reduce((a, [, q]) => a + q, 0)
      * c.perHour * (inp.facilities[c.fac] ? inp.facilities[c.fac].count : 0), 0) + 1;
    for (const [i2, js] of consumers) {
      // kept items, and the RV materials while planning the upgrade, never feed a bench
      const kept = keep.some(([k]) => k === i2) || (rv && rv.mats.some(([k]) => k === i2));
      const si = sellable.indexOf(i2), ei = foods.indexOf(i2);
      const market = si >= 0 || ei >= 0;
      if (js.length < 2 && !market && !kept) continue;
      if (kept || !market || js.length > 1) {     // one recipe per ingredient (none for kept items)
        const row = new Array(n).fill(0); for (const j2 of js) row[uOf.get(j2)] = 1; rows.push(row); b.push(kept ? 0 : 1);
      }
      if (!market || kept) continue;
      const M = most(i2);                         // routed: sold + eaten <= M * (1 - routed)
      const row = new Array(n).fill(0);
      if (si >= 0) row[nx + si] = 1;
      if (ei >= 0) row[nx + ns + nb + ei] = 1;
      for (const j2 of js) row[uOf.get(j2)] = M;
      rows.push(row); b.push(M);
    }

    const obj = new Array(n).fill(0);
    sellable.forEach((i, k) => { obj[nx + k] = price(D, inp, i); });
    buyable.forEach((i, k) => { obj[nx + ns + k] = -seedCost.get(i); });
    if (rv) {
      for (const [i2, need] of rv.mats) {          // materials pile up at need * t
        if (items.has(i2)) rows[itemBase + items.get(i2)][tIdx] = need;
        else { const row = new Array(n).fill(0); row[tIdx] = 1; rows.push(row); b.push(0); }   // nothing makes it
      }
      // income >= coin * t, divided through by the coin: written with 1,060,000 on t the simplex (big-M
      // 1e7) stalled at t = 0; scaled, the same row solves (measured 2026-09-28)
      const scale = Math.max(1, rv.coin);
      const coinRow = obj.map((v) => -v / scale);
      coinRow[tIdx] = rv.coin / scale;
      rows.push(coinRow); b.push(0);
      if (rv.min != null) {                        // step 2: keep the speed, earn the most
        const row = new Array(n).fill(0); row[tIdx] = -1; rows.push(row); b.push(-rv.min);
      } else {                                     // step 1: the speed is all that counts. Maximized as
        // t * coin (same plan) so the objective has the size of a coin objective: with t alone (~0.005)
        // the reduced costs drowned under the food row's big-M and the simplex stopped at t = 0
        obj.fill(0); obj[tIdx] = scale;
      }
    }

    const groups = facNames.map((f) => ({ count: inp.facilities[f].count, ys: whole.filter((j) => cols[j].fac === f).map((j) => yOf.get(j)) }))
      .filter((g) => g.ys.length);
    const route = {
      us: [...uOwn].map(([j2, u]) => [u, [yOf.get(j2)]]),
      multi: [...consumers.values()].filter((js) => js.length > 1).map((js) => js.map((j2) => uOf.get(j2))),
      ysOf: new Map([...uOf].map(([j2, u]) => [u, [yOf.get(j2)]])),
      allU: [...new Set(uOf.values())],
    };
    const ints = [...yOf.values(), ...uOwn.values()];
    let res = HIGHS ? solveHighs(obj, rows, b, ints, [...uOwn.values()]) : null;
    if (!res) res = whole.length ? solveWhole(obj, rows, b, groups, new Map([...yOf].map(([j, y]) => [y, j])), route) : LP.solve(obj, rows, b);
    if (res.status === "infeasible") {
      const why = [];
      if (foodNeed > 0) why.push("feed " + eaters + " Aniimo");
      if (keep.length) why.push("make what you asked to keep");
      warnings.push("This layout cannot " + (why.join(" and ") || "work") + " with the Aniimo available. Lower a target, add facilities, or turn food planning off.");
    }
    if (res.status !== "optimal") return { status: res.status, warnings, inputs: inp };

    const name = (i) => (D.items[i] ? D.items[i].n : String(i));
    const lines = [];
    cols.forEach((c, j) => {
      const x = res.x[j];
      if (x < 1e-6) return;
      const valueOut = c.r.out.reduce((s, [i, q]) => s + q * price(D, inp, i), 0);
      const valueIn = c.r.in.reduce((s, [i, q]) => s + q * price(D, inp, i), 0);
      lines.push({
        facility: c.fac, zone: c.zone && c.zone.name !== "No device" ? c.zone.name : null,
        mbti: D.facilities[c.fac] ? D.facilities[c.fac].mbti : null,
        recipeId: c.r.id, makes: describe(D, c.r), count: x, kind: c.kind,
        benches: yOf.has(j) ? Math.round(res.x[yOf.get(j)]) : null,   // whole benches set to this recipe
        minutesPerCycle: c.minutes, cyclesPerHour: c.perHour * x,
        lineValue: (valueOut - valueIn) * c.perHour * x,       // same convention as the site's lines
        aniimo: c.workerHours * x,
        cropJobs: c.cropJobs ? Object.fromEntries(Object.entries(c.cropJobs).map(([k, v]) => [k, v * x])) : null,
        worker: c.op ? jobName(D, c.op.ab, c.op.lv, c.r.fam) : c.r.ops.filter((o) => o.wl).map((o) => o.ab + " " + o.lv + "+").join(", ") + (inp.watered && c.r.wc ? ", Water 1+ (watering)" : ""),
        note: c.r.note || null,
      });
    });
    lines.sort((a, b2) => b2.lineValue - a.lineValue);
    const sold = sellable.map((i, k) => ({ item: name(i), id: i, perHour: res.x[nx + k], coin: res.x[nx + k] * price(D, inp, i) }))
      .filter((s) => s.perHour > 1e-6).sort((a, b2) => b2.coin - a.coin);
    const bought = buyable.map((i, k) => ({ item: name(i), id: i, perHour: res.x[nx + ns + k], coin: res.x[nx + ns + k] * seedCost.get(i) }))
      .filter((x2) => x2.perHour > 1e-6);
    const eaten = foods.map((i, k) => ({ item: name(i), id: i, perHour: res.x[nx + ns + nb + k],
      food: res.x[nx + ns + nb + k] * D.items[i].f, coinIfSold: res.x[nx + ns + nb + k] * price(D, inp, i) }))
      .filter((e) => e.perHour > 1e-6);
    const devices = zoneList.map((z, k) => {
      const placed = res.x[zBase + k];
      const under = {};
      cols.forEach((c, j) => { if (c.zone === z && res.x[j] > 1e-6) under[c.fac] = (under[c.fac] || 0) + res.x[j]; });
      const crops = cols.filter((c, j) => c.zone === z && res.x[j] > 1e-6).map((c) => describe(D, c.r));
      return { facility: z.fac, setting: z.setting, count: placed, place: Math.ceil(placed - 1e-6), worker: z.worker, max: z.max, under, crops };
    }).filter((d) => d.count > 1e-6);
    const zoneSeats = devices.reduce((acc, d) => acc + d.count, 0);
    const used = { dedicated: 0, bench: 0, crop: 0, devices: zoneSeats };
    for (const l of lines) used[l.kind] += l.aniimo;
    const abilityNeeds = {};                       // job -> Aniimo-hours per hour (1 = one Aniimo full time)
    const fullTime = {};                           // part of that which is one indivisible full-time seat
    for (const l of lines) {
      if (l.kind === "crop") {
        for (const [k, v] of Object.entries(l.cropJobs || {})) abilityNeeds[k] = (abilityNeeds[k] || 0) + v;
        continue;
      }
      abilityNeeds[l.worker] = (abilityNeeds[l.worker] || 0) + l.aniimo;
      if (l.kind === "dedicated") fullTime[l.worker] = (fullTime[l.worker] || 0) + l.aniimo;
    }
    for (const d of devices) {
      abilityNeeds[d.worker] = (abilityNeeds[d.worker] || 0) + d.place;
      fullTime[d.worker] = (fullTime[d.worker] || 0) + d.place;
    }
    return {
      status: "optimal", inputs: inp, warnings,
      rvRate: rv ? res.x[tIdx] : null,
      coinPerHour: res.value, coinPerDay: res.value * 24,
      lines, sold, bought, eaten, devices, fullTime,
      kept: keep.map(([i, h]) => ({ item: name(i), id: i, perDay: h * 24 })),
      food: { eaters, needPerHour: foodNeed,
              // how long the eaten mix lasts per item fed (for "how often do I refill")
              hoursPerItem: eaten.length ? eaten.reduce((acc, e) => acc + e.food, 0) / eaten.reduce((acc, e) => acc + e.perHour, 0) / (foodNeed || 1) : 0 },
      aniimo: { cap: inp.cap, reserved: inp.reserved, haulers: inp.haulers, pool, used,
                total: used.dedicated + used.bench + used.crop + used.devices },
      abilityNeeds,
    };
  }

  // What the chosen RV level allows: highest level and how many of each facility (home_object_place_data),
  // highest level per module, and the data's Aniimo cap.
  function rvLimits(D, rv) {
    const fac = {}, mod = {}, count = {};
    for (const [n, f] of Object.entries(D.facilities)) {
      const ok = f.levels.filter((l) => l.rv == null || l.rv <= rv);
      if (ok.length) fac[n] = Math.max(...ok.map((l) => l.lv));
      if (f.maxCount) count[n] = ok.length ? f.maxCount[Math.max(1, Math.min(rv, 20)) - 1] : 0;
    }
    for (const [n, levels] of Object.entries(D.modules)) {
      const ok = levels.filter((l) => l.rv != null && l.rv <= rv);
      mod[n] = ok.length ? Math.max(...ok.map((l) => l.lv)) : 0;
    }
    return { facilities: fac, counts: count, modules: mod, cap: D.rvCaps[rv] || 0 };
  }

  // Every recipe the gates allow (ignoring the user's own off-list), for the page's checklist.
  function recipeChoices(D, userInputs) {
    const inp = Object.assign(defaults(D), userInputs || {});
    const seen = new Map();
    for (const { r, fac } of available(D, inp, true)) {
      if (!seen.has(r.id)) seen.set(r.id, { id: r.id, makes: describe(D, r), facilities: [], note: r.note, mod: r.mod, kind: r.k, variant: r.v, variantName: r.vn });
      seen.get(r.id).facilities.push(fac);
    }
    return [...seen.values()];
  }

  // Aniimo that can do a job ("Earth" at level 2+), best level first. Prismana forms only if asked.
  // Forms of one species can do different jobs (user, 2026-09-28; 50 of 96 species): Stellarys Basic is
  // Dark 3 + Leisure 3, its Rainstorm Form adds Water 2, its Prismana form is Ice 3 + Dark 4 + Leisure 4.
  // So forms are merged only when their job sets are identical, and every row keeps its form names.
  function candidates(D, ability, minLevel, includePrismana, fam) {
    const groups = new Map();
    for (const a of D.aniimo || []) {
      if ((a.ab[ability] || 0) < minLevel || (!includePrismana && a.prismana)) continue;
      if (fam && a.fam !== fam) continue;
      const key = a.n + "|" + JSON.stringify(Object.entries(a.ab).sort());
      const g = groups.get(key);
      if (!g) groups.set(key, Object.assign({}, a, { formNames: [a.fn || "Basic Form"] }));
      else g.formNames.push(a.fn || "Basic Form");
    }
    return [...groups.values()].sort((a, b) => b.ab[ability] - a.ab[ability]
      || Object.keys(b.ab).length - Object.keys(a.ab).length || a.n.localeCompare(b.n));
  }

  const formLabel = (a) => (a.formNames || [a.fn || "Basic Form"]).join(" / ");

  // Suggested roster: the fewest Aniimo that cover all the work. Full-time seats (locked facilities,
  // devices, whole benches) each need their own Aniimo. The leftover part-time work of different jobs is
  // packed onto Aniimo that can do several of them (user, 2026-09-28: "there is aniimo that can do more
  // than one work"), e.g. Fragrancier = Perfumery + Leisure + Dark. Greedy set cover; each Aniimo has
  // one hour of work per hour. Candidates prefer the highest level, then the most jobs covered.
  // For a best-case plan (result.abilityLevels set), every job must get an Aniimo AT the best level the plan
  // assumed, not just the recipe's minimum (user, 2026-09-28: "if the workbench asks for lv2 recommend a lv3,
  // because lv3 is best"); otherwise the roster would not deliver the speed the best case counts on.
  // Ties go to Aniimo whose other abilities are also high (sum of all levels), then to more abilities.
  const allLevels = (a) => Object.values(a.ab).reduce((s2, v) => s2 + v, 0);
  function roster(D, result, includePrismana) {
    const parse = (job) => { const p = parseJob(D, job); return p ? [p.ab, p.lv, p.fam] : null; };
    const jobs = Object.entries(result.abilityNeeds || {}).map(([job, load]) => ({ job, load, ab: parse(job) })).filter((j) => j.ab && j.load > 1e-6);
    const pool = (D.aniimo || []).filter((a) => includePrismana || !a.prismana);
    const minLv = result.abilityLevels || {}, famLv = result.familyLevels || {};
    const can = (a, j) => (!j.ab[2] || a.fam === j.ab[2])
      && (a.ab[j.ab[0]] || 0) >= Math.max(j.ab[1], (j.ab[2] ? famLv[j.ab[2]] : minLv[j.ab[0]]) || 0);
    const out = [];
    const remaining = new Map();
    const full = result.fullTime || {};
    for (const j of jobs) {
      // full-time seats (locked facilities, devices) are whole Aniimo; the rest can be shared
      const whole = Math.max(Math.floor(j.load + 1e-9), Math.ceil((full[j.job] || 0) - 1e-9));
      const best = pool.filter((a) => can(a, j)).sort((a, b) => b.ab[j.ab[0]] - a.ab[j.ab[0]]
        || allLevels(b) - allLevels(a) || Object.keys(b.ab).length - Object.keys(a.ab).length)[0];
      if (whole > 0 && best) out.push({ aniimo: best, count: whole, jobs: [{ job: j.job, load: whole }] });
      const rest = Math.max(0, j.load - whole);
      if (rest > 1e-6) remaining.set(j.job, { j, rest });
    }
    const spareFill = () => {
      for (const m of out) {
        if (m.count !== 1) continue;
        let spare = 1 - m.jobs.reduce((acc, j) => acc + j.load, 0);
        for (const x of [...remaining.values()].sort((a, b) => b.rest - a.rest)) {
          if (spare <= 1e-6) break;
          if (!can(m.aniimo, x.j)) continue;
          const t = Math.min(spare, x.rest);
          const same = m.jobs.find((j) => j.job === x.j.job);
          if (same) same.load += t; else m.jobs.push({ job: x.j.job, load: t });
          spare -= t; x.rest -= t;
          if (x.rest <= 1e-6) remaining.delete(x.j.job);
        }
      }
    };
    let guard = 0;
    while (remaining.size && guard++ < 200) {
      spareFill();
      if (!remaining.size) break;
      let bestA = null, bestTake = null, bestScore = -1;
      for (const a of pool) {
        const fits = [...remaining.values()].filter((x) => can(a, x.j)).sort((x, y) => y.rest - x.rest);
        let cap = 1, score = 0;
        const take = [];
        for (const x of fits) { const t = Math.min(cap, x.rest); if (t <= 1e-6) break; take.push([x, t]); cap -= t; score += t; }
        const lvl = take.reduce((acc, [x]) => acc + (a.ab[x.j.ab[0]] || 0), 0) * 100 + allLevels(a);
        if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && bestA && lvl > bestA._lvl)) {
          bestA = Object.assign({}, a, { _lvl: lvl }); bestTake = take; bestScore = score;
        }
      }
      if (!bestA || bestScore <= 1e-6) break;
      out.push({ aniimo: bestA, count: 1, jobs: bestTake.map(([x, t]) => ({ job: x.j.job, load: t })) });
      for (const [x, t] of bestTake) { x.rest -= t; if (x.rest <= 1e-6) remaining.delete(x.j.job); }
    }
    return { members: out, total: out.reduce((acc, m) => acc + m.count, 0), uncovered: [...remaining.keys()] };
  }

  // Ideal personality for one roster member (user request): each bench has one MBTI letter that gives +20%
  // there. A personality holds one letter of each pair (E/I, S/N, T/F, J/P), so per pair keep the letter that
  // covers more of this Aniimo's work; "?" = no bench of this member cares about that pair. Crops, devices and
  // benches without a letter get no bonus. Returns the code, which benches each letter helps, and the share
  // of the member's work that gets +20%.
  const PAIRS = [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]];
  function idealPersonality(result, member) {
    const weight = {};                             // letter -> Aniimo-hours of this member's work it would boost
    const benches = {};                            // letter -> facilities
    let total = 0;
    for (const j of member.jobs) {
      const load = j.load * (member.count || 1);
      total += load;
      const lines = (result.lines || []).filter((l) => l.worker === j.job);
      const jobTotal = lines.reduce((s2, l) => s2 + l.aniimo, 0);
      if (!jobTotal) continue;
      for (const l of lines) {
        if (!l.mbti) continue;
        const share = load * l.aniimo / jobTotal;  // this member's part of that line's work
        weight[l.mbti] = (weight[l.mbti] || 0) + share;
        (benches[l.mbti] = benches[l.mbti] || new Set()).add(l.facility);
      }
    }
    let code = "", boosted = 0;
    const help = {};
    for (const [a, b] of PAIRS) {
      const wa = weight[a] || 0, wb = weight[b] || 0;
      if (!wa && !wb) { code += "?"; continue; }
      const pick = wa >= wb ? a : b;
      code += pick;
      boosted += Math.max(wa, wb);
      help[pick] = [...benches[pick]];
    }
    return { code, help, share: total > 0 ? boosted / total : 0 };
  }

  // Highest level of every ability among all Aniimo (optionally counting Prismana forms).
  function bestAbilityLevels(D, includePrismana) {
    const best = {};
    for (const a of D.aniimo || []) {
      if (a.prismana && !includePrismana) continue;
      for (const [ab, lv] of Object.entries(a.ab)) best[ab] = Math.max(best[ab] || 0, lv);
    }
    return best;
  }

  // Best case: the same layout, every job done by the best Aniimo in the game for it, personality matched.
  function bestCase(D, userInputs, includePrismana) {
    D = released(D, (userInputs || {}).unreleased);
    const levels = bestAbilityLevels(D, includePrismana);
    // pens: the best of their own family (Dewy family tops out at Leisure 3, Susuta Prismana has 4)
    const fams = {};
    for (const r of D.recipes) {
      const op = r.fam && mainOp(r);
      if (op) fams[r.fam] = familyBest(D, r.fam, op.ab, includePrismana);
    }
    return Object.assign(plan(D, Object.assign({}, userInputs, { abilityLevels: levels, familyLevels: fams, personality: true })),
      { abilityLevels: levels, familyLevels: fams });
  }

  // Whole facilities per plan line (user: "x46 potato, how many farmland should be potato?"). The LP gives
  // fractions (12.01 Farmland); crops and locked facilities are real plots, so each facility type is
  // rounded with the largest-remainder method: the rounded lines of one type add up to the rounded total
  // of that type, never more than the user has. Part-time benches keep their fraction (busy 30%).
  // Largest remainder: whole numbers that add up to `total`, each at least its `mins` entry (a used crop
  // line, >= 0.2 plot, keeps 1 plot: Potato 0.72 fed the Kvass and the food). If the minimums overshoot,
  // the plot comes back from the value rounded up the most.
  const usedMin = (v) => Math.max(Math.floor(v + 1e-9), v >= 0.2 ? 1 : 0);
  function roundTo(values, total, mins) {
    const floorOf = values.map((v, i) => Math.max(Math.floor(v + 1e-9), mins ? mins[i] : 0));
    const base = floorOf.slice();
    let left = total - base.reduce((a, b2) => a + b2, 0);
    const up = values.map((v, i) => [v - base[i], i]).filter(([r]) => r > 1e-9).sort((a, b2) => b2[0] - a[0]);
    for (const [, i] of up) { if (left <= 0) break; base[i]++; left--; }
    while (left < 0) {                             // minimums above the total: take from the most rounded up
      let donor = -1, best = -Infinity;
      base.forEach((n, j) => { if (n > 0 && n - values[j] > best) { best = n - values[j]; donor = j; } });
      if (donor < 0) break;
      base[donor]--; left++;
    }
    return base;
  }

  // Whole plots per plan line. Rounded in two steps so a device never covers more plots than it can:
  // first the plots under each device setting (and with no device), adding up to the facility's rounded
  // total; then the crops inside each of those. The LP keeps every device area <= its whole coverage, so
  // rounding an area never goes over it. (User, 2026-09-28: the plan said 9 plots under the Sunlamp,
  // the device panel said 8.5; both now read these numbers.)
  function wholeCounts(lines) {
    const out = new Map();
    const byFac = {};
    for (const l of lines) if (l.kind !== "bench") (byFac[l.facility] = byFac[l.facility] || []).push(l);
    for (const ls of Object.values(byFac)) {
      const byZone = new Map();
      for (const l of ls) { const k = l.zone || ""; if (!byZone.has(k)) byZone.set(k, []); byZone.get(k).push(l); }
      const zones = [...byZone.values()];
      const sums = zones.map((z) => z.reduce((s2, l) => s2 + l.count, 0));
      // an area needs room for its own used lines, but never more than ceil(its plots) (<= its coverage)
      const zoneMins = zones.map((z, k) => Math.min(Math.ceil(sums[k] - 1e-9), z.reduce((a, l) => a + usedMin(l.count), 0)));
      const zoneWhole = roundTo(sums, Math.round(sums.reduce((a, b2) => a + b2, 0) + 1e-9), zoneMins);
      zones.forEach((z, k) => {
        const w = roundTo(z.map((l) => l.count), zoneWhole[k], z.map((l) => usedMin(l.count)));
        z.forEach((l, i) => out.set(l, w[i]));
      });
    }
    return out;
  }


  // Alternatives for one roster row (user request): every other Aniimo form that can do ALL of that row's
  // jobs, forms with identical job sets merged. Order (user, 2026-09-28): the most abilities first, since a
  // many-skilled Aniimo can also cover other jobs; then the levels it brings to this row's jobs (faster).
  function alternatives(D, member, includePrismana, minLevels, familyLevels) {
    const minLv = minLevels || {}, famLv = familyLevels || {};   // best case: alternatives reach the best level too
    const needs = member.jobs.map((j) => parseJob(D, j.job)).filter(Boolean)
      .map((p) => [p.ab, Math.max(p.lv, (p.fam ? famLv[p.fam] : minLv[p.ab]) || 0), p.fam]);
    const sig = (a) => a.n + "|" + JSON.stringify(Object.entries(a.ab).sort());
    const chosen = sig(member.aniimo);
    const groups = new Map();
    for (const a of D.aniimo || []) {
      if (!includePrismana && a.prismana) continue;
      if (!needs.every(([ab, lv, fam]) => (a.ab[ab] || 0) >= lv && (!fam || a.fam === fam))) continue;
      if (sig(a) === chosen) continue;
      const g = groups.get(sig(a));
      if (!g) groups.set(sig(a), Object.assign({}, a, { formNames: [a.fn || "Basic Form"] }));
      else g.formNames.push(a.fn || "Basic Form");
    }
    const jobLevels = (a) => needs.reduce((s2, [ab]) => s2 + (a.ab[ab] || 0), 0);
    return [...groups.values()].sort((a, b) => Object.keys(b.ab).length - Object.keys(a.ab).length
      || jobLevels(b) - jobLevels(a) || a.n.localeCompare(b.n));
  }

  const api = { plan, rvLimits, wholeCounts, idealPersonality, alternatives, defaults, workPerMinute, recipeChoices, candidates, bestAbilityLevels, bestCase, roster, formLabel, parseJob, familyBest, released, rvChain, rvTime, useSolver,
    solverName: () => (HIGHS ? "HiGHS" : "built-in") };
  if (typeof module !== "undefined") module.exports = api; else root.Planner = api;
})(this);
