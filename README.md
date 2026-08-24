# STRANDED MARS

A survival-crafting game on Mars. You are the botanist left behind after Ares III. The planet is an island of rust. Scavenge wreckage, craft stations, keep yourself alive, and science a way home.

Roadmap (Russian): [PLAN.md](PLAN.md).

Inspired by *The Martian* and the grain of *Stranded Deep* — gather, craft, build, survive. Not a delivery game.

## How it is arranged

You wash up at the damaged **Hab**. Everything useful is on the ground: scrap, rock, canvas, tape, a few potatoes. Distant Ares wrecks are salvage islands, not delivery stops.

```
              SOLAR GRAVEYARD  (cells, wire)
                       |
     SOIL FLATS ------- HAB ------- ROVER WRECK (hydrazine)
     (regolith)         |
                 PATHFINDER        (comms board)
                       |
                  SCHIAPARELLI MAV  (leave)
```

## Survival loop

Same verbs as Stranded Deep, Martian materials:

1. **Gather** wreckage with **E**
2. **Craft** a crude hammer (**C**)
3. **Seal** the Hab or the oxygen leak wins
4. Build a **water still**, fuel it with ice or hydrazine, drink
5. Build a **farm plot**, plant potatoes, harvest copies
6. Patch **solar** so night doesn't freeze you
7. Loot Pathfinder, place a **radio**, talk to Earth
8. Walk to the **MAV** with water and food. Hermes is coming.

Meters: **O₂, hunger, thirst, warmth**. Dust storms and night punish you outside a sealed, powered Hab.

## Controls

| Key | Action |
| --- | --- |
| WASD | Walk |
| Mouse | Look (click the desert) |
| E | Gather / use station / place |
| C | Craft menu |
| Tab | Pockets (click potato or water to eat / drink) |
| F | Scan resources through dust |
| Esc | Cancel placement |

EN / RU toggle is on the title card.

## Run it

```bash
npm install
npm run dev
```
