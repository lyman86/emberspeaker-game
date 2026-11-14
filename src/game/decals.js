import * as THREE from 'three';

/**
 * Floor decals painted procedurally on canvases: blood splatters (wet, glossy), stone cracks, moss and
 * grime patches. Scattered once per level for lived-in grime; blood is also added where monsters die.
 */
const rnd = (a, b) => a + Math.random() * (b - a);

function canvas(S = 256) { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; }

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * vnoise(x, y); x *= 2.1; y *= 2.1; a *= 0.5; } return s; };

function bloodTex(seed) {
  const [c, x] = canvas(256);
  x.translate(128, 128);
  // main pool: noisy blob built from overlapping circles
  for (let i = 0; i < 26; i++) {
    const a = hash(seed, i) * 6.28, r = hash(i, seed) * 40;
    const rr = 18 + hash(seed + 3, i) * 34;
    const g = x.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, rr);
    g.addColorStop(0, 'rgba(70,4,4,0.95)'); g.addColorStop(0.7, 'rgba(60,3,3,0.9)'); g.addColorStop(1, 'rgba(40,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, rr, 0, 6.28); x.fill();
  }
  // spatter droplets and streaks flung outward
  for (let i = 0; i < 70; i++) {
    const a = hash(seed * 7, i) * 6.28, r = 50 + hash(i, seed * 3) * 70, s = 1 + hash(i * 3, seed) * 5;
    x.fillStyle = `rgba(${60 + (i % 30)},2,2,${0.6 + hash(i, 9) * 0.4})`;
    x.beginPath(); x.ellipse(Math.cos(a) * r, Math.sin(a) * r, s * 1.8, s, a, 0, 6.28); x.fill();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  // darker coagulated rim
  const img = x.getImageData(0, 0, 256, 256), d = img.data;
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const k = (j * 256 + i) * 4, n = fbm(i / 20 + seed, j / 20);
    d[k] *= 0.7 + 0.5 * n; d[k + 3] = Math.min(255, d[k + 3] * (0.85 + 0.3 * n));
  }
  x.putImageData(img, 0, 0);
  return c;
}

function crackTex(seed) {
  const [c, x] = canvas(256);
  x.lineCap = 'round';
  const branch = (px, py, a, len, w, depth) => {
    if (depth > 5 || w < 0.4) return;
    let cx = px, cy = py;
    x.lineWidth = w; x.strokeStyle = 'rgba(8,6,5,0.9)';
    x.beginPath(); x.moveTo(cx, cy);
    const segs = 6;
    for (let i = 0; i < segs; i++) { a += (hash(seed + depth, i + cx) - 0.5) * 0.9; cx += Math.cos(a) * len / segs; cy += Math.sin(a) * len / segs; x.lineTo(cx, cy); }
    x.stroke();
    const n = depth < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) branch(cx, cy, a + (hash(seed, depth * 9 + i) - 0.5) * 1.8, len * 0.6, w * 0.6, depth + 1);
  };
  for (let i = 0; i < 4; i++) branch(128, 128, (i / 4) * 6.28 + hash(seed, i), 70, 4, 0);
  // dusty halo around the impact
  const g = x.createRadialGradient(128, 128, 4, 128, 128, 90);
  g.addColorStop(0, 'rgba(20,16,12,0.5)'); g.addColorStop(1, 'rgba(20,16,12,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return c;
}

function patchTex(seed, rgb, density = 0.55) {
  const [c, x] = canvas(256);
  const img = x.createImageData(256, 256), d = img.data;
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const k = (j * 256 + i) * 4, u = i / 256 - 0.5, v = j / 256 - 0.5;
    const n = fbm(i / 28 + seed, j / 28 - seed) + fbm(i / 7, j / 7) * 0.25;
    const fall = Math.max(0, 1 - Math.hypot(u, v) * 2.1);
    const a = Math.max(0, Math.min(1, (n * fall * 1.9 - (1 - density)) * 3));
    d[k] = rgb[0] * (0.7 + n * 0.6); d[k + 1] = rgb[1] * (0.7 + n * 0.6); d[k + 2] = rgb[2] * (0.7 + n * 0.6); d[k + 3] = a * 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

export class Decals {
  constructor(game) {
    this.game = game;
    const T = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const mk = (cv, o) => new THREE.MeshStandardMaterial({ map: T(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...o });
    this.mats = {
      blood: [1, 2, 3].map((s) => mk(bloodTex(s), { roughness: 0.18, metalness: 0.0, envMapIntensity: 0 })),
      crack: [4, 5].map((s) => mk(crackTex(s), { roughness: 1 })),
      moss: [6, 7].map((s) => mk(patchTex(s, [70, 92, 40], 0.5), { roughness: 0.9 })),
      grime: [8, 9].map((s) => mk(patchTex(s, [26, 22, 18], 0.62), { roughness: 1 })),
    };
    this.geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.live = [];
  }

  _add(kind, x, z, size, y = 0.025) {
    const list = this.mats[kind], m = new THREE.Mesh(this.geo, list[(Math.random() * list.length) | 0]);
    m.position.set(x, y + Math.random() * 0.004, z); m.rotation.y = Math.random() * 6.283; m.scale.set(size, 1, size * rnd(0.8, 1.2));
    m.receiveShadow = true; m.renderOrder = 1;
    this.game.level.group.add(m);
    return m;
  }

  /** Grime, cracks, moss and old blood across the level's floor. */
  scatter(level) {
    const outdoor = level.spec.floor === 'dirt';
    const n = Math.round(level.w * level.h * (outdoor ? 0.09 : 0.16));
    for (let i = 0; i < n; i++) {
      const cx = (Math.random() * level.w) | 0, cz = (Math.random() * level.h) | 0;
      if (!level.isFloor(cx, cz)) continue;
      const c = level.center(cx, cz), x = c.x + rnd(-1.8, 1.8), z = c.z + rnd(-1.8, 1.8);
      const r = Math.random();
      if (outdoor) { if (r < 0.55) this._add('grime', x, z, rnd(2.5, 5)); else if (r < 0.85) this._add('moss', x, z, rnd(2, 4)); else this._add('blood', x, z, rnd(1, 1.8)); }
      else if (r < 0.4) this._add('grime', x, z, rnd(2.5, 5)); else if (r < 0.7) this._add('crack', x, z, rnd(1.6, 3.2)); else if (r < 0.85) this._add('moss', x, z, rnd(1.5, 3)); else this._add('blood', x, z, rnd(1.2, 2.2));
    }
  }

  /** Fresh blood that spreads out under a fallen body, then slowly dries. */
  blood(pos, size = 2) {
    const m = this._add('blood', pos.x, pos.z, 0.1, 0.03);
    this.live.push({ m, t: 0, size });
    if (this.live.length > 40) { const o = this.live.shift(); o.m.removeFromParent(); }
  }

  /** Impact crack under heavy blows. */
  crack(pos, size = 2.5) { const m = this._add('crack', pos.x, pos.z, size, 0.028); this.live.push({ m, t: 1, size, crack: true }); }

  update(dt) {
    for (const o of this.live) if (!o.crack && o.t < 1) { o.t = Math.min(1, o.t + dt * 0.5); const e = 1 - (1 - o.t) ** 3; o.m.scale.set(o.size * e, 1, o.size * e); }
  }

  clear() { this.live.length = 0; }
}
