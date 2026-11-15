# Ashen Crowns

An original turn-based fantasy strategy game for the browser: four crowns fight over one hand-seeded map, *The Sundered Vale*.
All names, rules, code and pixel art are original to this project (the art is drawn in code, see `js/sprites.js`).

## Play

Open `index.html` in a browser. No server or install needed.

## What is in it

- One fixed map (44 x 32 tiles) with 4 capitals, free cities, ruins, roads and bridges
- Cities span four tiles, have three tiers (palisade town, walled city, citadel) and show their garrison
- Armies of up to 8 units, 12 unit types with abilities (flying, siege, banner, volley, ...)
- Heroes with experience, a choice of advance at each level, quests, relics that drop on death, mana and three spells
- City mustering, fortifying, income and upkeep
- Duel-based battles with walls, terrain and command bonuses, and an odds preview
- Three computer opponents; autosave at the start of each of your turns

## Develop

Sources are `body.html`, `style.css` and `js/*.js`. Run `./build.sh` to rebuild `index.html` and `dist/ashen-crowns.html`.
Append `?auto` to the URL to watch four computer players fight a whole war (used for testing).
