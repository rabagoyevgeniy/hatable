/** CLEAR / DUST / STORM. Writes world.storm for existing visuals. */

export function createWeather() {
  return { state: "clear", hold: 90, warn: 0 };
}

export function tickWeather(world, dt) {
  if (!world.weather) world.weather = createWeather();
  const w = world.weather;
  const t = world.playTime || 0;

  if (t < 150) {
    w.state = "clear";
    w.warn = 0;
    w.hold = 40;
    world.stormTarget = 0.04;
    world.storm = Math.min(world.storm || 0, 0.1);
    return;
  }

  w.hold = Math.max(0, (w.hold || 0) - dt);

  if (w.state === "clear") {
    w.warn = 0;
    world.stormTarget = 0.05;
    if (w.hold <= 0) {
      w.state = "dust";
      w.warn = 0.15;
      w.hold = 28 + Math.random() * 18;
    }
  } else if (w.state === "dust") {
    w.warn = Math.min(1, w.warn + dt * 0.035);
    world.stormTarget = 0.22 + w.warn * 0.12;
    if (w.hold <= 0) {
      if (Math.random() < 0.55) {
        w.state = "storm";
        w.hold = 42 + Math.random() * 28;
        w.warn = 1;
      } else {
        w.state = "clear";
        w.hold = 80 + Math.random() * 70;
        w.warn = 0;
      }
    }
  } else {
    w.warn = 1;
    world.stormTarget = 0.72 + Math.random() * 0.08;
    if (w.hold <= 0) {
      w.state = "dust";
      w.hold = 18 + Math.random() * 12;
      w.warn = 0.45;
    }
  }
}

export function weatherLabel(world, lang = "ru") {
  const state = world.weather?.state || "clear";
  const ru = lang === "ru";
  if (state === "storm") return ru ? "БУРЯ" : "STORM";
  if (state === "dust" || (world.weather?.warn || 0) > 0.35) return ru ? "ПЫЛЬ" : "DUST";
  return ru ? "ЯСНО" : "CLEAR";
}
