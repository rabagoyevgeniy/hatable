# Backlog

## P0 PLAYER CONTROL & WORLD SCALE (CURRENT GATE)

Human playtest failed again. **Gameplay expansion is frozen** until a human can say:

> «Мне приятно просто бегать по Марсу и крутить камерой. Я понимаю, где моя база. Я вижу, куда я иду. Я не проваливаюсь под землю.»

Closed in code this pass (awaiting **human** retest — harness is not a phone):

1. **Terrain grounding** — player Y uses the same PlaneGeometry bilinear as the rendered mesh (Three.js `iy=0 → worldZ = −half`). Feet sit on `terrainHeight + footOffset`. Emergency snap if underground. Spawn / save / blackout use the same snap. Camera offset is not a sink hide.
2. **Dual-stick mobile** — left stick: camera-relative move. Right stick: camera orbit (dead zone, curve, damp, pitch limits). No random full-screen drag.
3. **Third-person camera** — behind + slightly above. Character faces travel when moving; orbit does not spin the body while idle. Landscape FOV 42, follow distance ~15.4 m. Character should occupy ~10–18% of screen height.
4. **Buttons** — large Interact above the look stick; Scan / Craft / Inventory smaller. iPhone safe areas.
5. **Station scale** — living module + dedicated airlock + lab tube + greenhouse silhouette + yard solar / antenna / beacon. Not a 300% tent scale.
6. **Distiller communication** — spatial hiss (distance + pan), silent when off; steam / lamp / spin when working. Prompt: NEED ICE → LOAD ICE → COLLECT WATER. QA plates (LEAK / HAB / ДИСТИЛЛЯТОР) stay until the replacement is understandable.

Human gate for the next build: spawn, walk 3–5 minutes without sinking, both sticks, face away while running forward, enter/exit Hab, walk the station, find the still by sight + sound, understand ice → water without a manual.

**STOP.** Do not start Rover. Do not add survival systems. Do not add scan-gates.

## P0

- Human retest of the control/scale pass above
- Do not break gather / craft / mobile / journal
- Do not add rover, suit-tablet, or new survival couplings until that retest

## P1

- Do not break `npm run smoke` / `npm run first-sol` / playability
- Optional after the P0 gate: pinch zoom; E-build still on the stake → ice fuel → drip; storm wire splice
- Do not add more scan-gates (fabric / tape / hammer). Scanner reach is 22 m

## P2

- Suit tablet instead of MMO meters — only if a real player can verify in the browser **after** this control gate

## P3

- Rover (scan ident says not a taxi — do not start driving)
- Escape as an engineering project (MAV is a cargo walk after Earth, not a vehicle)
- Original IP rename of Martian-adjacent names
