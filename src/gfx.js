import * as THREE from "three";

function hash2(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) & 0xfffffff) / 0xfffffff;
}

function noise2(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2(x, y, oct = 5) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += noise2(x * f, y * f) * a;
    f *= 2;
    a *= 0.5;
  }
  return v;
}

export function canvasTex(size, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function marsAlbedo() {
  return canvasTex(512, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    const d = img.data;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s;
        const v = y / s;
        const n = fbm2(u * 8, v * 8, 5);
        const grit = fbm2(u * 42 + 9, v * 42, 3);
        const streak = fbm2(u * 3, v * 18, 3);
        const r = 0.48 + n * 0.28 + grit * 0.08 + streak * 0.06;
        const g = 0.24 + n * 0.14 + grit * 0.03;
        const b = 0.12 + n * 0.05;
        const i = (y * s + x) * 4;
        d[i] = Math.min(255, r * 255);
        d[i + 1] = Math.min(255, g * 255);
        d[i + 2] = Math.min(255, b * 255);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function rockAlbedo() {
  return canvasTex(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    const d = img.data;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm2(x / 18, y / 18, 4);
        const i = (y * s + x) * 4;
        d[i] = (70 + n * 90) | 0;
        d[i + 1] = (38 + n * 42) | 0;
        d[i + 2] = (24 + n * 22) | 0;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function hullAlbedo() {
  return canvasTex(512, (ctx, s) => {
    ctx.fillStyle = "#e8e0d4";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dust = fbm2(x / 40, y / 40, 4);
        if (dust > 0.55) {
          ctx.fillStyle = `rgba(160, 90, 48, ${(dust - 0.55) * 0.55})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.strokeStyle = "rgba(90, 70, 55, 0.28)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.strokeRect(8 + (i % 4) * 128, 8 + Math.floor(i / 4) * 256, 112, 240);
    }
    ctx.strokeStyle = "rgba(180, 90, 40, 0.45)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.62);
    ctx.lineTo(s, s * 0.62);
    ctx.stroke();
    ctx.fillStyle = "rgba(40, 32, 28, 0.18)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(hash2(i, 2) * s, hash2(i, 7) * s, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function metalAlbedo() {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#c4beb4";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? "rgba(90,80,70,0.18)" : "rgba(255,255,245,0.08)";
      ctx.fillRect(0, y, s, 1);
    }
    for (let i = 0; i < 80; i++) {
      const n = fbm2(i * 0.2, 3, 3);
      ctx.fillStyle = `rgba(120, 55, 28, ${0.08 + n * 0.22})`;
      ctx.fillRect(hash2(i, 1) * s, hash2(i, 4) * s, 12 + n * 28, 4);
    }
  });
}

export function evaAlbedo() {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#e07030";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm2(x / 22, y / 22, 4);
        if (n > 0.48) {
          ctx.fillStyle = `rgba(90, 42, 18, ${(n - 0.48) * 0.7})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.fillStyle = "rgba(244, 236, 224, 0.55)";
    ctx.fillRect(0, s * 0.42, s, 10);
    ctx.fillRect(0, s * 0.72, s, 6);
  });
}

export function floorAlbedo() {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#cbb79a";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(70, 50, 36, 0.28)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i * s) / 8, 0);
      ctx.lineTo((i * s) / 8, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * s) / 8);
      ctx.lineTo(s, (i * s) / 8);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(140, 80, 40, 0.18)";
    ctx.fillRect(0, 0, s, s);
  });
}

export function solarAlbedo() {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#152033";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(80, 140, 200, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo((i * s) / 12, 0);
      ctx.lineTo((i * s) / 12, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * s) / 12);
      ctx.lineTo(s, (i * s) / 12);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "rgba(90, 160, 255, 0.18)");
    g.addColorStop(1, "rgba(20, 30, 50, 0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

let _maps;
export function maps() {
  if (_maps) return _maps;
  const mars = marsAlbedo();
  mars.repeat.set(72, 72);
  const hull = hullAlbedo();
  hull.repeat.set(2, 2);
  const eva = evaAlbedo();
  eva.repeat.set(3, 3);
  const metal = metalAlbedo();
  metal.repeat.set(4, 4);
  const rock = rockAlbedo();
  rock.repeat.set(2, 2);
  const floor = floorAlbedo();
  floor.repeat.set(6, 6);
  const solar = solarAlbedo();
  solar.repeat.set(2, 2);
  _maps = { mars, hull, eva, metal, rock, floor, solar };
  return _maps;
}

export function std(opts) {
  return new THREE.MeshStandardMaterial(opts);
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vDir = w.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 sunDir;
  uniform float night;
  uniform float storm;
  uniform float dusk;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 zenithDay = vec3(0.72, 0.48, 0.32);
    vec3 horizonDay = vec3(0.95, 0.68, 0.42);
    vec3 zenithNight = vec3(0.05, 0.06, 0.12);
    vec3 horizonNight = vec3(0.18, 0.1, 0.12);
    vec3 zenith = mix(zenithNight, zenithDay, 1.0 - night);
    vec3 horizon = mix(horizonNight, horizonDay, 1.0 - night);
    float t = smoothstep(-0.08, 0.62, h);
    vec3 col = mix(horizon, zenith, t);

    float sun = pow(max(0.0, dot(dir, normalize(sunDir))), 48.0);
    float glow = pow(max(0.0, dot(dir, normalize(sunDir))), 6.0);
    vec3 sunCol = vec3(1.0, 0.88, 0.62);
    vec3 marsBlue = vec3(0.42, 0.58, 0.92);
    col += sunCol * sun * (1.0 - night) * 1.35;
    col += mix(sunCol, marsBlue, dusk) * glow * (1.0 - night) * 0.42;
    col += marsBlue * dusk * pow(max(0.0, dot(dir, normalize(sunDir))), 12.0) * 0.55;

    float haze = pow(1.0 - abs(h), 2.35);
    col = mix(col, vec3(0.68, 0.38, 0.22), haze * 0.34 * (1.0 - night));
    col = mix(col, vec3(0.42, 0.22, 0.12), storm * 0.55);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function makeSky() {
  const uniforms = {
    sunDir: { value: new THREE.Vector3(0.6, 0.5, -0.4) },
    night: { value: 0 },
    storm: { value: 0 },
    dusk: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(520, 40, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = "sky";
  return { mesh, uniforms };
}

export function makeSunHalo() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255, 244, 210, 1)");
  g.addColorStop(0.18, "rgba(255, 210, 140, 0.7)");
  g.addColorStop(0.5, "rgba(255, 160, 80, 0.18)");
  g.addColorStop(1, "rgba(255, 140, 60, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(90, 90, 1);
  sprite.name = "sunHalo";
  return sprite;
}

export function bakeEnvironment(renderer) {
  const envScene = new THREE.Scene();
  const sky = makeSky();
  envScene.add(sky.mesh);
  const hemi = new THREE.HemisphereLight(0xffd2b0, 0x5a2a18, 1);
  envScene.add(hemi);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(envScene, 0.06).texture;
  pmrem.dispose();
  return tex;
}

export function packedYard() {
  const mat = std({
    map: maps().mars,
    color: 0x8a5a38,
    roughness: 0.98,
    metalness: 0.02,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(18, 40), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  m.receiveShadow = true;
  return m;
}

export function dustSprite() {
  const t = canvasTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255, 228, 196, 0.95)");
    g.addColorStop(0.28, "rgba(214, 146, 88, 0.42)");
    g.addColorStop(1, "rgba(140, 62, 28, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Low horizon band so Meshy props sit in Mars dust, not a hard sky cut. */
export function makeHaze() {
  const geo = new THREE.SphereGeometry(490, 36, 18, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.18);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xc47a4a,
    transparent: true,
    opacity: 0.32,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "haze";
  mesh.frustumCulled = false;
  mesh.renderOrder = -8;
  return mesh;
}
