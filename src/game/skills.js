import * as THREE from 'three';
import { canUpgradeSlot } from './progression.js';
import { ultimateIcon } from './ultimate-art.js';
import { ultimateOpening, meteorDescent, judgmentBeam, summonSigil, boneGolemRegalia } from './ultimate-vfx.js';
import { PALETTE } from './fx.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const ICON = (body, bg) => `<svg viewBox="0 0 40 40"><defs><radialGradient id="g${bg[0].slice(1)}"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient></defs><rect width="40" height="40" fill="url(#g${bg[0].slice(1)})"/>${body}</svg>`;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ----------------------------------------------------------------------------- shared helpers
function orb(game, pal, size) { return game.fx.orb(pal, size); }

const boneGeos = {};
/** Knobbly bone spear (points along +Z). len = length, thick = girth multiplier. */
function boneMesh(len, thick = 1) {
  const key = len + ':' + thick;
  if (!boneGeos[key]) {
    const P = [[0, -0.5], [0.07, -0.47], [0.1, -0.4], [0.065, -0.3], [0.05, -0.1], [0.06, 0.02], [0.045, 0.1], [0.05, 0.2], [0.03, 0.34], [0.012, 0.46], [0, 0.5]];
    const g = new THREE.LatheGeometry(P.map(([x, y]) => new THREE.Vector2(x * thick, y * len)), 7);
    g.rotateX(Math.PI / 2);
    boneGeos[key] = g;
  }
  boneGeos.mat ??= new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.55, emissive: 0x1a3a1a, emissiveIntensity: 0.8 });
  const m = new THREE.Mesh(boneGeos[key], boneGeos.mat); m.castShadow = true;
  return m;
}

let arrowGeo = null;
/** A real-looking arrow: wooden shaft, iron head, pale fletching. */
export function arrowMesh(game, glow = null) {
  if (!arrowGeo) {
    arrowGeo = {
      shaft: new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5).rotateX(Math.PI / 2),
      head: new THREE.ConeGeometry(0.06, 0.2, 4).rotateX(Math.PI / 2).translate(0, 0, 0.74),
      fl: new THREE.PlaneGeometry(0.1, 0.28).rotateX(Math.PI / 2).translate(0, 0, -0.55),
      wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.35, metalness: 0.9 }),
      feather: new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.9, side: THREE.DoubleSide }),
    };
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(arrowGeo.shaft, arrowGeo.wood), new THREE.Mesh(arrowGeo.head, arrowGeo.iron));
  const f1 = new THREE.Mesh(arrowGeo.fl, arrowGeo.feather), f2 = f1.clone(); f2.rotation.z = Math.PI / 2; g.add(f1, f2);
  if (glow) { const s = new THREE.Mesh(game.fx.sphereGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...glow) })); s.scale.set(0.09, 0.09, 0.3); s.position.z = 0.7; g.add(s); }
  g.scale.setScalar(1.2);
  game.gfx.scene.add(g);
  return g;
}

/** Launch a projectile. team 'player' hits enemies; 'enemy' hits the player and their minions. */
export function shoot(game, o) {
  const pal = o.pal ?? 'fire', P = PALETTE[pal];
  const mesh = o.mesh ?? orb(game, pal, o.size ?? 0.3);
  const light = o.light ? game.gfx.flash(o.pos, P.light, o.light, 9, 14) : null;
  const sz = o.size ?? 0.3;
  const p = {
    pos: o.pos.clone(), vel: o.vel.clone(), r: o.r ?? 0.6, team: o.team, life: o.life ?? 2.2, pal, mesh, light, lightTok: light?.userData.token,
    onHit: o.onHit, pierce: !!o.pierce, hits: new Set(), noWall: !!o.noWall,
    trail: o.trail ?? ((dt, pr) => {
      const fire = pal === 'fire';
      game.particles.emit({ pos: pr.pos, count: 2, radius: 0.1, speed: [0, 0.8], life: [0.15, 0.35], size: [sz * 2.4, sz * 3.6], c0: P.hot, c1: P.cool, drag: 2, grow1: 0.2, tex: fire ? 'flame' : 'glow', spin: [1, 4] });
      if (Math.random() < 0.6) game.particles.emit({ pos: pr.pos, count: 1, speed: [0.5, 2.5], life: [0.3, 0.7], size: [0.1, 0.2], c0: P.core, c1: P.hot, gravity: 5 });
      if (fire && Math.random() < 0.25) game.smoke.emit({ pos: pr.pos, count: 1, speed: [0, 0.4], life: [0.6, 1.1], size: [sz * 2, sz * 4], c0: [0.09, 0.07, 0.06], c1: [0.03, 0.03, 0.03], up: 0.6, alpha: 0.35, grow0: 0.6, grow1: 1.5, tex: 'smoke' });
    }),
  };
  mesh.position.copy(p.pos);
  if (!mesh.parent) game.gfx.scene.add(mesh);
  if (o.ribbon !== false) game.fx.trail(mesh, { width: o.ribbonWidth ?? (o.mesh ? 0.22 : sz * 2.4), color: o.ribbonColor ?? (o.mesh ? P.hot.map((v) => v * 0.6) : P.hot), life: o.ribbonLife ?? (o.mesh ? 0.16 : 0.22) });
  mesh.updateMatrixWorld(true);
  if (o.mesh && !o.keepRot) mesh.lookAt(p.pos.clone().add(p.vel));
  game.projectiles.push(p);
  return p;
}

/** Hit everything in a cone in front of the player. Returns the enemies hit. */
export function meleeHit(game, pl, { range = 3, arc = 2.1, dmg, pal = 'steel', knock = 0, stun = 0, from } = {}) {
  const hit = [];
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const dx = e.pos.x - pl.pos.x, dz = e.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
    if (d > range + e.radius||!game.level.clear(pl.pos.x,pl.pos.z,e.pos.x,e.pos.z,.1)) continue;
    let da = Math.atan2(dx, dz) - pl.facing; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > arc / 2 && d > e.radius + 0.6) continue;
    game.hurtEnemy(e, typeof dmg === 'function' ? dmg() : dmg, { pal, from: from ?? pl.pos, knock, stun });
    const hp = e.pos.clone().setY(1.2 * e.scale);
    game.fx.spark(hp, pal === 'steel' ? 'blood' : pal, 10);
    game.particles.emit({ pos: hp, count: 8, speed: [2, 6], life: [0.3, 0.6], size: [0.15, 0.35], c0: [1.2, 0.08, 0.05], c1: [0.3, 0, 0], gravity: 14, dir: V(dx / (d || 1), 0.4, dz / (d || 1)), spread: 0.6 });
    hit.push(e);
  }
  if (hit.length) { game.audio.play('hit', pl.pos, 0.9); game.hitStop(0.03); }
  return hit;
}

const towards = (pl, aim, max) => { const d = aim.clone().sub(pl.pos).setY(0); const l = Math.min(max, d.length()); return d.normalize().multiplyScalar(l); };
/** Dash along a line, stopping at walls; damages and stuns enemies crossed. */
function dash(game, pl, aim, { dist = 9, dur = 0.22, pal = 'steel', dmg, stun = 0, trail = 'dirt', onEnd, ghost = null, run = false } = {}) {
  const from = pl.pos.clone(), dir = towards(pl, aim, dist), len = dir.length(); dir.normalize();
  const to=game.level.displacement(from,from.clone().addScaledVector(dir,len),pl.radius??0.7);
  pl.face(to.x, to.z); pl.stop(); pl.invuln = Math.max(pl.invuln, dur + 0.1);
  const hit = new Set();
  let t = 0;
  pl.lock = dur + 0.05;
  if (run) pl.locomote('Running_A', len / dur, { max: 2.6 });
  let gt = 0;
  game.fx.add((dt) => {
    t += dt;
    const k = Math.min(1, t / dur);
    if (ghost && (gt -= dt) <= 0) { gt = dur / 4; game.fx.afterimage(pl, ghost); }
    pl.pos.lerpVectors(from, to, 1 - (1 - k) ** 2);
    game.smoke.emit({ pos: { x: pl.pos.x, y: 0.3, z: pl.pos.z }, count: 2, radius: 0.3, speed: [0.2, 1], life: [0.4, 0.8], size: [0.8, 1.6], c0: [0.22, 0.19, 0.16], c1: [0.1, 0.09, 0.08], alpha: 0.4, tex: 'smoke', grow0: 0.6, grow1: 1.4 });
    if (dmg) for (const e of game.enemiesNear(pl.pos, 1.8)) if (!hit.has(e)) { hit.add(e); game.hurtEnemy(e, dmg(), { pal, from: pl.pos, knock: 1.5, stun }); game.fx.spark(e.pos.clone().setY(1.2), pal === 'steel' ? 'blood' : pal, 10); }
    if (k >= 1) { onEnd?.(hit); return false; }
    return true;
  });
  return to;
}

// ============================================================================= MAGE
const MAGE = [
  {
    id: 'firebolt', name: '火焰弹', cost: 0, cd: 0.34, unlock: 1, anim: 'cast_bolt', windup: 0.2, lock: 0.34, primary: true,
    desc: '射出一枚火焰弹。',
    icon: ICON('<circle cx="24" cy="16" r="7" fill="#ffd27a"/><path d="M6 34 L20 20" stroke="#ff8a2a" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="16" r="3.5" fill="#fff"/>', ['#7a2a0a', '#1d0903']),
    fire(game, pl, aim) {
      const from = pl.castOrigin(), dir = aim.clone().sub(from).setY(0).normalize();
      game.audio.play('firebolt', from);
      game.particles.emit({ pos: from, count: 6, dir, spread: 0.5, speed: [2, 7], life: [0.12, 0.3], size: [0.5, 1], c0: PALETTE.fire.core, c1: PALETTE.fire.cool, tex: 'flame' });
      shoot(game, { team: 'player', pos: from, vel: dir.multiplyScalar(30), pal: 'fire', size: 0.24, r: 0.7, light: 60,
        onHit: (e, pos) => { game.fx.spark(pos, 'fire', 14); game.fx.flames(pos, { count: 4, radius: 0.2, size: [0.8, 1.4], up: 2 }); game.audio.play('hitfire', pos); if (e) game.hurtEnemy(e, pl.roll(13, 19, 'fire'), { pal: 'fire', from: pos }); } });
    },
  },
  {
    id: 'fireball', name: '火球术', cost: 14, cd: 1.1, unlock: 1, anim: 'cast_ball', windup: 0.26, lock: 0.45,
    desc: '掷出爆裂火球，对范围内的敌人造成伤害。',
    icon: ICON('<circle cx="20" cy="20" r="11" fill="#ff7a1a"/><circle cx="20" cy="20" r="7" fill="#ffd27a"/><circle cx="20" cy="20" r="3" fill="#fff"/><path d="M20 4 L23 12 L17 12Z M36 20 L28 23 L28 17Z M20 36 L17 28 L23 28Z M4 20 L12 17 L12 23Z" fill="#ffb347"/>', ['#8a2a08', '#1d0903']),
    fire(game, pl, aim) {
      const from = pl.castOrigin(), dir = aim.clone().sub(from).setY(0).normalize(), F = PALETTE.fire;
      const big = pl.has('emberheart') ? 1.4 : 1;
      game.audio.play('fireball', from);
      game.fx.ring(pl.pos, { color: F.hot, r0: 0.3, r1: 2.2, dur: 0.3 });
      const mesh = game.fx.orb('fire', 0.5 * big);
      game.fx.heat(from, { r: 1, dur: 0.4 });
      shoot(game, { team: 'player', pos: from, vel: dir.multiplyScalar(22), pal: 'fire', size: 0.55, r: 0.9, light: 160, mesh, keepRot: true, ribbonWidth: 1.1 * big, ribbonColor: [2.6, 0.9, 0.15], ribbonLife: 0.3,
        trail: (dt, pr) => {
          pr.mesh.rotation.x += dt * 9; pr.mesh.rotation.z += dt * 7;
          game.particles.emit({ pos: pr.pos, count: 4, radius: 0.25, speed: [0, 1.5], life: [0.2, 0.5], size: [1.2, 2.2], c0: F.hot, c1: F.cool, drag: 2, grow0: 0.8, grow1: 0.3, tex: 'flame', spin: [1, 4] });
          game.particles.emit({ pos: pr.pos, count: 2, speed: [1, 4], life: [0.4, 0.9], size: [0.12, 0.24], c0: F.core, c1: F.hot, gravity: 7 });
          if (Math.random() < 0.6) game.smoke.emit({ pos: pr.pos, count: 1, speed: [0, 0.6], life: [0.8, 1.5], size: [1, 2], c0: [0.1, 0.08, 0.06], c1: [0.03, 0.03, 0.03], up: 0.8, alpha: 0.45, grow0: 0.5, grow1: 1.6, tex: 'smoke', spin: [0.3, 1] });
        },
        onHit: (e, pos) => {
          const r = 4 * big;
          game.fx.explode(pos, r, 'fire', big);
          game.fx.flames(pos, { count: 10, radius: r * 0.4, size: [1.4, 2.6], up: 3.5, life: [0.4, 0.9] });
          game.audio.play('explosion', pos);
          for (const en of game.enemiesNear(pos, r + 0.2)) game.hurtEnemy(en, pl.roll(30 * (big > 1 ? 1.25 : 1), 42 * (big > 1 ? 1.25 : 1), 'fire'), { pal: 'fire', from: pos, knock: 2.2 });

        } });
    },
  },
  {
    id: 'nova', name: '冰霜新星', cost: 22, cd: 6, unlock: 2, anim: 'cast_nova', windup: 0.26, lock: 0.52, self: true,
    desc: '以自身为中心爆发寒冰，冻结并重创周围的敌人。',
    icon: ICON('<g stroke="#dff4ff" stroke-width="2.5" stroke-linecap="round"><path d="M20 5V35M5 20H35M9.5 9.5L30.5 30.5M30.5 9.5L9.5 30.5"/></g><circle cx="20" cy="20" r="4" fill="#fff"/>', ['#1c5fb0', '#061533']),
    fire(game, pl) {
      const p = pl.pos.clone(), R = 7.5, I = PALETTE.ice;
      game.audio.play('nova', p);
      game.fx.ground(p, { tex: 'ring', color: I.hot, r0: 0.5, r1: R * 1.05, dur: 0.38 });
      game.fx.ground(p, { tex: 'lightdisc', color: I.cool, r0: R * 0.4, r1: R * 1.1, dur: 0.5, opacity: 0.5 });
      game.fx.ground(p, { tex: 'magic2', color: [0.5, 1.1, 2], r0: R * 0.9, r1: R * 1.0, dur: 0.2, hold: 1.2, spin: 0.6 });
      game.fx.spikes(p, { count: 24, radius: R * 0.92, ringOnly: true, height: 2.8, hold: 1.1 });
      game.fx.spikes(p, { count: 16, radius: R * 0.6, height: 1.8, hold: 0.9 });
      game.fx.decal(p, R * 1.1, 0xbfe6ff, 3, 0.35);
      game.particles.emit({ pos: { x: p.x, y: 0.5, z: p.z }, count: 90, radius: 0.8, ring: true, outward: true, speed: [12, 26], life: [0.3, 0.6], size: [0.4, 0.9], c0: I.hot, c1: I.cool, drag: 2.6, tex: 'glint', spin: [2, 6] });
      game.particles.emit({ pos: { x: p.x, y: 0.4, z: p.z }, count: 60, radius: R * 0.8, flat: true, speed: [0.2, 1.5], up: 1.6, life: [0.8, 1.8], size: [0.2, 0.45], c0: I.core, c1: I.hot, drag: 0.8, tex: 'star' });
      game.smoke.emit({ pos: { x: p.x, y: 0.4, z: p.z }, count: 30, radius: R * 0.7, flat: true, speed: [0.3, 1.2], life: [1.2, 2.4], size: [3, 6], c0: [0.6, 0.75, 0.9], c1: [0.35, 0.45, 0.6], alpha: 0.2, grow0: 0.6, grow1: 1.4, tex: 'smoke', spin: [0.1, 0.5] });
      game.gfx.flash(p, I.light, 380, 0.6, 30);
      game.gfx.addShake(0.3);
      game.fx.shockwave(p, { r1: R * 2.4, dur: 0.5, strength: 0.05 });
      game.fx.chunks(p, 'ice', 8, 0.7);
      for (const e of game.enemiesNear(p, R)) { game.hurtEnemy(e, pl.roll(24, 32, 'cold'), { pal: 'ice', from: p }); e.freeze?.(2.6); }
    },
  },
  {
    id: 'chain', name: '闪电链', cost: 18, cd: 3.2, unlock: 3, anim: 'cast_bolt', windup: 0.2, lock: 0.42,
    desc: '释放一道在敌人之间弹跳的闪电。',
    icon: ICON('<path d="M23 3 L10 22 H19 L15 37 L31 16 H21Z" fill="#e8f0ff" stroke="#7aa0ff" stroke-width="1.5"/>', ['#3a3fb0', '#0a0a33']),
    fire(game, pl, aim) {
      const from = pl.castOrigin(), B = PALETTE.bolt, storm = pl.has('stormcoil');
      game.audio.play('lightning', from);
      game.particles.emit({ pos: from, count: 4, speed: [0, 1], life: [0.1, 0.2], size: [1.4, 2.2], c0: B.core, c1: B.hot, tex: 'elec' });
      let prev = from.clone(), hit = new Set(), mul = 1; const base = pl.roll(34, 44, 'lightning');
      let cur = game.nearestEnemy(aim, 6) ?? game.nearestEnemy(pl.pos, 14);
      if (!cur) {
        const end = pl.pos.clone().add(aim.clone().sub(pl.pos).setY(0).clampLength(0, 14)).setY(0.2);
        game.fx.bolt(prev, end); game.fx.spark(end, 'bolt', 16); game.fx.decal(end, 1.2, 0x000000, 3, 0.5);
        return;
      }
      let i = 0;
      const jump = () => {
        if (!cur || i >= (storm ? 9 : 6)) return;
        const to = cur.pos.clone().setY(1.3 * (cur.scale ?? 1));
        game.fx.bolt(prev, to, { width: i ? 0.07 : 0.1 });
        game.fx.spark(to, 'bolt', 12);
        game.fx.shockwave(to, { r1: 2.4, dur: 0.22, strength: 0.018, y: 1.2 });
        game.particles.emit({ pos: to, count: 3, speed: [0, 0.5], life: [0.1, 0.25], size: [1.6, 2.6], c0: B.core, c1: B.hot, tex: 'elec' });
        game.hurtEnemy(cur, { v: Math.round(base.v * mul), crit: base.crit }, { pal: 'bolt', from: prev });
        if (i) game.audio.play('lightning', to, 0.45);
        hit.add(cur); prev = to; if (!storm) mul *= 0.82; i++;
        cur = game.enemies.filter((e) => e.alive && !hit.has(e) && e.pos.distanceTo(prev) < 9).sort((a, b) => a.pos.distanceTo(prev) - b.pos.distanceTo(prev))[0];
        if (cur) game.after(0.09, jump);
      };
      jump();
      game.gfx.addShake(0.15);
    },
  },
  {
    id: 'meteor', name: '陨石术', cost: 38, cd: 9, unlock: 4, anim: 'cast_meteor', windup: 0.32, lock: 0.64,
    desc: '召唤燃烧的陨石砸向目标区域，留下一片火海。',
    icon: ICON('<circle cx="14" cy="27" r="8" fill="#5a2a12"/><circle cx="14" cy="27" r="5" fill="#ff7a1a"/><path d="M19 22 L36 4 L30 16 L37 15 L22 27Z" fill="#ffb347"/>', ['#a03408', '#200a03']),
    fire(game, pl, aim) {
      const big = pl.has('emberheart') ? 1.4 : 1;
      const target = aim.clone().setY(0), F = PALETTE.fire, R = 5.5 * big, fall = 0.95;
      game.fx.telegraph(target, R, fall, [3, 0.9, 0.15]);
      game.audio.play('meteorfall', target);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), new THREE.MeshStandardMaterial({ color: 0x1a0d08, emissive: new THREE.Color(3.5, 1.1, 0.2), emissiveIntensity: 1, roughness: 1, flatShading: true, normalMap: game.materials.tex.dark_rock.nor }));
      const start = target.clone().add(V(-7, 34, -9));
      rock.position.copy(start); game.gfx.scene.add(rock);
      game.fx.trail(rock, { width: 2.6, color: [2.8, 0.9, 0.12], life: 0.35 });
      const halo = game.fx.orb('fire', 1.9); rock.add(halo); halo.position.set(0, 0, 0); halo.scale.setScalar(1.5);
      const light = game.gfx.flash(start, F.light, 300, fall + 0.1, 40);
      let t = 0;
      game.fx.add((dt) => {
        t += dt;
        const k = Math.min(1, t / fall);
        rock.position.lerpVectors(start, target, k * k);
        rock.rotation.x += dt * 6; rock.rotation.y += dt * 4;
        light.position.copy(rock.position);
        game.particles.emit({ pos: rock.position, count: 5, radius: 0.7, speed: [0, 2], life: [0.3, 0.7], size: [1.6, 3.2], c0: F.hot, c1: F.cool, drag: 1.5, grow0: 0.8, grow1: 0.3, tex: 'flame', spin: [1, 3] });
        game.smoke.emit({ pos: rock.position, count: 3, radius: 0.5, speed: [0, 1], life: [1, 2], size: [2, 4], c0: [0.1, 0.07, 0.05], c1: [0.03, 0.03, 0.03], alpha: 0.55, grow0: 0.6, grow1: 1.8, tex: 'smoke', spin: [0.2, 0.6] });
        if (k < 1) return true;
        game.audio.play('meteorhit', target);
        game.fx.explode(target, R * 1.15, 'fire', 1.8);
        game.fx.ground(target, { tex: 'ring', color: F.hot, r0: 1, r1: R * 2, dur: 0.7, opacity: 0.55 });
        game.fx.spikes(target, { count: 9, radius: R * 0.5, color: 0x1a0d08, emissive: 0xff5a10, height: 1.5, hold: 4, rough: 0.9 });
        game.fx.shockwave(target, { r1: R * 3.4, dur: 0.7, strength: 0.07 });
        game.fx.dustWall(target, { r1: R * 1.4, dur: 0.7, h: 2, color: [0.35, 0.22, 0.14] });
        game.fx.chunks(target, 'rock', 14, 1.2);
        game.fx.heat(target, { r: R * 0.9, dur: 4, strength: 0.01 });
        game.gfx.addShake(1.1);
        game.hitStop(0.07);
        for (const e of game.enemiesNear(target, R)) game.hurtEnemy(e, pl.roll(70 * big, 95 * big, 'fire'), { pal: 'fire', from: target, knock: 4 });
        let bt = 0, tick = 0;
        game.fx.add((d2) => {
          bt += d2; tick += d2;
          if (Math.random() < 0.7) game.fx.flames({ x: target.x + rnd(-R, R) * 0.6, y: 0.2, z: target.z + rnd(-R, R) * 0.6 }, { count: 1, radius: 0.3, size: [1, 2.2], up: 2.5 });
          if (Math.random() < 0.2) game.smoke.emit({ pos: { x: target.x, y: 1, z: target.z }, count: 1, radius: R * 0.5, speed: [0, 0.4], up: 1.6, life: [1.5, 2.5], size: [2.5, 4.5], c0: [0.08, 0.07, 0.06], c1: [0.03, 0.03, 0.03], alpha: 0.4, tex: 'smoke', grow0: 0.6, grow1: 1.6 });
          if (tick > 0.5) { tick = 0; for (const e of game.enemiesNear(target, R * 0.8)) game.hurtEnemy(e, pl.roll(8, 12, 'fire'), { pal: 'fire', quiet: true }); }
          return bt < 4;
        });
        return false;
      }, () => { rock.removeFromParent(); rock.geometry.dispose(); rock.material.dispose(); });
    },
  },
  {
    id: 'blink', name: '闪现', cost: 10, cd: 3.5, unlock: 1, anim: null, windup: 0, lock: 0.12, instant: true,
    desc: '瞬间传送到鼠标所指的位置。',
    icon: ICON('<path d="M8 28 Q20 6 32 28" fill="none" stroke="#e0c8ff" stroke-width="3" stroke-dasharray="3 3"/><circle cx="8" cy="28" r="3.5" fill="#8a60d0"/><circle cx="32" cy="28" r="4.5" fill="#fff"/>', ['#5a2aa0', '#12062a']),
    fire(game, pl, aim) { teleport(game, pl, aim, 'dark', 'blink'); },
  },
];

function teleport(game, pl, aim, pal, sound) {
  const D = PALETTE[pal], from = pl.pos.clone();
  const dir = aim.clone().sub(from).setY(0); const dist = Math.min(13, dir.length()); dir.normalize();
  const to=game.level.displacement(from,from.clone().addScaledVector(dir,dist),pl.radius??0.7);
  const puff = (p) => {
    game.particles.emit({ pos: { x: p.x, y: 1.1, z: p.z }, count: 30, radius: 0.5, speed: [1, 6], life: [0.25, 0.6], size: [0.6, 1.4], c0: D.core, c1: D.cool, drag: 3, tex: 'twirl', spin: [3, 8] });
    game.particles.emit({ pos: { x: p.x, y: 1.1, z: p.z }, count: 3, speed: [0, 0.3], life: [0.15, 0.3], size: [2.5, 3.5], c0: D.hot, c1: D.cool, tex: 'twirl', spin: [6, 10] });
    game.fx.ground(p, { tex: 'twirl', color: D.hot, r0: 0.5, r1: 2.6, dur: 0.4, spin: 6 });
  };
  puff(from);
  game.fx.shockwave(from, { r0: 2.5, r1: 0.2, dur: 0.25, strength: 0.04, y: 1.1 });
  for (let i = 1; i < 8; i++) game.particles.emit({ pos: from.clone().lerp(to, i / 8).setY(1.1), count: 3, radius: 0.3, speed: [0, 1], life: [0.2, 0.5], size: [0.3, 0.7], c0: D.hot, c1: D.cool, tex: 'glint' });
  pl.pos.copy(to); pl.path = [];
  puff(to);
  game.fx.shockwave(to, { r1: 3.5, dur: 0.3, strength: 0.035, y: 1.1 });
  game.gfx.flash(to, D.light, 200, 0.35, 16);
  game.audio.play(sound, to);
  pl.invuln = Math.max(pl.invuln, 0.25);
}

// ============================================================================= WARRIOR (rage)
const WARRIOR = [
  {
    id: 'cleave', name: '猛砍', cost: 0, cd: 0.5, unlock: 1, anim: 'atk_cleave', windup: 0.24, lock: 0.46, melee: 3.4, primary: true,
    desc: '挥动战锤横扫前方的敌人，每命中一个敌人获得怒气。',
    icon: ICON('<path d="M8 30 Q20 4 34 14" fill="none" stroke="#ffe0b0" stroke-width="4" stroke-linecap="round"/><path d="M28 6 l8 2 -4 7z" fill="#ccc"/>', ['#7a1a0a', '#1d0503']),
    fire(game, pl) {
      game.audio.play('swing', pl.pos);
      game.fx.slash(pl.pos, pl.facing, { r: 3.4, arc: 2.4, color: [2.2, 1.9, 1.6] });
      const hit = meleeHit(game, pl, { range: 3.4, arc: 2.4, dmg: () => pl.roll(16, 22), knock: 1 });
      pl.gainRes(hit.length * 9 + (hit.length ? 3 : 0));
    },
  },
  {
    id: 'slam', name: '裂地猛击', cost: 25, cd: 0.9, unlock: 1, anim: 'atk_slam', windup: 0.3, lock: 0.55,
    desc: '重锤砸地，裂地冲击沿直线前进，击晕路径上的敌人。',
    icon: ICON('<path d="M6 32 L34 32" stroke="#a8763a" stroke-width="3"/><path d="M12 32 L16 24 L20 30 L24 20 L28 32" fill="none" stroke="#ffb060" stroke-width="2.5"/><rect x="16" y="4" width="8" height="10" fill="#bbb"/>', ['#6a3a10', '#1a0d03']),
    fire(game, pl, aim) {
      const dir = aim.clone().sub(pl.pos).setY(0).normalize(), hit = new Set();
      game.audio.play('meteorhit', pl.pos, 0.6);
      game.gfx.addShake(0.5);
      game.fx.dustWall(pl.pos.clone().addScaledVector(dir, 1.2), { r1: 2.5, dur: 0.45, h: 1 });
      for (let i = 1; i <= 7; i++) game.after(i * 0.045, () => {
        const p = pl.pos.clone().addScaledVector(dir, i * 1.4);
        if (game.level.blocked(p.x, p.z, 0.3)) return;
        game.smoke.emit({ pos: { x: p.x, y: 0.3, z: p.z }, count: 4, radius: 0.5, flat: true, speed: [1, 4], up: 4, life: [0.4, 0.9], size: [0.4, 0.9], c0: [0.3, 0.25, 0.2], c1: [0.1, 0.09, 0.08], gravity: 12, alpha: 0.95, tex: 'dirt' });
        game.smoke.emit({ pos: { x: p.x, y: 0.5, z: p.z }, count: 2, radius: 0.4, speed: [0.2, 1], up: 1, life: [0.8, 1.4], size: [1.6, 2.8], c0: [0.28, 0.24, 0.2], c1: [0.12, 0.1, 0.09], alpha: 0.45, tex: 'smoke', grow0: 0.6, grow1: 1.6 });
        game.fx.decal(p, 1.3, 0x000000, 5, 0.6);
        if (i % 2) game.fx.chunks(p, 'rock', 2, 0.6);
        game.fx.shockwave(p, { r1: 2.6, dur: 0.25, strength: 0.025, y: 0.3 });
        game.fx.ground(p, { tex: 'ring_soft', color: [1.6, 0.8, 0.3], r0: 0.4, r1: 2.2, dur: 0.3, opacity: 0.6 });
        for (const e of game.enemiesNear(p, 1.9)) if (!hit.has(e)) { hit.add(e); game.hurtEnemy(e, pl.roll(38, 50), { pal: 'steel', from: pl.pos, knock: 2, stun: 1.1 }); }
      });
    },
  },
  {
    id: 'warcry', name: '战吼', cost: 0, cd: 12, unlock: 2, anim: 'atk_cry', windup: 0.25, lock: 0.6, self: true,
    desc: '发出震天怒吼：获得 30 怒气，6 秒内伤害提高 30%、护甲提高 50%。',
    icon: ICON('<path d="M10 14 Q20 2 30 14 Q20 24 10 14z" fill="#ffcf9a"/><path d="M8 24 Q20 34 32 24" fill="none" stroke="#ff7040" stroke-width="3"/><path d="M5 30 Q20 42 35 30" fill="none" stroke="#ff5030" stroke-width="2"/>', ['#8a1a10', '#200503']),
    fire(game, pl) {
      const warlord = pl.has('warlord');
      pl.buff('warcry', warlord ? 12 : 6, { dmg: 0.3, armor: 0.5 });
      pl.gainRes(30);
      if (warlord) pl.heal(pl.maxHp * 0.25);
      game.audio.play('warcry', pl.pos, 0.9);
      game.fx.ground(pl.pos, { tex: 'ring', color: [3, 0.8, 0.3], r0: 1, r1: 9, dur: 0.6 });
      game.fx.ground(pl.pos, { tex: 'ring_soft', color: [2, 0.4, 0.1], r0: 0.5, r1: 7, dur: 0.8 });
      game.particles.emit({ pos: { x: pl.pos.x, y: 1.6, z: pl.pos.z }, count: 40, speed: [3, 9], life: [0.3, 0.6], size: [0.3, 0.7], c0: [3, 1, 0.3], c1: [0.8, 0.1, 0], tex: 'streak', align: true });
      game.gfx.addShake(0.4);
      game.fx.shockwave(pl.pos, { r1: 16, dur: 0.6, strength: 0.06, y: 1.4 });
      for (const e of game.enemiesNear(pl.pos, 7)) e.stun?.(0.8);
    },
  },
  {
    id: 'whirlwind', name: '旋风斩', cost: 35, cd: 4, unlock: 3, anim: 'atk_spin', windup: 0.1, lock: 0.95, self: true,
    desc: '高速旋转，连续三次斩击周围所有敌人。',
    icon: ICON('<circle cx="20" cy="20" r="12" fill="none" stroke="#ffe0b0" stroke-width="3" stroke-dasharray="14 6"/><circle cx="20" cy="20" r="5" fill="#ffb060"/>', ['#6a2a0a', '#1a0803']),
    fire(game, pl) {
      const butcher = pl.has('butcher'), n = butcher ? 6 : 3;
      if (butcher) pl.lock = 1.8;
      for (let i = 0; i < n; i++) game.after(i * 0.3, () => {
        game.audio.play('swing', pl.pos);
        game.fx.slash(pl.pos, pl.facing + i * 2.1, { r: 4, arc: 6.2, dur: 0.28, color: [2.2, 1.8, 1.4], tex: 'slash2' });
        game.smoke.emit({ pos: { x: pl.pos.x, y: 0.3, z: pl.pos.z }, count: 4, radius: 2.5, ring: true, speed: [1, 3], life: [0.5, 0.9], size: [1, 2], c0: [0.25, 0.21, 0.18], c1: [0.1, 0.09, 0.08], alpha: 0.4, tex: 'smoke', grow1: 1.4 });
        game.fx.shockwave(pl.pos, { r1: 6, dur: 0.3, strength: 0.018, y: 1 });
        const hit = meleeHit(game, pl, { range: 4, arc: 7, dmg: () => pl.roll(18, 24), knock: 0.8 });
        if (butcher) pl.gainRes(hit.length * 2);
      });
    },
  },
  {
    id: 'leap', name: '跃击', cost: 40, cd: 8, unlock: 4, anim: 'atk_leap', windup: 0.05, lock: 0.75,
    desc: '跃向目标位置猛砸地面，对落点周围的敌人造成巨大伤害并击退。',
    icon: ICON('<path d="M6 32 Q16 0 30 26" fill="none" stroke="#ffd080" stroke-width="2.5" stroke-dasharray="3 3"/><circle cx="30" cy="28" r="6" fill="#ff8a3a"/>', ['#7a3a0a', '#1d0903']),
    fire(game, pl, aim) {
      const from = pl.pos.clone(), dir = towards(pl, aim, 12);
      const to=game.level.displacement(from,from.clone().add(dir),pl.radius??0.8);
      pl.face(to.x, to.z); pl.stop(); pl.invuln = 0.7;
      game.audio.play('swing', pl.pos);
      let t = 0; const dur = 0.55;
      game.fx.add((dt) => {
        t += dt; const k = Math.min(1, t / dur);
        pl.pos.lerpVectors(from, to, k); pl.pos.y = Math.sin(k * Math.PI) * 3.2;
        if (k < 1) return true;
        pl.pos.y = 0;
        const R = 5;
        game.fx.explode(to, R, 'steel', 0.6);
        game.fx.ground(to, { tex: 'ring', color: [1, 0.8, 0.6], r0: 1, r1: R * 1.8, dur: 0.5, opacity: 0.6 });
        game.fx.decal?.(to, R * 0.9);
        game.fx.shockwave(to, { r1: R * 3, dur: 0.55, strength: 0.06 });
        game.fx.dustWall(to, { r1: R * 1.3, dur: 0.6, h: 1.6 });
        game.fx.chunks(to, 'rock', 10, 1);
        game.audio.play('meteorhit', to, 0.8);
        game.gfx.addShake(0.9); game.hitStop(0.06);
        for (const e of game.enemiesNear(to, R)) game.hurtEnemy(e, pl.roll(70, 92), { pal: 'steel', from: to, knock: 3.5, stun: 1 });
        return false;
      });
    },
  },
  {
    id: 'charge', name: '冲锋', cost: 0, cd: 5, unlock: 1, anim: 'Running_A', windup: 0, lock: 0.25, instant: true,
    desc: '向前冲锋，撞开路径上的敌人并获得 15 怒气。',
    icon: ICON('<path d="M5 20 H28" stroke="#ffd0a0" stroke-width="4"/><path d="M26 12 L36 20 L26 28z" fill="#ff9a50"/><path d="M5 13 H18M5 27 H18" stroke="#ff9a5088" stroke-width="2"/>', ['#6a2a0a', '#1a0803']),
    fire(game, pl, aim) {
      game.audio.play('swing', pl.pos);
      dash(game, pl, aim, { dist: 10, dur: 0.36, dmg: () => pl.roll(10, 14), stun: 0.8, run: true, ghost: [1.2, 0.45, 0.15] });
      pl.gainRes(15);
    },
  },
];

// ============================================================================= RANGER (focus)
function fireArrow(game, pl, dir, { dmg, speed = 42, pierce = false, glow = null, pal = 'steel', onHit, from } = {}) {
  const o = from ?? pl.castOrigin();
  const mesh = arrowMesh(game, glow);
  return shoot(game, { team: 'player', pos: o, vel: dir.clone().multiplyScalar(speed), pal, mesh, r: 0.6, pierce, life: 1.2, ribbonWidth: glow ? 0.35 : 0.14, ribbonColor: glow ?? [0.7, 0.72, 0.75], ribbonLife: glow ? 0.22 : 0.12,
    trail: (dt, pr) => { if (glow) game.particles.emit({ pos: pr.pos, count: 2, speed: [0, 0.4], life: [0.12, 0.3], size: [0.4, 0.8], c0: glow, c1: [glow[0] * 0.2, glow[1] * 0.2, glow[2] * 0.2], tex: 'glow' }); else if (Math.random() < 0.5) game.particles.emit({ pos: pr.pos, count: 1, speed: [0, 0.2], life: [0.1, 0.2], size: [0.4, 0.6], c0: [0.6, 0.55, 0.5], c1: [0.1, 0.1, 0.1], tex: 'streak', align: true }); },
    onHit: (e, pos) => {
      game.particles.emit({ pos, count: 6, speed: [1, 5], life: [0.2, 0.4], size: [0.15, 0.35], c0: [1.6, 1.4, 1], c1: [0.3, 0.2, 0.1], gravity: 9, tex: 'streak', align: true });
      if (e) { game.hurtEnemy(e, dmg(), { pal, from: pos, knock: 0.5 }); game.audio.play('hit', pos, 0.7); }
      onHit?.(e, pos);
    } });
}
const RANGER = [
  {
    id: 'shot', name: '速射', cost: 0, cd: 0.3, unlock: 1, anim: 'bow_shot', windup: 0.18, lock: 0.3, primary: true,
    desc: '快速射出一箭。',
    icon: ICON('<path d="M6 34 L32 8" stroke="#d8c8a8" stroke-width="2.5"/><path d="M32 8 l-7 1 6 6z" fill="#ddd"/><path d="M6 34 l2 -6 4 4z" fill="#ccc"/>', ['#2a4a1a', '#0a1405']),
    fire(game, pl, aim) {
      const dir = aim.clone().sub(pl.pos).setY(0).normalize();
      game.audio.play('arrow', pl.pos);
      const n = pl.has('windforce') && Math.random() < 0.25 ? 3 : 1;
      for (let i = 0; i < n; i++) fireArrow(game, pl, dir.clone().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.12), { dmg: () => pl.roll(12, 17) });
      pl.gainRes(2);
    },
  },
  {
    id: 'multishot', name: '多重射击', cost: 20, cd: 0.8, unlock: 1, anim: 'bow_shot', windup: 0.24, lock: 0.42,
    desc: '扇形射出五支箭。',
    icon: ICON('<g stroke="#d8c8a8" stroke-width="2"><path d="M6 34 L34 6"/><path d="M6 34 L36 18"/><path d="M6 34 L20 4"/></g>', ['#3a5a1a', '#0a1405']),
    fire(game, pl, aim) {
      const dir = aim.clone().sub(pl.pos).setY(0).normalize(), n = pl.has('hawk') ? 9 : 5;
      game.audio.play('arrow', pl.pos); game.after(0.04, () => game.audio.play('arrow', pl.pos, 0.6));
      for (let i = 0; i < n; i++) fireArrow(game, pl, dir.clone().applyAxisAngle(UP, (i - (n - 1) / 2) * (0.7 / (n - 1)) * 1.2), { dmg: () => pl.roll(14, 19) });
    },
  },
  {
    id: 'pierce', name: '穿透箭', cost: 25, cd: 4, unlock: 2, anim: 'bow_power', windup: 0.42, lock: 0.6,
    desc: '蓄力射出一支贯穿所有敌人的重箭。',
    icon: ICON('<path d="M4 20 H36" stroke="#9fd8ff" stroke-width="3"/><path d="M36 20 l-8 -5 v10z" fill="#e8f8ff"/><circle cx="14" cy="20" r="4" fill="none" stroke="#9fd8ff"/><circle cx="24" cy="20" r="4" fill="none" stroke="#9fd8ff"/>', ['#1a3a5a', '#050f1a']),
    fire(game, pl, aim) {
      const dir = aim.clone().sub(pl.pos).setY(0).normalize();
      game.audio.play('lightning', pl.pos, 0.5); game.audio.play('arrow', pl.pos);
      game.fx.ground(pl.pos, { tex: 'ring_soft', color: [0.8, 1.6, 2.6], r0: 0.4, r1: 3, dur: 0.3 });
      fireArrow(game, pl, dir, { dmg: () => pl.roll(40, 55), speed: 55, pierce: true, glow: [1.2, 2.4, 4], pal: 'bolt' });
    },
  },
  {
    id: 'rain', name: '箭雨', cost: 35, cd: 7, unlock: 3, anim: 'bow_power', windup: 0.3, lock: 0.5,
    desc: '向天空射出箭矢，在目标区域落下密集的箭雨。',
    icon: ICON('<g stroke="#d8c8a8" stroke-width="2"><path d="M8 4 L14 30"/><path d="M18 2 L22 30"/><path d="M28 4 L30 30"/></g><path d="M6 34 H34" stroke="#7a5a3a" stroke-width="3"/>', ['#3a4a2a', '#0a1005']),
    fire(game, pl, aim) {
      const R = pl.has('hawk') ? 5.8 : 4.5, c = aim.clone().setY(0);
      game.audio.play('arrow', pl.pos);
      game.fx.telegraph(c, R, 0.5, [1.6, 1.4, 0.8]);
      for (let i = 0; i < 36; i++) game.after(0.45 + i * 0.035, () => {
        const a = Math.random() * 6.283, r = R * Math.sqrt(Math.random());
        const p = V(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
        const m = arrowMesh(game); m.position.set(p.x - 1.5, 9, p.z - 1.5); m.updateMatrixWorld(true); m.lookAt(p);
        let t = 0;
        game.fx.add((dt) => { t += dt; const k = Math.min(1, t / 0.18); m.position.set(p.x - 1.5 * (1 - k), 9 * (1 - k) + 0.3, p.z - 1.5 * (1 - k)); if (k < 1) return true;
          game.smoke.emit({ pos: { x: p.x, y: 0.2, z: p.z }, count: 1, speed: [0.5, 1.5], up: 2, life: [0.3, 0.6], size: [0.3, 0.6], c0: [0.3, 0.25, 0.2], c1: [0.1, 0.09, 0.08], gravity: 8, tex: 'dirt' });
          return t < 2.5; }, () => m.removeFromParent());
        if (i % 3 === 0) game.after(0.18, () => { game.audio.play('hit', p, 0.3); for (const e of game.enemiesNear(p, 1.6)) game.hurtEnemy(e, pl.roll(9, 13), { pal: 'steel', quiet: true }); });
      });
    },
  },
  {
    id: 'explosive', name: '爆裂箭', cost: 40, cd: 9, unlock: 4, anim: 'bow_power', windup: 0.36, lock: 0.55,
    desc: '射出一支火药箭，命中后猛烈爆炸并点燃地面。',
    icon: ICON('<path d="M4 34 L26 12" stroke="#d8c8a8" stroke-width="2.5"/><circle cx="28" cy="10" r="7" fill="#ff7a1a"/><circle cx="28" cy="10" r="3" fill="#ffe0a0"/>', ['#7a3a0a', '#1d0903']),
    fire(game, pl, aim) {
      const dir = aim.clone().sub(pl.pos).setY(0).normalize();
      game.audio.play('arrow', pl.pos); game.audio.play('firebolt', pl.pos, 0.6);
      fireArrow(game, pl, dir, { dmg: () => pl.roll(20, 26), speed: 38, glow: [4, 1.6, 0.4], pal: 'fire',
        onHit: (e, pos) => {
          game.fx.explode(pos, 4.5, 'fire', 1.4); game.audio.play('explosion', pos);
          for (const en of game.enemiesNear(pos, 4.5)) game.hurtEnemy(en, pl.roll(55, 72, 'fire'), { pal: 'fire', from: pos, knock: 2.5 });
          let bt = 0, tick = 0;
          game.fx.add((d2) => { bt += d2; tick += d2; if (Math.random() < 0.5) game.fx.flames({ x: pos.x + rnd(-2, 2), y: 0.2, z: pos.z + rnd(-2, 2) }, { count: 1, size: [0.8, 1.8] });
            if (tick > 0.5) { tick = 0; for (const en of game.enemiesNear(pos, 3.5)) game.hurtEnemy(en, pl.roll(6, 9, 'fire'), { pal: 'fire', quiet: true }); } return bt < 3; });
        } });
    },
  },
  {
    id: 'roll', name: '翻滚', cost: 0, cd: 2.5, unlock: 1, anim: 'bow_roll', windup: 0, lock: 0.35, instant: true,
    desc: '向鼠标方向翻滚，翻滚期间无敌。',
    icon: ICON('<path d="M10 28 A10 10 0 1 1 28 26" fill="none" stroke="#d8f0c0" stroke-width="3"/><path d="M28 18 l2 9 -8 -2z" fill="#d8f0c0"/>', ['#2a5a2a', '#081a08']),
    fire(game, pl, aim) {
      pl.play('bow_roll', { once: true, restart: true, speed: 1.6, fade: 0.05 });
      game.audio.play('swing', pl.pos, 0.6);
      dash(game, pl, aim, { dist: 7.5, dur: 0.38, ghost: [0.35, 0.9, 0.4] });
      pl.invuln = 0.45;
    },
  },
];

// ============================================================================= PALADIN (mana)
const PALADIN = [
  {
    id: 'smite', name: '正义打击', cost: 0, cd: 0.5, unlock: 1, anim: 'atk_slash', windup: 0.22, lock: 0.44, melee: 3.2, primary: true,
    desc: '以圣光灌注的剑斩击敌人，回复少量法力。',
    icon: ICON('<path d="M20 4 V28" stroke="#fff4c0" stroke-width="4"/><path d="M12 28 H28" stroke="#c9a96b" stroke-width="3"/><circle cx="20" cy="12" r="8" fill="#ffe08a55"/>', ['#8a6a1a', '#201803']),
    fire(game, pl) {
      game.audio.play('swing', pl.pos);
      game.fx.slash(pl.pos, pl.facing, { r: 3.2, arc: 2.2, color: [3, 2.6, 1.4] });
      const hit = meleeHit(game, pl, { range: 3.2, arc: 2.2, dmg: () => pl.roll(15, 21, 'holy'), pal: 'holy', knock: 0.8 });
      if (hit.length) pl.gainRes(4);
      if (hit.length && pl.has('dawn')) { const t = hit[0].pos.clone(); game.fx.pillar(t, 'holy', 30, 7); for (const e of game.enemiesNear(t, 3)) game.hurtEnemy(e, pl.roll(14, 20, 'holy'), { pal: 'holy', quiet: true }); }
    },
  },
  {
    id: 'hammer', name: '审判之锤', cost: 18, cd: 1, unlock: 1, anim: 'atk_cast', windup: 0.3, lock: 0.5,
    desc: '召唤圣光之锤砸向目标区域。',
    icon: ICON('<rect x="10" y="6" width="20" height="10" rx="2" fill="#ffe8a0"/><path d="M20 16 V34" stroke="#c9a96b" stroke-width="4"/><path d="M6 36 Q20 26 34 36" fill="none" stroke="#fff4c0" stroke-width="2"/>', ['#9a7a1a', '#221a03']),
    fire(game, pl, aim) {
      const c = aim.clone().setY(0), H = PALETTE.holy, R = 3.8;
      game.fx.telegraph(c, R, 0.35, [3, 2.5, 1.2]);
      game.after(0.35, () => {
        game.fx.pillar(c, 'holy', 40, 10);
        game.fx.column(c, { color: [2.2, 1.8, 0.8], r: 1.1, h: 14, dur: 0.55 });
        game.fx.explode(c, R, 'holy', 0.7);
        game.fx.chunks(c, 'rock', 5, 0.7);
        game.fx.ground(c, { tex: 'magic1', color: H.hot, r0: R, r1: R * 1.2, dur: 0.15, hold: 0.8, spin: 1 });
        game.audio.play('bell', c, 0.35); game.audio.play('explosion', c, 0.6);
        for (const e of game.enemiesNear(c, R)) game.hurtEnemy(e, pl.roll(34, 46, 'holy'), { pal: 'holy', from: c, knock: 1.5 });
      });
    },
  },
  {
    id: 'shield', name: '圣光护盾', cost: 25, cd: 14, unlock: 2, anim: 'atk_powerup', windup: 0.2, lock: 0.5, self: true,
    desc: '获得吸收 40% 最大生命值伤害的圣光护盾，持续 8 秒。',
    icon: ICON('<path d="M20 4 L33 9 Q33 26 20 35 Q7 26 7 9z" fill="#ffe8a066" stroke="#fff4c0" stroke-width="2.5"/>', ['#8a7a2a', '#201a05']),
    fire(game, pl) {
      const amt = pl.maxHp * 0.4 * (pl.has('aegis') ? 2 : 1);
      pl.shield = amt; pl.buff('shield', 8, {});
      game.audio.play('levelup', pl.pos, 0.5);
      game.fx.pillar(pl.pos, 'holy', 60, 6);
      game.fx.shockwave(pl.pos, { r1: 7, dur: 0.4, strength: 0.03, y: 1.2 });
      pl.showShield(true);
    },
  },
  {
    id: 'heal', name: '治疗之光', cost: 30, cd: 10, unlock: 3, anim: 'atk_cast', windup: 0.25, lock: 0.5, self: true,
    desc: '圣光爆发：回复 35% 最大生命，并灼烧周围的亡灵。',
    icon: ICON('<path d="M20 6 V34 M6 20 H34" stroke="#fff8d0" stroke-width="6"/><circle cx="20" cy="20" r="14" fill="none" stroke="#ffd060" stroke-width="2"/>', ['#9a8a2a', '#221f05']),
    fire(game, pl) {
      pl.heal(pl.maxHp * 0.35);
      game.audio.play('potion', pl.pos); game.audio.play('levelup', pl.pos, 0.4);
      game.fx.pillar(pl.pos, 'holy', 70, 9);
      game.fx.column(pl.pos, { color: [1.8, 1.6, 0.8], r: 1.3, h: 10, dur: 0.9, flow: [0, -1.6] });
      game.fx.ground(pl.pos, { tex: 'lightdisc', color: [1.1, 0.9, 0.45], r0: 1, r1: 7, dur: 0.6, opacity: 0.22 });
      game.fx.ground(pl.pos, { tex: 'magic2', color: [1.6, 1.25, 0.45], r0: 4, r1: 5, dur: 0.3, hold: 1, spin: 1.5, opacity: 0.8 });
      for (const e of game.enemiesNear(pl.pos, 5)) game.hurtEnemy(e, pl.roll(30, 40, 'holy'), { pal: 'holy', from: pl.pos, knock: 2 });
    },
  },
  {
    id: 'consecrate', name: '奉献', cost: 40, cd: 12, unlock: 4, anim: 'atk_powerup', windup: 0.3, lock: 0.6, self: true,
    desc: '圣化脚下的土地 5 秒：持续灼烧其中的敌人，并治疗站在其中的你。',
    icon: ICON('<circle cx="20" cy="24" r="13" fill="none" stroke="#ffd060" stroke-width="2.5"/><path d="M20 8 l3 8 -3 3 -3 -3z" fill="#fff4c0"/><path d="M8 26 H32" stroke="#ffd06088" stroke-width="2"/>', ['#8a6a1a', '#1d1503']),
    fire(game, pl) {
      const c = pl.pos.clone(), R = 6.5, H = PALETTE.holy;
      game.audio.play('bell', c, 0.5);
      game.fx.glyph(c, { tex: 'magic1', color: [2.4, 1.9, 0.7], r: R, dur: 5, spin: 0.4 });
      game.fx.glyph(c, { tex: 'lightdisc', color: [0.9, 0.7, 0.25], r: R * 1.05, dur: 5, spin: 0 });
      let t = 0, tick = 0;
      game.fx.add((dt) => {
        t += dt; tick += dt;
        if (Math.random() < 0.8) game.particles.emit({ pos: { x: c.x, y: 0.2, z: c.z }, count: 1, radius: R * 0.9, flat: true, speed: [0, 0.3], up: 2.5, life: [0.6, 1.2], size: [0.25, 0.5], c0: H.core, c1: H.cool, tex: 'glint', spin: [1, 3] });
        if (tick > 0.5) { tick = 0;
          for (const e of game.enemiesNear(c, R)) game.hurtEnemy(e, pl.roll(10, 14, 'holy'), { pal: 'holy', quiet: true });
          if (pl.pos.distanceTo(c) < R) pl.heal(pl.maxHp * 0.02); }
        return t < 5;
      });
    },
  },
  {
    id: 'bash', name: '盾击冲锋', cost: 0, cd: 5, unlock: 1, anim: 'atk_bash', windup: 0, lock: 0.3, instant: true,
    desc: '举盾冲锋，击晕路径上的敌人。',
    icon: ICON('<path d="M14 6 L26 10 Q26 24 14 32 Q4 24 4 10z" fill="#c9a96b"/><path d="M26 20 H38" stroke="#fff4c0" stroke-width="3"/><path d="M34 15 l4 5 -4 5" fill="none" stroke="#fff4c0" stroke-width="2"/>', ['#6a5a2a', '#1a1505']),
    fire(game, pl, aim) {
      game.audio.play('swing', pl.pos);
      dash(game, pl, aim, { dist: 8.5, dur: 0.34, pal: 'holy', dmg: () => pl.roll(12, 16, 'holy'), stun: 1.2, run: true, ghost: [1.3, 1.0, 0.4], onEnd: () => pl.play('atk_bash', { once: true, restart: true, speed: 1.8, fade: 0.06 }) });
    },
  },
];

// ============================================================================= NECROMANCER (essence)
const NECRO = [
  {
    id: 'bonespike', name: '骨刺', cost: 0, cd: 0.32, unlock: 1, anim: 'cast_bolt', windup: 0.2, lock: 0.34, primary: true,
    desc: '射出一枚骨刺，命中时获得精魄。',
    icon: ICON('<path d="M6 34 L30 10" stroke="#e8e4d4" stroke-width="4" stroke-linecap="round"/><path d="M30 10 l6 -6 -2 8z" fill="#fff"/>', ['#2a3a2a', '#081008']),
    fire(game, pl, aim) {
      const from = pl.castOrigin(), dir = aim.clone().sub(from).setY(0).normalize(), B = PALETTE.bone;
      game.audio.play('bonespike', from, 0.4);
      const m = boneMesh(0.9);
      game.gfx.scene.add(m);
      shoot(game, { team: 'player', pos: from, vel: dir.multiplyScalar(32), pal: 'bone', mesh: m, r: 0.6, ribbonWidth: 0.3, ribbonColor: [0.45, 1.6, 0.7], ribbonLife: 0.2,
        trail: (dt, pr) => game.particles.emit({ pos: pr.pos, count: 1, speed: [0, 0.4], life: [0.15, 0.3], size: [0.4, 0.7], c0: [0.6, 1.4, 0.8], c1: [0.05, 0.2, 0.1], tex: 'glow' }),
        onHit: (e, pos) => { game.particles.emit({ pos, count: 10, speed: [2, 6], life: [0.2, 0.5], size: [0.12, 0.3], c0: B.core, c1: B.cool, gravity: 12, tex: 'streak', align: true }); if (e) { game.hurtEnemy(e, pl.roll(13, 18, 'bone'), { pal: 'bone', from: pos }); pl.gainRes(5); } } });
    },
  },
  {
    id: 'lance', name: '白骨长矛', cost: 20, cd: 0.9, unlock: 1, anim: 'cast_ball', windup: 0.26, lock: 0.45,
    desc: '掷出贯穿一切的白骨长矛。',
    icon: ICON('<path d="M4 20 H34" stroke="#f0ecdc" stroke-width="5"/><path d="M34 20 l-8 -6 v12z" fill="#fff"/><path d="M8 16 v8 M14 15 v10" stroke="#9a947a" stroke-width="2"/>', ['#3a4a3a', '#0a120a']),
    fire(game, pl, aim) {
      const from = pl.castOrigin(), dir = aim.clone().sub(from).setY(0).normalize(), weaver = pl.has('boneweaver');
      game.audio.play('bonespike', from);
      const m = boneMesh(2.6, 2.4);
      game.gfx.scene.add(m);
      game.fx.shockwave(from, { r1: 3, dur: 0.3, strength: 0.025, y: 1.2 });
      shoot(game, { team: 'player', pos: from, vel: dir.multiplyScalar(36), pal: 'bone', mesh: m, r: 0.9, pierce: true, life: 1, ribbonWidth: 0.8, ribbonColor: [0.4, 1.5, 0.6], ribbonLife: 0.28,
        trail: (dt, pr) => { game.particles.emit({ pos: pr.pos, count: 2, radius: 0.2, speed: [0, 0.8], life: [0.25, 0.5], size: [0.8, 1.4], c0: [0.6, 1.6, 0.8], c1: [0.02, 0.15, 0.05], tex: 'smoke' }); },
        onHit: (e, pos) => { if (!e) return; game.hurtEnemy(e, pl.roll(30, 40, 'bone'), { pal: 'bone', from: pos, knock: 1.2 }); game.fx.spark(pos, 'bone', 12);
          if (weaver) { game.fx.explode(pos, 3, 'poison', 0.7); for (const en of game.enemiesNear(pos, 3)) if (en !== e) game.hurtEnemy(en, pl.roll(20, 28, 'bone'), { pal: 'poison', quiet: true }); } } });
    },
  },
  {
    id: 'raise', name: '召唤骷髅', cost: 30, cd: 3, unlock: 2, anim: 'cast_meteor', windup: 0.3, lock: 0.55,
    desc: '从地下唤起两具骷髅为你作战，持续 30 秒（最多 4 具）。',
    icon: ICON('<circle cx="20" cy="15" r="8" fill="#e8e4d4"/><circle cx="17" cy="14" r="2" fill="#2a2"/><circle cx="23" cy="14" r="2" fill="#2a2"/><path d="M14 24 h12 v8 h-12z" fill="#c8c4b4"/>', ['#2a4a2a', '#081208']),
    fire(game, pl, aim) {
      const extra = pl.has('deathsbreath'), n = extra ? 3 : 2, max = extra ? 6 : 4;
      const mine = game.allies.filter((a) => a.alive);
      for (let i = 0; i < mine.length + n - max; i++) mine[i].expire();
      game.audio.play('raise', pl.pos, 0.8);
      for (let i = 0; i < n; i++) {
        const a = pl.facing + (i - (n - 1) / 2) * 0.9;
        let x = pl.pos.x + Math.sin(a) * 2.5, z = pl.pos.z + Math.cos(a) * 2.5;
        if (game.level.blocked(x, z, 0.8)) { x = pl.pos.x; z = pl.pos.z; }
        game.fx.glyph(V(x, 0, z), { tex: 'magic2', color: [0.4, 1.6, 0.6], r: 1.8, dur: 1.4, spin: 2 });
        game.fx.column(V(x, 0, z), { color: [0.3, 1.5, 0.6], r: 0.7, h: 4, dur: 0.7 });
        game.particles.emit({ pos: { x, y: 0.3, z }, count: 20, radius: 0.6, speed: [0.2, 1], up: 2.5, life: [0.5, 1.1], size: [0.3, 0.7], c0: [0.6, 2, 0.8], c1: [0, 0.2, 0.05], tex: 'glow' });
        game.spawnAlly('skeleton', x, z);
      }
    },
  },
  {
    id: 'corpse', name: '尸爆', cost: 20, cd: 1.2, unlock: 3, anim: 'cast_nova', windup: 0.22, lock: 0.45,
    desc: '引爆目标附近的尸体，每具尸体对周围造成剧毒爆炸。',
    icon: ICON('<circle cx="20" cy="20" r="11" fill="#5aa040"/><circle cx="20" cy="20" r="6" fill="#c8ff9a"/><path d="M8 32 l6 -6 M32 32 l-6 -6 M8 8 l6 6 M32 8 l-6 6" stroke="#9aff6a" stroke-width="2.5"/>', ['#2a4a1a', '#081205']),
    fire(game, pl, aim) {
      const list = game.corpses().filter((c) => c.pos.distanceTo(aim) < 10).sort((a, b) => a.pos.distanceTo(aim) - b.pos.distanceTo(aim)).slice(0, 5);
      if (!list.length) { game.ui.number(pl.pos, '附近没有尸体', 'info'); pl.mp += 20; pl.cds.corpse = 0; return; }
      list.forEach((c, i) => game.after(i * 0.08, () => {
        const p = c.pos.clone();
        c.consume();
        game.fx.explode(p, 4.2, 'poison', i === 0 ? 0.7 : 0.3);
        game.fx.chunks(p, 'gore', 5, 0.8); game.fx.chunks(p, 'bone', 4, 0.9);
        game.particles.emit({ pos: { x: p.x, y: 0.8, z: p.z }, count: 24, speed: [3, 10], up: 4, life: [0.4, 0.9], size: [0.2, 0.45], c0: [1.2, 0.1, 0.06], c1: [0.3, 0, 0], gravity: 16, tex: 'dirt' });
        game.audio.play('corpseburst', p);
        for (const e of game.enemiesNear(p, 4.2)) game.hurtEnemy(e, pl.roll(50, 65, 'poison'), { pal: 'poison', from: p, knock: 2 });
      }));
    },
  },
  {
    id: 'deathnova', name: '死亡新星', cost: 40, cd: 8, unlock: 4, anim: 'cast_nova', windup: 0.26, lock: 0.55, self: true,
    desc: '释放剧毒新星，伤害并减速周围的敌人。',
    icon: ICON('<circle cx="20" cy="20" r="13" fill="none" stroke="#8aff5a" stroke-width="3"/><circle cx="20" cy="20" r="6" fill="#4a8a2a"/><path d="M20 3 V9 M20 31 V37 M3 20 H9 M31 20 H37" stroke="#c8ff9a" stroke-width="2"/>', ['#2a4a1a', '#061205']),
    fire(game, pl) {
      const p = pl.pos.clone(), R = 8, P = PALETTE.poison;
      game.audio.play('nova', p, 0.7); game.audio.play('corpseburst', p, 0.45);
      game.fx.ground(p, { tex: 'ring', color: P.hot, r0: 0.5, r1: R, dur: 0.45, opacity: 0.6 });
      game.fx.ground(p, { tex: 'magic2', color: P.hot, r0: R * 0.8, r1: R, dur: 0.3, hold: 0.8, spin: 2 });
      game.particles.emit({ pos: { x: p.x, y: 0.6, z: p.z }, count: 50, radius: 0.8, ring: true, outward: true, speed: [10, 20], life: [0.4, 0.7], size: [0.9, 1.7], c0: P.hot.map((v) => v * 0.6), c1: P.cool, drag: 2.5, tex: 'smoke' });
      game.smoke.emit({ pos: { x: p.x, y: 0.5, z: p.z }, count: 24, radius: R * 0.7, flat: true, speed: [0.3, 1.2], life: [1.4, 2.6], size: [3, 5], c0: [0.25, 0.45, 0.15], c1: [0.1, 0.2, 0.06], alpha: 0.3, tex: 'smoke', grow1: 1.5 });
      game.gfx.flash(p, P.light, 300, 0.5, 26);
      for (const e of game.enemiesNear(p, R)) { game.hurtEnemy(e, pl.roll(45, 60, 'poison'), { pal: 'poison', from: p }); e.slowFor?.(3); }
    },
  },
  {
    id: 'wraithstep', name: '骨灵步', cost: 10, cd: 3.5, unlock: 1, anim: null, windup: 0, lock: 0.12, instant: true,
    desc: '化作亡魂瞬移到鼠标所指的位置。',
    icon: ICON('<path d="M10 30 Q14 8 20 8 Q26 8 30 30 l-4 -4 -3 4 -3 -4 -3 4 -3 -4z" fill="#b8ffd0aa"/><circle cx="17" cy="16" r="2" fill="#0a2"/><circle cx="23" cy="16" r="2" fill="#0a2"/>', ['#1a4a2a', '#051208']),
    fire(game, pl, aim) { teleport(game, pl, aim, 'poison', 'blink'); },
  },
];

const UP = new THREE.Vector3(0, 1, 0);
export const KEYS = ['左键', '右键', 'Q', 'W', 'E', '空格'];
export const CLASS_SKILLS = { mage: MAGE, warrior: WARRIOR, ranger: RANGER, paladin: PALADIN, necro: NECRO };
for (const list of Object.values(CLASS_SKILLS)) list.forEach((s, i) => { s.key = KEYS[i]; s.slot = i; });
export const SKILL = Object.fromEntries(Object.values(CLASS_SKILLS).flat().map((s) => [s.id, s]));

// Rank effects capture their rank at cast time so delayed/projectile damage remains correct.
const ULTIMATES = {
  warrior: ['天崩地裂','atk_leap','跃起重砸，六道熔岩裂缝持续灼烧。','追加一次震击。','8 秒狂神：攻速 +30%，免疫控制。'],
  ranger: ['万箭归宗','bow_power','大范围箭雨持续 4 秒，标记敌人易伤 20%。','箭雨附带燃烧。','灵鹰最后俯冲爆炸。'],
  mage: ['炎狱降临','cast_meteor','炎狱之门落下三颗陨石并卷起火龙卷。','陨石数量提高为五颗。','留下持续 6 秒的熔岩火海。'],
  paladin: ['天罚','atk_cast','八道圣光依次轰击敌人，每次命中回复生命。','光柱同时眩晕敌人。','展开圣光之翼，6 秒无敌。'],
  necro: ['亡者大军','cast_meteor','召唤 6 具骷髅战士与 1 具骨像魔，持续 15 秒。','额外召唤 2 具骷髅法师。','骨像魔消散时自爆。'],
};
function areaDamage(g,p,c,r,a,b,pal,stun=0) {
  for(const e of g.enemiesNear(c,r)) g.hurtEnemy(e,p.roll(a,b,pal),{pal,from:c,stun});
}
function burning(g,p,c,r,seconds,damage=8,pal='fire',visual=true) {
  let t=0,tick=0;
  if(visual)g.fx.glyph(c,{tex:'magic2',color:pal==='fire'?[2.4,0.7,0.1]:[0.4,1.6,0.4],r,dur:seconds,spin:0.3});
  g.fx.add(dt=>{t+=dt; tick+=dt; if(tick>=0.5){tick=0;areaDamage(g,p,c,r,damage,damage*1.3,pal);}return t<seconds;});
}
function ultimate(g,p,aim,cls,rank) {
  const c=aim.clone().setY(0), origin=p.pos.clone();
  // Avoid targeting another room beyond the view; all casts remain within local encounter range.
  if(c.distanceTo(origin)>24) c.copy(origin).add(aim.clone().sub(origin).setY(0).normalize().multiplyScalar(24));
  g.audio.play(cls==='mage'?'meteorfall':cls==='necro'?'raise':cls==='ranger'?'arrow':cls==='warrior'?'warcry':'bell',origin,0.7);
  if(cls==='warrior')c.copy(g.level.displacement(origin,c,p.radius??.6));
  ultimateOpening(g,p,c,cls,rank);
  if(cls==='warrior') {
    let jumpTime=0;p.invuln=Math.max(p.invuln,0.8);p.lock=Math.max(p.lock??0,.75);
    g.fx.add(dt=>{jumpTime+=dt;const k=Math.min(1,jumpTime/0.7);p.pos.lerpVectors(origin,c,k);p.pos.y=Math.sin(k*Math.PI)*5;if(k>=1){p.pos.y=0;return false;}return true;},()=>{p.pos.y=0;});
    const hit=()=>{g.fx.explode(c,9,'fire',.75);g.fx.chunks(c,'rock',18,1.5);areaDamage(g,p,c,11,100,130,'fire');};
    g.fx.telegraph(c,11,0.7,[3,0.5,0.1]);g.after(0.7,hit);
    for(let i=0;i<6;i++) for(let j=1;j<=5;j++) g.after(0.7+j*0.12,()=>{
      const q=c.clone().add(V(Math.sin(i*Math.PI/3)*j*2,0,Math.cos(i*Math.PI/3)*j*2));
      burning(g,p,q,1.5,4,9,'fire',false);
    });
    if(rank>=3)g.after(1.6,hit);
    if(rank>=5)p.buff('berserk',8,{immuneControl:true});
  } else if(cls==='ranger') {
    for(let i=0;i<16;i++)g.after(i*0.25,()=>{
      for(const e of g.enemiesNear(c,12))e.markedUntil=g.time+1;
      areaDamage(g,p,c,12,9,13,'steel');
      if(rank>=3 && i%4===0)burning(g,p,c,12,1,5,'fire',false);
    });
    if(rank>=5)g.after(4,()=>{g.fx.shockwave(c,{r1:18,dur:.5,strength:.025});g.fx.explode(c,12,'fire',2);areaDamage(g,p,c,12,130,170,'fire');});
  } else if(cls==='mage') {
    for(let i=0;i<(rank>=3?5:3);i++){
      const q=c.clone().add(V(rnd(-5,5),0,rnd(-5,5))),delay=.6+i*.45;
      meteorDescent(g,q,delay);
      g.after(delay,()=>{g.fx.explode(q,7,'fire',1.2);g.fx.shockwave(q,{r1:13,dur:.5,strength:.022});g.gfx.addShake(.4);areaDamage(g,p,q,7,85,115,'fire');});
    }
    burning(g,p,c,9,3,18,'fire',false);
    if(rank>=5)g.after(3,()=>burning(g,p,c,11,6,24));
  } else if(cls==='paladin') {
    for(let i=0;i<8;i++)g.after(i*0.28,()=>{
      const enemies=g.enemiesNear(c,16), q=(enemies[i%Math.max(1,enemies.length)]?.pos??c).clone();
      judgmentBeam(g,q);g.fx.explode(q,3,'holy',0.35);
      if(g.enemiesNear(q,4).length)p.heal(p.maxHp*0.035);
      areaDamage(g,p,q,4,55,75,'holy',rank>=3?1.5:0);
    });
    if(rank>=5)p.buff('divineWings',6,{});
  } else {
    const count=rank>=3?9:7;
    for(let i=0;i<count;i++) {
      const q=origin.clone().add(V(Math.sin(i*6.28/count)*3,0,Math.cos(i*6.28/count)*3));
      if(g.level.blocked(q.x,q.z,0.8))q.copy(origin);
      const a=g.spawnAlly(i===6?'golem':i>6?'mage':'skeleton',q.x,q.z);
      a.life=15;a.army=true;a.damageMul=rank>=4?1.4:rank>=2?1.2:1;
      if(i===6){a.root.scale.multiplyScalar(2);a.maxHp*=4;a.hp=a.maxHp;a.damageMul*=3;a.explodeOnDeath=rank>=5;boneGolemRegalia(g,a);}
      summonSigil(g,q,i===6);
    }
  }
}
for(const [cls,list] of Object.entries(CLASS_SKILLS)) {
  const [name,anim,desc,third,fifth]=ULTIMATES[cls];
  list.push({id:'ultimate_'+cls,name,anim,desc,cost:0,cd:60,unlock:10,windup:0.45,lock:0.8,
    icon:ultimateIcon(cls),
    fire(g,p,aim){ultimate(g,p,aim,cls,p.rank(this));},key:'R',slot:6,third,fifth});
  list.forEach((s,i)=>{
    s.unlock=[1,1,2,4,6,1,10][i];
    if(!canUpgradeSlot(i)){s.rankDescriptions=[s.desc];return;}
    s.third??='冷却时间缩短 15%。';
    s.fifth??='余烬回响：0.3 秒后追加一次无消耗的技能效果。';
    s.rankDescriptions=[s.desc,'伤害、治疗和护盾效果比第 1 阶提高 20%。',s.third,'伤害、治疗和护盾效果比第 1 阶提高 40%。',s.fifth];
    const fire=s.fire;
    s.fire=function(g,p,aim){
      const rank=p.rank(s), mul=rank>=4?1.4:rank>=2?1.2:1;
      const ranked=new Proxy(p,{get(target,key){
        if(key==='roll')return(a,b,school)=>{const result=target.roll(a,b,school);return {...result,v:Math.round(result.v*mul)};};
        if(key==='heal')return(n,quiet)=>target.heal(n*mul,quiet);
        if(key==='buff')return(name,dur,data)=>target.buff(name,dur,{...data,...(data.dmg?{dmg:data.dmg*mul}:{}),...(data.armor?{armor:data.armor*mul}:{})});
        return Reflect.get(target,key);
      }});
      const beforeAllies=g.allies.length;
      fire.call(s,g,ranked,aim);
      if(s.id==='raise')for(const a of g.allies.slice(beforeAllies))a.damageMul=mul;
      if(s.id==='shield')p.shield*=mul;
      if(rank>=5 && i<6)g.after(0.3,()=>{if(p.alive)fire.call(s,g,ranked,aim);});
    };
    SKILL[s.id]=s;
  });
}
KEYS.push('R');
