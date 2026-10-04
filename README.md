# Aniimo Homeland Planner

A planner for the Homeland in Aniimo. Enter your RV level, facilities, modules, Recipe Notes and
Aniimo, and it works out what to plant and craft for the most Home Coin per hour, which Aniimo you
need for each job, and how long until your next RV upgrade.

## How to use it

Open it in your browser: **https://shinumino.github.io/aniimo-homeland-planner/**

Or use it offline: download this repository (green **Code** button, then **Download ZIP**), unzip it
and open `index.html`. Offline, the page does its calculations itself, so at high RV levels it can
pause for a few seconds while it plans. The website plans in the background and does not pause.

It opens in **simple mode**: pick your RV level and it assumes everything that RV allows is built and
upgraded (all its production plots bought too), then shows what to set on each facility, the fewest Aniimo that run it, and the ideal Aniimo
to aim for. Press **Advanced mode** (top right) to enter your own setup (facilities, modules, Recipe
Notes, options) and see the numbers; back in simple mode, the plan uses that setup. The page remembers
which mode you used last, and **Save setup to file** / **Load setup file** work in both modes.

Nothing to install. The planning runs in your browser on your own PC, and your settings are kept in
your browser. The website counts visits anonymously with [GoatCounter](https://www.goatcounter.com/)
(no cookies, no personal data); the offline copy counts nothing.

## What it does

- Picks the recipes and crops for each facility, one recipe per bench, so you can set it and leave it.
- Sends each ingredient to a single recipe, since the Aniimo decide where items go once they are in
  storage.
- Places the Heat Furnace, Cooling Unit and Sunlamp where crops need them.
- From RV 12 (Power Module): decides which machines to run in E-mode on Crackle Generators, at full 120%,
  and says how many generators and what to connect. Untick "Use power" to plan without it.
- Plans food for your Aniimo and anything you want to keep for yourself (Aniipods).
- Shows the fewest Aniimo that run the plan (minimum roster) and the best Aniimo for it (ideal roster),
  each with alternatives you can use instead. The ideal roster fits your home; if it has to use your
  hauler places or a lower level on a small job to fit, it says so.
- Shows what the next RV upgrade needs, the recipe chain behind it, and how long it takes with your
  plan, or plans for the fastest upgrade instead of the most coin.

## What's new

**October 2026**

- Facilities you set to keep an Aniimo full time: a full-time bench must never run out of ingredients. The
  page now says so under that list, and when unticking a bench would earn more, it names that bench.
  "Plan for the fastest upgrade" now names the full-time benches that block the upgrade instead of saying
  your layout cannot make it.
- Some Aniimo always have certain personality letters, because their evolution needs them (for example
  Nighttime Piopiota is always E and P, so never J). When the best letter for a job is one that Aniimo can
  never have, the roster says so and points you to the alternatives.
- The roster tables have a clearer line between rows.

- The page no longer freezes while it plans: big RV levels can take a few seconds, but you can keep
  using the page. Plans at RV 16-20 are also better, because the planner now has time to finish.
- The minimum roster is now truly the fewest Aniimo, and counts each Aniimo's real speed.
- The ideal roster uses the best Aniimo for the plan you see (generators included) and fits your home.
- "Go up to level 4" uses Prismana Aniimo where level 4 is needed, and says when no Aniimo has level 4.
- Personality (+20%) no longer speeds up crops and generators: the game only gives it on facilities with
  a personality letter.
- Setup files are checked before they are loaded, so a broken or tampered file cannot break your saved
  setup or run anything on the page.
- Smaller fixes: RV 20 shows that it is the last level, the upgrade time counts raw materials and unfed
  Aniimo, module and facility levels above your RV are capped, and more warnings are in Portuguese.
- Removed the "Aniimo you need" list and the long job list under Best case; the rosters show the same
  Aniimo with their pictures.

## Notes

- The numbers (recipe times, workloads, prices, facility limits) were read from game build 3603741
  and checked against the game where we could. Rechecked after the update to build 3634150: no homeland
  numbers changed. A game update can change them.
- The item, facility and Aniimo icons are the game's own art and belong to its owners.
- This is a fan-made tool. It is not affiliated with or endorsed by the makers of Aniimo.

## License and credits

MIT license, see `LICENSE`.

The optimizer uses [HiGHS](https://highs.dev/) through
[highs-js](https://github.com/lovasoa/highs-js) (MIT license, see `vendor/HIGHS-JS-LICENSE`).
