// Generates the plot arrangements around one device that layout.js draws, and writes them into layout.js
// between the "PATTERNS:BEGIN" / "PATTERNS:END" markers. Run: node tools/pack-patterns.js
//
// Geometry (planner.js COVER/PACK, from home_object_data and HomelandEnvManager): plots on the 1-square grid,
// Farmland 2x2, Woodland 4x4, climate pens (layout.js PENS: Starfall Hammock, Tidewhisper Sandcastle) 5x5; a
// plot counts when at least one whole square of it is inside the device's 9x9 area; nothing on the device's own
// body. The device sits on squares [0, s) x [0, s).
// For a 2x2 device (Cooling Unit) a 9x9 area cannot be centred on the grid. Every reading of it (centred,
// whole squares only = 8x8; or 9 squares offset either way) gives the same maximum counts as planner.js PACK
// (checked with this solver), so the strictest one is used: an arrangement valid there is valid in all.
//
// For each device size, p = 0..2 pens (at most 2 Hammocks; the Sandcastle is 1, under another setting) and
// k Woodland (p + k <= 8): the most Farmland that still fits (exact 0/1 program), and among those arrangements
// the one with plots closest to the device (it reads better; any of them is valid).
const fs = require("fs"), path = require("path");
const loadHighs = require("./highs-node.js");

const SIZES = { 1: { lo: -4, hi: 5 }, 2: { lo: -3, hi: 5 } };   // squares [lo, hi) count as inside
const PLOT = { P: 5, W: 4, F: 2 };
const MAX_PENS = 2;

function candidates(s, lo, hi) {
  const out = [];
  for (const [kind, size] of Object.entries(PLOT)) {
    for (let x = lo - size + 1; x < hi; x++) for (let y = lo - size + 1; y < hi; y++) {
      let inside = false, onDevice = false;
      const cells = [];
      for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
        const cx = x + i, cy = y + j;
        cells.push(cx + "," + cy);
        if (cx >= lo && cx < hi && cy >= lo && cy < hi) inside = true;
        if (cx >= 0 && cx < s && cy >= 0 && cy < s) onDevice = true;
      }
      // squared distance of the plot's centre to the device's centre, x4 to stay whole
      const d = (2 * x + size - s) ** 2 + (2 * y + size - s) ** 2;
      if (inside && !onDevice) out.push({ kind, x, y, cells, d });
    }
  }
  return out;
}

function solve(H, s, pens, woodland) {
  const { lo, hi } = SIZES[s];
  const cand = candidates(s, lo, hi);
  const byCell = new Map();
  cand.forEach((c, k) => c.cells.forEach((cell) => { if (!byCell.has(cell)) byCell.set(cell, []); byCell.get(cell).push(k); }));
  // one Farmland outweighs any distance total (<= 32 plots x 400)
  const BIG = 100000;
  const obj = cand.map((c, k) => (c.kind === "F" ? BIG - c.d : -c.d) + " x" + k);
  const lines = ["Maximize", " obj: " + obj.join(" + ").replace(/\+ -/g, "- "), "Subject To"];
  let r = 0;
  for (const ks of byCell.values()) if (ks.length > 1) lines.push(" c" + r++ + ": " + ks.map((k) => "x" + k).join(" + ") + " <= 1");
  for (const [kind, n] of [["W", woodland], ["P", pens]]) {
    lines.push(" " + kind + ": " + cand.map((c, k) => (c.kind === kind ? "x" + k : null)).filter(Boolean).join(" + ") + " = " + n);
  }
  lines.push("Binary", " " + cand.map((c, k) => "x" + k).join(" "), "End");
  const res = H.solve(lines.join("\n"), { output_flag: false, time_limit: 120 });
  if (res.Status !== "Optimal") throw new Error("size " + s + ", " + pens + " pens, " + woodland + " Woodland: " + res.Status);
  const picked = cand.filter((c, k) => Math.round(res.Columns["x" + k].Primal) === 1);
  // nearest first: a plan with fewer plots takes the first ones
  const near = (a, b) => a.d - b.d || a.y - b.y || a.x - b.x;
  const of = (kind) => picked.filter((c) => c.kind === kind).sort(near).map((c) => [c.x, c.y]);
  return { P: of("P"), W: of("W"), F: of("F") };
}

(async () => {
  const H = await loadHighs();
  const patterns = {};
  for (const s of Object.keys(SIZES).map(Number)) {
    patterns[s] = [];
    for (let p = 0; p <= MAX_PENS; p++) {
      patterns[s][p] = [];
      for (let k = 0; k + p <= 8; k++) {
        const q = solve(H, s, p, k);
        patterns[s][p].push(q);
        console.log("device " + s + "x" + s + ", " + p + " pens, " + k + " Woodland -> " + q.F.length + " Farmland");
      }
    }
  }
  const file = path.join(__dirname, "..", "layout.js");
  const src = fs.readFileSync(file, "utf8");
  const rows = (list) => "[" + list.map(([x, y]) => "[" + x + "," + y + "]").join(",") + "]";
  const body = Object.entries(patterns).map(([s, byPens]) => "    " + s + ": [\n" + byPens.map((list, p) => "      [   // " + p + " pens\n"
    + list.map((q, k) => "        { P: " + rows(q.P) + ", W: " + rows(q.W) + ",\n          F: " + rows(q.F) + " },   // " + k + " Woodland").join("\n")
    + "\n      ],").join("\n") + "\n    ],").join("\n");
  if (!src.includes("PATTERNS:BEGIN")) throw new Error("layout.js has no PATTERNS markers");
  const out = src.replace(/(\/\/ PATTERNS:BEGIN[^\n]*\n)[\s\S]*?(\s*\/\/ PATTERNS:END)/, (m, a, b) => a + body + b);
  fs.writeFileSync(file, out);
  console.log("written to layout.js");
})().catch((e) => { console.error(e); process.exit(1); });
