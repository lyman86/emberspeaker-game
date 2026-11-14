import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { inventoryModel } from './inventory-art.js';
import { BASES, RARITY } from './items.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/**
 * Procedural 3D equipment. One model per item (base × rarity × variant × legendary) is used for:
 *  - the inventory icon (rendered once, cached as an image),
 *  - the item lying on the ground,
 *  - the piece worn by the hero (weapon in hand, shield on the arm, helmet, pauldrons, bracers, greaves).
 *
 * Model conventions (metres, real size):
 *  weapons  — grip at the origin, long axis +Y (thumb side), edge / striking side +X (finger side)
 *  bows     — grip at the origin, limbs along ±Y, string toward −X (toward the archer)
 *  shield   — centre of the arm strap at the origin, face normal +Z, top +Y
 *  helm     — centre of the skull at the origin, up +Y, face +Z (for a 0.24 m head)
 *  pauldron — top of the left shoulder at the origin, up +Y, outward +X
 *  bracer / greave — along +Y (toward the hand / toward the knee), front +Z
 */

const LEG_THEME = {
  emberheart: [3.5, 1.1, 0.2], stormcoil: [0.8, 1.6, 4], butcher: [3, 0.25, 0.15], warlord: [3, 0.9, 0.2], windforce: [1, 3, 2.4],
  hawk: [3, 2.2, 0.6], dawn: [3.2, 2.6, 1.2], aegis: [2.6, 2.4, 1.6], deathsbreath: [0.6, 3, 1], boneweaver: [0.9, 3, 1.4],
  silentbell: [2, 0.8, 3.4], gravewalker: [0.7, 2.6, 0.9], bloodring: [3, 0.2, 0.25],
};
const GEM = { common: null, magic: [0.35, 0.8, 3.2], rare: [3, 1.9, 0.35], legendary: [3.4, 1.3, 0.25] };

export function itemVariant(it) { return it.v ?? (it.uid ?? 0) % 3; }

/** Which visual family an item belongs to (decides geometry). */
export function visualKind(it) {
  const b = BASES[it.base];
  if (!b) return 'misc';
  if (b.slot === 'chest') return 'pauldron';
  if (b.slot === 'gloves') return 'bracer';
  if (b.slot === 'boots') return 'greave';
  return it.base;
}

export class Gear {
  constructor(renderer, materials) {
    this.materials = materials;
    const pm = new THREE.PMREMGenerator(renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.mats = {};
    this.icons = new Map();
    this.cache = new Map();
  }

  // ------------------------------------------------------------------ materials
  _std(key, o) {
    if (!this.mats[key]) {
      const M = o.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      const { physical, ...rest } = o;
      this.mats[key] = new M({ envMap: this.env, envMapIntensity: 0.32, ...rest });
    }
    return this.mats[key];
  }
  metal(kind) {
    const T = this.materials.tex;
    const nor = T?.slate_floor_03?.nor;
    const K = {
      iron: { color: 0x6f6b66, roughness: 0.55 },
      steel: { color: 0xb4b8be, roughness: 0.3 },
      dark: { color: 0x474a52, roughness: 0.3 },
      gold: { color: 0xd8a64c, roughness: 0.28 },
      silver: { color: 0xe4e6ea, roughness: 0.2 },
      bronze: { color: 0xa0703c, roughness: 0.4 },
      bone: { color: 0xd8cfb4, roughness: 0.55, metalness: 0 },
    }[kind];
    return this._std('m:' + kind, { metalness: 1, normalMap: nor, normalScale: new THREE.Vector2(0.15, 0.15), ...K });
  }
  wood() { const T = this.materials.tex?.weathered_brown_planks; return this._std('wood', { color: 0x8a6a4a, roughness: 0.75, metalness: 0, map: T?.diff, normalMap: T?.nor }); }
  leather(col = 0x4a3020) { const T = this.materials.tex?.rock_surface; return this._std('leather:' + col, { color: col, roughness: 0.7, metalness: 0, normalMap: T?.nor, normalScale: new THREE.Vector2(0.4, 0.4) }); }
  cloth(col) { const T = this.materials.tex?.dry_decay_leaves; return this._std('cloth:' + col, { color: col, roughness: 0.92, metalness: 0, normalMap: T?.nor, normalScale: new THREE.Vector2(0.25, 0.25), side: THREE.DoubleSide }); }
  glow(c) { return this._std('glow:' + c.join(','), { color: 0x000000, emissive: new THREE.Color(...c), emissiveIntensity: 1, roughness: 0.3, metalness: 0 }); }
  gem(c) { return this._std('gem:' + c.join(','), { color: new THREE.Color(...c).multiplyScalar(0.12), emissive: new THREE.Color(...c).multiplyScalar(0.55), roughness: 0.08, metalness: 0.2, envMapIntensity: 1.4 }); }

  /** Palette for one item: primary metal, trim, gem colour, rune glow. */
  _look(it) {
    const r = it.rarity, v = itemVariant(it);
    const L = it.legendary ? LEG_THEME[it.flag] ?? [3, 1.2, 0.3] : null;
    const look = {
      r, v, L,
      main: this.metal(r === 'common' ? 'iron' : r === 'magic' ? 'steel' : r === 'rare' ? (v === 1 ? 'steel' : 'dark') : (['silentbell', 'boneweaver', 'deathsbreath'].includes(it.flag) ? 'dark' : it.flag === 'aegis' || it.flag === 'dawn' ? 'silver' : 'dark')),
      trim: this.metal(r === 'common' ? 'iron' : r === 'magic' ? (v === 2 ? 'bronze' : 'steel') : 'gold'),
      gemCol: L ?? GEM[r],
      wood: this.wood(),
      leather: this.leather(r === 'legendary' ? 0x2a1a14 : r === 'rare' ? 0x3a2216 : 0x4a3020),
    };
    look.gemMat = look.gemCol ? this.gem(look.gemCol) : null;
    look.rune = L ? this.glow(L.map((x) => x * 0.9)) : null;
    look.cloth = this.cloth(r === 'legendary' ? 0x1c1418 : r === 'rare' ? [0x6a1414, 0x1d2a52, 0x2a3a1a][v] : r === 'magic' ? [0x22325e, 0x3a2a4a, 0x2a4038][v] : [0x5a4a38, 0x4a4036, 0x3e3a34][v]);
    return look;
  }

  // ------------------------------------------------------------------ model
  /** New Object3D for an item (shared geometry/materials; cheap to make many). */
  model(it) {
    const key = [it.base, it.rarity, itemVariant(it), it.legendary ?? ''].join('|');
    if (!this.cache.has(key)) this.cache.set(key, this._build(it));
    const src = this.cache.get(key);
    const o = src.clone(true);
    o.userData = { ...src.userData };
    return o;
  }

  _build(it) {
    const K = this._look(it);
    const g = new THREE.Group();
    const add = (geo, mat, pos, rot, scl) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); if (scl) m.scale.set(...scl); m.castShadow = true; g.add(m); return m; };
    const fn = this['_' + visualKind(it)];
    (fn ?? this._misc).call(this, add, K, it, g);
    g.userData.tip = { sword: 0.95, axe: 0.68, mace: 0.66, staff: 1.2, scythe: 1.25, wand: 0.34 }[visualKind(it)] ?? 0;
    return g;
  }

  // ---- weapons
  _grip(add, K, len = 0.16, r = 0.017) {
    add(new THREE.CylinderGeometry(r, r * 1.08, len, 10), K.leather);
    for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(r * 1.05, r * 0.28, 5, 12), K.leather, [0, -len / 2 + (i + 0.5) * (len / 5), 0], [Math.PI / 2, 0, 0.3]);
  }

  _sword(add, K) {
    this._grip(add, K);
    // pommel
    if (K.gemMat && K.r !== 'magic') add(new THREE.OctahedronGeometry(0.03, 0), K.gemMat, [0, -0.11, 0], null, [1, 1.3, 1]);
    else add(new THREE.SphereGeometry(0.03, 12, 8), K.trim, [0, -0.105, 0]);
    // cross-guard (curved quillons along the edge axis)
    const gs = new THREE.Shape();
    const gw = K.r === 'common' ? 0.1 : 0.13, curl = K.r === 'common' ? 0 : 0.03;
    gs.moveTo(-gw, curl); gs.quadraticCurveTo(-gw * 0.5, -0.012, 0, -0.012); gs.quadraticCurveTo(gw * 0.5, -0.012, gw, curl);
    gs.lineTo(gw, curl + 0.018); gs.quadraticCurveTo(gw * 0.5, 0.012, 0, 0.016); gs.quadraticCurveTo(-gw * 0.5, 0.012, -gw, curl + 0.018); gs.closePath();
    add(extrude(gs, 0.02, 0.004), K.trim, [0, 0.093, 0]);
    if (K.gemMat) add(new THREE.OctahedronGeometry(0.018, 0), K.gemMat, [0, 0.098, 0.018]);
    // blade with bevelled edges and a ricasso
    const len = K.r === 'legendary' ? 0.92 : 0.82, w = K.r === 'rare' || K.r === 'legendary' ? 0.03 : 0.026;
    const bs = new THREE.Shape();
    bs.moveTo(-w, 0); bs.lineTo(-w * 0.92, len * 0.7); bs.quadraticCurveTo(-w * 0.8, len * 0.92, 0, len); bs.quadraticCurveTo(w * 0.8, len * 0.92, w * 0.92, len * 0.7); bs.lineTo(w, 0); bs.closePath();
    add(extrude(bs, 0.003, 0.0045, 0.011), K.main, [0, 0.11, 0]);
    // fuller
    add(new THREE.BoxGeometry(0.008, len * 0.62, 0.0105), K.r === 'legendary' ? K.rune : this.metal('dark'), [0, 0.11 + len * 0.36, 0]);
  }

  _axe(add, K) {
    add(new THREE.CylinderGeometry(0.019, 0.022, 0.8, 9), K.wood, [0, 0.22, 0]);
    this._grip(add, K, 0.14, 0.021);
    add(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 9), K.trim, [0, -0.17, 0]);
    // bearded head, edge toward +X
    const s = new THREE.Shape();
    const big = K.r === 'rare' || K.r === 'legendary';
    s.moveTo(0.015, 0.05); s.lineTo(0.08, 0.06); s.quadraticCurveTo(0.15, 0.09, big ? 0.2 : 0.17, big ? 0.15 : 0.12);
    s.quadraticCurveTo(big ? 0.24 : 0.2, 0.0, big ? 0.2 : 0.17, big ? -0.15 : -0.11); s.quadraticCurveTo(0.12, -0.08, 0.07, -0.03); s.lineTo(0.015, -0.03); s.closePath();
    add(extrude(s, 0.012, 0.005, 0.004), K.main, [0, 0.52, 0]);
    add(new THREE.BoxGeometry(0.05, 0.1, 0.045), K.trim, [0, 0.525, 0]);
    if (big) { const sp = new THREE.ConeGeometry(0.022, 0.1, 6); sp.rotateZ(Math.PI / 2); add(sp, K.main, [-0.075, 0.525, 0]); }
    else add(new THREE.BoxGeometry(0.05, 0.05, 0.04), K.main, [-0.045, 0.525, 0]);
    if (K.rune) add(new THREE.BoxGeometry(0.1, 0.006, 0.026), K.rune, [0.12, 0.52, 0]);
    if (K.gemMat) add(new THREE.OctahedronGeometry(0.02, 0), K.gemMat, [0, 0.525, 0.025]);
  }

  _mace(add, K) {
    add(new THREE.CylinderGeometry(0.017, 0.02, 0.62, 9), K.r === 'common' ? K.wood : K.main, [0, 0.16, 0]);
    this._grip(add, K, 0.15, 0.02);
    add(new THREE.SphereGeometry(0.026, 10, 8), K.trim, [0, -0.1, 0]);
    add(new THREE.CylinderGeometry(0.035, 0.03, 0.15, 10), K.main, [0, 0.52, 0]);
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10), K.trim, [0, 0.43, 0]);
    const n = K.r === 'common' ? 6 : 8;
    const fs = new THREE.Shape(); fs.moveTo(0, -0.08); fs.lineTo(0.06, -0.04); fs.quadraticCurveTo(0.075, 0.02, 0.05, 0.07); fs.lineTo(0, 0.09); fs.closePath();
    const fl = extrude(fs, 0.008, 0.003);
    for (let i = 0; i < n; i++) { const m = add(fl, i % 2 && K.r !== 'common' ? K.trim : K.main, [0, 0.52, 0], [0, (i / n) * Math.PI * 2, 0]); m.translateX(0.02); }
    add(new THREE.ConeGeometry(0.02, 0.06, 6), K.main, [0, 0.62, 0]);
    if (K.gemMat) add(new THREE.SphereGeometry(0.018, 10, 8), K.gemMat, [0, 0.66, 0]);
    if (K.rune) add(new THREE.TorusGeometry(0.038, 0.004, 6, 20), K.rune, [0, 0.47, 0], [Math.PI / 2, 0, 0]);
  }

  _staff(add, K) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const y = -0.65 + i * 0.17; pts.push(new THREE.Vector3(Math.sin(i * 1.7) * 0.012, y, Math.cos(i * 2.3) * 0.01)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.021, 7), K.r === 'common' ? K.wood : this.cloth(0x1c1410), null);
    for (const y of [-0.05, 0.08, 0.95]) add(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 9), K.trim, [0, y, 0]);
    // claw holding a crystal
    const c = K.gemCol ?? [0.9, 0.6, 0.3];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const cur = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(Math.cos(a) * 0.06, 1.08, Math.sin(a) * 0.06), new THREE.Vector3(Math.cos(a) * 0.05, 1.18, Math.sin(a) * 0.05), new THREE.Vector3(Math.cos(a) * 0.02, 1.24, Math.sin(a) * 0.02)]);
      add(new THREE.TubeGeometry(cur, 10, 0.008, 5), K.r === 'common' ? K.wood : K.trim);
    }
    const cr = add(new THREE.OctahedronGeometry(0.045, 0), this.gem(c), [0, 1.13, 0], null, [1, 1.7, 1]);
    cr.userData.glowCore = true;
    if (K.r === 'legendary' || K.r === 'rare') add(new THREE.TorusGeometry(0.075, 0.004, 6, 24), K.rune ?? K.trim, [0, 1.13, 0], [Math.PI / 2.4, 0, 0]);
  }

  _wand(add, K) {
    add(new THREE.LatheGeometry([[0.0, -0.1], [0.016, -0.1], [0.018, -0.08], [0.014, 0.1], [0.011, 0.28], [0.0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 10), K.r === 'common' ? K.wood : this.metal('bone'));
    for (const y of [-0.07, 0.07, 0.25]) add(new THREE.TorusGeometry(0.015, 0.004, 5, 12), K.trim, [0, y, 0], [Math.PI / 2, 0, 0]);
    add(new THREE.OctahedronGeometry(0.028, 0), this.gem(K.gemCol ?? [0.9, 0.5, 0.25]), [0, 0.33, 0], null, [1, 1.6, 1]);
  }

  _scythe(add, K) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.9) * 0.015, -0.5 + i * 0.21, 0));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.02, 7), K.r === 'common' ? K.wood : this.cloth(0x221a14));
    add(new THREE.CylinderGeometry(0.027, 0.027, 0.06, 8), K.trim, [0, 1.17, 0]);
    // long crescent blade sweeping toward +X then down
    const s = new THREE.Shape();
    s.moveTo(0, 0.03); s.quadraticCurveTo(0.32, 0.12, 0.62, -0.12); s.quadraticCurveTo(0.34, 0.0, 0, -0.04); s.closePath();
    add(extrude(s, 0.006, 0.004, 0.006), K.r === 'common' ? K.main : this.metal('dark'), [0, 1.17, 0]);
    // skull ornament
    if (K.r !== 'common') { add(new THREE.SphereGeometry(0.04, 10, 8), this.metal('bone'), [0, 1.24, 0.0], null, [1, 1.1, 1.1]); add(new THREE.SphereGeometry(0.01, 6, 4), this.glow(K.gemCol ?? [0.5, 2, 0.8]), [-0.014, 1.245, 0.036]); add(new THREE.SphereGeometry(0.01, 6, 4), this.glow(K.gemCol ?? [0.5, 2, 0.8]), [0.014, 1.245, 0.036]); }
    if (K.rune) add(new THREE.BoxGeometry(0.3, 0.004, 0.014), K.rune, [0.28, 1.21, 0], [0, 0, -0.2]);
  }

  _bowShape(add, K, recurve) {
    const L = recurve ? 0.62 : 0.78;
    const mk = (sgn) => new THREE.CatmullRomCurve3([
      [0, 0.06], [-0.025, L * 0.35], [-0.07, L * 0.72], [-0.1, L * 0.95], recurve ? [-0.06, L * 1.06] : [-0.11, L * 1.0],
    ].map(([x, y]) => new THREE.Vector3(x, y * sgn, 0)));
    for (const sgn of [1, -1]) {
      add(new THREE.TubeGeometry(mk(sgn), 24, 0.014, 6), K.r === 'common' ? K.wood : K.r === 'magic' ? this.leather(0x3a2414) : this.metal('dark'));
      const tip = mk(sgn).getPoint(1);
      add(new THREE.ConeGeometry(0.012, 0.05, 6), K.trim, [tip.x, tip.y, 0], [0, 0, sgn > 0 ? 0.6 : Math.PI - 0.6]);
    }
    const t1 = mk(1).getPoint(1);
    const str = new THREE.CylinderGeometry(0.0025, 0.0025, t1.y * 2, 4);
    add(str, this._std('string', { color: 0xd8d0c0, roughness: 0.8, metalness: 0 }), [t1.x, 0, 0]);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.13, 8), K.leather);
    if (K.rune) for (const sgn of [1, -1]) add(new THREE.TubeGeometry(mk(sgn), 20, 0.0035, 4), K.rune, [0.012, 0, 0]);
    if (K.gemMat) add(new THREE.OctahedronGeometry(0.018, 0), K.gemMat, [0.02, 0, 0]);
  }
  _bow(add, K) { this._bowShape(add, K, false); }
  _crossbow(add, K) { this._bowShape(add, K, true); }

  // ---- off-hands
  _shield(add, K) {
    const v = K.v;
    const shape = new THREE.Shape();
    if (K.r === 'common' && v !== 2) { shape.absarc(0, 0, 0.33, 0, Math.PI * 2, false); }
    else { // heater / kite
      const w = 0.27, top = 0.36, bot = K.r === 'rare' || K.r === 'legendary' ? -0.5 : -0.4;
      shape.moveTo(-w, top); shape.lineTo(w, top); shape.lineTo(w, 0.05); shape.quadraticCurveTo(w * 0.95, bot * 0.6, 0, bot); shape.quadraticCurveTo(-w * 0.95, bot * 0.6, -w, 0.05); shape.closePath();
    }
    const geo = extrude(shape, 0.025, 0.008, 0.008, 24);
    bend(geo, 0.55);
    const face = K.r === 'common' ? K.wood : K.r === 'magic' ? this.cloth([0x2a3a6a, 0x6a1a1a, 0x2a4a2a][v]) : K.main;
    add(geo, face, [0, 0, 0.02]);
    // rim
    const pts = shape.getSpacedPoints(64).map((p) => new THREE.Vector3(p.x, p.y, 0.02 + 0.035 - (p.x * p.x) * 0.55));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.013, 6, true), K.trim);
    // boss / emblem
    if (K.r === 'common') { add(new THREE.SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.trim, [0, 0, 0.055], [Math.PI / 2, 0, 0]); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(new THREE.SphereGeometry(0.012, 6, 4), K.trim, [Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.05 - 0.035]); } }
    else {
      const cross = new THREE.Shape(); const a = 0.03;
      cross.moveTo(-a, 0.26); cross.lineTo(a, 0.26); cross.lineTo(a, 0.08); cross.lineTo(0.17, 0.08); cross.lineTo(0.17, 0.02); cross.lineTo(a, 0.02); cross.lineTo(a, -0.3); cross.lineTo(-a, -0.3); cross.lineTo(-a, 0.02); cross.lineTo(-0.17, 0.02); cross.lineTo(-0.17, 0.08); cross.lineTo(-a, 0.08); cross.closePath();
      const cg = extrude(cross, 0.008, 0.003); bend(cg, 0.55);
      add(cg, K.r === 'legendary' ? K.rune : K.trim, [0, 0, 0.07]);
      if (K.gemMat) add(new THREE.OctahedronGeometry(0.03, 0), K.gemMat, [0, 0.05, 0.09]);
    }
    // straps on the back
    add(new THREE.BoxGeometry(0.06, 0.2, 0.02), K.leather, [0, 0, -0.01]);
  }

  _orb(add, K) {
    const c = K.gemCol ?? [1.2, 0.6, 0.25];
    const core = add(new THREE.IcosahedronGeometry(0.045, 2), this.glow(c.map((x) => x * 0.8)));
    core.userData.glowCore = true;
    add(new THREE.SphereGeometry(0.075, 24, 16), this._std('glass', { color: 0x223040, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, envMapIntensity: 2, depthWrite: false }));
    add(new THREE.TorusGeometry(0.095, 0.005, 6, 32), K.trim, null, [Math.PI / 2.3, 0.3, 0]);
    if (K.r !== 'common') add(new THREE.TorusGeometry(0.11, 0.004, 6, 32), K.rune ?? K.trim, null, [0.4, Math.PI / 2.2, 0]);
  }

  _quiver(add, K) {
    add(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 12, 1, true), K.leather, null);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12), K.leather, [0, -0.25, 0]);
    for (const y of [0.22, -0.18]) add(new THREE.TorusGeometry(0.062, 0.006, 6, 18), K.trim, [0, y, 0], [Math.PI / 2, 0, 0]);
    const fe = this._std('feather' + K.r, { color: K.r === 'legendary' ? 0xd8a040 : K.r === 'rare' ? 0x8a1a1a : 0xd8d0c0, roughness: 0.9, side: THREE.DoubleSide, metalness: 0 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, x = Math.cos(a) * 0.03, z = Math.sin(a) * 0.03;
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), K.wood, [x, 0.3, z]);
      add(new THREE.PlaneGeometry(0.02, 0.08), fe, [x, 0.36, z], [0, a, 0]);
    }
  }

  _relic(add, K) {
    add(new THREE.BoxGeometry(0.1, 0.13, 0.07), K.r === 'common' ? K.wood : this.metal('dark'));
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.018, 0.018, 0.075), K.trim, [x * 0.05, y * 0.065, 0]);
    add(new THREE.ConeGeometry(0.07, 0.06, 4), K.trim, [0, 0.095, 0], [0, Math.PI / 4, 0]);
    add(new THREE.PlaneGeometry(0.05, 0.07), this.glow(K.gemCol ?? [0.4, 1.4, 0.6]), [0, 0, 0.0355]);
    add(new THREE.SphereGeometry(0.022, 10, 8), this.metal('bone'), [0, 0, 0.04]);
  }

  // ---- armour
  _helm(add, K) {
    const v = K.v, r = K.r;
    const full = r !== 'common' || v === 2;
    const prof = full
      ? [[0, 0.155], [0.07, 0.15], [0.115, 0.115], [0.135, 0.05], [0.138, -0.03], [0.13, -0.13], [0.118, -0.15]]
      : [[0, 0.15], [0.07, 0.145], [0.115, 0.11], [0.132, 0.05], [0.136, 0.0], [0.15, -0.01], [0.15, -0.02]];
    const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 28);
    add(g, K.main, [0, 0.03, -0.01]);
    if (full) {
      // eye slit and breathing holes as dark (or glowing) inlays on the face side
      add(new THREE.BoxGeometry(0.17, 0.018, 0.02), K.r === 'legendary' ? K.rune : this._std('void', { color: 0x050505, roughness: 1, metalness: 0 }), [0, 0.035, 0.122]);
      add(new THREE.BoxGeometry(0.02, 0.1, 0.02), this._std('void', { color: 0x050505, roughness: 1, metalness: 0 }), [0, -0.035, 0.124]);
      add(new THREE.TorusGeometry(0.137, 0.008, 6, 28), K.trim, [0, -0.1, -0.01], [Math.PI / 2, 0, 0]);
      add(new THREE.BoxGeometry(0.012, 0.2, 0.25), K.trim, [0, 0.12, -0.01]); // ridge
    } else {
      add(new THREE.BoxGeometry(0.025, 0.11, 0.02), K.trim, [0, -0.0, 0.135]); // nasal
      add(new THREE.TorusGeometry(0.135, 0.007, 6, 28), K.trim, [0, 0.03, -0.01], [Math.PI / 2, 0, 0]);
    }
    if (r === 'rare' || r === 'legendary') { // crest plume
      const s = new THREE.Shape(); s.moveTo(-0.14, 0.0); s.quadraticCurveTo(-0.05, 0.16, 0.12, 0.07); s.lineTo(0.13, 0.0); s.quadraticCurveTo(0, 0.05, -0.14, 0); s.closePath();
      const pg = extrude(s, 0.016, 0.005); pg.scale(0.85, 0.7, 1); pg.rotateY(Math.PI / 2);
      add(pg, this.cloth(r === 'legendary' ? 0x8a1010 : [0x7a1414, 0x14306a, 0x6a5a3a][v]), [0, 0.165, -0.02]);
    }
    if (r === 'legendary') for (const s of [1, -1]) { // horns
      const cur = new THREE.CatmullRomCurve3([new THREE.Vector3(0.12 * s, 0.08, 0), new THREE.Vector3(0.22 * s, 0.13, -0.02), new THREE.Vector3(0.26 * s, 0.25, -0.05), new THREE.Vector3(0.22 * s, 0.33, -0.08)]);
      add(new THREE.TubeGeometry(cur, 16, 0.022, 7), this.metal('bone'));
    }
    if (K.gemMat && r !== 'legendary') add(new THREE.OctahedronGeometry(0.018, 0), K.gemMat, [0, 0.12, 0.11]);
  }

  _hood(add, K) {
    const open = 1.0; // half-width of the face opening (radians)
    const g = new THREE.SphereGeometry(0.15, 28, 18, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.72);
    g.scale(1, 1.12, 1.08);
    add(g, K.cloth, [0, 0.0, -0.015]);
    const drape = new THREE.CylinderGeometry(0.135, 0.2, 0.2, 24, 1, true, open * 0.8, Math.PI * 2 - open * 1.6);
    add(drape, K.cloth, [0, -0.19, -0.03]);
    // peak of the cowl
    const pk = new THREE.ConeGeometry(0.06, 0.1, 10); pk.rotateX(-0.9);
    add(pk, K.cloth, [0, 0.13, -0.09]);
    if (K.r !== 'common') add(new THREE.TorusGeometry(0.148, 0.006, 6, 24, Math.PI * 2 - open * 2), K.rune ?? K.trim, [0, 0.0, -0.015], [Math.PI / 2, 0, Math.PI / 2 + open], [1, 1.08, 1]);
  }

  _pauldron(add, K, it) {
    const base = it.base, r = K.r;
    if (base === 'robe') { // cloth mantle with trim
      const th = Math.PI * 0.5;
      const g = new THREE.SphereGeometry(0.115, 20, 12, 0, Math.PI * 2, 0, th); g.scale(1.05, 0.8, 1.05);
      add(g, K.cloth, [0.0, -0.05, 0]);
      add(new THREE.TorusGeometry(0.115 * 1.05, 0.006, 6, 24), K.rune ?? K.trim, [0.0, -0.05, 0], [Math.PI / 2, 0, 0]);
      if (K.gemMat) add(new THREE.OctahedronGeometry(0.02, 0), K.gemMat, [0.05, 0.07, 0.06]);
      return;
    }
    const leather = base === 'leather';
    const mat = leather ? K.leather : K.main;
    const n = leather ? 2 : r === 'common' ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const rad = 0.13 - i * 0.012;
      const g = new THREE.SphereGeometry(rad, 22, 10, 0, Math.PI * 2, 0, Math.PI * (0.36 + i * 0.04)); g.scale(1.12, 0.48, 1.0);
      const m = add(g, i === n - 1 && !leather && r !== 'common' ? K.trim : mat, [0.025 + i * 0.022, 0.012 - i * 0.04, 0], [0, 0, -0.35 - i * 0.18]);
      m.renderOrder = i;
    }
    if (leather) for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; add(new THREE.SphereGeometry(0.008, 6, 4), K.trim, [0.03 + Math.sin(a) * 0.1, 0.06, Math.cos(a) * 0.1]); }
    if (r === 'rare' || r === 'legendary') { // spikes
      for (let i = 0; i < (r === 'legendary' ? 3 : 2); i++) add(new THREE.ConeGeometry(0.014, 0.08, 6), r === 'legendary' ? this.metal('bone') : K.trim, [0.02 + i * 0.035, 0.085 - i * 0.012, -0.02], [0, 0, -0.4 - i * 0.2]);
    }
    if (K.rune) add(new THREE.TorusGeometry(0.115, 0.004, 5, 24, Math.PI), K.rune, [0.03, 0.03, 0], [Math.PI / 2, 0, -0.4]);
  }

  _bracer(add, K) {
    add(new THREE.CylinderGeometry(0.04, 0.05, 0.17, 14, 1, true), K.r === 'common' ? K.leather : K.main, null);
    for (const y of [-0.075, 0.075]) add(new THREE.TorusGeometry(K.r === 'common' ? 0.042 : 0.046, 0.006, 5, 16), K.r === 'common' ? K.main : K.trim, [0, y * (y > 0 ? 0.95 : 1), 0], [Math.PI / 2, 0, 0], [y > 0 ? 0.88 : 1.05, y > 0 ? 0.88 : 1.05, 1]);
    if (K.r !== 'common') add(new THREE.BoxGeometry(0.03, 0.12, 0.012), K.trim, [0, 0, 0.047]);
    if (K.rune) add(new THREE.BoxGeometry(0.008, 0.1, 0.004), K.rune, [0, 0, 0.054]);
    if (K.gemMat) add(new THREE.OctahedronGeometry(0.012, 0), K.gemMat, [0, 0.0, 0.056]);
  }

  _greave(add, K) {
    const g = new THREE.CylinderGeometry(0.058, 0.05, 0.3, 16, 1, true, -Math.PI * 0.55, Math.PI * 1.1);
    add(g, K.r === 'common' ? K.leather : K.main, [0, 0, 0.005]);
    const knee = new THREE.SphereGeometry(0.055, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2); knee.rotateX(Math.PI / 2);
    add(knee, K.r === 'common' ? K.main : K.trim, [0, 0.17, 0.035], null, [1, 1, 0.7]);
    if (K.r !== 'common') add(new THREE.BoxGeometry(0.012, 0.26, 0.012), K.trim, [0, 0, 0.06]);
    if (K.rune) add(new THREE.BoxGeometry(0.006, 0.2, 0.004), K.rune, [0, -0.01, 0.068]);
    if (K.r !== 'common') for (const y of [-0.08, 0.06]) add(new THREE.TorusGeometry(0.057, 0.004, 5, 16, Math.PI * 1.1), K.trim, [0, y, 0.005], [Math.PI / 2, 0, -Math.PI * 0.05]);
  }

  _amulet(add, K) {
    add(new THREE.TorusGeometry(0.1, 0.004, 6, 40, Math.PI * 1.2), K.trim, [0, 0.07, 0], [0, 0, -Math.PI * 0.1 - Math.PI]);
    const s = new THREE.Shape(); s.moveTo(0, 0.05); s.lineTo(0.035, 0); s.lineTo(0, -0.06); s.lineTo(-0.035, 0); s.closePath();
    add(extrude(s, 0.008, 0.004), K.trim, [0, -0.04, 0]);
    add(new THREE.OctahedronGeometry(0.025, 0), this.gem(K.gemCol ?? [0.8, 0.7, 0.5]), [0, -0.045, 0.012], null, [0.9, 1.3, 0.6]);
  }

  _ring(add, K) {
    add(new THREE.TorusGeometry(0.03, 0.008, 10, 28), K.trim, null, [0.3, 0, 0]);
    add(new THREE.CylinderGeometry(0.012, 0.016, 0.01, 8), K.trim, [0, 0.036, 0.008]);
    add(new THREE.OctahedronGeometry(0.014, 0), this.gem(K.gemCol ?? [0.8, 0.7, 0.5]), [0, 0.046, 0.008], null, [1, 0.8, 1]);
  }

  _misc(add, K) { add(new THREE.BoxGeometry(0.2, 0.2, 0.2), K.main); }

  // ------------------------------------------------------------------ wearing
  /** Rest-pose (T-pose) world matrices of a rig's bones, keyed by bone-name suffix lookup. */
  _rig(scene) {
    if (scene.userData.rig) return scene.userData.rig;
    scene.updateMatrixWorld(true);
    const bones = [];
    scene.traverse((o) => { if (o.isBone) bones.push(o); });
    const find = (n) => bones.find((b) => b.name.endsWith(n));
    const W = (n) => { const b = find(n); return b ? b.matrixWorld.clone() : null; };
    const P = (n) => { const b = find(n); return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null; };
    const hand = (side) => {
      const h = P(side + 'Hand'), mid = P(side + 'HandMiddle1') ?? P(side + 'HandIndex1'), idx = P(side + 'HandIndex1'), pky = P(side + 'HandPinky1') ?? P(side + 'HandRing1');
      if (!h || !mid) return null;
      const finger = mid.clone().sub(h).normalize();
      const across = idx && pky ? idx.clone().sub(pky) : new THREE.Vector3(0, 0, 1);
      across.addScaledVector(finger, -across.dot(finger)).normalize();
      const palm = new THREE.Vector3().crossVectors(finger, across); if (palm.y > 0) palm.negate();
      return { h, finger, across, palm, len: mid.distanceTo(h) };
    };
    // head volume from the skinned vertices that follow the head bone (rest pose = bind pose)
    const headBox = new THREE.Box3(), v = new THREE.Vector3();
    scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const hi = o.skeleton.bones.findIndex((b) => b.name.endsWith('Head'));
      const ti = o.skeleton.bones.findIndex((b) => b.name.endsWith('HeadTop_End'));
      if (hi < 0) return;
      const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) { const b = si.getComponent(i, k); if (b === hi || b === ti) w += sw.getComponent(i, k); }
        if (w > 0.6) headBox.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
      }
    });
    const rig = (scene.userData.rig = { W, P, hand: { Left: hand('Left'), Right: hand('Right') }, head: headBox.isEmpty() ? null : headBox });
    return rig;
  }

  /** Attach worn models for every equipped item to an actor (removes the previous set). */
  dress(actor, equip, opts = {}) {
    for (const o of actor._gear ?? []) o.removeFromParent();
    actor._gear = [];
    actor.weaponObj = null;
    const src = actor.game.assets.gltf.get('mx:' + opts.file).scene;
    const R = this._rig(src);
    const bones = {};
    actor.model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const bone = (n) => Object.values(bones).find((b) => b.name.endsWith(n));
    const put = (item, boneName, pos, xAxis, yAxis, scale = 1, mirror = false) => {
      const b = bone(boneName), W = R.W(boneName);
      if (!b || !W) return;
      const z = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
      const x = new THREE.Vector3().crossVectors(yAxis, z).normalize();
      const D = new THREE.Matrix4().makeBasis(x, yAxis.clone().normalize(), z).scale(new THREE.Vector3(mirror ? -scale : scale, scale, scale)).setPosition(pos);
      const L = new THREE.Matrix4().copy(W).invert().multiply(D);
      const m = this.model(item);
      L.decompose(m.position, m.quaternion, m.scale);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false;
        if(item.stars===3){o.material=o.material.clone();o.material.emissive=new THREE.Color(RARITY[item.rarity].color).multiplyScalar(0.22);}
      } });
      b.add(m);
      actor._gear.push(m);
      return m;
    };
    const up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1), side = new THREE.Vector3(1, 0, 0);
    const P = R.P;
    for (const [slot, it] of Object.entries(equip)) {
      if (!it) continue;
      const kind = visualKind(it);
      if (slot === 'weapon') {
        const left = kind === 'bow' || kind === 'crossbow', H = R.hand[left ? 'Left' : 'Right'];
        if (!H) continue;
        const pos = H.h.clone().addScaledVector(H.finger, H.len * 0.8).addScaledVector(H.palm, 0.03);
        actor.weaponObj = put(it, (left ? 'Left' : 'Right') + 'Hand', pos, H.finger, H.across);
      } else if (slot === 'offhand') {
        if (kind === 'shield') {
          const fa = P('LeftForeArm'), hd = P('LeftHand'), H = R.hand.Left;
          if (!fa || !hd || !H) continue;
          const out = H.palm.clone().negate();
          const pos = fa.clone().lerp(hd, 0.5).addScaledVector(out, 0.07);
          const top = H.across.clone();
          put(it, 'LeftForeArm', pos, new THREE.Vector3().crossVectors(top, out), top);
        } else if (kind === 'orb') {
          const H = R.hand.Left; if (!H) continue;
          put(it, 'LeftHand', H.h.clone().addScaledVector(H.finger, H.len * 0.9).addScaledVector(H.palm, 0.12), H.finger, H.across);
        } else if (kind === 'quiver') {
          const s2 = P('Spine2') ?? P('Spine1'); if (!s2) continue;
          const y = new THREE.Vector3(-0.42, 1, 0).normalize();
          put(it, 'Spine2', s2.clone().add(new THREE.Vector3(0.06, 0.02, -0.17)), new THREE.Vector3().crossVectors(y, fwd), y);
        } else if (kind === 'relic') {
          const hp = P('Hips'); if (!hp) continue;
          put(it, 'Hips', hp.clone().add(new THREE.Vector3(0.17, -0.06, 0.03)), fwd.clone().negate(), up);
        }
      } else if (slot === 'helm') {
        const hd = P('Head');
        if (!hd) continue;
        let c, sc;
        if (R.head) { const z = R.head.getSize(new THREE.Vector3()); c = R.head.getCenter(new THREE.Vector3()); sc = (Math.max(z.x, z.z * 0.85) / 0.24) * 1.1; c.y = R.head.max.y - 0.16 * sc; }
        else { const top = P('HeadTop_End'), h = top ? top.distanceTo(hd) : 0.2; c = hd.clone().addScaledVector(up, h * 0.5).addScaledVector(fwd, 0.035); sc = h / 0.2; }
        put(it, 'Head', c, side, up, sc);
      } else if (slot === 'chest') {
        const la = P('LeftArm'), ra = P('RightArm');
        if (!la || !ra) continue;
        const s = la.distanceTo(ra) / 0.32;
        put(it, 'LeftArm', la.clone().add(new THREE.Vector3(0.025, 0.035, 0)), side, up, s * 0.78);
        put(it, 'RightArm', ra.clone().add(new THREE.Vector3(-0.025, 0.035, 0)), side, up, s * 0.78, true);
      } else if (slot === 'gloves') {
        for (const sd of ['Left', 'Right']) {
          const fa = P(sd + 'ForeArm'), hd = P(sd + 'Hand'), H = R.hand[sd];
          if (!fa || !hd || !H) continue;
          const y = hd.clone().sub(fa).normalize();
          const out = H.palm.clone().negate();
          put(it, sd + 'ForeArm', fa.clone().lerp(hd, 0.62), new THREE.Vector3().crossVectors(y, out), y, fa.distanceTo(hd) / 0.26);
        }
      } else if (slot === 'boots') {
        for (const sd of ['Left', 'Right']) {
          const kn = P(sd + 'Leg'), ft = P(sd + 'Foot');
          if (!kn || !ft) continue;
          const y = kn.clone().sub(ft).normalize();
          put(it, sd + 'Leg', kn.clone().lerp(ft, 0.5).addScaledVector(fwd, 0.02), new THREE.Vector3().crossVectors(y, fwd), y, kn.distanceTo(ft) / 0.42);
        }
      }
    }
    return actor._gear;
  }

  // ------------------------------------------------------------------ portraits
  /** Head-and-shoulders portrait of a character model (data URL, cached). hide = baked-in mesh indices to hide. */
  portrait(game, file, hide = [], size = 160) {
    const key = 'portrait:' + file;
    if (this.icons.has(key)) return this.icons.get(key);
    this._iconSetup();
    const src = game.assets.gltf.get('mx:' + file).scene, R = this._rig(src);
    const m = SkeletonUtils.clone(src);
    let k = 0; m.traverse((o) => { if (o.isMesh) { o.visible = !hide.includes(k); k++; o.frustumCulled = false; } });
    const box = R.head ?? new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3()), h = box.getSize(new THREE.Vector3()).y;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0x8a96c0, 0x2a1a10, 1.3));
    const key1 = new THREE.DirectionalLight(0xffd8a8, 4); key1.position.set(c.x + 1.2, c.y + 1.5, c.z + 2); key1.target.position.copy(c); scene.add(key1, key1.target);
    const rim = new THREE.DirectionalLight(0x9ab8ff, 5); rim.position.set(c.x - 1.5, c.y + 0.8, c.z - 1.6); rim.target.position.copy(c); scene.add(rim, rim.target);
    const fire = new THREE.PointLight(0xff7a2a, 2.5, 3, 1.5); fire.position.set(c.x + 0.25, c.y - 0.35, c.z + 0.5); scene.add(fire);
    scene.add(m);
    const cam = new THREE.PerspectiveCamera(24, 1, 0.01, 20);
    const look = c.clone().add(new THREE.Vector3(0, -h * 0.22, 0));
    cam.position.copy(look).add(new THREE.Vector3(h * 0.9, h * 0.25, h * 5.2));
    cam.lookAt(look);
    const r = this.iconR; r.setSize(size, size, false);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    r.setSize(128, 128, false);
    this.icons.set(key, url);
    return url;
  }

  _iconSetup() {
    if (this.iconR) return;
    this.iconR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.iconR.setSize(192, 192, false);
    this.iconR.toneMapping = THREE.ACESFilmicToneMapping;
    this.iconR.toneMappingExposure = 1.45;
    this.iconR.outputColorSpace = THREE.SRGBColorSpace;
    const s = (this.iconScene = new THREE.Scene());
    s.add(new THREE.HemisphereLight(0xb8c4e0, 0x2a2018, 1.8));
    const k = new THREE.DirectionalLight(0xffe2c0, 4.5); k.position.set(2, 3, 4); s.add(k);
    const f = new THREE.DirectionalLight(0xffffff, 1.6); f.position.set(0, 0, 5); s.add(f);
    const rim = new THREE.DirectionalLight(0x8ab0ff, 3); rim.position.set(-3, 1, -2); s.add(rim);
    this.iconCam = new THREE.PerspectiveCamera(22, 1, 0.01, 50);
  }

  // ------------------------------------------------------------------ icons
  /** Data-URL image of the item, rendered with studio lighting (cached). */
  icon(it) {
    const key = [it.base, it.rarity, itemVariant(it), it.legendary ?? ''].join('|');
    if (this.icons.has(key)) return this.icons.get(key);
    this._iconSetup();
    const K=this._look(it);
    const full=inventoryModel(it,{...K,steel:this.metal(it.rarity==='legendary'?'silver':'steel'),sole:this.leather(0x18171b),
      cloth:it.base==='robe'?this.cloth(it.rarity==='common'?0x41656c:it.rarity==='magic'?0x3f4e83:0x693b59):K.cloth,
      leather:this.leather(it.rarity==='common'?0x815c39:0x503a2b)});
    const m=full??this.model(it);
    const kind = visualKind(it), b = BASES[it.base];
    // pose for a readable silhouette
    if (b.slot === 'weapon') m.rotation.set(0.25, -0.5, kind === 'bow' || kind === 'crossbow' ? -0.6 : -0.75);
    else if (kind === 'shield') m.rotation.set(0.1, -0.35, 0);
    else if (it.base==='boots') m.rotation.set(.12,-.95,-.08);
    else if (it.base==='gloves') m.rotation.set(.1,-.22,-.12);
    else if (b.slot==='chest') m.rotation.set(.1,-.28,-.04);
    else if (kind === 'helm' || kind === 'hood') m.rotation.set(0.15, 0.6, 0);
    else if (kind === 'quiver' || kind === 'relic') m.rotation.set(0.2, 0.5, -0.3);
    else m.rotation.set(0.25, 0.4, 0);
    const holder = new THREE.Group(); holder.add(m); this.iconScene.add(holder);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    holder.position.sub(c);
    const r = Math.max(sz.x, sz.y) * 0.5 + 0.0001;
    const cam = this.iconCam;
    cam.position.set(0, 0, (r / Math.tan(THREE.MathUtils.degToRad(11))) * 1.08 + sz.z * 0.5);
    cam.lookAt(0, 0, 0);
    const mats = new Set(); m.traverse((o) => { if (o.isMesh && o.material.envMapIntensity != null) mats.add(o.material); });
    for (const mt of mats) { mt.userData.envI = mt.envMapIntensity; mt.envMapIntensity = 1.25; }
    this.iconR.render(this.iconScene, cam);
    for (const mt of mats) mt.envMapIntensity = mt.userData.envI;
    const url = this.iconR.domElement.toDataURL('image/png');
    this.iconScene.remove(holder);
    m.userData.disposeIcon?.();
    this.icons.set(key, url);
    return url;
  }
}

// ------------------------------------------------------------------ geometry helpers
function extrude(shape, depth, bevel = 0.003, size = bevel, curveSegments = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: size, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** Curve a flat plate around the Y axis (shield face). */
function bend(geo, k) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - p.getX(i) * p.getX(i) * k);
  p.needsUpdate = true;
  geo.computeVertexNormals();
}

export { mergeGeometries };
