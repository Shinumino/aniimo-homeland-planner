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

  // The +20% personality bonus exists only on a facility that has an MBTI letter: the game's
  // Utils.getHomePetFitPersonality returns 0 (no match) when the facility's mbti is nil, whatever the
  // Aniimo's talents. Farmland, Woodland, the Crackle Generator, the by-hand makers and the devices have
  // none, so "personality" never speeds them up (cross-model audit 2026-10-02, checked in the decompiled
  // Common/Utils/Utils.lua of build 3634150; the planner used to give crops and generators +20%).
  const scaleSpeed = (sp, x) => ({ parts: sp.parts.map((q) => Object.assign({}, q, { h: q.h * x })), fixed: sp.fixed * x });
  const personalityFits = (D, inp, fac) => !!(inp.personality && D.facilities[fac] && D.facilities[fac].mbti);

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
    if (!L || !Array.isArray(L.mats)) return null;   // RV 1 is in the table with no cost (mats null)
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
    // a material with no crafting chain (Mineral Sand, Wood Block: gathered, not crafted) has no steps, so it
    // never got a row above and the estimate said "ready" from coins alone (cross-model audit 2026-10-02:
    // RV 5 with no Mine, RV 6 needs 700 Mineral Sand). It is its own raw input.
    for (const [i, n] of c.mats) if (!mats.some((m) => m.item === i)) mats.push({ item: i, need: n, stages: [] });
    for (const m of mats) {
      m.blocked = [];
      const made = new Set(m.stages.map((st) => st.item));
      m.raw = [];
      const inputs = m.stages.length ? m.stages.flatMap((st) => st.inputs) : [[m.item, m.need]];
      for (const [i, q] of inputs) if (!made.has(i)) {
        const perHour = Math.max(0, net.get(i) || 0);
        m.raw.push({ item: i, need: q, perHour, hours: perHour > 1e-9 ? q / perHour : Infinity });
        if (!(perHour > 1e-9)) m.blocked.push("the plan makes no spare " + (D.items[i] ? D.items[i].n : i));
      }
      const byFac = {};
      for (const st of m.stages) {
        const r = D.recipes.find((x) => x.id === st.recipeId);
        const op = mainOp(r);
        // unfed Aniimo work at noFoodRatio, here as in the plan's columns (it timed stages fed even with feed off:
        // 5x too fast; ChatGPT, cross-model round 2)
        const fed = inp.feed !== false ? 1 : (D.noFoodRatio != null ? D.noFoodRatio : 0.2);
        const rate = (op ? workPerMinute(op.lv, Math.max(op.lv, best[op.ab] || op.lv), op.f, personalityFits(D, inp, st.fac[0])) : 60) * fed;
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

  // Plots one device reaches (user, 2026-10-02: "a little square inside is enough"). HomelandEnvManager takes
  // every plot whose rectangle TOUCHES the device's envBounds (9 x 9), no reduction for a partial overlap. Exact
  // maximum of non-overlapping plots touching it, off the device's own footprint (home_object_data boundSize:
  // Heat Furnace 1x1, Sunlamp 1x1, Cooling Unit 2x2; Woodland 4x4, Farmland 2x2), solved as a 0/1 program
  // 2026-10-02, then corrected by the user's counts below. A best arrangement: the
  // player's own may reach fewer, so the page keeps it editable. The old guess was 16 Farmland / 4 Woodland
  // (whole plots inside a 9 x 9 square), which left a Cherry Blossom plot outside the user's furnace.
  // The rule that matches the user's counts (2026-10-02): a plot counts when at least one whole square of it is
  // inside the 9 x 9 area. Exact packing per device with its own body kept free (home_object_data boundSize),
  // area centred on it, plots on the 1-square grid: Heat Furnace (1x1) 8 Woodland / 24 Farmland = the user's
  // count; Cooling Unit (2x2) 8 / 24 (user counted 8 Woodland, 21 Farmland in their layout; 24 is the best
  // packing, the user's choice); Sunlamp (1x1) as the furnace. Sizes are the same at every level.
  const COVER = { "Heat Furnace": { Farmland: 24, Woodland: 8 }, Sunlamp: { Farmland: 24, Woodland: 8 }, "Cooling Unit": { Farmland: 24, Woodland: 8 } };
  const OLD_COVER = { Farmland: 16, Woodland: 4 };
  // a number per device ({ "Heat Furnace": { Woodland: 8 } }), or one for every device as setups saved before
  // ({ Woodland: 5 }); the old guess in a saved setup means "the default", not a choice
  function coverage(inp, device, fac) {
    const cv = (inp && inp.deviceCoverage) || {};
    const own = cv[device] && cv[device][fac];
    if (own != null && own !== "") return Math.max(0, Number(own) || 0);
    const flat = cv[fac];
    if (flat != null && flat !== "" && Number(flat) !== OLD_COVER[fac]) return Math.max(0, Number(flat) || 0);
    return (COVER[device] || {})[fac] || 0;
  }

  // Mixed plots around one device (user, 2026-10-02: "Woodland with Farmland and a furnace"). Exact packing
  // (0/1 program, one whole square inside, body kept free): with k Woodland, 24 23 22 21 20 18 16 14 12
  // Farmland still fit for k = 0..8, the same for every device. Exactly: w <= 8, w + f <= 24, 2w + f <= 28.
  // In units of the device's own reach (u = w * 8 / Woodland reach, v = f * 24 / Farmland reach) so numbers
  // the user types scale the same shape. The straight line before (w/8 + f/24 <= 1) allowed 0 Farmland with
  // 8 Woodland. Summed over n devices of a setting the three limits are n times as large.
  const PACK = [[1, 0, 8], [1, 1, 24], [2, 1, 28]];   // [a, b, c]: a*u + b*v <= c per device
  function packUnits(inp, device, fac) {             // u or v per plot of this facility
    const reach = coverage(inp, device, fac);
    if (!(reach > 0)) return null;
    return fac === "Woodland" ? { u: 8 / reach, v: 0 } : fac === "Farmland" ? { u: 0, v: 24 / reach } : { u: 0, v: 24 / reach };
  }
  function coverFits(inp, device, w, f, n) {
    const W = packUnits(inp, device, "Woodland"), F = packUnits(inp, device, "Farmland");
    const u = w ? (W ? w * W.u : Infinity) : 0, v = f ? (F ? f * F.v : Infinity) : 0;
    return PACK.every(([a, b, c]) => a * u + b * v <= c * (n || 1) + 1e-9);
  }

  function zoneRatio(r, zone) {
    zone = zone || {};                             // by-hand columns pass none (a crop id ticked by hand threw here; Gemini)
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
      deviceCoverage: {},          // per device; empty = the reach above (coverage())
      // A bench holds one recipe (user, 2026-09-28: "all benches can craft only one recipe"; they can
      // change it by hand, but want a plan they can set and leave). Off = time-share a bench between
      // recipes, which only works if you switch them yourself.
      oneRecipePerBench: true,
      // Power (user, 2026-10-01, from RV 12 with the Power Module): the planner may switch machines to
      // E-mode on Crackle Generators. Off = every machine is worked by an Aniimo, as before.
      power: true,
      unreleased: [],              // species not in the game yet: never planned, listed or suggested
    };
  }

  // Recipes the user can run: facility level, RV module, Recipe Note, and their own on/off list.
  function available(D, inp, ignoreDisabled) {
    const owned = new Set((inp.notes || []).map((n) => n.toLowerCase()));
    const off = new Set(ignoreDisabled ? [] : (inp.disabledRecipes || []).map(Number));
    // a level above what the RV allows counts as the RV's top level here too, so the page's recipe list
    // (recipeChoices) agrees with the plan, which caps it in planOnce (ChatGPT, cross-model audit round 1)
    const lim = inp.rv != null ? rvLimits(D, inp.rv) : null;
    const maxLv = lim ? lim.facilities : null;
    const out = [];
    for (const r of D.recipes) {
      if (off.has(r.id)) continue;
      if (r.note && !owned.has("all") && !owned.has(r.note.toLowerCase())) continue;
      if (r.mod && Math.min(inp.modules[r.mod[0]] || 0, lim ? lim.modules[r.mod[0]] || 0 : Infinity) < Number(r.mod[1])) continue;
      for (const [fac, minLv] of r.fac) {
        const have = inp.facilities[fac];
        const lv = maxLv ? Math.min(have ? have.level || 0 : 0, maxLv[fac] || 0) : have && have.level || 0;
        if (!have || !(have.count > 0) || lv < minLv) continue;
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
  // The ability level of the Aniimo the plan puts on a job (the page's "Aniimo go up to level N")
  function workerLevel(inp, need, ab) {
    if (inp.abilityLevels && ab && inp.abilityLevels[ab] != null) return Math.max(1, Math.min(4, inp.abilityLevels[ab]));
    const top = inp._skillTop && ab && inp._skillTop[ab] ? inp._skillTop[ab] : 4;
    if (inp.workerMaxLevel != null && inp.workerMaxLevel !== "") return Math.max(1, Math.min(4, top, Number(inp.workerMaxLevel)));
    if (inp.workerBonus === "max") return 4;
    return Math.min(4, (need || 1) + (Number(inp.workerBonus) || 0));
  }

  // Power (decompiled HomelandEnvManager.lua / HomeLandUtils.lua, build 3634150). A Crackle Generator makes
  // min(1, its worker's workload a minute / unitWorkload) * electricProduce (updateFacilityElectricProduce);
  // its worker is one Lightning Aniimo, full time. Its level is the Power Module's. Returns what ONE
  // generator makes with the Aniimo this plan can give it, or null when there is no power to plan.
  function powerSupply(D, inp, warnings) {
    const PW = D.power;
    if (inp.power === false || !PW) return null;
    const have = inp.facilities[PW.generatorFacility];
    const top = (PW.generatorByModule || {})[(inp.modules || {})[PW.module] || 0] || 0;
    if (!have || !(have.count > 0) || !top) return null;
    let lv = Number(have.level) || top;
    if (lv > top) {
      warnings.push(PW.generatorFacility + " level " + lv + " needs " + PW.module + " level " + lv + ": planning with level " + top + ".");
      lv = top;
    }
    const g = PW.generators[lv];
    if (!g) return null;
    const fed = inp.feed !== false ? 1 : (D.noFoodRatio != null ? D.noFoodRatio : 0.2);
    // the generator's operations carry no functionId: the default formula (ATK - DEF, x1.2 on a match)
    const rate = workPerMinute(g.lv, workerLevel(inp, g.lv, g.ab), null, personalityFits(D, inp, PW.generatorFacility)) * fed;
    const produce = Math.min(1, rate / g.unitWorkload) * g.produce;
    return produce > 0 ? { lv, count: have.count, produce, worker: g.ab + " " + g.lv + "+" } : null;
  }

  // 1.2 as a fraction (6/5), so the power row compares whole numbers: in floats 4 x 125 x 1.2 is
  // 600.0000000000001, which would not fit in 600
  function rateFraction(rate) {
    for (let d = 1; d <= 1000; d++) if (Math.abs(rate * d - Math.round(rate * d)) < 1e-9) return [Math.round(rate * d), d];
    return [rate, 1];
  }

  function buildColumn(D, inp, r, fac, zone) {
    const dedicated = inp.dedicated.includes(fac);
    const general = (need, ab) => workerLevel(inp, need, ab);
    // a pen is worked by its family only: no better than that family's best (best case: exactly it)
    const petLv = (need, ab) => {
      if (!r.fam) return general(need, ab);
      const top = (inp.familyLevels || {})[r.fam];
      if (top != null) return Math.max(1, top);
      return Math.max(1, Math.min(general(need, ab), familyBest(D, r.fam, ab, false) || 1));
    };
    const fed = inp.feed !== false ? 1 : (D.noFoodRatio != null ? D.noFoodRatio : 0.2);
    const opRate = (o) => workPerMinute(o.lv, petLv(o.lv, o.ab), o.f, personalityFits(D, inp, fac)) * fed;
    let minutes, workerHours, kind, cropJobs = null, speed = null;
    if (r.k === "production") {
      const ratio = zoneRatio(r, zone);
      if (!(ratio > 0)) return null;
      minutes = (r.t - (inp.watered ? r.wc : 0)) / 60 / ratio;
      const ops = r.ops.filter((o) => o.wl).concat(inp.watered && r.wc ? [WATERING, WATERING] : []);
      cropJobs = {};                               // Aniimo-hours per plot-hour, by job ("Earth 1+")
      speed = {};                                  // how those hours were timed, for the roster (see roster)
      for (const o of ops) {
        const key = o.ab + " " + o.lv + "+";
        cropJobs[key] = (cropJobs[key] || 0) + (o.wl / opRate(o) + inp.cropOpOverhead) / minutes;
        const sp = speed[key] = speed[key] || { parts: [], fixed: 0 };
        sp.parts.push({ h: o.wl / opRate(o) / minutes, need: o.lv, pet: petLv(o.lv, o.ab), f: o.f });
        sp.fixed += inp.cropOpOverhead / minutes;  // walking between plots: the same at any level
      }
      workerHours = Object.values(cropJobs).reduce((a, b2) => a + b2, 0);
      kind = "crop";
    } else {
      const op = mainOp(r);
      const rate = op ? opRate(op) : 60;
      minutes = r.wl / rate;
      workerHours = 1;                             // one Aniimo per running facility (user, in game)
      if (op) speed = { parts: [{ h: 1, need: op.lv, pet: petLv(op.lv, op.ab), f: op.f }], fixed: 0 };
      kind = dedicated ? "dedicated" : "bench";
    }
    if (!(minutes > 0)) return null;
    const perHour = 60 / minutes;
    return { r, fac, zone: r.k === "production" ? zone : null, kind, minutes, perHour, workerHours, cropJobs, speed,
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
    if (fastest.capped) p.capped = true;         // either step at the time cap: not proven best
    const rate = p.status === "optimal" ? p.rvRate : t;
    return Object.assign(p.status === "optimal" ? p : fastest, { fastRv: { level: chain.level, reachable: true, rate,
      readyHours: 1 / rate, upgradeHours: chain.secs / 3600, perHour: chain.mats.map(([i, n]) => [i, n * rate]),
      coinForUpgrade: rv.coin * rate } });
  }

  function planCore(D, userInputs) {
    // With HiGHS, plots, benches and devices are whole numbers inside one model: no rounding afterwards,
    // so no crop "shows 0 plots" and no device sits over nothing (both found by the combination sweep,
    // tests/sweep.test.mjs, 2026-09-29). The device passes below are for the hand-written fallback only.
    if (HIGHS) {
      // Power in two passes (measured 2026-10-01): with an E-mode choice on every machine, maxed RV 20 hit the
      // 4 s cap 4.1% under its best (400,109 vs 417,051). Where E-mode is SLOWER than the Aniimo, it only
      // frees an Aniimo, which is worth nothing while the plan has Aniimo to spare (its reduced cost is then
      // <= the Aniimo column's, which is <= 0). In every best plan RV 12-20 all E machines were the faster
      // kind, with 10-14 Aniimo spare. So: plan with the faster ones; only if that plan has no whole Aniimo
      // left over, also try every E-mode choice and keep the better plan.
      userInputs = userInputs || {};               // plan(D) with no inputs (review 4 N3)
      const exact = Object.assign({}, userInputs, { _exact: true });
      if (Object.assign(defaults(D), userInputs || {}).power === false) return planOnce(D, exact);
      // the fastest-upgrade step 1 maximizes upgrades per hour, not coin: compare on what was maximized
      // (Fable review #1: comparing coin kept a 186 h upgrade when 165.5 h was possible)
      const speed = userInputs && userInputs._rv && userInputs._rv.min == null;
      const score = (q) => (speed ? q.rvRate : q.coinPerHour);
      const better = (a, q) => (q.status === "optimal" && (a.status !== "optimal" || score(q) > score(a)) ? q : a);
      // a ticked facility (Aniipod Maker) stays on its Aniimo in this pass: it returns only with Aniimo to
      // spare, and then E-mode would only cost ingredients and power (it runs faster and eats more, 2.4 vs 2 Mega
      // from 14.4 vs 12 Shell, worth no coin). Left as a free 0/1 choice it cost the solver its 4 s at RV 19-20
      // (maxed RV 20 + Mega: 390,234 capped vs 417,051).
      // First a floor: E-mode on Mines and Wells only, where most of the gain is (25 vs 30 min on level-3 ores
      // and water). A small search, never at the cap RV 12-20 (0.5-3.7 s). Then every bench too; the better plan
      // is kept. Measured 2026-10-01: the full search alone ran out of time at RV 19-20 (394,828 at RV 20, the
      // floor gives 403,788; the true best is 417,051), the floor alone gave up 2-3% at RV 16 and 19.
      const names = ["floor", "full"];
      const tried = [planOnce(D, Object.assign({}, exact, { _eFasterOnly: true, _eLockedOnly: true, _handE: 0 })),
                     planOnce(D, Object.assign({}, exact, { _eFasterOnly: true, _handE: 0 }))];
      // read before any flag is copied onto a pass below (review 4 N1: the copied "capped" made the floor look
      // unproven and the no-power solve ran anyway, +3-4 s at RV 20)
      const floorProven = tried[0].status === "optimal" && !tried[0].capped;
      const fast = tried.reduce(better);
      if (!(fast.status === "optimal" && fast.aniimo.pool - fast.aniimo.total >= 1 - 1e-6)) {
        // Aniimo short: every E-mode choice, with any ticked facility held in E-mode (freeing its Aniimo pays
        // now; held, not free, for the solver's sake) and, when something is ticked, held on its Aniimo too
        // (Fable review 3 F2: 5 Mines, 2 Aniimo up to level 2, personality on: 4 Mines in E-mode + the Maker on
        // its Aniimo = 6,124.8, the Maker in E-mode fits only 3 Mines = 5,760)
        tried.push(planOnce(D, Object.assign({}, exact, { _handE: 1 }))); names.push("ticked in E-mode");
        // only when some ticked item can use E-mode at all; otherwise it is the same model again (review 4 N2)
        if (tried[2].handEOffered) { tried.push(planOnce(D, Object.assign({}, exact, { _handE: 0 }))); names.push("ticked on Aniimo"); }
      }
      const passes = tried.map((q, k) => ({ name: names[k], status: q.status, capped: !!q.capped, coin: q.coinPerHour }));
      const best = tried.reduce(better);
      // not proven if any pass that lost ran out of time (Fable review 2 #2, review 3 F4: both directions)
      if (tried.some((q) => q !== best && (q.capped || q.status === "time_limit"))) best.capped = true;
      // Power never shows LESS than no power: a plan without it is a plan with it, so when the search ran out of
      // time the plan without power is solved too and the better one kept. On EVERY path (review 3 F1: the
      // early return above skipped it, and maxed RV 20 showed 386,528 with power vs 394,828 without).
      // A floor solved to the end is already at least the plan without power (that plan is one of its choices),
      // so the extra solve is needed only when the floor itself ran out of time.
      best.passes = passes;
      if (floorProven && best.capped) best.checkedWithoutPower = true;
      if (best.status === "optimal" && best.capped && !floorProven) {
        best.checkedWithoutPower = true;
        const off = planOnce(D, Object.assign({}, exact, { power: false }));
        passes.push({ name: "no power", status: off.status, capped: !!off.capped, coin: off.coinPerHour });
        if (off.status === "optimal" && score(off) > score(best))
          return Object.assign(off, { capped: true, checkedWithoutPower: true, powerNote: "not better within the time limit", passes });
      }
      return best;
    }
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
    if (final.status === "optimal") return final;
    result.warnings = (result.warnings || []).concat("Could not find a plan with one recipe per bench; this plan shares benches between recipes.");
    return result;
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
  // 4 s cap (measured 2026-09-29 with whole plots): RV 11/12 still exact in ~1.5 s; maxed RV 16 -2.5% and
  // RV 20 -0.4% of the true best; a 1 s cap cost RV 20 about 20%. The plan says when the cap was hit.
  const HIGHS_OPTIONS = { output_flag: false, time_limit: 4, mip_rel_gap: 1e-4 };
  // the limit actually given: 4 s on the page's own thread, more where the page stays usable (the Worker sets
  // __highsTimeLimit = 30), so the "best found in N s" the player reads is the real N
  const timeLimit = () => (typeof globalThis !== "undefined" && globalThis.__highsTimeLimit) || HIGHS_OPTIONS.time_limit;
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
    // globalThis.__highsTimeLimit: tests force the time cap with it (review 3 F1)
    const opts = typeof globalThis !== "undefined" && globalThis.__highsTimeLimit ? Object.assign({}, HIGHS_OPTIONS, { time_limit: globalThis.__highsTimeLimit }) : HIGHS_OPTIONS;
    try { r = HIGHS.solve(out.join("\n"), opts); } catch (e) { return null; }
    if (r.Status === "Infeasible") return { status: "infeasible" };
    if (r.Status === "Unbounded") return { status: "unbounded" };
    if (r.Status === "Time limit reached" && !(isFinite(r.ObjectiveValue) && r.Columns && Object.keys(r.Columns).length))
      return { status: "time_limit" };
    const have = r.Status === "Optimal" || r.Status === "Time limit reached";
    if (!have) return null;
    const x = new Array(obj.length).fill(0);
    for (const [k, c] of Object.entries(r.Columns)) x[Number(k.slice(1))] = c.Primal;
    for (const j of ints) x[j] = Math.round(x[j]);
    const value = obj.reduce((a, v, j) => a + v * x[j], 0);
    return { status: "optimal", x, value, capped: r.Status !== "Optimal" };
  }

  const DEVICE_EPS = 0.01;                       // coin/h a placed device "costs" in exact mode (tie-breaker)
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
    // empty / null means "every Aniimo in the home eats"; a negative count would make the food need negative
    if (inp.homeAniimo != null && inp.homeAniimo !== "") inp.homeAniimo = nn(inp.homeAniimo, null);
    if (inp.workerMaxLevel != null && inp.workerMaxLevel !== "") inp.workerMaxLevel = Math.max(1, Math.min(4, Math.round(Number(inp.workerMaxLevel)) || 1));
    // the best level any Aniimo has per skill, Prismana included: "go up to level 4" is timed at 4 only where
    // someone has it (only Prismana forms do, and never Light or Perfumery). The plan timed every job at 4 and
    // the roster could not staff it (ChatGPT, cross-model audit round 2; user: level 4 = Prismana where needed)
    inp._skillTop = bestAbilityLevels(D, true);
    const warnings = [];
    const pool = inp.cap - inp.reserved - inp.haulers;
    if (pool <= 0) warnings.push("No Aniimo left for production: cap - reserved - haulers is " + pool + ".");
    const limits = rvLimits(D, inp.rv);
    const facilities = {};
    for (const [name, f0] of Object.entries(inp.facilities)) {
      let f = f0;
      const fd = D.facilities[name];
      // a level above anything the game has (setup file, direct call) is first brought to the game's top
      if (fd && Number(f.level) > fd.levels.length) f = Object.assign({}, f, { level: fd.levels.length });
      const lvl = fd && fd.levels.find((l) => l.lv === f.level);
      // a level the RV does not allow yet is planned at the highest one it does, like counts below: the
      // plan must only use recipes the player can craft now (a setup file or an RV lowered by hand can
      // carry a higher level; the plan used to keep it and list recipes nobody could make yet)
      let level = f.level;
      if (lvl && lvl.rv != null && lvl.rv > inp.rv) {
        level = Math.max(1, limits.facilities[name] || 1);
        warnings.push(name + " level " + f.level + " needs RV " + lvl.rv + ": planning with level " + level + ".");
      }
      const max = limits.counts[name];
      let count = f.count;
      if (max != null && count > max) {
        warnings.push("RV " + inp.rv + " allows " + max + " " + name + ", not " + count + ": planning with " + max + ".");
        count = max;
      }
      facilities[name] = { count, level };
    }
    inp.facilities = facilities;
    // module levels too: a level the RV does not allow unlocked its recipes (RV 7 with Ecological Module 3
    // planned Quick Potato, 92 Potato/h a plot instead of 15; ChatGPT + Gemini Flash, cross-model round 2)
    const modules = {};
    for (const [m, v] of Object.entries(inp.modules || {})) {
      const max = limits.modules[m] || 0, want = Math.min(Number(v) || 0, (D.modules[m] || []).length);
      if (want > max) {
        const row = (D.modules[m] || []).find((l) => l.lv === want);
        warnings.push(m + " level " + want + " needs RV " + (row ? row.rv : "?") + ": planning with level " + max + ".");
      }
      modules[m] = Math.min(want, max);
    }
    inp.modules = modules;

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
    const coverOf = (fac, device) => coverage(inp, device, fac);
    for (const { r, fac } of available(D, inp)) {
      // a device only helps crops that ask for a temperature or light; others stay off device plots,
      // and a facility the devices cannot cover (coverage 0) only gets the no-device zone
      const zs = r.k === "production" ? (needsEnv(r) ? zones.filter((z) => z === neutral || coverOf(fac, z.fac) > 0) : [neutral]) : [null];
      for (const z of zs) {
        // a device setting only for crops it speeds up (user, 2026-10-02: Cherry Blossom wants Warm +1; under
        // Scorching +2 it is 1 off, 80%, exactly as with no device, and the plan listed it there for nothing)
        if (z && z !== neutral && !(zoneRatio(r, z) > zoneRatio(r, neutral))) continue;
        const c = buildColumn(D, inp, r, fac, z); if (c) cols.push(c);
      }
    }
    // E-mode (user, 2026-10-01): a machine whose level has a power need can run the recipe's E twin. Its only
    // step is operation 5002, a timer (type 3): no Aniimo, food or personality; `time` seconds at 100% power.
    // Only full 120% is planned (the user's choice: an overloaded network slows every machine on it), so the
    // cycle is time / 1.2. Confirmed in game: Mine Lv 4, Copper Ore, 120%, 25 min, "Aniimo are not required".
    // Only with HiGHS: the hand-written fallback does not branch on the generator count, and rounding it
    // put 5 Mines on one Lv 1 generator (720 > 600; Fable review #4)
    const gen = HIGHS ? powerSupply(D, inp, warnings) : null;
    if (gen) for (const { r, fac } of available(D, inp)) {
      if (!r.e || r.k !== "processing") continue;
      const fl = D.facilities[fac] && D.facilities[fac].levels.find((l) => l.lv === inp.facilities[fac].level);
      if (!fl || !fl.pw) continue;
      const minutes = r.e.t / 60 / D.power.maxRate;
      // first pass (planCore): only where E-mode is faster than the Aniimo on the same machine
      if (inp._eFasterOnly) {
        const a = cols.find((c) => c.r === r && c.fac === fac && c.kind !== "electric");
        if (a && !(minutes < a.minutes - 1e-9)) continue;
      }
      if (inp._eLockedOnly && !inp.dedicated.includes(fac)) continue;   // the floor pass: Mines and Wells only
      cols.push({ r, fac, zone: null, kind: "electric", minutes, perHour: 60 / minutes, workerHours: 0, cropJobs: null, op: null, pw: fl.pw,
        locked: inp.dedicated.includes(fac) });
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
    // E-mode machines are whole in both modes: one with an E recipe set draws its power, busy or not
    // (HomelandEnvManager.checkNeedElectricCost: formula set and not disabled)
    const oneRecipe = inp.oneRecipePerBench !== false;
    // ... and so are locked facilities worked by Aniimo (Mines, Wells, pens): they cannot be time-shared, and in
    // time-share mode the table showed "Well 0" for 0.12 of a Well (audit 2026-10-02)
    const whole = cols.map((c, j) => ((oneRecipe ? c.kind !== "crop" : c.kind === "electric" || c.kind === "dedicated") ? j : -1)).filter((j) => j >= 0);
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
    // "Make for yourself" recipes are not set and left: you switch the Aniipod Maker to Mega when you want
    // Aniipods. Routing them made 1 Aniipod Mega a day cost 4,266 coin/h (a friend's RV 10 setup,
    // 2026-09-28): all Shell had to go to the Maker, none could be sold. So their ingredients stay free.
    const byHand = (j2) => cols[j2].r.out.some(([o]) => keep.some(([k]) => k === o));
    for (const j2 of (oneRecipe ? whole : []).filter((j3) => !byHand(j3))) for (const [i2] of cols[j2].r.in) { if (!consumers.has(i2)) consumers.set(i2, []); if (!consumers.get(i2).includes(j2)) consumers.get(i2).push(j2); }
    // Made by hand (page tick boxes: Aniipods, Growth Bud/Flower/Fruit). The facility is set to that recipe
    // and left out of the plan; it takes its ingredients at full speed, and only that. So the plan sets
    // aside exactly that much (Aniipod Mega: 6 Shell per Mega, 2 Megas an hour with a level-3 Aniimo =
    // 12 Shell an hour) and at least one whole facility must make each ingredient (a Mine on Clay for
    // Aniipod Pro, a Potato plot for Growth Bud). The rest of the ingredient is the plan's as usual.
    // History (user, 2026-09-28): first nothing was set aside (Pro had no Clay), then ALL of the ingredient
    // was held back, so ticking Mega could not sell a single Shell and the plan moved 5 Mines to Clay.
    // a ticked item needs its facility at the recipe's level, and one facility makes one item: the page offers
    // only that, a setup file or a direct call did not (no Maker at all, or two items on RV 6's one Maker;
    // Gemini Flash + ChatGPT, cross-model round 2)
    const handUsed = {};
    const handOk = (r) => {
      const f = r.fac[0][0];
      // level as the E-mode code below reads it: byHandLevels (the page takes ticked facilities out of
      // `facilities`), else the layout, else the RV's top. "Ticked with no Maker at all" is the page's to stop
      // (it offers items only for facilities you have): the engine cannot tell it from "taken out to tick".
      const lv = (inp.byHandLevels || {})[f] != null ? Number(inp.byHandLevels[f]) : inp.facilities[f] ? inp.facilities[f].level : limits.facilities[f];
      if (!(Math.min(Number(lv) || 0, limits.facilities[f] || 0) >= r.fac[0][1])) {
        warnings.push((D.items[r.out[0][0]] ? D.items[r.out[0][0]].n : r.id) + " needs " + f + " level " + r.fac[0][1] + ": not planned.");
        return false;
      }
      handUsed[f] = (handUsed[f] || 0) + 1;
      if (handUsed[f] > (limits.counts[f] != null ? limits.counts[f] : 1)) {
        warnings.push("RV " + inp.rv + " allows " + (limits.counts[f] || 0) + " " + f + ": " + (D.items[r.out[0][0]] ? D.items[r.out[0][0]].n : r.id) + " not planned.");
        return false;
      }
      return true;
    };
    // only crafted items can be made by hand: a crop id (setup file, direct call) is not one (Gemini Flash, final)
    const handRecipes = (inp.byHand || []).map(Number).map((id) => D.recipes.find((r) => r.id === id)).filter((r) => r && r.k !== "production")
      .map((r) => ({ r, c: buildColumn(D, inp, r, r.fac[0][0], null) })).filter((x) => x.c)
      // ... and only if the layout can make its ingredients: Mega ticked at RV 6 (no Mine digs Shell before RV 9)
      // kept a Lightning 3 seat and "set aside 12 Shell/h" next to "Nothing can make Shell" (audit 2026-10-02)
      .filter(({ r }) => {
        const miss = r.in.filter(([i]) => !cols.some((c) => c.r.out.some(([o]) => o === i)));
        for (const [i] of miss) warnings.push("Nothing in your layout can make " + (D.items[i] ? D.items[i].n : i) + ".");
        return !miss.length;
      })
      .filter(({ r }) => handOk(r));               // after the ingredient check, which names what is missing first
    // A ticked facility in E-mode (user, 2026-10-01: "add the Aniipod Maker into the calculation, if it is worth
    // E-power or not"). In E-mode it runs its own 120% timer whenever its ingredients are in storage, so it
    // makes MORE than on its Aniimo and eats that much more (Fable review 2 #1: the first version set aside the
    // Aniimo's 12 Shell/h while the machine took 14.4; with Aniimo up to level 1, 4 vs 14.4). So with h = 1 the
    // set-aside is the E rate. Offered only where the timer is at least as fast as the Aniimo, so ticking never
    // gives fewer of what you asked for (Basic Aniipod: not at level 2+, 15 min vs 25; at level 1 it is 30 vs 25).
    // The planner then picks: one Aniimo full time, or the facility's power x 1.2 on the generators.
    const handE = gen ? handRecipes.map(({ r, c }, k) => {
      const f = r.fac[0][0];
      // the page takes ticked facilities out of `facilities`, so it passes their level in byHandLevels
      const lv = (inp.byHandLevels || {})[f] != null ? Number(inp.byHandLevels[f]) : inp.facilities[f] ? inp.facilities[f].level : limits.facilities[f];
      const fl = D.facilities[f] && D.facilities[f].levels.find((l) => l.lv === lv);
      if (!r.e || !fl || !fl.pw) return null;       // (r.e first: a ticked recipe without an E twin; review 3 F5)
      const minutesE = r.e.t / 60 / D.power.maxRate;
      if (minutesE > c.minutes + 1e-9) return null;
      return { k, pw: fl.pw, perHourE: 60 / minutesE };
    }).filter(Boolean) : [];
    const handNeed = new Map();                    // item -> per hour the by-hand facilities take
    for (const { r, c } of handRecipes) for (const [i, q] of r.in) handNeed.set(i, (handNeed.get(i) || 0) + q * c.perHour);
    // "can make": some recipe in the layout outputs it (Clay is in `items` through Pottery's input even with
    // no Mine, and the plan then failed with "cannot feed 32 Aniimo"; Fable review 2 #4)
    const usedCols = [...new Set([...consumers.values()].flat())];
    const ownU = usedCols.filter((j2) => inp.facilities[cols[j2].fac].count > 1);
    const uBase = yBase + whole.length, uOwn = new Map(ownU.map((j2, k) => [j2, uBase + k]));
    const uOf = new Map(usedCols.map((j2) => [j2, uOwn.has(j2) ? uOwn.get(j2) : yOf.get(j2)]));
    // A recipe in E-mode and the same recipe on an Aniimo are ONE recipe for routing (its ingredient goes to
    // that recipe, on whichever machine): the E column uses its Aniimo twin's switch, y_E <= count * u_A.
    // As two consumers, "2 dryers on Dried Strawberries, one in E-mode" was infeasible (Fable review #2).
    const sharedU = [];
    for (const jE of ownU) {
      if (cols[jE].kind !== "electric") continue;
      const jA = ownU.find((j3) => cols[j3].kind !== "electric" && cols[j3].r === cols[jE].r && cols[j3].fac === cols[jE].fac);
      if (jA == null) continue;
      uOf.set(jE, uOwn.get(jA)); sharedU.push([jE, uOwn.get(jA)]); uOwn.delete(jE);
    }
    // fastest upgrade: t = upgrades per hour (see plan)
    const rv = inp._rv || null;
    // Never fed to a plan bench: kept items, the RV materials while planning the upgrade, and what a by-hand
    // facility takes (it would race the bench for it, first Aniimo to arrive wins; Fable review #4).
    const isKept = (i2) => keep.some(([k]) => k === i2) || !!(rv && rv.mats.some(([k]) => k === i2)) || handNeed.has(i2);
    // Full flags (Fable review #3): a set bench with its ingredient in storage keeps working, so a routed
    // ingredient is either all used by its bench, or the bench runs flat out and the rest piles up for you
    // to sell by hand. f[j] = 1 means bench recipe j runs full (x = y). Without this the plan could route
    // 11.2 Wool/h to a Loom, run it 1.3% of the time and throw 3.2 Wool/h away. Exact solver only: the
    // hand-written fallback cannot branch on these, so it keeps the older, looser rule.
    const exact = !!HIGHS;
    const routed = exact ? [...consumers].filter(([i2]) => !isKept(i2)) : [];
    const fCols = [...new Set(routed.flatMap(([, js]) => js))];
    const fBase = uBase + ownU.length, fOf = new Map(fCols.map((j2, k) => [j2, fBase + k]));
    // Surplus flags (user, 2026-09-29: "a bench that runs out of one ingredient stops; the others wait in
    // storage, they do not rot or lose value"). s[i] = 1: routed item i piles up (and may be sold). A set
    // bench that is not full runs out of ONE of its ingredients, so at most (its ingredients - 1) have
    // surplus; a full bench may leave surplus of all. The first version asked a non-full bench to use up
    // every ingredient exactly, which with whole plots cost 6-13% and was slow (Fable review 2 #1).
    const sItems = routed.map(([i2]) => i2);
    const sBase = fBase + fCols.length, sOf = new Map(sItems.map((i2, k) => [i2, sBase + k]));
    const tIdx = rv ? sBase + sItems.length : -1;
    const gIdx = gen ? sBase + sItems.length + (rv ? 1 : 0) : -1;   // generators placed and worked
    const hBase = sBase + sItems.length + (rv ? 1 : 0) + (gen ? 1 : 0);   // h: ticked facility in E-mode (0/1)
    const n = hBase + handE.length;
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
      // A locked facility (Mine, Well, pens) keeps its Aniimo and works non-stop: set to a recipe, it runs
      // flat out (x = y). Before, a Mine could be set to Shell and run 1.5% of the time for a few Shells,
      // which the table showed as "Mine 0" (a friend's RV 10 setup, 2026-09-28).
      // E-mode on a locked facility too (Fable review #3: "Mine E-mode busy 75%" is not something you can set)
      if (cols[j].kind === "dedicated" || cols[j].locked) {
        const full = new Array(n).fill(0);
        full[j] = -1; full[y] = 1;
        rows.push(full); b.push(0);
      }
    }
    const cover = inp.deviceCoverage || {};
    zoneList.forEach((z, k) => {                   // crops under a device setting <= what those devices cover
      // three packing limits (PACK) instead of one straight line
      for (const [a, b2, cap] of PACK) {
        const pr = new Array(n).fill(0);
        cols.forEach((c, j) => { if (c.zone === z) { const un = packUnits(inp, z.fac, c.fac); if (un) pr[j] = a * un.u + b2 * un.v; } });
        pr[zBase + k] = -cap;
        rows.push(pr); b.push(0);
      }
      // and a device has at least one plot under it: a tiny coin cost was not enough, the solver's tolerance
      // (~5 coin on 50,000) let a Heat Furnace stay over nothing (sweep, 2026-09-29)
      const some = new Array(n).fill(0);
      cols.forEach((c, j) => { if (c.zone === z) some[j] = -1; });
      some[zBase + k] = 1;
      rows.push(some); b.push(0);
    });
    zoneList.forEach((z, k) => {                   // fixed devices: placed <= the count decided
      const fixed = (inp._deviceFix || {})[z.fac + "|" + z.setting];
      if (!fixed) return;
      const row = new Array(n).fill(0);
      row[zBase + k] = 1;
      rows.push(row); b.push(fixed);
    });
    // whole devices: placed >= what an earlier pass rounded up to. Not in the final solve (_deviceFix is only
    // an upper bound there, devices are whole numbers instead): forcing it kept a Heat Furnace with nothing
    // under it at RV 12 (Fable review #2).
    zoneList.forEach((z, k) => {
      const min = (inp._deviceMin || {})[z.fac + "|" + z.setting];
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
    for (const [i, k] of items) { rows.push(new Array(n).fill(0)); b.push(-(keepOf.get(i) || 0) - (handNeed.get(i) || 0)); }  // made >= used + sold + kept + by hand
    handE.forEach((h, i) => {                      // in E-mode the set-aside is the E rate: + q (E - Aniimo) on h
      const { r, c } = handRecipes[h.k];
      for (const [it, q] of r.in) if (items.has(it)) rows[itemBase + items.get(it)][hBase + i] += q * (h.perHourE - c.perHour);
    });
    for (const i of handNeed.keys()) {             // facilities (plots, Mines) making it >= 1
      const row = new Array(n).fill(0);
      cols.forEach((c, j) => { if (c.r.out.some(([o]) => o === i)) row[j] = -1; });
      if (row.some((v) => v)) { rows.push(row); b.push(-1); }
    }
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
    // each by-hand facility keeps one Aniimo working it (the Maker runs flat out on a Lightning Aniimo):
    // those come out of the budget (Fable review #1)
    const handAniimo = handRecipes.reduce((a, { c }) => a + c.workerHours, 0);
    if (gen) workerRow[gIdx] = 1;                  // each generator keeps one Lightning Aniimo on it
    handE.forEach((h, i) => { workerRow[hBase + i] = -handRecipes[h.k].c.workerHours; });   // E-mode frees its seat
    if (inp._handE != null) handE.forEach((h, i) => {   // held at exactly 0 or 1 (planCore's passes)
      const lo = new Array(n).fill(0); lo[hBase + i] = -1; rows.push(lo); b.push(-inp._handE);
      const hi = new Array(n).fill(0); hi[hBase + i] = 1; rows.push(hi); b.push(inp._handE);
    });
    rows.push(workerRow); b.push(Math.max(0, pool) - handAniimo);
    if (gen) {
      // full 120%: power drawn x 1.2 <= power made, all generators on one pole network (their outputs add up,
      // HomelandEnvManager link groups); as whole numbers via 1.2 = 6/5
      const [num, den] = rateFraction(D.power.maxRate);
      const row = new Array(n).fill(0);
      cols.forEach((c, j) => { if (c.kind === "electric") row[yOf.get(j)] = c.pw * num; });
      handE.forEach((h, i) => { row[hBase + i] = h.pw * num; });
      row[gIdx] = -gen.produce * den;
      rows.push(row); b.push(0);
      const most = new Array(n).fill(0); most[gIdx] = 1; rows.push(most); b.push(gen.count);

    }

    for (const [j2, u] of sharedU) {               // E twin: y_E <= count * u (its Aniimo twin's switch)
      const row = new Array(n).fill(0); row[yOf.get(j2)] = 1; row[u] = -inp.facilities[cols[j2].fac].count; rows.push(row); b.push(0);
    }
    for (const [j2, u] of uOwn) {                  // y <= count * u
      const row = new Array(n).fill(0); row[yOf.get(j2)] = 1; row[u] = -inp.facilities[cols[j2].fac].count; rows.push(row); b.push(0);
    }
    // most of an item one hour can hold: everything that makes it, flat out (the M of the sell rows)
    const most = (i2) => cols.reduce((acc, c) => acc + c.r.out.filter(([o]) => o === i2).reduce((a, [, q]) => a + q, 0)
      * c.perHour * (inp.facilities[c.fac] ? inp.facilities[c.fac].count : 0), 0) + 1;
    for (const [j2, f] of fOf) {                   // f = 1: x >= y (the bench runs full)
      const cnt = inp.facilities[cols[j2].fac].count;
      const row = new Array(n).fill(0); row[j2] = -1; row[yOf.get(j2)] = 1; row[f] = cnt; rows.push(row); b.push(cnt);
      // and only a recipe that is set can be "full": otherwise an unused recipe (0 of 0 benches) switched the
      // rule off and Strawberry was sold while its Tanghulu bench ran 10% (found by the sweep, 2026-09-29)
      const set = new Array(n).fill(0); set[f] = 1; set[uOf.get(j2)] = -1; rows.push(set); b.push(0);
      // a set, not-full bench leaves surplus in at most K - 1 of its K ingredients:
      // sum s - f - K (1 - u) <= K - 1
      const ins = cols[j2].r.in.map(([i2]) => i2).filter((i2) => sOf.has(i2));
      if (ins.length) {
        const K = ins.length;
        const lim = new Array(n).fill(0);
        for (const i2 of ins) lim[sOf.get(i2)] += 1;
        lim[f] -= 1; lim[uOf.get(j2)] += K;
        rows.push(lim); b.push(2 * K - 1);
      }
    }
    for (const [i2, js] of consumers) {
      const kept = isKept(i2);
      const si = sellable.indexOf(i2), ei = foods.indexOf(i2);
      const market = si >= 0 || ei >= 0;
      if (exact && !kept) {                        // surplus of a routed item only when flagged: surplus <= M (1 - routed) + M s
        const M = most(i2);
        const row = rows[itemBase + items.get(i2)].map((v) => -v);
        for (const u of new Set(js.map((j2) => uOf.get(j2)))) row[u] += M;   // a shared switch once (review #2)
        row[sOf.get(i2)] -= M;
        rows.push(row); b.push(M);
      }
      if (js.length < 2 && !market && !kept) continue;
      if (kept || !market || js.length > 1) {     // one recipe per ingredient (none for kept items)
        const row = new Array(n).fill(0); for (const j2 of js) row[uOf.get(j2)] = 1; rows.push(row); b.push(kept ? 0 : 1);
      }
      if (!market || kept) continue;
      const M = most(i2);                         // routed: sold + eaten <= M (1 - routed), unless it has surplus
      const row = new Array(n).fill(0);
      if (si >= 0) row[nx + si] = 1;
      if (ei >= 0) row[nx + ns + nb + ei] = 1;
      for (const j2 of js) row[uOf.get(j2)] = M;
      if (sOf.has(i2)) row[sOf.get(i2)] = -M;
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
    // exact mode: devices and crop plots are whole numbers too; a device costs a hair of coin so an
    // unneeded one is never placed just because its Aniimo happens to be free
    const devInts = inp._deviceFix || inp._exact ? zoneList.map((z, k) => zBase + k) : [];
    const cropInts = inp._exact ? cols.map((c, j) => (c.kind === "crop" ? j : -1)).filter((j) => j >= 0) : [];
    if (inp._exact) zoneList.forEach((z, k) => { obj[zBase + k] -= DEVICE_EPS; });
    if (gen) obj[gIdx] -= DEVICE_EPS;              // an idle generator is never placed
    // a ticked facility goes to E-mode when the power is spare: it frees an Aniimo (e.g. your one Lightning 3)
    // (no tie-breaker on h: planCore holds it at 0 or 1 in every pass, so a tie is decided by the passes:
    // the Maker keeps its Aniimo unless Aniimo are short; review 3 F6)
    // nor a machine set to E-mode with nothing to do: it would draw power and show in no line (RV 20, power test)
    cols.forEach((c, j) => { if (c.kind === "electric") obj[yOf.get(j)] -= DEVICE_EPS; });
    const hVars = handE.map((h, i) => hBase + i);
    const ints = [...yOf.values(), ...uOwn.values(), ...fOf.values(), ...sOf.values(), ...devInts, ...cropInts, ...(gen ? [gIdx] : []), ...hVars];
    let res = HIGHS ? solveHighs(obj, rows, b, ints, [...uOwn.values(), ...fOf.values(), ...sOf.values(), ...hVars]) : null;
    // HiGHS at its time cap with nothing found: say so. Falling back to the hand-written solver ran a
    // different model and once took 49 s (Fable review 2 #2). Only a missing/broken HiGHS falls back.
    if (res && res.status === "time_limit") {
      warnings.push("No plan found within " + timeLimit() + " s. Try fewer options or a smaller layout.");
      return { status: "time_limit", warnings, inputs: inp };
    }
    const builtIn = !res;                          // HiGHS absent, or it threw mid-solve (solveHighs returns null)
    if (!res) res = whole.length ? solveWhole(obj, rows, b, groups, new Map([...yOf].map(([j, y]) => [y, j])), route) : LP.solve(obj, rows, b);
    if (res.status === "infeasible") {
      const why = [];
      if (foodNeed > 0) why.push("feed " + eaters + " Aniimo");
      if (keep.length) why.push("make what you asked to keep");
      warnings.push("This layout cannot " + (why.join(" and ") || "work") + " with the Aniimo available. Lower a target, add facilities, or turn food planning off.");
    }
    if (res.status !== "optimal") return { status: res.status, warnings, inputs: inp };
    // Built-in solver only (HiGHS could not load): it leaves plots fractional, and the page then showed whole
    // plots (wholeCounts) next to coin from the fractions (RV 2: "2 plots", 218 coin/h; 2 plots make 200. ChatGPT,
    // cross-model round 2; Gemini Flash proposed this fix). So fix every crop column at the whole plots the page
    // will show and solve the rest again; if that cannot work, at the plots rounded down; else keep the LP's.
    if (builtIn) {                                 // (it read !HIGHS: a HiGHS that threw skipped this; ChatGPT, final)
      const crop = cols.map((c, j) => (c.kind === "crop" ? j : -1)).filter((j) => j >= 0);
      if (crop.some((j) => Math.abs(res.x[j] - Math.round(res.x[j])) > 1e-6)) {
        const probe = cols.map((c, j) => ({ facility: c.fac, zone: c.zone && c.zone.name !== "No device" ? c.zone.name : null, count: res.x[j], kind: c.kind }));
        const shown = wholeCounts(probe);
        const fixAt = (val) => {
          const R = rows.map((r) => r.slice()), B = b.slice();
          for (const j of crop) {
            const v = val(j), lo = new Array(obj.length).fill(0), hi = new Array(obj.length).fill(0);
            lo[j] = -1; hi[j] = 1; R.push(lo, hi); B.push(-v, v);
          }
          return whole.length ? solveWhole(obj, R, B, groups, new Map([...yOf].map(([j, y]) => [y, j])), route) : LP.solve(obj, R, B);
        };
        let fixed = fixAt((j) => shown.get(probe[j]) || 0);
        if (!fixed || fixed.status !== "optimal") fixed = fixAt((j) => Math.floor(res.x[j] + 1e-9));
        if (fixed && fixed.status === "optimal") res = fixed;
        else {                                     // no whole-plot plan: say so, never show fractions as plots (ChatGPT, r3)
          warnings.push("No plan with whole plots fits these Aniimo.");
          return { status: "infeasible", warnings, inputs: inp };
        }
      }
    }

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
        // whole benches set to this recipe: no more than the work needs. Benches above that are a tie the solver's
        // gap leaves (maxed RV 13: "Carousel Mill 2 benches, busy 15%", 1 bench gives the same coin; audit
        // 2026-10-02). Locked facilities (and E-mode on them) run flat out, so they keep the solver's count.
        benches: !yOf.has(j) ? null : c.kind === "dedicated" || c.locked ? Math.round(res.x[yOf.get(j)])
          : Math.min(Math.round(res.x[yOf.get(j)]), Math.max(1, Math.ceil(x - 1e-6))),
        pw: c.kind === "electric" ? c.pw : undefined,
        minutesPerCycle: c.minutes, cyclesPerHour: c.perHour * x,
        lineValue: (valueOut - valueIn) * c.perHour * x,       // same convention as the site's lines
        aniimo: c.workerHours * x,
        cropJobs: c.cropJobs ? Object.fromEntries(Object.entries(c.cropJobs).map(([k, v]) => [k, v * x])) : null,
        speed: c.speed && (c.cropJobs ? Object.fromEntries(Object.entries(c.speed).map(([k, sp]) => [k, scaleSpeed(sp, x)]))
          : scaleSpeed(c.speed, x)),
        worker: c.kind === "electric" ? "E-mode" : c.op ? jobName(D, c.op.ab, c.op.lv, c.r.fam) : c.r.ops.filter((o) => o.wl).map((o) => o.ab + " " + o.lv + "+").join(", ") + (inp.watered && c.r.wc ? ", Water 1+ (watering)" : ""),
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
      // crops under it at less than full speed (one setting per device: Maple Syrup, wanting Cold -2, at 80%
      // under Cool -1 beside Ginseng; correct, but it read like a bug without the number; audit 2026-10-02)
      const slow = [...new Set(cols.filter((c, j) => c.zone === z && res.x[j] > 1e-6 && zoneRatio(c.r, z) < 1)
        .map((c) => c.r.out[0][0] + "|" + zoneRatio(c.r, z)))].map((k) => { const [i, rt] = k.split("|"); return { item: Number(i), ratio: Number(rt) }; });
      // no more devices than their plots need (maxed RV 20: "2 Cooling Units" over 13 Farmland, one covers 16;
      // a tie under the solver's gap; audit 2026-10-02)
      let need = 1;                                // fewest devices whose packing holds what is under them
      while (need < 1000 && !coverFits(inp, z.fac, under.Woodland || 0, under.Farmland || 0, need)) need++;
      const place = Math.min(Math.ceil(placed - 1e-6), need);
      return { facility: z.fac, setting: z.setting, count: Math.min(placed, place), place, worker: z.worker, max: z.max, under, crops, slow };
    }).filter((d) => d.count > 1e-6);
    const zoneSeats = devices.reduce((acc, d) => acc + d.count, 0);
    const handOn = new Map(handE.filter((h, i) => Math.round(res.x[hBase + i]) === 1).map((h) => [h.k, h]));   // ticked, in E-mode
    // power drawn by the machines the plan sets (lines, whole machines) and ticked facilities in E-mode
    const eDraw = lines.reduce((a, l) => a + (l.kind === "electric" ? l.benches * l.pw : 0), 0) + [...handOn.values()].reduce((a, h) => a + h.pw, 0);
    // and no more generators than that needs at 120% (same tie as benches and devices)
    const G = !gen ? 0 : Math.min(Math.round(res.x[gIdx]), eDraw > 0 ? Math.ceil(eDraw * D.power.maxRate / gen.produce - 1e-9) : 0);
    const handSeats = handRecipes.reduce((a, { c }, k) => a + (handOn.has(k) ? 0 : c.workerHours), 0);
    const used = { dedicated: 0, bench: 0, crop: 0, electric: 0, devices: zoneSeats, byHand: handSeats, generators: G };
    for (const l of lines) used[l.kind] += l.aniimo;
    const abilityNeeds = {};                       // job -> Aniimo-hours per hour (1 = one Aniimo full time)
    const fullTime = {};                           // part of that which is one indivisible full-time seat
    // job -> how its hours were timed: { parts: [{ h, need, pet, f }], fixed }. The plan times every job at
    // the assumed level (pet); the roster rescales the parts for the Aniimo it actually picks. Seats (devices,
    // generators, by-hand makers) are fixed: a slower Aniimo there makes less, it does not take longer.
    const abilitySpeed = {};
    const addSpeed = (job, sp) => { const t = abilitySpeed[job] = abilitySpeed[job] || { parts: [], fixed: 0, seat: 0 };
      if (sp) { t.parts.push(...sp.parts); t.fixed += sp.fixed; } };
    const addFixed = (job, h) => { addSpeed(job, { parts: [], fixed: h }); };
    // seats are booked whole by roster() before any sharing; their hours must not mix into the shared work's
    // slowdown (RV 6: a Well seat made shared watering x1.20 where the crops alone give x1.03; ChatGPT, r3)
    const addSeat = (job, h) => { addSpeed(job, null); abilitySpeed[job].seat += h; };
    for (const l of lines) {
      if (l.kind === "crop") {
        for (const [k, v] of Object.entries(l.cropJobs || {})) {
          abilityNeeds[k] = (abilityNeeds[k] || 0) + v;
          if (l.speed && l.speed[k]) addSpeed(k, l.speed[k]); else addFixed(k, v);
        }
        continue;
      }
      if (l.kind === "electric") continue;         // no Aniimo on an E-mode machine
      abilityNeeds[l.worker] = (abilityNeeds[l.worker] || 0) + l.aniimo;
      if (l.kind === "dedicated") addSeat(l.worker, l.aniimo);
      else if (l.speed) addSpeed(l.worker, l.speed); else addFixed(l.worker, l.aniimo);
      if (l.kind === "dedicated") fullTime[l.worker] = (fullTime[l.worker] || 0) + l.aniimo;
    }
    for (const d of devices) {
      abilityNeeds[d.worker] = (abilityNeeds[d.worker] || 0) + d.place;
      addSeat(d.worker, d.place);
      fullTime[d.worker] = (fullTime[d.worker] || 0) + d.place;
    }
    if (G) {                                       // a generator is a full-time seat for its Lightning Aniimo
      abilityNeeds[gen.worker] = (abilityNeeds[gen.worker] || 0) + G;
      addSeat(gen.worker, G);
      fullTime[gen.worker] = (fullTime[gen.worker] || 0) + G;
    }
    for (const [k, { r, c }] of handRecipes.entries()) {   // a by-hand facility is a full-time seat for its worker
      if (handOn.has(k)) continue;                 // ... unless it runs in E-mode
      const op = mainOp(r);
      if (!op) continue;
      const job = jobName(D, op.ab, op.lv, r.fam);
      abilityNeeds[job] = (abilityNeeds[job] || 0) + c.workerHours;
      addSeat(job, c.workerHours);
      fullTime[job] = (fullTime[job] || 0) + c.workerHours;
    }
    if (Number(inp.workerMaxLevel) === 4) {      // say where "level 4" could not be used
      const low = [...new Set(Object.keys(abilityNeeds).map((j) => parseJob(D, j)).filter((q) => q && !q.fam && (inp._skillTop[q.ab] || 0) < 4).map((q) => q.ab))].sort();
      if (low.length) warnings.push("No Aniimo has " + low.join(", ") + " at level 4: planned at level 3.");
    }
    // coin per hour is what is sold minus what is bought, whatever the solver's objective was (the fastest-
    // upgrade step 1 maximizes speed; its objective is not coin; Fable review #6)
    const coin = sold.reduce((a, x2) => a + x2.coin, 0) - bought.reduce((a, x2) => a + x2.coin, 0);
    return {
      status: "optimal", inputs: inp, warnings,
      capped: !!res.capped,                        // the solver stopped at its time cap: best found, not proven best
      rvRate: rv ? res.x[tIdx] : null,
      // by-hand items at full speed, per hour (what the page shows under the plan)
      byHand: handRecipes.map(({ r, c }, k) => {
        const rate = handOn.has(k) ? handOn.get(k).perHourE : c.perHour;   // the E timer sets the pace in E-mode
        // worker = the abilityNeeds key its Aniimo fills (the page's rosters map it to this facility); none in E-mode
        const op = handOn.has(k) ? null : mainOp(r);
        return { recipeId: r.id, facility: r.fac[0][0], perHour: rate * r.out[0][1], needs: r.in.map(([i, q]) => [i, q * rate]),
          mode: handOn.has(k) ? "E-mode" : "Aniimo", worker: op ? jobName(D, op.ab, op.lv, r.fam) : null };
      }),
      coinPerHour: coin, coinPerDay: coin * 24,
      lines, sold, bought, eaten, devices, fullTime,
      power: gen ? {
        generators: G, level: gen.lv, worker: gen.worker, perGenerator: gen.produce, produce: G * gen.produce,
        // what the machines in the plan draw. The solver may leave a machine "set" with nothing to run (its
        // tie-breaker cost is under the MIP gap, 1e-4 of the plan); it is in no line, you would not set it, and
        // its power is not counted here, so the real draw is at most what the power row allowed. An x >= y/1000
        // row per E column forced it out but made RV 15 hit the 4 s cap (measured 2026-10-01). Cost: within the
        // gap, i.e. at most ~1e-4 of coin/h (Fable review #5: maxed RV 18 cap 14, one idle Crafting Table).
        draw: eDraw,
        maxRate: D.power.maxRate,
      } : null,
      kept: keep.map(([i, h]) => ({ item: name(i), id: i, perDay: h * 24 })),
      handEOffered: handE.length,                  // ticked items that could run in E-mode (planCore's passes)
      food: { eaters, needPerHour: foodNeed,
              // how long the eaten mix lasts per item fed (for "how often do I refill")
              hoursPerItem: eaten.length ? eaten.reduce((acc, e) => acc + e.food, 0) / eaten.reduce((acc, e) => acc + e.perHour, 0) / (foodNeed || 1) : 0 },
      aniimo: { cap: inp.cap, reserved: inp.reserved, haulers: inp.haulers, pool, used,
                total: used.dedicated + used.bench + used.crop + used.devices + used.byHand + used.generators },
      abilityNeeds, abilitySpeed, timeLimit: timeLimit(),
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
    // The generator's levels have no RV of their own (empty rv_level), so every level counted as open from
    // RV 1 and the page offered a level-5 Crackle Generator at RV 1 (found 2026-10-01). Its level is the
    // Power Module's: "Unlocks Furniture: Crackle Generator (Level N)"; no module, no generator.
    if (D.power) {
      const g = D.power.generatorFacility, gl = (D.power.generatorByModule || {})[mod[D.power.module] || 0];
      if (gl) fac[g] = gl;
      else { delete fac[g]; if (g in count) count[g] = 0; }
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
      // form ids too, so the page can show the form names in another language
      if (!g) groups.set(key, Object.assign({}, a, { formNames: [a.fn || "Basic Form"], formIds: [a.form] }));
      else { g.formNames.push(a.fn || "Basic Form"); g.formIds.push(a.form); }
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
    // Prismana: everywhere with the tick box; without it only on a job planned at level 4, since only Prismana
    // forms reach 4 there (user, 2026-10-02: "use Prismana where it needs a level 4")
    const pool = D.aniimo || [];
    // (the ideal roster passes abilityLevels; its own tick box alone decides Prismana there)
    const planned4 = (j) => !result.abilityLevels && !j.ab[2] && Number(cap) === 4 && ((result.inputs || {})._skillTop || {})[j.ab[0]] === 4;
    const minLv = result.abilityLevels || {}, famLv = result.familyLevels || {};
    const jobLv = result.jobLevels || {};          // per-job override (the ideal roster lowering its smallest jobs)
    // "Aniimo go up to level N" (user's own Aniimo): the plan already counts level-N workers, slower, on jobs
    // that ask for more, so the roster takes level N there and never suggests one above it (audit 2026-10-02:
    // with level 2 it listed a level-3 Shrubclaw for Earth 3+). The best case passes exact levels instead.
    const cap = result.inputs && result.inputs.workerMaxLevel != null && result.inputs.workerMaxLevel !== "" && !result.abilityLevels
      ? Number(result.inputs.workerMaxLevel) : 4;
    // Slowness of Aniimo a on job j: share of a's own day per planned hour. The plan timed j at the assumed
    // level; the minimum roster may pick an Aniimo that only meets the job's level (user rule), which is slower
    // (formula 3054: level 2 on a 1+ job is 180 a minute, level 3 is 240). It used to book planned hours as
    // its time, so Scorchhowl (Earth 2) carried 70% Earth 1+ timed at Earth 3 plus 30% Fire: ~123% of its
    // day (ChatGPT, cross-model audit 2026-10-02; user: count each level's real speed). Seats stay 1.
    const speed = result.abilitySpeed || {};
    const slowCache = new Map();
    const slow = (a, j) => {
      const key = a.id + "|" + j.job;
      if (slowCache.has(key)) return slowCache.get(key);
      const sp = speed[j.job];
      let k = 1;
      if (sp) {
        const lv = a.ab[j.ab[0]] || 0;
        let planned = sp.fixed, real = sp.fixed;
        for (const q of sp.parts) {
          const rp = workPerMinute(q.need, q.pet, q.f, false), ra = workPerMinute(q.need, lv, q.f, false);
          planned += q.h; real += ra > 0 ? q.h * rp / ra : Infinity;
        }
        k = planned > 0 ? real / planned : 1;
      }
      slowCache.set(key, k);
      return k;
    };
    const can = (a, j) => (includePrismana || !a.prismana || planned4(j) || (result.prismanaJobs || []).includes(j.job)) && (!j.ab[2] || a.fam === j.ab[2])
      && (a.ab[j.ab[0]] || 0) >= Math.max(Math.min(j.ab[1], cap), (j.ab[2] ? famLv[j.ab[2]] : jobLv[j.job] != null ? jobLv[j.job] : minLv[j.ab[0]]) || 0)
      && (j.ab[2] || (a.ab[j.ab[0]] || 0) <= cap);
    const out = [];
    const remaining = new Map();
    const full = result.fullTime || {};
    for (const j of jobs) {
      // full-time seats (locked facilities, devices, generators, by-hand makers) are whole Aniimo; everything
      // else is shared work and goes to the packing below, at each Aniimo's real speed. Reserving floor(load)
      // whole Aniimo for shared work skipped that speed and could not regroup it (RV 2, five Wheat plots: 6
      // Aniimo where 5 fit; ChatGPT and Gemini Flash, cross-model audit round 2, found it independently).
      const whole = Math.ceil((full[j.job] || 0) - 1e-9);
      const best = pool.filter((a) => can(a, j)).sort((a, b) => b.ab[j.ab[0]] - a.ab[j.ab[0]]
        || allLevels(b) - allLevels(a) || Object.keys(b.ab).length - Object.keys(a.ab).length)[0];
      if (whole > 0 && best) out.push({ aniimo: best, count: whole, jobs: [{ job: j.job, load: whole, time: whole }] });
      // with nobody able to take the whole seats, the whole load stays open, so it reaches `uncovered` and
      // the page warns (cross-model audit 2026-10-02: a Mine with every Earth species unreleased gave an
      // empty roster and no warning, because the seats were subtracted whether or not anyone filled them)
      const rest = best ? Math.max(0, j.load - whole) : j.load;
      if (rest > 1e-6) remaining.set(j.job, { j, rest });
    }
    // Shared work, exactly (HiGHS): the fewest Aniimo that cover every job's planned hours at their real speed.
    // n[a] = how many of form a, x[a,j] = planned hours of job j it covers; per form sum(slowness * x) <= n[a];
    // minimize sum n. The greedy packing below found
    // 6 where 5 fit (RV 2, five Wheat plots; ChatGPT round 2) and stays as the fallback without HiGHS.
    const exactShared = () => {
      if (!HIGHS || !remaining.size) return false;
      const rem = [...remaining.values()];
      const cols = [];                             // [a, x, k] for every form that can take that job
      // forms with the same levels in these jobs' skills (and the same family) are interchangeable here: one
      // stands for all (217 forms made a model HiGHS could not finish in its 4 s; first measured at RV 2)
      const skills = [...new Set(rem.map((x) => x.j.ab[0]))].sort();
      const seen = new Map();
      for (const a of pool) {
        if (!rem.some((x) => can(a, x.j) && Number.isFinite(slow(a, x.j)))) continue;
        const sig = (a.fam || "") + "|" + skills.map((k) => a.ab[k] || 0).join(",");
        const had = seen.get(sig);
        // keep the one the old greedy would have liked: more skills overall, then higher levels overall
        if (!had || Object.keys(a.ab).length > Object.keys(had.ab).length
          || (Object.keys(a.ab).length === Object.keys(had.ab).length && allLevels(a) > allLevels(had))) seen.set(sig, a);
      }
      // and a form at least as good in every one of those skills (same family) does anything a weaker one can,
      // at least as fast (slowness only falls with level), so the weaker one is never needed. Still at the 4 s cap
      // with identical forms merged; dominated ones dropped makes it small.
      // Dominance by what each form can DO here, not by raw levels: at "go up to level 2" Shrubclaw (Earth 3) cannot
      // take Earth work, so it must not knock out Budclaw (Earth 1); that made 3 Aniimo where 2 fit (ChatGPT, r3).
      const cands = [...seen.values()];
      const better = (o, a) => rem.every((x) => !can(a, x.j) || (can(o, x.j) && slow(o, x.j) <= slow(a, x.j)))
        && rem.some((x) => (can(o, x.j) && !can(a, x.j)) || (can(o, x.j) && slow(o, x.j) < slow(a, x.j)));
      const forms = cands.filter((a) => !cands.some((o) => o !== a && better(o, a)));
      if (!forms.length) return false;
      const nCol = new Map();
      for (const a of forms) {
        nCol.set(a, cols.length); cols.push(null);   // n[a]
        for (const x of rem) if (can(a, x.j)) { const k = slow(a, x.j); if (Number.isFinite(k)) cols.push([a, x, k]); }
      }
      const N = cols.length, obj = new Array(N).fill(0), rows = [], b = [];
      // heads only: a small "prefer faster" weight on x made HiGHS prove ties for 1-2.6 s per roster, without
      // it 75-120 ms for the same totals (RV 2/12/20). Which form fills a head is already chosen above.
      for (let c = 0; c < N; c++) obj[c] = cols[c] ? 0 : -1;
      for (const x of rem) {                       // cover exactly: rest <= sum x[.,j] <= rest
        // (">=" alone let HiGHS book work nobody needs at no cost: "Grass 1+ covered 1.14 of 0.54", math sweep)
        const r = new Array(N).fill(0); let any = false;
        cols.forEach((c, i) => { if (c && c[1] === x) { r[i] = -1; any = true; } });
        if (!any) continue;
        rows.push(r); b.push(-x.rest + 1e-9);
        rows.push(r.map((v) => -v)); b.push(x.rest + 1e-9);
      }
      for (const [a, ci] of nCol) {                // real time fits the whole Aniimo of that form
        const r = new Array(N).fill(0); r[ci] = -1;
        cols.forEach((c, i) => { if (c && c[0] === a) r[i] = c[2]; });
        rows.push(r); b.push(0);
      }
      const res = solveHighs(obj, rows, b, [...nCol.values()], []);
      if (!res || res.status !== "optimal") return false;
      for (const [a, ci] of nCol) {
        const n = Math.round(res.x[ci]);
        if (n < 1) continue;
        const jobs = [];
        cols.forEach((c, i) => { if (c && c[0] === a && res.x[i] > 1e-9) jobs.push({ job: c[1].j.job, load: res.x[i], time: res.x[i] * c[2] }); });
        if (jobs.length) out.push({ aniimo: a, count: n, jobs });
      }
      for (const x of rem) if (forms.some((a) => can(a, x.j))) remaining.delete(x.j.job);
      return true;
    };
    const spareFill = () => {
      for (const m of out) {
        if (m.count !== 1) continue;
        let spare = 1 - m.jobs.reduce((acc, j) => acc + j.time, 0);
        for (const x of [...remaining.values()].sort((a, b) => b.rest - a.rest)) {
          if (spare <= 1e-6) break;
          if (!can(m.aniimo, x.j)) continue;
          const k = slow(m.aniimo, x.j);
          if (!Number.isFinite(k)) continue;
          const t = Math.min(spare / k, x.rest);   // planned hours it covers; t * k of its own day
          const same = m.jobs.find((j) => j.job === x.j.job);
          if (same) { same.load += t; same.time += t * k; } else m.jobs.push({ job: x.j.job, load: t, time: t * k });
          spare -= t * k; x.rest -= t;
          if (x.rest <= 1e-6) remaining.delete(x.j.job);
        }
      }
    };
    let guard = exactShared() ? 200 : 0;          // exact covered it: skip the greedy packing
    while (remaining.size && guard++ < 200) {
      spareFill();
      if (!remaining.size) break;
      let bestA = null, bestTake = null, bestScore = -1;
      for (const a of pool) {
        const fits = [...remaining.values()].filter((x) => can(a, x.j)).sort((x, y) => y.rest - x.rest);
        let cap = 1, score = 0;
        const take = [];
        for (const x of fits) {
          const k = slow(a, x.j);
          if (!Number.isFinite(k)) continue;
          const t = Math.min(cap / k, x.rest); if (t <= 1e-6) break; take.push([x, t, k]); cap -= t * k; score += t;
        }
        const lvl = take.reduce((acc, [x]) => acc + (a.ab[x.j.ab[0]] || 0), 0) * 100 + allLevels(a);
        if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && bestA && lvl > bestA._lvl)) {
          bestA = Object.assign({}, a, { _lvl: lvl }); bestTake = take; bestScore = score;
        }
      }
      if (!bestA || bestScore <= 1e-6) break;
      out.push({ aniimo: bestA, count: 1, jobs: bestTake.map(([x, t, k]) => ({ job: x.j.job, load: t, time: t * k })) });
      for (const [x, t] of bestTake) { x.rest -= t; if (x.rest <= 1e-6) remaining.delete(x.j.job); }
    }
    // The plan only limits total Aniimo-hours; whole Aniimo with the right skills can need more heads than the
    // production slots (RV 2 defaults: 7 for 6, cross-model audit 2026-10-02). Say so instead of hiding it.
    const total = out.reduce((acc, m) => acc + m.count, 0);
    const inp = result.inputs || {};
    const slots = inp.cap != null ? Math.max(0, inp.cap - (inp.reserved || 0) - (inp.haulers || 0)) : null;
    return { members: out, total, uncovered: [...remaining.keys()], slots, over: slots != null && total > slots ? total - slots : 0 };
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
      // j.load already holds the whole row ("2x" seat rows and exact rows both store the total): multiplying by the
      // count doubled every weight. Harmless, since only ratios are used, but wrong (both AIs, round 3)
      const load = j.load;
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

  // pens: the best of their own family (Dewy family tops out at Leisure 3, Susuta Prismana has 4)
  function bestFamilyLevels(D, includePrismana) {
    const fams = {};
    for (const r of D.recipes) {
      const op = r.fam && mainOp(r);
      if (op) fams[r.fam] = familyBest(D, r.fam, op.ab, includePrismana);
    }
    return fams;
  }

  // Ideal roster (user, 2026-10-02: "minimum is what you need, ideal is the best case roster"): the best
  // Aniimo in the game for every job of THIS plan. bestCase below re-plans with those Aniimo, and from RV 12 up
  // that plan drops the Crackle Generators the shown plan places, so its roster had nobody for them (cross-
  // model audit). Same jobs, best levels; their real speed books them (roster), so it can need fewer Aniimo.
  function idealRoster(D, result, includePrismana) {
    D = released(D, ((result && result.inputs) || {}).unreleased);
    // basis: the plan with the levels this roster was held to, for the page's alternatives and personalities
    const levels = bestAbilityLevels(D, includePrismana);
    // "go up to level 4" timed some skills at 4, which only Prismana forms have: there the best is 4 and Prismana is
    // allowed even with the tick box off, like the minimum roster (an Earth-3 seat made 20% less; ChatGPT, final)
    const inp = result.inputs || {}, top = inp._skillTop || {}, prismanaJobs = [];
    if (!includePrismana && Number(inp.workerMaxLevel) === 4) for (const job of Object.keys(result.abilityNeeds || {})) {
      const q = parseJob(D, job);
      if (q && !q.fam && top[q.ab] === 4) { levels[q.ab] = 4; prismanaJobs.push(job); }
    }
    const basis = Object.assign({}, result, { abilityLevels: levels, familyLevels: bestFamilyLevels(D, includePrismana), prismanaJobs });
    // It must fit the home (user, 2026-10-02: "the ideal must fit the maximum it can fit on that level"). The best
    // level everywhere means specialists, and at RV 2 that was 9 Aniimo for 8 places. So, while it does not fit,
    // the JOB with the least work drops one level (never below what it asks), and `relaxed` lists those jobs.
    // Per job, not per skill (Gemini Flash, round 3): lowering a skill let its big jobs go to weaker Aniimo too.
    const home = result.inputs && result.inputs.cap != null ? Number(result.inputs.cap) : Infinity;
    const jobs = Object.entries(result.abilityNeeds || {}).map(([job, h]) => ({ job, h, q: parseJob(D, job) }))
      .filter((x) => x.q && !x.q.fam).sort((x, y) => x.h - y.h);
    basis.jobLevels = {};
    const relaxed = [];
    let R = roster(D, basis, includePrismana);
    while (R.total > home) {
      const x = jobs.find((y) => (basis.jobLevels[y.job] != null ? basis.jobLevels[y.job] : levels[y.q.ab] || 0) > y.q.lv);
      if (!x) break;                               // nothing left to lower: show it as it is, over
      basis.jobLevels[x.job] = (basis.jobLevels[x.job] != null ? basis.jobLevels[x.job] : levels[x.q.ab]) - 1;
      if (!relaxed.includes(x.job)) relaxed.push(x.job);
      R = roster(D, basis, includePrismana);
    }
    // ... then give back what fitting did not need, biggest jobs first: lowering the smallest job first can leave
    // an earlier one lowered for nothing (RV 2: Wind 1+ fitted at the best level; ChatGPT, round 3)
    if (R.total <= home) for (const job of [...relaxed].sort((x, y) => (result.abilityNeeds[y] || 0) - (result.abilityNeeds[x] || 0))) {
      const was = basis.jobLevels[job];
      delete basis.jobLevels[job];
      const back = roster(D, basis, includePrismana);
      if (back.total <= home) { R = back; relaxed.splice(relaxed.indexOf(job), 1); } else basis.jobLevels[job] = was;
    }
    return Object.assign(R, { basis, relaxed });
  }

  // Best case: the same layout, every job done by the best Aniimo in the game for it, personality matched.
  function bestCase(D, userInputs, includePrismana) {
    D = released(D, (userInputs || {}).unreleased);
    const levels = bestAbilityLevels(D, includePrismana);
    const fams = bestFamilyLevels(D, includePrismana);
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

  // Money per plan row (user, 2026-09-29: "the sum of the table is more than the 71 thousand at the top").
  // The old Coin/h was the value a row adds at sell prices, so the Potato row counted Potato nobody sells.
  // Now: costs flow down the chain (seeds, then what each row takes from the rows before it, split over a
  // row's outputs by their value), and a row earns only on the part of its output that leaves the plan.
  // A row whose output all goes to other rows shows 0 and says what it feeds. Under the table: the value
  // of what leaves the plan without being sold (the Aniipod Maker's Shell, what the Aniimo eat). Then
  // sum(rows) - sum(under) = coin/h at the top, which tests/sweep.test.mjs checks on every plan.
  function lineMoney(D, p) {
    const inp = p.inputs || {};
    const val = (i) => price(D, Object.assign({ values: {} }, inp), i);
    const rec = (l) => D.recipes.find((r) => r.id === l.recipeId);
    const outs = (l) => rec(l).out.map(([i, q]) => [i, q * l.cyclesPerHour]);
    const ins = (l) => rec(l).in.map(([i, q]) => [i, q * l.cyclesPerHour]);
    const made = new Map(), used = new Map();
    for (const l of p.lines) {
      for (const [i, q] of outs(l)) made.set(i, (made.get(i) || 0) + q);
      for (const [i, q] of ins(l)) used.set(i, (used.get(i) || 0) + q);
    }
    const buyCost = new Map((p.bought || []).map((x) => [x.id, x.perHour > 0 ? x.coin / x.perHour : 0]));
    const costIn = new Map();                      // item -> cost carried into everything made of it
    const producers = (i) => p.lines.filter((l) => rec(l).out.some(([o]) => o === i));
    const rows = new Map();
    const ext = (i) => (made.get(i) ? Math.max(0, made.get(i) - (used.get(i) || 0)) / made.get(i) : 0);
    let left = p.lines.slice();
    for (let pass = 0; left.length && pass <= p.lines.length + 1; pass++) {
      const last = pass === p.lines.length + 1;      // a loop in the chain: take the rest as they are
      left = left.filter((l) => {
        const ready = ins(l).every(([i]) => !made.has(i) || producers(i).every((m) => m === l || rows.has(m)));
        if (!ready && !last) return true;
        const cost = ins(l).reduce((a, [i, q]) => a + q * (made.has(i) ? (costIn.get(i) || 0) / made.get(i) : (buyCost.get(i) || 0)), 0);
        const o = outs(l);
        const worth = o.map(([i, q]) => q * val(i));
        const total = worth.reduce((a, v) => a + v, 0);
        let money = 0;
        o.forEach(([i, q], k) => {
          const share = total > 0 ? worth[k] / total : 1 / o.length;
          costIn.set(i, (costIn.get(i) || 0) + cost * share);
          money += ext(i) * (q * val(i) - cost * share);
        });
        const feeds = [...new Set(p.lines.filter((m) => m !== l && rec(m).in.some(([i]) => o.some(([x]) => x === i))).map((m) => m.recipeId))];
        rows.set(l, { money, feeds });
        return false;
      });
    }
    const under = [];
    const hand = new Map();
    for (const h of p.byHand || []) for (const [i, q] of h.needs) hand.set(i, (hand.get(i) || 0) + q);
    for (const [i, mk] of made) {
      const out = Math.max(0, mk - (used.get(i) || 0));
      if (!(out > 1e-9) || !(val(i) > 0)) continue;
      const sold = ((p.sold || []).find((x) => x.id === i) || { perHour: 0 }).perHour;
      const eaten = ((p.eaten || []).find((x) => x.id === i) || { perHour: 0 }).perHour;
      const h = Math.min(hand.get(i) || 0, out);
      if (h > 1e-6) under.push({ kind: "byHand", id: i, perHour: h, coin: h * val(i),
        facility: ((p.byHand || []).find((x) => x.needs.some(([n]) => n === i)) || {}).facility });
      if (eaten > 1e-6) under.push({ kind: "eaten", id: i, perHour: eaten, coin: eaten * val(i) });
      const rest = out - sold - eaten - h;
      if (rest * val(i) > 0.5) under.push({ kind: "leftover", id: i, perHour: rest, coin: rest * val(i) });
    }
    return { rows, under };
  }

  // Whole plots per plan line. Rounded in two steps so a device never covers more plots than it can:
  // first the plots under each device setting (and with no device), adding up to the facility's rounded
  // total; then the crops inside each of those. The LP keeps every device area <= its whole coverage, so
  // rounding an area never goes over it. (User, 2026-09-28: the plan said 9 plots under the Sunlamp,
  // the device panel said 8.5; both now read these numbers.)
  function wholeCounts(lines) {
    const out = new Map();
    const byFac = {};
    // benches and E-mode machines show their whole machines (l.benches); only plots and locked facilities
    // worked by Aniimo are rounded here. An E-mode line in the rounding took a Pickling Jar's "1" (sweep, 2026-10-01)
    for (const l of lines) if (l.kind !== "bench" && l.kind !== "electric") (byFac[l.facility] = byFac[l.facility] || []).push(l);
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
  // maxLevel: the player's "Aniimo go up to level N" (minimum roster only). Like roster()'s can(): a job asks for
  // at most N, and nobody above N is offered, since those are not the player's (Gemini Flash, cross-model round
  // 2: with level 2, a Fire 2 Aniimo on a Fire 3+ bench got only level-3 alternatives).
  function alternatives(D, member, includePrismana, minLevels, familyLevels, maxLevel) {
    const minLv = minLevels || {}, famLv = familyLevels || {};   // best case: alternatives reach the best level too
    const cap = maxLevel != null && maxLevel !== "" ? Number(maxLevel) : 4;
    // An alternative is at least as good as the suggested Aniimo on each of its jobs, so it never lowers the plan's
    // output (ChatGPT r3: Earth 2 offered for an Earth 3 Mine seat, 25% less), and it follows whatever that member
    // was held to: lowered ideal jobs, level-4 Prismana jobs (Gemini Flash r3: both listed nobody). minLevels and
    // familyLevels are kept for callers; the member's own levels already carry them.
    const needs = member.jobs.map((j) => parseJob(D, j.job)).filter(Boolean)
      .map((p) => [p.ab, Math.max(p.fam ? p.lv : Math.min(p.lv, cap), member.aniimo.ab[p.ab] || 0, (p.fam ? famLv[p.fam] : 0) || 0), p.fam]);
    const prismanaOk = includePrismana || !!member.aniimo.prismana;
    const sig = (a) => a.n + "|" + JSON.stringify(Object.entries(a.ab).sort());
    const chosen = sig(member.aniimo);
    const groups = new Map();
    for (const a of D.aniimo || []) {
      if (!prismanaOk && a.prismana) continue;
      if (!needs.every(([ab, lv, fam]) => (a.ab[ab] || 0) >= lv && (!fam || a.fam === fam) && (fam || (a.ab[ab] || 0) <= cap))) continue;
      if (sig(a) === chosen) continue;
      const g = groups.get(sig(a));
      if (!g) groups.set(sig(a), Object.assign({}, a, { formNames: [a.fn || "Basic Form"], formIds: [a.form] }));
      else { g.formNames.push(a.fn || "Basic Form"); g.formIds.push(a.form); }
    }
    const jobLevels = (a) => needs.reduce((s2, [ab]) => s2 + (a.ab[ab] || 0), 0);
    return [...groups.values()].sort((a, b) => Object.keys(b.ab).length - Object.keys(a.ab).length
      || jobLevels(b) - jobLevels(a) || a.n.localeCompare(b.n));
  }

  const api = { coverage, coverFits, plan, rvLimits, wholeCounts, idealPersonality, alternatives, defaults, workPerMinute, recipeChoices, candidates, bestAbilityLevels, bestCase, idealRoster, roster, formLabel, parseJob, familyBest, released, rvChain, rvTime, useSolver,
    lineMoney, solverName: () => (HIGHS ? "HiGHS" : "built-in"), solverTimeLimit: timeLimit };
  if (typeof module !== "undefined") module.exports = api; else root.Planner = api;
})(this);
