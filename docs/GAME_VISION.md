# STRANDED MARS — vision

You are the last person at a failed Mars expedition. The Hab is damaged. Nobody is coming soon. Mars is the enemy: oxygen, pressure, cold, water, power, dust, distance, and your own mistakes.

Fantasy: **I am alive because I understand the system.**

Journey: survive → stabilize → understand → build → explore → self-sufficient → reconnect → escape.

## Not this game

- Walk to marker, collect three, craft the highlighted item, checkbox.
- Zombies, aliens, guns, XP trees, infinite planet, shops.
- Unauthorized clone of another studio’s assets or dialogue.

Objectives may guide. **Systems create gameplay.**

## Pillars (design lessons only)

1. **Engineering you can see** — power, leaks, repair. Know *why* it failed.
2. **Local transformation** — the same Hab yard must look different after several Sols.
3. **Believable science** — discoveries unlock tools, not +10 XP.
4. **Distance as depth** — early life is a short leash from Hab; range is progression.
5. **Physical survival** — see, carry, place, store, consume objects.
6. **Coupled systems** — storm hits solar, battery dies, heater fails, crops suffer.

Loop: observe problem → understand cause → prepare → leave safety → scavenge → return → repair → stabilize → unlock range → new problem.

## First 30 minutes (quality bar)

Leak + power emergency. Patch pressure. Salvage. Trickle-charge a damaged array. Night kills solar. Battery is the lifeline. Ice → water. First crop is a moment, not a click.

Closed when `scripts/first-sol.mjs` stays green (leak → repair → power → sleep → still → ice → water → drink → crop). Ice must be scanned before it fuels the still; soil must be scanned before the last potato goes in the dirt. After that, deepen **stabilize** (storm → solar → battery → heater/grid → crops; storms scar the array and can snap the roof cable). Fetching splice wire is a daylight walk, not a storm-night stroll. Pathfinder is a longer leash than the solar wreck; placing the radio is not Hello, Earth. A clear-day sleep can finish the listen; the journal waits for the reply. Suit range is O₂ ∩ warmth ∩ thirst ∩ hunger — a dry mouth is not a full tank; leftover tank sips pack the walk. After Earth, the MAV walk wants water and a potato that is not the last seed — range is not the win. The scanner names a wreck you can walk to, not the horizon, and does not print a 48 m loot inventory or light the far wreck. Rover waits.

## Constraints

Browser game. Vite + Three.js. Desktop quality, mobile fallback. No rewrite. Modular systems when a feature needs them — not empty folders.

The Hab is a character. Silence is part of Mars.
