let ctx;
let windGain;
let droneGain;
let master;

export function startAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);

  const drone = ctx.createOscillator();
  drone.type = "sawtooth";
  drone.frequency.value = 46;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 180;
  droneGain = ctx.createGain();
  droneGain.gain.value = 0.18;
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
  windFilter.frequency.value = 700;
  windGain = ctx.createGain();
  windGain.gain.value = 0.05;
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);
  wind.start();
}

export function setStormAudio(intensity) {
  if (!windGain) return;
  windGain.gain.value = 0.05 + intensity * 0.22;
  if (droneGain) droneGain.gain.value = 0.18 + intensity * 0.08;
}

export function footstep() {
  beep(180, 0.04, 0.07, "square");
}

export function pickupTone() {
  beep(520, 0.08, 0.12, "triangle");
}

export function deliverTone() {
  beep(330, 0.12, 0.16, "sine");
  setTimeout(() => beep(440, 0.12, 0.16, "sine"), 90);
  setTimeout(() => beep(660, 0.18, 0.2, "sine"), 180);
}

export function stumbleTone() {
  beep(90, 0.2, 0.18, "sawtooth");
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
