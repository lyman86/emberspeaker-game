import { ULTIMATE_GLYPHS, ULTIMATE_STYLES } from './ultimate-art.js';
import { GLYPHS } from './skillglyphs.js';

/**
 * Painted skill icons: a game-icons.net glyph (CC BY 3.0) composited onto a textured, lit background with
 * an energy glow, a metallic / elemental gradient fill, surface grain, rim light and vignette.
 * Rendered once per skill into a PNG data URL.
 */

// palette: bg0 centre, bg1 edge, glow, fill gradient top→bottom, rim, swirl
const P = {
  fire: { bg: ['#6a1a04', '#120402'], glow: '#ff6a10', fill: ['#fff6d0', '#ffc040', '#e04a08'], rim: '#ffe6a0', swirl: '#ff8a20' },
  ice: { bg: ['#0e3a70', '#020a1a'], glow: '#4ab8ff', fill: ['#ffffff', '#bfe8ff', '#3a8ae0'], rim: '#e8f8ff', swirl: '#6ac8ff' },
  storm: { bg: ['#1c1e6a', '#04041a'], glow: '#7a8aff', fill: ['#ffffff', '#c8d0ff', '#5a6ae8'], rim: '#f0f2ff', swirl: '#8a9aff' },
  arcane: { bg: ['#3a1260', '#0a0218'], glow: '#b46aff', fill: ['#ffffff', '#e0c0ff', '#8a40e0'], rim: '#f6e8ff', swirl: '#c080ff' },
  steel: { bg: ['#4a1408', '#100402'], glow: '#ff7a30', fill: ['#ffffff', '#d8d4cc', '#7a7068'], rim: '#fff0d8', swirl: '#ff6a20' },
  blood: { bg: ['#5a0a0a', '#120202'], glow: '#ff3a20', fill: ['#fff0e0', '#ffb090', '#c02a18'], rim: '#ffe0c8', swirl: '#ff4020' },
  wild: { bg: ['#1e4a1a', '#040e04'], glow: '#9aff5a', fill: ['#ffffff', '#e8e0c4', '#8a7a52'], rim: '#f4ffe0', swirl: '#a0ff70' },
  wind: { bg: ['#14404a', '#020c10'], glow: '#7affe0', fill: ['#ffffff', '#d8fff4', '#4ab8a0'], rim: '#f0fffa', swirl: '#80ffe0' },
  holy: { bg: ['#6a4a0a', '#140c02'], glow: '#ffd24a', fill: ['#ffffff', '#fff0b0', '#d89a20'], rim: '#fffbe8', swirl: '#ffdc6a' },
  bone: { bg: ['#14402a', '#020c06'], glow: '#5aff8a', fill: ['#ffffff', '#ece6cc', '#8a8460'], rim: '#f4fff0', swirl: '#6aff9a' },
  death: { bg: ['#183a14', '#030a02'], glow: '#7aff3a', fill: ['#f4ffe8', '#b8ff90', '#3a9a20'], rim: '#f0ffe0', swirl: '#90ff50' },
};

const STYLE = {
  firebolt: 'fire', fireball: 'fire', nova: 'ice', chain: 'storm', meteor: 'fire', blink: 'arcane',
  cleave: 'steel', slam: 'steel', warcry: 'blood', whirlwind: 'steel', leap: 'steel', charge: 'blood',
  shot: 'wild', multishot: 'wild', pierce: 'wind', rain: 'wild', explosive: 'fire', roll: 'wind',
  smite: 'holy', hammer: 'holy', shield: 'holy', heal: 'holy', consecrate: 'holy', bash: 'holy',
  bonespike: 'bone', lance: 'bone', raise: 'bone', corpse: 'death', deathnova: 'death', wraithstep: 'bone',
};

// ---- small value-noise for painterly grain / swirling energy
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * vnoise(x, y); x = x * 2.02 + 7.3; y = y * 2.02 + 1.7; a *= 0.5; } return s; }

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

let grainCanvas = null;
function grain(S) {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const n = fbm(i / 18, j / 18) * 0.7 + hash(i, j) * 0.3;
    const k = (j * S + i) * 4, v = Math.round(n * 255);
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return (grainCanvas = c);
}

const cache = new Map();

/** PNG data URL for a skill id (null if no glyph). */
export function skillArt(id, S = 128) {
  if (cache.has(id)) return cache.get(id);
  const d = ULTIMATE_GLYPHS[id] ?? GLYPHS[id];
  if (!d) return null;
  const p = P[ULTIMATE_STYLES[id] ?? STYLE[id] ?? 'arcane'];
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const seed = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0);

  // 1. background: lit gradient + swirling energy noise
  let g = x.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.75);
  g.addColorStop(0, p.bg[0]); g.addColorStop(1, p.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const img = x.getImageData(0, 0, S, S), sw = hex(p.swirl);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S - 0.5, v = j / S - 0.5, r = Math.hypot(u, v), a = Math.atan2(v, u);
    const n = fbm(Math.cos(a + r * 5) * r * 6 + seed, Math.sin(a + r * 5) * r * 6 - seed * 0.3);
    const e = Math.max(0, n - 0.42) * 2.2 * Math.max(0, 1 - r * 1.5);
    const k = (j * S + i) * 4;
    for (let q = 0; q < 3; q++) img.data[k + q] = Math.min(255, img.data[k + q] + sw[q] * e * 0.55);
  }
  x.putImageData(img, 0, 0);
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.35; x.drawImage(grain(S), 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';

  // 2. glyph path scaled into the frame
  const path = new Path2D(d), sc = (S * 0.8) / 512, off = S * 0.1;
  const withGlyph = (fn) => { x.save(); x.translate(off, off); x.scale(sc, sc); fn(); x.restore(); };
  // outer glow (two soft passes)
  for (const [blur, alpha] of [[S * 0.16, 0.9], [S * 0.06, 1]]) {
    x.save(); x.shadowColor = p.glow; x.shadowBlur = blur; x.globalAlpha = alpha;
    withGlyph(() => { x.fillStyle = p.glow; x.fill(path, ULTIMATE_GLYPHS[id]?'evenodd':'nonzero'); });
    x.restore();
  }
  // drop shadow for depth
  x.save(); x.shadowColor = 'rgba(0,0,0,0.85)'; x.shadowBlur = S * 0.03; x.shadowOffsetX = S * 0.012; x.shadowOffsetY = S * 0.02;
  withGlyph(() => { x.fillStyle = '#000'; x.fill(path, ULTIMATE_GLYPHS[id]?'evenodd':'nonzero'); });
  x.restore();
  // body fill: vertical metallic / elemental gradient
  x.save(); x.translate(off, off); x.scale(sc, sc);
  const gg = x.createLinearGradient(0, 0, 160, 512);
  gg.addColorStop(0, p.fill[0]); gg.addColorStop(0.45, p.fill[1]); gg.addColorStop(1, p.fill[2]);
  x.fillStyle = gg; x.fill(path, ULTIMATE_GLYPHS[id]?'evenodd':'nonzero');
  // surface detail clipped to the glyph: grain, specular sweep, inner shadow toward bottom-right
  x.clip(path, ULTIMATE_GLYPHS[id]?'evenodd':'nonzero');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.55; x.drawImage(grain(S), 0, 0); x.globalAlpha = 1;
  x.globalCompositeOperation = 'screen';
  const sp = x.createLinearGradient(S * 0.1, S * 0.05, S * 0.6, S * 0.55);
  sp.addColorStop(0, 'rgba(255,255,255,0.0)'); sp.addColorStop(0.45, 'rgba(255,255,255,0.35)'); sp.addColorStop(0.55, 'rgba(255,255,255,0.0)');
  x.fillStyle = sp; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'multiply';
  const sh = x.createRadialGradient(S * 0.3, S * 0.25, S * 0.1, S * 0.5, S * 0.5, S * 0.8);
  sh.addColorStop(0, 'rgba(255,255,255,1)'); sh.addColorStop(1, 'rgba(90,70,60,1)');
  x.fillStyle = sh; x.fillRect(0, 0, S, S);
  x.restore();
  // rim light: thin bright stroke offset up-left
  x.save(); x.translate(off - S * 0.006, off - S * 0.008); x.scale(sc, sc);
  x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.35; x.lineWidth = 6; x.strokeStyle = p.rim; x.stroke(path);
  x.restore();

  // 3. vignette, corner sparkle and bevel
  g = x.createRadialGradient(S * 0.5, S * 0.5, S * 0.35, S * 0.5, S * 0.5, S * 0.74);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'screen';
  g = x.createLinearGradient(0, 0, 0, S * 0.5); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S * 0.5);
  x.globalCompositeOperation = 'source-over';
  x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(1, S - 1); x.lineTo(1, 1); x.lineTo(S - 1, 1); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.moveTo(S - 1, 1); x.lineTo(S - 1, S - 1); x.lineTo(1, S - 1); x.stroke();

  const url = c.toDataURL('image/png');
  cache.set(id, url);
  return url;
}

/** Replace each skill's vector icon with its painted version (call once in the browser). */
export function paintSkillIcons(skills) {
  for (const s of skills) {
    const url = skillArt(s.id);
    if (url) s.icon = `<img class="sk-art" draggable="false" src="${url}">`;
  }
}
