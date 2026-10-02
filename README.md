# Aniimo Homeland Planner

A planner for the Homeland in Aniimo. Enter your RV level, facilities, modules, Recipe Notes and
Aniimo, and it works out what to plant and craft for the most Home Coin per hour, which Aniimo you
need for each job, and how long until your next RV upgrade.

## How to use it

Open it in your browser: **https://shinumino.github.io/aniimo-homeland-planner/**

Or use it offline: download this repository (green **Code** button, then **Download ZIP**), unzip it
and open `index.html`.

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
- Lists the Aniimo that can do each job, a suggested roster, and a best case with the best Aniimo in
  the game.
- Shows what the next RV upgrade needs, the recipe chain behind it, and how long it takes with your
  plan, or plans for the fastest upgrade instead of the most coin.

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
