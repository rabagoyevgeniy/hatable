# MARTIAN STRANDING

A walking-delivery game on Mars. You are the botanist left behind after Ares III. The planet is empty. Walk, carry, connect.

Inspired by *The Martian* and the stride of *Death Stranding*. This is not an app builder.

## How it is arranged

Acidalia Planitia is a sparse map of **six outposts**. They start isolated. Your job is to carry crates between them and bring the **Ares Link** back online — the same fantasy as connecting chiral network knots, except the weather is dust, the cargo is potatoes, and Earth is 12 minutes away.

```
              SOLAR FARM
                  |
     POTATO FARM -+-- HAB -- ROVER CACHE
                  |     |
            PATHFINDER  |
                        |
                   SCHIAPARELLI MAV
```

| Site | What it is |
| --- | --- |
| **Hab** | Home. Rest, oxygen, first crates. |
| **Rover Cache** | First walk. Learn weight and bracing. |
| **Potato Farm** | Greenhouse. Food is a countdown. |
| **Solar Farm** | Power. Dust storms eat the arrays. |
| **Pathfinder** | A radio in a tomb. Hello, Earth. |
| **MAV** | The long walk. Hermes is coming. |

## How you play

You are a porter, not a shooter. Third-person walk across dunes. Cargo on your back has **weight**: it slows you, throws your **balance** on slopes, and will spill if you stumble. Hold **Shift** to brace, like planting your feet against the load.

Dust storms are the timefall. Visibility dies, wind shoves you, crate condition drops. Rest at a beacon to refill O₂ and plant a Link node.

Six story orders follow Watney's arc: survive the storm, farm, restore power, talk to Earth, stockpile, then haul life support to the MAV.

## Controls

| Key | Action |
| --- | --- |
| WASD | Walk |
| Mouse | Look (click the desert to capture the cursor) |
| Shift | Brace the load |
| E | Pick up / deliver / rest |
| Q | Drop top crate |
| C | Scan (outposts and cargo through the dust) |
| Tab | Backpack |

EN / RU toggle is on the title card.

## Run it

```bash
npm install
npm run dev
```

Open the local Vite URL (port 5173). `npm run build` emits a static `dist/` you can host anywhere.
