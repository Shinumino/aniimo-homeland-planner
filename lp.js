// Tiny linear-program solver: maximize c.x subject to A.x <= b, x >= 0.
//
// Why hand-written: the planner runs inside a page opened from disk (no server, no npm, nothing to
// install for a friend), so it cannot pull a library.
// Rows with b < 0 ("at least" constraints, e.g. food the Aniimo must eat) are handled with the big-M
// method: the row is flipped to >=, given a surplus and an artificial variable that starts in the
// basis at a huge cost. If an artificial is still positive at the optimum the problem is infeasible.
// Bland's rule (lowest index enters/leaves) prevents cycling; material balances have b = 0, which makes
// the problem heavily degenerate and a largest-coefficient rule can loop forever.
(function (root) {
  // Bland's rule cannot cycle in exact arithmetic, but in floating point a heavily degenerate problem
  // still can: the fastest-upgrade LP with personality on ran 200,000 pivots (7 s) and gave up
  // (2026-09-28). A stuck solve is retried once with every right-hand side nudged by a few 1e-7
  // (standard anti-degeneracy perturbation; far below anything the planner reports).
  function solve(c, A, b, opts) {
    const r = solveOnce(c, A, b, opts);
    if (r.status !== "iteration_limit" || (opts && opts.noRetry)) return r;
    const nudged = b.map((v, i) => v + 1e-7 * (1 + (i % 7)));
    return solveOnce(c, A, nudged, Object.assign({}, opts, { maxIter: 200000 }));
  }

  function solveOnce(c, A, b, opts) {
    const eps = (opts && opts.eps) || 1e-9;
    const maxIter = (opts && opts.maxIter) || 20000;
    const M = (opts && opts.bigM) || 1e7;
    const m = A.length, n = c.length;
    const flipped = b.map((v) => v < 0);
    const nArt = flipped.filter(Boolean).length;
    // columns: x (n) | slack or surplus (m) | artificial (nArt) | rhs
    const width = n + m + nArt + 1;
    const T = new Float64Array((m + 1) * width);
    const basis = new Int32Array(m);
    let art = 0;
    const artCols = [];
    for (let i = 0; i < m; i++) {
      const s = flipped[i] ? -1 : 1;
      const row = A[i];
      for (let j = 0; j < n; j++) T[i * width + j] = s * (row[j] || 0);
      T[i * width + width - 1] = s * b[i];
      if (flipped[i]) {
        T[i * width + n + i] = -1;                 // surplus
        const col = n + m + art++;
        T[i * width + col] = 1;                    // artificial
        basis[i] = col;
        artCols.push(col);
      } else {
        T[i * width + n + i] = 1;                  // slack
        basis[i] = n + i;
      }
    }
    for (let j = 0; j < n; j++) T[m * width + j] = -c[j];
    for (const col of artCols) T[m * width + col] = M;
    // price out the artificials so the objective row is consistent with the starting basis
    for (let i = 0; i < m; i++) {
      if (!flipped[i]) continue;
      for (let j = 0; j < width; j++) T[m * width + j] -= M * T[i * width + j];
    }

    let iter = 0;
    for (; iter < maxIter; iter++) {
      let enter = -1;
      for (let j = 0; j < width - 1; j++) if (T[m * width + j] < -eps) { enter = j; break; }
      if (enter < 0) break;
      let leave = -1, best = Infinity;
      for (let i = 0; i < m; i++) {
        const a = T[i * width + enter];
        if (a > eps) {
          const ratio = T[i * width + width - 1] / a;
          if (ratio < best - eps || (Math.abs(ratio - best) <= eps && basis[i] < basis[leave])) { best = ratio; leave = i; }
        }
      }
      if (leave < 0) return { status: "unbounded" };
      const p = T[leave * width + enter];
      for (let j = 0; j < width; j++) T[leave * width + j] /= p;
      for (let i = 0; i <= m; i++) {
        if (i === leave) continue;
        const f = T[i * width + enter];
        if (f === 0) continue;
        for (let j = 0; j < width; j++) T[i * width + j] -= f * T[leave * width + j];
      }
      basis[leave] = enter;
    }
    if (iter >= maxIter) return { status: "iteration_limit" };
    for (let i = 0; i < m; i++) {
      if (basis[i] >= n + m && T[i * width + width - 1] > 1e-6) return { status: "infeasible" };
    }
    const x = new Array(n).fill(0);
    for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i * width + width - 1];
    const value = c.reduce((s, cj, j) => s + cj * x[j], 0);
    return { status: "optimal", x: x, value: value, iterations: iter };
  }

  const api = { solve: solve };
  if (typeof module !== "undefined") module.exports = api; else root.LP = api;
})(this);
