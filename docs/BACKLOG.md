# Backlog

## P0.1 MOBILE PLAYABILITY (CURRENT GATE)

Human playtest after the control/scale pass found two remaining P0 bugs. **Gameplay expansion stays frozen.**

Closed in code this pass (awaiting **human phone** retest):

1. **packedYard removed** — the dark `CircleGeometry` sat as a flat disc over the real dunes. Feet were on the mesh, but the disc covered the astronaut and looked like sinking. Ground around Hab is the real terrain. No replacement plane.
2. **Right stick direction** — thumb right looks right, left looks left, up looks up, down looks down. Orbit math matches mouse look (`camYaw` decreases for look-right when the camera sits on +Z).
3. **Dual-stick tuning** — dead zone 0.11, curve 1.28, look damp 16, follow `1-exp(-16 dt)`. Look stick matches move-stick size on landscape phones. Idle orbit still does not spin the body.

Human gate is unchanged:

> «Мне приятно просто бегать по Марсу и крутить камерой. Я понимаю, где моя база. Я вижу, куда я иду. Я не проваливаюсь под землю.»

**STOP.** No Rover. No new survival. No scan-gates.

## P0

- Human retest of P0.1 (packedYard gone, stick direction, walk around Hab)
- Do not break gather / craft / mobile / journal
- Do not add rover, suit-tablet, or new survival couplings until that retest

## P1

- Do not break `npm run smoke` / `npm run first-sol` / playability
- Optional after the P0 gate: pinch zoom; packed landing *on the same terrain geometry*; E-build still
- Do not add more scan-gates (fabric / tape / hammer). Scanner reach is 22 m

## P2

- Suit tablet instead of MMO meters — only if a real player can verify in the browser **after** this control gate

## P3

- Rover (scan ident says not a taxi — do not start driving)
- Escape as an engineering project (MAV is a cargo walk after Earth, not a vehicle)
- Original IP rename of Martian-adjacent names
