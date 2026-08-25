let ctx;
let windGain;
let droneGain;
let humGain;
let hissGain;
let breathGain;
let master;
let dripTimer = 0;

export function startAudio() {
  try {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.24;
    master.connect(ctx.destination);

    const drone = ctx.createOscillator();
    drone.type = "sawtooth";
    drone.frequency.value = 44;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 160;
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.14;
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    drone.start();

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 620;
    windGain = ctx.createGain();
    windGain.gain.value = 0.045;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    wind.start();

    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 118;
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    hum.connect(humGain);
    humGain.connect(master);
    hum.start();

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = "bandpass";
    hissFilter.frequency.value = 2400;
    hissFilter.Q.value = 0.7;
    hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer;
    hiss.loop = true;
    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(master);
    hiss.start();

    const breath = ctx.createOscillator();
    breath.type = "sine";
    breath.frequency.value = 9;
    breathGain = ctx.createGain();
    breathGain.gain.value = 0;
    breath.connect(breathGain);
    breathGain.connect(master);
    breath.start();
  } catch {
    ctx = null;
  }
}

export function setAmbience({ storm = 0, inside = false, sealed = false, night = false, leak = false, o2 = 100, grid = true } = {}) {
  if (!windGain) return;
  const outside = inside ? 0.22 : 1;
  windGain.gain.value = (0.04 + storm * 0.28 + (night ? 0.03 : 0)) * outside;
  if (droneGain) droneGain.gain.value = 0.12 + storm * 0.1;
  if (humGain) humGain.gain.value = inside && sealed && grid ? 0.055 : inside ? 0.018 : 0;
  if (hissGain) hissGain.gain.value = leak ? (inside ? 0.085 : 0.025) : 0;
  if (breathGain) breathGain.gain.value = o2 < 34 ? ((34 - o2) / 34) * 0.07 : 0;
}

export function setStormAudio(intensity) {
  setAmbience({ storm: intensity });
}

export function footstep(inside) {
  beep(inside ? 140 : 190, inside ? 0.03 : 0.05, 0.06, "square");
}

export function pickupTone(type = "scrap") {
  const map = {
    scrap: 480,
    rock: 220,
    ice: 880,
    fabric: 360,
    tape: 640,
    soil: 180,
    potato: 520,
    water: 760,
    solar: 440,
    wire: 560,
    comms: 700,
    hydrazine: 500,
  };
  beep(map[type] || 520, 0.09, 0.11, type === "ice" || type === "water" ? "sine" : "triangle");
}

export function deliverTone() {
  beep(330, 0.12, 0.16, "sine");
  setTimeout(() => beep(440, 0.12, 0.16, "sine"), 90);
  setTimeout(() => beep(660, 0.18, 0.2, "sine"), 180);
}

export function sleepTone() {
  beep(180, 0.1, 0.4, "sine");
  setTimeout(() => beep(140, 0.08, 0.5, "sine"), 200);
}

export function dripTone() {
  beep(920, 0.04, 0.07, "sine");
}

export function tickStill(dt, running) {
  if (!running) {
    dripTimer = 0;
    return;
  }
  dripTimer += dt;
  if (dripTimer > 1.15) {
    dripTimer = 0;
    dripTone();
  }
}

function beep(freq, gain, dur, type) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(g);
  g.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}
