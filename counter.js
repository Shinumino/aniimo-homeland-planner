// Anonymous visit counter: GoatCounter (user, 2026-10-01: "is there a way to know how many people used the
// tool?"). GitHub Pages keeps no visitor numbers, and the repo's own traffic page only sees the code, not
// the site (it showed 0 views and 141 "clones" that were deploy jobs and crawlers).
//
// GoatCounter sets no cookies and keeps no personal data: it counts a page view with its path, referrer,
// browser, screen size and country, and does not keep the IP address. The page says so in one line.
//
// Counts the PUBLIC SITE only, as an allow-list of hosts over https: a copy opened from disk (the zipped
// web folder the user shares with friends), localhost, or anybody re-hosting the files never reports.
// The script is pinned to a version with its integrity hash, so a changed file on their server is refused
// by the browser instead of running on this page.
//
// Off switch: set code to "" (nothing loads), or stop the site on goatcounter.com (no push needed).
(function (root) {
  const COUNTER = { code: "shinumino", hosts: ["shinumino.github.io"] };
  const SRC = "https://gc.zgo.at/count.v4.js";
  const SRI = "sha384-nRw6qfbWyJha9LhsOtSb2YJDyZdKvvCFh0fJYlkquSFjUxp9FVNugbfy8q1jdxI+";

  // The site code becomes part of a URL, so only a plain GoatCounter name is accepted.
  function counterUrl(loc, cfg) {
    if (!cfg || !/^[a-z0-9-]{2,50}$/.test(cfg.code || "")) return null;
    if (!loc || loc.protocol !== "https:" || !(cfg.hosts || []).includes(loc.hostname)) return null;
    return "https://" + cfg.code + ".goatcounter.com/count";
  }

  function start(doc, loc, cfg) {
    const url = counterUrl(loc, cfg);
    if (!url) return false;
    const s = doc.createElement("script");
    s.async = true;
    s.src = SRC;
    s.integrity = SRI;
    s.crossOrigin = "anonymous";
    s.dataset.goatcounter = url;
    doc.head.appendChild(s);
    return true;
  }

  const api = { counterUrl, start, COUNTER };
  if (typeof module !== "undefined") module.exports = api;
  else start(root.document, root.location, COUNTER);
})(this);
