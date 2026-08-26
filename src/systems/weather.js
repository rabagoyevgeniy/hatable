/** CLEAR / DUST / STORM. Writes world.storm for existing visuals. */

export const WEATHER_BAND = {
  clear: { storm: 0.05, stormTarget: 0.05, warn: 0 },
  dust: { storm: 0.28, stormTarget: 0.28, warn: 0.4 },
  storm: { storm: 0.78, stormTarget: 0.78, warn: 1 },
};

export function createWeather() {
  return { state: "clear", hold: 90, warn: 0 };
}

function rand(world) {
  const r = world.weather?.rand;
  return typeof r === "function" ? r() : Math.random();
}

/** Pin weather without the live RNG — harness / console tests. */
export function applyWeatherState(world, state) {
  if (!world.weather) world.weather = createWeather();
  const band = WEATHER_BAND[state] || WEATHER_BAND.clear;
  world.weather.state = state;
  world.weather.warn = band.warn;
  world.storm = band.storm;
  world.stormTarget = band.stormTarget;
}

export function tickWeather(world, dt) {
  if (!world.weather) world.weather = createWeather();
  const w = world.weather;
  const t = world.playTime || 0;

  if (t < 280) {
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
      w.hold = 28 + rand(world) * 18;
    }
  } else if (w.state === "dust") {
    w.warn = Math.min(1, w.warn + dt * 0.035);
    world.stormTarget = 0.22 + w.warn * 0.12;
    if (w.hold <= 0) {
      if (rand(world) < 0.55) {
        w.state = "storm";
        w.hold = 42 + rand(world) * 28;
        w.warn = 1;
      } else {
        w.state = "clear";
        w.hold = 80 + rand(world) * 70;
        w.warn = 0;
      }
    }
  } else {
    w.warn = 1;
    world.stormTarget = 0.72 + rand(world) * 0.08;
    if (w.hold <= 0) {
      w.state = "dust";
      w.hold = 18 + rand(world) * 12;
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
