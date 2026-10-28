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
  storage (for orders you can let two benches share one, with a warning).
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

- Long plans now tell you what is happening: after 30 seconds the page says it is still loading, after 60 seconds
  that the setup takes long to plan, and a plan that had to stop searching says so, with the time it took. In Simple
  mode too.
- New in Advanced, under **Goal**: tick "Use as few Aniimo as possible" and the plan keeps your goal (the most coin,
  the fastest upgrade or the most orders) while using the fewest Aniimo that still earn the same coin, with power
  running machines in their place (on an RV 17 setup: 36 Aniimo down to 28, same coin). A table under it shows one
  Aniimo fewer per row and the coin each costs; click a row to use that plan.
- New in Advanced, under **Goal**: tick "Plan to fill the most orders" and the plan makes as many of the items
  daily orders ask for as it can, the most asked first, then the most coin (or the fastest upgrade, if that is
  ticked). It says how much of the order board it fills, how much coin that costs, and why it cannot fill the rest.
  While a season runs, "Season orders too" adds the season orders: 2 a day by the game's files, and you can enter
  another number.
- Benches may share an ingredient: with "Plan to fill the most orders" ticked, two or more benches can use the same
  ingredient while each keeps one recipe, so the plan fills more orders (at RV 13 to 20, about 6 to 10 points more of
  the order board with the starting limit of 4, and sometimes more with no limit). In the game the first free bench
  takes it, so the page names every shared ingredient and its
  benches, and lists the orders that depend on it under "If the split allows". "Share at most" (4 to start) limits
  how many are shared.
- The orders summary says why an order is not filled, for example "Moondew Radish already goes to Moondew Radish
  Slices".
- The page is reorganized: Advanced has six groups of settings (Your homeland, Goal, What you can make, Your Aniimo,
  Make for yourself, Assumptions); the orders and upgrade results sit next to the plan; the headline shows the goal's
  result; the rosters have the same names in both modes and show each Aniimo's best alternative first. On a phone,
  Advanced no longer scrolls sideways and its settings fold into one line.
- Event seeds: one tick for those paid in Home Coin (Sweet Potato) and one for those paid in Moonray Wheat (Moondew
  Radish, Waxing Moon Pepper). Before, the Moonray Wheat seeds needed both ticks.
- Under "No plan", nothing from the last plan comes back any more (clicking a column, picking another upgrade level,
  or an error while planning showed its rows or times), and Simple mode now says "No plan" when planning fails.
- A rare case where the solver called a layout impossible when it was not (it showed "This layout cannot...") is
  fixed: such a layout now gets its plan.
- Form names follow the game's 15 October update: Prismana Form, Rainfall Form (was Rainstorm Form),
  Timberline Form (was Mountain Woods Form) and Flowerfield Form (was Sea of Flowers Form). In Portuguese,
  Ervassom is now Hexxin and five form names follow the game's new ones. Only the names changed: plans and
  rosters are the same.
- Tuckin has Grass and Hauling, as in the game. The page showed a second Tuckin with Artisanship and could put
  it on a crafting bench: that one is a copy in the game files that nobody can own. Five more Aniimo had a copy
  like it (Magmarex, Tubster, Shelly, Susuta, Plateau Turbo) and showed twice or with their form named twice.
  Plans earn the same. Rosters may name different Aniimo than before, and a roster that had Tuckin crafting now
  names one that can.
- Base layout: when you change the language, the map and its hover names change at once. Before, the old map
  stayed for a few seconds with its names in the other language.
- **Base layout** (Advanced mode), by [Dan-801](https://github.com/Dan-801): a map of your homeland with
  everything the plan uses placed on your open plots. Plots sit under the right device, E-mode machines are on
  the power network, and Storage Units are close to what fills them. It has a grid (one square is one tile) and a
  legend. Click "Base layout" to open it: it stays closed until you do, so the page stays light.
- Base layout: the Starfall Hammock is no longer placed beside a Cooling Unit. The game asks for Cool -1 on it,
  but its timer is the same with or without one. An Aniimo with the F personality is what makes it faster, and
  the panel now says so.
- The page opens faster on phones: it no longer freezes for about a second while it gets ready.
- "Plan for the fastest upgrade": if the page has to use its backup calculator and cannot plan the upgrade, it
  now shows the plan for the most coin and says so. Before, it could show wrong numbers.
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
  and checked against the game where we could. Rechecked after the updates to builds 3634150, 3668494,
  3714366 and 3732728 (15 October 2026): none of these numbers changed. A game update can change them.
- The item, facility and Aniimo icons are the game's own art and belong to its owners.
- This is a fan-made tool. It is not affiliated with or endorsed by the makers of Aniimo.

## License and credits

MIT license, see `LICENSE`.

The optimizer uses [HiGHS](https://highs.dev/) through
[highs-js](https://github.com/lovasoa/highs-js) (MIT license, see `vendor/HIGHS-JS-LICENSE`).
