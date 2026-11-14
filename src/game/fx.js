import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };

export const PALETTE = {
  fire: { core: [4, 2.2, 0.7], hot: [3, 1.1, 0.2], cool: [0.9, 0.12, 0.02], light: 0xff8a3a },
  ice: { core: [1.6, 2.6, 4], hot: [0.6, 1.5, 3], cool: [0.1, 0.35, 1], light: 0x66bbff },
  bolt: { core: [2.5, 3, 5], hot: [1.2, 1.6, 4], cool: [0.3, 0.3, 1.6], light: 0x9ab4ff },
  dark: { core: [2.6, 0.7, 4], hot: [1.5, 0.3, 2.6], cool: [0.35, 0.05, 0.8], light: 0xa050ff },
  bone: { core: [2, 2, 1.6], hot: [1, 0.95, 0.7], cool: [0.3, 0.28, 0.2], light: 0xd8d0b0 },
  holy: { core: [3, 2.6, 1.2], hot: [2, 1.5, 0.5], cool: [0.8, 0.5, 0.1], light: 0xffdf8a },
  poison: { core: [1.0, 2.2, 0.6], hot: [0.45, 1.3, 0.25], cool: [0.1, 0.5, 0.1], light: 0x7dff6a },
  blood: { core: [2.2, 0.3, 0.2], hot: [1.4, 0.1, 0.08], cool: [0.4, 0.02, 0.02], light: 0xff4030 },
  steel: { core: [2.4, 2.3, 2.1], hot: [1.6, 1.5, 1.3], cool: [0.5, 0.45, 0.4], light: 0xffe8c8 },
};

import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { energyMaterial, orbMaterial, distortMaterial, Debris, Trail } from './vfx.js';

/** Visual effects: textured particles, ground decals, rings, slashes, lightning, spikes. */
export class Fx {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 64);
    this.discGeo = new THREE.CircleGeometry(1, 48);
    this.planeGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.sphereGeo = new THREE.SphereGeometry(1, 16, 12);
    this.tex = {};
    this.debris = new Debris(game.gfx.scene);
    this.cylGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, 0.5, 0);
  }

  async load() {
    const L = new THREE.TextureLoader(), base = import.meta.env.BASE_URL + 'assets/fx/';
    await Promise.all(['atlas', 'ring', 'ring_soft', 'slash', 'slash2', 'magic1', 'magic2', 'lightdisc', 'scorch', 'twirl', 'flip_fire', 'flip_blaze', 'flip_explosion', 'flip_smoke', 'flip_dust'].map(async (n) => {
      const t = await L.loadAsync(base + n + '.png');
      t.colorSpace = n.startsWith('flip_') ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      this.tex[n] = t;
    }));
  }

  add(update, dispose) { this.list.push({ update, dispose }); }

  update(dt) {
    this.debris.update(dt, this.game.level);
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].update(dt)) { this.list[i].dispose?.(); this.list.splice(i, 1); }
    }
  }

  clear() { for (const e of this.list) e.dispose?.(); this.list.length = 0; this.debris.clear(); }

  _mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); this.game.gfx.scene.add(m); return m; }
  _kill(m) { m.removeFromParent(); m.material.dispose(); }

  /** Textured ground plane (ring / glyph / slash / light) that animates scale, spin and fade. */
  ground(pos, { tex = 'ring', color = [3, 1.2, 0.3], r0 = 0.5, r1 = 5, dur = 0.45, y = 0.12, opacity = 1, spin = 0, ease = 'out', blend = 'add', hold = 0 } = {}) {
    const energy = blend === 'add' && tex !== 'lightdisc';
    const mat = energy ? energyMaterial({ map: this.tex[tex], color, opacity, scale: 5, polar: true, flow: [0.15, -0.5] })
      : new THREE.MeshBasicMaterial({ ...ADD, alphaMap: this.tex[tex], color: new THREE.Color(...color), opacity, blending: blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending });
    const m = this._mesh(this.planeGeo, mat);
    m.position.set(pos.x, y, pos.z); m.rotation.y = Math.random() * 6.28; m.renderOrder = 3;
    let t = 0;
    this.add((dt) => {
      t += dt;
      const k = Math.min(1, t / dur), e = ease === 'out' ? 1 - (1 - k) ** 3 : k;
      m.scale.setScalar(Math.max(0.01, (r0 + (r1 - r0) * e) / 2 * 2));
      m.rotation.y += spin * dt;
      if (energy) {
        const U = mat.uniforms; U.time.value += dt;
        U.progress.value = t < dur ? k * k * 0.85 : 0.85 + 0.15 * Math.min(1, (t - dur) / Math.max(0.01, hold));
        if (hold > 0 && t < dur + hold) U.progress.value = t < dur ? 0.1 * k : 0.1 + 0.9 * ((t - dur) / hold) ** 3;
      } else mat.opacity = opacity * (t < dur ? 1 - k * k : Math.max(0, 1 - (t - dur) / Math.max(0.01, hold)));
      return t < dur + hold;
    }, () => this._kill(m));
    return m;
  }

  /** Expanding ground shockwave ring. */
  ring(pos, { color = [3, 1.2, 0.3], r0 = 0.5, r1 = 5, dur = 0.45, y = 0.12, opacity = 1 } = {}) {
    return this.ground(pos, { tex: 'ring', color, r0, r1, dur, y, opacity });
  }

  /** Persistent glyph on the floor (summons, consecration). Returns a handle with .stop(). */
  glyph(pos, { tex = 'magic1', color = [2, 1.6, 0.6], r = 4, dur = 5, spin = 0.6 } = {}) {
    const mat = tex === 'lightdisc' ? new THREE.MeshBasicMaterial({ ...ADD, alphaMap: this.tex[tex], color: new THREE.Color(...color), opacity: 0 })
      : energyMaterial({ map: this.tex[tex], color, polar: true, scale: 4, flow: [0.2, -0.4] });
    const m = this._mesh(this.planeGeo, mat);
    m.position.set(pos.x, 0.1, pos.z); m.renderOrder = 3;
    m.scale.setScalar(r);
    let t = 0;
    this.add((dt) => {
      t += dt; m.rotation.y += spin * dt;
      const fade = Math.min(1, t * 4) * Math.min(1, (dur - t) * 2);
      if (mat.uniforms) { mat.uniforms.time.value += dt; mat.uniforms.progress.value = 1 - fade * 0.92; }
      else mat.opacity = fade * (0.75 + 0.25 * Math.sin(t * 6));
      return t < dur;
    }, () => this._kill(m));
    return m;
  }

  /** Flash sphere (explosion core). */
  blast(pos, { color = [4, 2, 0.6], r = 3, dur = 0.25 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ ...ADD, color: new THREE.Color(...color) });
    const m = this._mesh(this.sphereGeo, mat);
    m.position.set(pos.x, pos.y ?? 1, pos.z);
    let t = 0;
    this.add((dt) => { t += dt; const k = t / dur; m.scale.setScalar(r * (0.3 + 0.7 * Math.sqrt(k))); mat.opacity = (1 - k) ** 3 * 0.22; return k < 1; }, () => this._kill(m));
  }

  /** Frozen translucent copy of an actor's current pose that fades out (speed afterimage). */
  afterimage(actor, color = [1, 0.6, 0.3], life = 0.32) {
    const mat = new THREE.MeshBasicMaterial({ ...ADD, color: new THREE.Color(...color), opacity: 0.38 });
    const copy = SkeletonUtils.clone(actor.model);
    copy.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.frustumCulled = false; } });
    const g = new THREE.Group();
    g.position.copy(actor.root.position); g.rotation.copy(actor.root.rotation);
    g.add(copy);
    this.game.gfx.scene.add(g);
    let t = 0;
    this.add((dt) => { t += dt; mat.opacity = 0.38 * (1 - t / life) ** 1.5; return t < life; }, () => { g.removeFromParent(); mat.dispose(); });
  }

  /** Screen-space shockwave: an expanding ring that bends the image. */
  shockwave(pos, { r0 = 0.5, r1 = 8, dur = 0.5, strength = 0.035, y = 0.6 } = {}) {
    const mat = distortMaterial({ map: this.tex.ring_soft, kind: 'ring', strength });
    const m = new THREE.Mesh(this.planeGeo, mat);
    m.position.set(pos.x, y, pos.z);
    this.game.gfx.distortScene.add(m);
    let t = 0;
    this.add((dt) => { t += dt; const k = Math.min(1, t / dur); m.scale.setScalar(r0 + (r1 - r0) * (1 - (1 - k) ** 2)); mat.uniforms.strength.value = strength * (1 - k) ** 1.5; return k < 1; }, () => { m.removeFromParent(); mat.dispose(); });
  }

  /** Heat haze wobble over fire (vertical billboard in the distortion buffer). */
  heat(pos, { r = 2, dur = 1.2, strength = 0.012, y = 1.2 } = {}) {
    const mat = distortMaterial({ kind: 'heat', strength });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), mat);
    m.position.set(pos.x, y + r * 0.6, pos.z); m.scale.setScalar(r);
    this.game.gfx.distortScene.add(m);
    let t = 0;
    this.add((dt) => { t += dt; m.quaternion.copy(this.game.gfx.camera.quaternion); mat.uniforms.time.value += dt; mat.uniforms.strength.value = strength * Math.min(1, t * 6) * (1 - t / dur); return t < dur; }, () => { m.removeFromParent(); m.geometry.dispose(); mat.dispose(); });
  }

  /** Vertical energy column (holy light, summoning beams). */
  column(pos, { color = [2.6, 2.1, 1], r = 1, h = 9, dur = 0.8, flow = [0, -2.4] } = {}) {
    const mat = energyMaterial({ color, scale: 3, flow, map: null });
    mat.uniforms.useMap.value = 0; mat.uniforms.soft.value = 1;
    mat.fragmentShader = mat.fragmentShader.replace('smoothstep(0.5, 0.0, length(vUv - 0.5))', 'smoothstep(1.0, 0.15, vUv.y) * smoothstep(0.0, 0.08, vUv.y)');
    const m = this._mesh(this.cylGeo, mat);
    m.position.set(pos.x, 0, pos.z); m.scale.set(r, h, r); m.renderOrder = 10;
    let t = 0;
    this.add((dt) => { t += dt; const k = t / dur; mat.uniforms.time.value += dt; mat.uniforms.progress.value = k < 0.3 ? 0.3 - k : (k - 0.3) / 0.7; m.scale.x = m.scale.z = r * (0.7 + 0.5 * Math.min(1, k * 3)); return k < 1; }, () => this._kill(m));
  }

  /** Expanding dust wall (ground slams). */
  dustWall(pos, { r1 = 6, dur = 0.6, h = 1.4, color = [0.5, 0.42, 0.34] } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), alphaMap: this.tex.smokeStrip ?? null, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.35 });
    const m = this._mesh(this.cylGeo, mat);
    m.position.set(pos.x, 0, pos.z); m.renderOrder = 4;
    let t = 0;
    this.add((dt) => { t += dt; const k = Math.min(1, t / dur), e = 1 - (1 - k) ** 3; m.scale.set(0.5 + r1 * e, h * (0.4 + 0.8 * e) * (1 - k * 0.5), 0.5 + r1 * e); mat.opacity = 0.32 * (1 - k); return k < 1; }, () => this._kill(m));
    (this.game.dusts ?? this.game.smoke).emit({ pos: { x: pos.x, y: 0.5, z: pos.z }, count: 10, radius: 0.8, ring: true, outward: true, speed: [r1 * 1.2, r1 * 2.2], life: [1.0, 1.6], size: [1.6, 2.8], c0: color.map((v) => v * 1.6), c1: color, drag: 3, alpha: 0.75, grow0: 0.6, grow1: 1.5, rot: [0, 6.28] });
  }

  /** Rock / bone / ice chunks flung from an impact. kind: rock | bone | ice | gore */
  chunks(pos, kind = 'rock', count = 10, power = 1) {
    const M = this.game.materials;
    this._chunkMat ??= {
      rock: M.get('rockTop', 1), bone: new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.6 }),
      ice: new THREE.MeshPhysicalMaterial({ color: 0xbfe4ff, emissive: 0x2a5aa0, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1, flatShading: true }),
      gore: new THREE.MeshStandardMaterial({ color: 0x4a0a08, roughness: 0.35, emissive: 0x100000 }),
    };
    this.debris.burst(pos, { count, mat: this._chunkMat[kind], speed: [3 * power, 9 * power], up: [5 * power, 11 * power], size: kind === 'rock' ? [0.5, 1.3] : [0.3, 0.8] });
  }

  /** Ribbon following a projectile; returns the Trail (push points while it flies, it fades once the projectile is gone). */
  trail(holder, { width = 0.5, color = [3, 1.2, 0.3], life = 0.22 } = {}) {
    const tr = new Trail(this.game.gfx.scene, { width, color, life });
    this.add((dt) => {
      if (tr.alive && !holder.parent) tr.stop();
      if (tr.alive) tr.push(holder.position);
      return tr.update(dt, this.game.gfx.camera);
    }, () => tr.dispose());
    return tr;
  }

  /** Noise-boiling energy sphere mesh for projectiles. */
  orb(pal, size) {
    const P = PALETTE[pal];
    this._orbGeo ??= new THREE.IcosahedronGeometry(1, 3);
    const m = this._mesh(this._orbGeo, orbMaterial({ core: P.core, edge: P.hot }));
    m.scale.setScalar(size);
    m.onBeforeRender = () => { m.material.uniforms.time.value = this.game.gfx.time; };
    return m;
  }

  /** Dark scorch / frost decal that fades out. */
  decal(pos, r, color = 0x000000, dur = 6, opacity = 0.7) {
    const mat = new THREE.MeshBasicMaterial({ color, alphaMap: this.tex.scorch, transparent: true, opacity, depthWrite: false });
    const m = this._mesh(this.planeGeo, mat);
    m.position.set(pos.x, 0.11 + Math.random() * 0.02, pos.z); m.rotation.y = Math.random() * 6.28; m.scale.setScalar(r); m.renderOrder = 2;
    let t = 0;
    this.add((dt) => { t += dt; mat.opacity = opacity * Math.min(1, (dur - t) / (dur * 0.4)); return t < dur; }, () => this._kill(m));
  }

  /** Danger marker: textured ring plus a disc that fills as the strike approaches. */
  telegraph(pos, r, dur, color = [3, 0.3, 0.2]) {
    const c = new THREE.Color(...color);
    const m1 = this._mesh(this.planeGeo, new THREE.MeshBasicMaterial({ ...ADD, alphaMap: this.tex.ring, color: c }));
    const m2 = this._mesh(this.planeGeo, new THREE.MeshBasicMaterial({ ...ADD, alphaMap: this.tex.lightdisc, color: c, opacity: 0.35 }));
    for (const m of [m1, m2]) { m.position.set(pos.x, 0.14, pos.z); m.renderOrder = 3; }
    m1.scale.setScalar(r * 1.05);
    let t = 0;
    this.add((dt) => { t += dt; const k = t / dur; m2.scale.setScalar(Math.max(0.01, r * k)); m1.material.opacity = 0.55 + 0.45 * Math.sin(t * 24); return k < 1; }, () => { this._kill(m1); this._kill(m2); });
  }

  /** Melee swing: a bright crescent sweeping around the attacker. */
  slash(pos, facing, { color = [2.4, 2.2, 1.8], r = 3, dur = 0.22, arc = 2.2, y = 1.2, tex = 'slash', tilt = 0 } = {}) {
    const mat = energyMaterial({ map: this.tex[tex], color, scale: 6, polar: true, flow: [-2.2, 0] });
    const m = this._mesh(this.planeGeo, mat);
    m.position.set(pos.x, y, pos.z); m.scale.setScalar(r); m.renderOrder = 12;
    m.rotation.z = tilt;
    const start = facing - arc / 2 + Math.PI / 2;
    let t = 0;
    this.add((dt) => { t += dt; const k = Math.min(1, t / dur); m.rotation.y = start + arc * (1 - (1 - k) ** 2) - Math.PI / 2; m.scale.setScalar(r * (0.8 + 0.25 * k)); mat.uniforms.time.value += dt; mat.uniforms.progress.value = k ** 1.5; return t < dur; }, () => this._kill(m));
    // a faint dust swirl under fast swings
    this.game.smoke.emit({ pos: { x: pos.x + Math.sin(facing) * r * 0.5, y: 0.3, z: pos.z + Math.cos(facing) * r * 0.5 }, count: 2, radius: r * 0.3, flat: true, speed: [0.5, 2], life: [0.4, 0.8], size: [0.8, 1.6], c0: [0.18, 0.16, 0.14], c1: [0.08, 0.07, 0.06], alpha: 0.3, tex: 'smoke', grow1: 1.6 });
  }

  /** Jagged, flickering lightning arc between two points with a glow sheath. */
  bolt(a, b, { color = [2.2, 3, 6], dur = 0.28, width = 0.09, branches = 2 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ ...ADD, color: new THREE.Color(...color) });
    const glowMat = new THREE.MeshBasicMaterial({ ...ADD, color: new THREE.Color(color[0] * 0.15, color[1] * 0.18, color[2] * 0.3) });
    const group = new THREE.Group(); this.game.gfx.scene.add(group);
    const build = () => {
      for (const c of [...group.children]) { c.geometry.dispose(); group.remove(c); }
      const strand = (p0, p1, w, jitter, glow) => {
        const n = Math.max(4, Math.round(p0.distanceTo(p1) / 0.7)), pts = [];
        for (let i = 0; i <= n; i++) {
          const p = p0.clone().lerp(p1, i / n);
          if (i && i < n) { p.x += rnd(-jitter, jitter); p.y += rnd(-jitter, jitter) * 0.7; p.z += rnd(-jitter, jitter); }
          pts.push(p);
        }
        const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
        group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, n * 2, w, 4), mat));
        if (glow) group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, n, w * 5, 5), glowMat));
        return pts;
      };
      const pts = strand(a, b, width, 0.55, true);
      for (let i = 0; i < branches; i++) {
        const s = pts[1 + ((Math.random() * (pts.length - 2)) | 0)];
        strand(s, s.clone().add(new THREE.Vector3(rnd(-2, 2), rnd(-0.5, 1.2), rnd(-2, 2))), width * 0.45, 0.3, false);
      }
    };
    build();
    let t = 0, acc = 0;
    this.add((dt) => { t += dt; acc += dt; if (acc > 0.045) { acc = 0; build(); } const o = 1 - (t / dur) ** 2; mat.opacity = o; glowMat.opacity = o; return t < dur; },
      () => { for (const c of group.children) c.geometry.dispose(); group.removeFromParent(); mat.dispose(); glowMat.dispose(); });
  }

  /** Ice or bone spikes erupting from the ground. */
  spikes(pos, { count = 10, radius = 3, color = 0x9fd8ff, emissive = 0x2a6cff, height = 2.2, hold = 0.7, ringOnly = false, rough = 0.15 } = {}) {
    const mat = new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: 1.1, roughness: rough, metalness: 0, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.94, flatShading: true });
    const geo = new THREE.ConeGeometry(0.34, 1, 5);
    geo.translate(0, 0.5, 0);
    const g = new THREE.Group(); g.position.set(pos.x, 0, pos.z); this.game.gfx.scene.add(g);
    const items = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd(-0.2, 0.2), r = ringOnly ? radius * rnd(0.85, 1) : radius * Math.sqrt(Math.random());
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.rotation.set(Math.sin(a) * -0.45 * rnd(0.3, 1), rnd(0, 6), Math.cos(a) * 0.45 * rnd(0.3, 1));
      m.castShadow = true;
      m.userData = { h: height * rnd(0.55, 1.15), w: rnd(0.7, 1.5), delay: ringOnly ? 0 : (r / radius) * 0.12 };
      m.scale.set(0.01, 0.01, 0.01);
      g.add(m); items.push(m);
    }
    let t = 0;
    const total = hold + 0.6;
    this.add((dt) => {
      t += dt;
      for (const m of items) {
        const u = m.userData, k = THREE.MathUtils.clamp((t - u.delay) / 0.1, 0, 1), out = THREE.MathUtils.clamp((t - hold) / 0.5, 0, 1);
        const e = 1 - (1 - k) ** 3;
        m.scale.set(u.w, Math.max(0.01, u.h * e * (1 - out)), u.w);
      }
      mat.opacity = 0.94 * (1 - THREE.MathUtils.clamp((t - hold) / 0.6, 0, 1));
      return t < total;
    }, () => { g.removeFromParent(); geo.dispose(); mat.dispose(); });
  }

  /** Billowing fire: flame sheets + embers + smoke column. */
  flames(pos, { count = 6, radius = 0.5, size = [1.2, 2.2], up = 3, life = [0.35, 0.8], pal = 'fire' } = {}) {
    const P = PALETTE[pal], g = this.game;
    if (pal === 'fire' && g.blazes) {
      g.blazes.emit({ pos: { x: pos.x, y: (pos.y ?? 0) + size[1] * 0.4, z: pos.z }, count: Math.max(1, Math.round(count * 0.25)), radius, flat: true, speed: [0, 0.3], up: up * 0.25, life: [life[0] + 0.2, life[1] + 0.35], size: [size[0] * 1.3, size[1] * 1.4], c0: [0.6, 0.52, 0.46], c1: [0.48, 0.32, 0.24], loop: true, rot: [-0.15, 0.15], alpha: 0.9 });
      count = Math.ceil(count * 0.4);
    }
    g.particles.emit({ pos, count, radius, flat: true, speed: [0, 0.8], up, life, size, c0: P.hot.map((v) => v * 0.7), c1: P.cool, drag: 1.2, grow0: 0.7, grow1: 0.25, tex: 'flame', spin: [0.5, 2] });
  }

  /** Full explosion: flash, flame burst, sparks, embers, rolling smoke, shockwave, scorch, light and shake. */
  explode(pos, radius = 3.5, pal = 'fire', power = 1) {
    const P = PALETTE[pal], g = this.game, p = { x: pos.x, y: (pos.y ?? 0.8), z: pos.z };
    const fire = pal === 'fire', body = fire ? P.hot : P.hot.map((v) => v * 0.45);
    this.blast(p, { color: body, r: radius * (fire ? 0.55 : 0.4), dur: 0.16 });
    this.ground(p, { tex: 'ring_soft', color: P.hot, r0: 0.4, r1: radius * 1.5, dur: 0.45, opacity: 0.55 * Math.min(1, power) * (fire ? 1 : 0.6) });
    this.ground(p, { tex: 'lightdisc', color: P.cool, r0: radius * 0.6, r1: radius * 1.6, dur: 0.3, opacity: 0.4 * Math.min(1, power) * (fire ? 1 : 0.5) });
    // fireball body: big flame sheets thrown outward
    g.particles.emit({ pos: p, count: Math.round((fire ? 8 : 8) * Math.sqrt(power)), radius: radius * 0.25, speed: [radius * 1.2, radius * 3.2], life: [0.28, 0.6], size: fire ? [radius * 0.5, radius * 0.95] : [radius * 0.35, radius * 0.6], c0: body, c1: P.cool, drag: 4, grow0: 0.6, grow1: 1.1, tex: pal === 'fire' ? 'flame' : 'smoke', spin: [1, 3] });
    g.particles.emit({ pos: p, count: 3, speed: [0, 1], life: [0.1, 0.18], size: [radius * 1.1, radius * 1.6], c0: P.hot, c1: P.cool, tex: 'burst', grow0: 0.5, grow1: 1.2 });
    if (fire && g.blasts) {
      g.blasts.emit({ pos: { x: p.x, y: p.y + radius * 0.2, z: p.z }, count: Math.round(3 + 2 * power), radius: radius * 0.3, speed: [radius * 0.4, radius * 1.1], up: radius * 0.25, drag: 2.5, life: [1.3, 1.7], size: [radius * 1.6, radius * 2.4], grow0: 0.7, grow1: 1.25, c0: [0.75, 0.68, 0.62], c1: [0.6, 0.55, 0.5], rot: [0, 6.28], spin: [0.1, 0.5] });
    }
    if (g.puffs && (fire || pal === 'steel' || pal === 'holy' || pal === 'poison')) {
      const sc = pal === 'poison' ? [0.3, 0.5, 0.22] : pal === 'holy' ? [0.6, 0.55, 0.45] : [0.42, 0.38, 0.35];
      g.puffs.emit({ pos: { x: p.x, y: p.y + 0.6, z: p.z }, count: Math.round(3 + 2 * power), radius: radius * 0.45, speed: [radius * 0.3, radius * 0.8], up: 1.2, drag: 1.5, life: [2.2, 3.4], size: [radius * 1.5, radius * 2.3], grow0: 0.6, grow1: 1.5, c0: sc, c1: sc.map((v) => v * 0.7), alpha: 0.7, rot: [0, 6.28], spin: [0.05, 0.25] });
    }
    if (g.dusts && power >= 0.6) g.dusts.emit({ pos: { x: p.x, y: 0.6, z: p.z }, count: Math.round(4 * power), radius: radius * 0.6, ring: true, outward: true, speed: [radius * 0.8, radius * 1.8], drag: 2.4, life: [1.4, 2.2], size: [radius * 0.9, radius * 1.4], grow0: 0.6, grow1: 1.4, c0: [0.7, 0.62, 0.55], c1: [0.5, 0.45, 0.4], alpha: 0.75, rot: [0, 6.28] });
    // sparks: velocity-aligned streaks
    g.particles.emit({ pos: p, count: Math.round(30 * power), speed: [6, 22], life: [0.25, 0.7], size: [0.4, 0.9], c0: P.core, c1: P.hot, gravity: 14, drag: 1.2, up: 4, tex: 'streak', align: true, grow1: 0.5 });
    // embers
    g.particles.emit({ pos: p, count: Math.round(18 * power), speed: [2, 8], life: [0.8, 1.8], size: [0.12, 0.25], c0: P.core, c1: P.hot, gravity: 3, drag: 0.6, up: 4, grow1: 0.6 });
    if (pal === 'fire' || pal === 'holy' || pal === 'steel') {
      g.smoke.emit({ pos: p, count: Math.round(16 * power), radius: radius * 0.35, speed: [0.5, 2.6], life: [1.4, 3.2], size: [radius * 0.7, radius * 1.3], c0: [0.12, 0.1, 0.09], c1: [0.04, 0.035, 0.03], up: 2.2, drag: 1.1, grow0: 0.5, grow1: 1.7, alpha: 0.6, tex: 'smoke', spin: [0.2, 0.8] });
      g.smoke.emit({ pos: { x: p.x, y: 0.3, z: p.z }, count: Math.round(8 * power), radius: radius * 0.5, flat: true, speed: [1, 4], life: [0.6, 1.2], size: [0.6, 1.4], c0: [0.25, 0.2, 0.16], c1: [0.1, 0.08, 0.07], gravity: 9, up: 5, alpha: 0.9, tex: 'dirt' });
      this.decal(p, radius * 0.9, 0x000000, 8, 0.75);
      if (power >= 0.9) g.decals?.crack(p, radius * 0.9);
    } else {
      g.particles.emit({ pos: p, count: Math.round(14 * power), radius: radius * 0.4, speed: [0.5, 2], life: [0.6, 1.2], size: [radius * 0.5, radius * 0.9], c0: P.hot, c1: P.cool, up: 1.5, drag: 1.2, grow0: 0.6, grow1: 1.4, tex: 'smoke', alpha: 0.7 });
    }
    g.gfx.flash(p, P.light, (fire ? 170 : 80) * power, 0.4, radius * 3.2);
    g.gfx.addShake(0.28 * power);
    this.shockwave(p, { r1: radius * 2.6, dur: 0.45, strength: 0.03 * Math.min(1.5, power) });
    if (fire) { this.heat(p, { r: radius * 0.8, dur: 1.4 }); if (power >= 1) this.chunks(p, 'rock', Math.round(4 * power), 0.8); }
  }

  /** Small impact burst for bolts and arrows. */
  spark(pos, pal = 'fire', n = 12) {
    const P = PALETTE[pal], g = this.game;
    g.particles.emit({ pos, count: n, speed: [3, 12], life: [0.15, 0.4], size: [0.3, 0.7], c0: P.core, c1: P.cool, drag: 3, gravity: 6, tex: 'streak', align: true });
    g.particles.emit({ pos, count: 2, speed: [0, 0.5], life: [0.08, 0.14], size: [1.4, 2.2], c0: P.core, c1: P.hot, tex: 'star', grow1: 1.2 });
    g.gfx.flash(pos, P.light, 120, 0.2, 12);
  }

  /** Rising column of light (level up, heal, teleport). */
  pillar(pos, pal = 'holy', n = 60, h = 6) {
    const P = PALETTE[pal], g = this.game;
    g.particles.emit({ pos: { x: pos.x, y: 0.2, z: pos.z }, count: Math.round(n * 0.6), radius: 0.9, ring: true, speed: [0, 0.6], up: h, life: [0.5, 1.1], size: [0.3, 0.7], c0: P.hot, c1: P.cool, drag: 1.2, tex: 'glint', spin: [1, 3] });
    g.particles.emit({ pos: { x: pos.x, y: 0.2, z: pos.z }, count: 4, speed: [0, 0.2], up: h * 0.6, life: [0.4, 0.7], size: [1.4, 2.2], c0: P.hot, c1: P.cool, tex: 'jet', rot: [0, 0.01], grow1: 1.3, alpha: 0.45 });
    this.ground(pos, { tex: 'ring_soft', color: P.hot, r0: 0.3, r1: 3.4, dur: 0.5, opacity: 0.5 });
    g.gfx.flash(pos, P.light, 200, 0.5, 16);
  }
}
