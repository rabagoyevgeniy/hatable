# Backlog

## P0 HUMAN PLAYTEST BLOCKERS

Human playtest failed. **No new gameplay systems** until a human can walk Mars on a phone, read the view, enter the Hab through the airlock, and trust the ground.

Closed in code this gate (awaiting human retest):

1. **Mobile must be landscape** — portrait pauses and shows «Поверните телефон»; HUD is a landscape layout (joystick BL, actions BR, compact vitals), not a stretched portrait UI.
2. **Player must never sink through terrain** — feet snap to the *visual* mesh, not a finer analytic height; spawn/reload/recovery cannot put the player underground.
3. **Hab must have real collision** — exterior hull blocks; airlock corridor is the only entrance/exit; locker + major furniture are solid.
4. **Mobile camera + UI playability** — landscape FOV/distance so the character does not dominate; quest text is a dismissible chip; bars/buttons do not cover the world; iPhone safe areas.

Do not reopen these as content work. The next milestone is a human retest, not more systems.

## P0

- Human retest of the four blockers above (phone landscape, walk without sinking, Hab perimeter, airlock in/out)
- Do not break gather / craft / mobile / journal
- Do not add rover, suit-tablet, or new survival couplings until that retest

## P1

- Do not break `npm run smoke` / `npm run first-sol` / `npm run` playability (leak → crop + storm/grid/cable/still-load/pressure-refill/heater-dawn/heater-crop/bunk-O₂ + scanner/desk/MAV/locker-pockets/S-band-tape + ground/Hab/landscape)
- Optional human playtest after the P0 gate: E-build still on the stake → ice fuel → drip → tank sip; storm → clear day → solar wreck wire → splice; Pathfinder walk; desk packing/lab after seal
- Do not add more scan-gates (fabric / tape / hammer) or overlay-name checklists. Scanner reach is 22 m

## P2

- Suit tablet instead of MMO meters — only if a real player can verify in the browser **after** the landscape/ground/Hab gate

## P3

- Rover (scan ident says not a taxi — do not start driving)
- Escape as an engineering project (MAV is a cargo walk after Earth, not a vehicle)
- Original IP rename of Martian-adjacent names
