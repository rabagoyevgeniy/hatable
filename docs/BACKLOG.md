# Backlog

## P0 STATION / GROUND (CURRENT GATE)

Human playtest after packedYard removal: the Hab floated over dunes. Gameplay expansion stays frozen until the starting site feels installed on Mars.

Closed in code this pass (awaiting **human phone** retest):

1. **Local foundation** — real terrain grades to `stationPadHeight()` (natural height at Hab origin). Irregular footprint, wide smooth falloff. No disc, no fog skirt.
2. **One height function** — mesh, player, loot, props, save. Mobile mesh 120 segs so bilinear cells cannot pull a dune under the modules.
3. **Seating** — plinths, deck, airlock/tube to grade, pads/legs. Airlock is a ramp.
4. **Night contrast** — dimmer mobile sun/hemi/terrain emissive; Hab beacon stronger after dark.

Human gate:

> «Это моя станция. Модули стоят на подготовленной площадке. Я хожу по той же земле.»

**STOP.** No Rover. No new survival. No scan-gates. No story chapters.

## P0

- Human retest of foundation + airlock + dual-stick (do not regress P0.1)
- Do not break gather / craft / mobile / journal

## P1

- Do not break `npm run smoke` / `npm run first-sol` / playability
- Human: night still readable; distiller sequence on phone
- Optional: pinch zoom

## P2

- Suit tablet instead of MMO meters — only after the physical world is believed

## P3

- Rover (scan ident says not a taxi — do not start driving)
- Escape as an engineering project (MAV is a cargo walk after Earth, not a vehicle)
- Original IP rename of Martian-adjacent names
