import * as THREE from 'three';
import { saltUpdate,saltPoise } from './salt.js';
import { dressSaltEnemy } from './salt-art.js';
import { plagueUpdate, poisonPool, addStagCrown, addTotem } from './encounters.js';
import {ironUpdate,ironPoise,hasStandard} from './iron.js';
import {dressIronEnemy} from './iron-art.js';
import { stagPoise } from './stag.js';
import { dressPlagueEnemy } from './plague-art.js';
import { Actor } from './actor.js';
import { shoot } from './skills.js';
import { PALETTE } from './fx.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export const ENEMY_TYPES = {
  saltdead:{model:'warrior',name:'盐壳行尸',hp:920,dmg:[38,53],speed:4.1,range:2.6,cd:1.7,xp:230,atkSpeed:1.4,gold:[22,35],episode:4},
  sandweaver:{model:'mage',name:'沙匠',hp:820,dmg:[42,57],speed:4.5,range:23,keep:15,ranged:true,proj:'ice',cd:2.8,xp:270,atkSpeed:1.5,gold:[25,39],episode:4},
  saltfiend:{model:'elite',name:'蓝皮盐魔',hp:1750,dmg:[51,70],speed:6.2,range:3.3,cd:1.7,xp:330,atkSpeed:1.5,scale:1.12,gold:[30,48],episode:4},
  tombguard:{model:'warrior',name:'盐墓守卫',hp:1400,dmg:[47,64],speed:4.8,range:3.2,cd:1.5,xp:280,atkSpeed:1.5,scale:1.1,gold:[26,42],episode:4},
  saltseal:{model:'mage',name:'共鸣盐晶',hp:950,dmg:[0,0],speed:0,range:0,cd:99,xp:130,atkSpeed:1,radius:.9,gold:[15,20],episode:4},
  saltpriest:{model:'boss',name:'封尸祭司 · 纳赫',hp:11000,dmg:[65,85],speed:3.8,range:20,cd:2.5,xp:1200,atkSpeed:1.3,scale:1.25,radius:.9,boss:true,tough:true,gold:[260,340],episode:4},
  saltqueen:{model:'saltqueen',name:'盐之女王 · 瑟芮娅',hp:36000,dmg:[78,105],speed:4.3,range:22,cd:2.5,xp:2500,atkSpeed:1.4,scale:1.6,radius:1,boss:true,tough:true,gold:[650,850],episode:4},

  rebel:{model:'rebel',name:'叛军盾卒',hp:620,dmg:[32,43],speed:4.7,range:2.7,cd:1.6,xp:115,atkSpeed:1.5,gold:[15,24],episode:3},
  raider:{model:'raider',name:'铁冠掠夺者',hp:490,dmg:[38,50],speed:6.2,range:2.7,cd:1.4,xp:110,atkSpeed:1.6,gold:[16,25],episode:3},
  arbalist:{model:'arbalist',name:'王庭弩手',hp:400,dmg:[29,39],speed:4.5,range:26,keep:17,ranged:true,proj:'arrow',cd:3,xp:125,atkSpeed:1.4,gold:[16,27],episode:3},
  assassin:{model:'assassin',name:'兜帽影刃',hp:470,dmg:[33,44],speed:7.4,range:2.5,cd:1.2,xp:135,atkSpeed:1.8,gold:[18,29],episode:3},
  berserker:{model:'berserker',name:'血誓狂战士',hp:1100,dmg:[42,57],speed:5.8,range:3.2,cd:1.5,xp:180,atkSpeed:1.5,gold:[25,38],episode:3},
  captain:{model:'captain',name:'叛军督军 · 奥伦',hp:3600,dmg:[43,58],speed:4.8,range:3,cd:1.5,xp:450,atkSpeed:1.6,tough:true,scale:1.2,gold:[140,190],episode:3},
  warbanner:{model:'rebel',name:'铁冠军阵战旗',hp:650,dmg:[0,0],speed:0,range:0,cd:99,xp:120,atkSpeed:1,radius:.55,gold:[20,30],episode:3},
  ballista:{model:'rebel',name:'关隘重弩',hp:1300,dmg:[60,85],speed:0,range:38,cd:5,xp:220,atkSpeed:1,proj:'arrow',radius:1.6,gold:[50,75],episode:3},
  blackknight:{model:'blackknight',name:'黑铁骑士 · 维斯特',hp:7200,dmg:[55,72],speed:5,range:3.5,cd:1.8,xp:700,atkSpeed:1.5,tough:true,boss:true,scale:1.25,radius:.9,gold:[230,300],episode:3},
  ironking:{model:'ironking',name:'叛王 · 赫拉克留斯',hp:24000,dmg:[65,85],speed:5.2,range:4,cd:1.8,xp:1800,atkSpeed:1.5,tough:true,boss:true,proj:'arrow',scale:1.45,radius:1.05,gold:[500,650],episode:3},

  villager:{model:'warrior',name:'疫病村民',hp:300,dmg:[17,24],speed:3.4,range:2.2,cd:1.6,xp:50,atkSpeed:1.4,gold:[8,15],episode:2},
  goblin:{model:'minion',name:'腐沼地精',hp:220,dmg:[24,32],speed:7,range:2,cd:1.1,xp:48,atkSpeed:1.8,scale:0.7,gold:[6,13],episode:2},
  werewolf:{model:'elite',name:'畸变狼人',hp:820,dmg:[30,42],speed:7,range:3,cd:1.4,xp:100,atkSpeed:1.5,gold:[14,25],episode:2},
  witch:{model:'mage',name:'疫歌女巫',hp:460,dmg:[27,37],speed:4.4,ranged:true,range:22,keep:13,cd:2.4,xp:85,atkSpeed:1.5,proj:'poison',gold:[13,22],episode:2},
  totem:{model:'mage',name:'疫歌图腾',hp:500,dmg:[0,0],speed:0,range:0,cd:99,xp:80,atkSpeed:1,gold:[0,0],episode:2},
  butcher:{model:'elite',name:'缝合屠夫',hp:4800,dmg:[42,58],speed:3.3,range:3.4,cd:2.2,xp:350,atkSpeed:1.2,scale:1.7,radius:1.1,tough:true,gold:[140,180],episode:2},
  stag:{model:'stag',name:'荆冠鹿王',hp:17000,dmg:[62,86],speed:5.2,range:4,cd:2,xp:1000,atkSpeed:1.4,scale:1.65,radius:1.2,tough:true,boss:true,gold:[350,450],episode:2},
  minion: { model: 'minion', name: '腐骨尸鬼', hp: 55, dmg: [6, 10], speed: 6.2, range: 2.0, cd: 1.2, xp: 14, atkSpeed: 1.5, gold: [2, 8] },
  warrior: { model: 'warrior', name: '亡兵行尸', hp: 150, dmg: [12, 17], speed: 4.3, range: 2.4, cd: 1.6, xp: 28, atkSpeed: 1.6, gold: [6, 14] },
  rogue: { model: 'rogue', name: '掷骨怪', hp: 75, dmg: [9, 13], speed: 4.6, ranged: true, range: 17, keep: 9, cd: 2.3, xp: 22, atkSpeed: 1.3, proj: 'arrow', gold: [4, 12] },
  mage: { model: 'mage', name: '深渊术士', hp: 85, dmg: [14, 19], speed: 4.0, ranged: true, range: 18, keep: 10, cd: 2.7, xp: 32, atkSpeed: 1.4, proj: 'dark', gold: [8, 16] },
  elite: { model: 'elite', name: '骨卫队长 · 哈肯', hp: 800, dmg: [20, 28], speed: 4.9, range: 3.4, cd: 1.7, xp: 140, atkSpeed: 1.3, scale: 1.15, radius: 1.0, tough: true, glow: [0.08, 0.008, 0.0], gold: [50, 70] },
  boss: { model: 'boss', name: '缄默守墓人 · 莫尔丹', hp: 3000, dmg: [16, 22], speed: 3.4, ranged: true, range: 40, keep: 12, cd: 2.2, xp: 400, atkSpeed: 1.3, scale: 1.3, radius: 0.9, tough: true, boss: true, glow: [0.04, 0.0, 0.08], gold: [150, 200] },
};

export class Enemy extends Actor {
  constructor(game, type, x, z, opts = {}) {
    const T = ENEMY_TYPES[type];
    super(game, T.model, { scale: T.scale ?? 1 });
    this.level=opts.level??({minion:1,warrior:3,rogue:3,mage:4,elite:5,boss:6}[type]??6);
    this.T = T; this.type = type; this.name = opts.name??T.name; this.tag = opts.tag;
    this.pos.set(x, 0, z);
    this.home = new THREE.Vector3(x, 0, z);
    this.maxHp = T.hp; this.hp = T.hp;
    this.radius = T.radius ?? 0.6 * (T.scale ?? 1);
    const free=game.level.nearestFree(x,z,this.radius);if(free){this.pos.x=free.x;this.pos.z=free.z;this.home.copy(this.pos);}
    this.alive = true;
    this.state = opts.dormant ? 'dormant' : 'idle';
    this.asleep = !!opts.asleep;
    this.t = 0; this.cd = rnd(0.3, 1.2); this.repath = 0; this.path = [];
    this.frozen = 0; this.slow = 0; this.stagger = 0;
    this.knock = new THREE.Vector3();
    this.facing = this.root.rotation.y = opts.face ?? rnd(0, 6.28);
    if (T.glow) this.tintBase = new THREE.Color(...T.glow);
    this.tint = this.tintBase ?? null; this._dirty = true;
    if (this.state === 'dormant') { this.play('Skeletons_Inactive_Floor_Pose'); }
    else if (opts.spawnIn) { this.state = 'rising'; this.t = this.duration('Spawn_Ground') / 1.6; this.play('Spawn_Ground', { once: true, speed: 1.6 }); }
    else this.play(T.boss ? 'Idle_B' : 'Idle');
    if(T.episode===2){this.tintBase=new THREE.Color(0.005,0.015,0.001);this.tint=this.tintBase;this._dirty=true;dressPlagueEnemy(this);}
    if(T.episode===3)dressIronEnemy(this);
    if(T.episode===4)dressSaltEnemy(this);
    if(type==='stag')addStagCrown(this);if(type==='totem')addTotem(this);
    if (T.boss) { this.phase = 1; this.summons = 0; this.bossT = 2; }
  }

  voice() {if(this.T.episode===3)return 'warcry';return ({villager:'e_villager',goblin:'e_goblin',werewolf:'e_wolf',witch:'e_witch',butcher:'e_butcher',stag:'e_wolf'})[this.type]??'rattle';}
  dispose(){this.saltArtDispose?.();this.ironArtDispose?.();this.plagueArtDispose?.();const geos=new Set();for(const o of this.encounterArt??[]){o.traverse(m=>{if(m.geometry)geos.add(m.geometry);});o.removeFromParent();}for(const geo of geos)geo.dispose();for(const mat of this.encounterMaterials??[])mat.dispose();super.dispose();}

  stun(sec) { if(this.T.episode===4&&this.T.boss){saltPoise(this,Math.min(.75,sec*.45));return;}if(this.T.episode===3&&this.T.boss){ironPoise(this,Math.min(.8,sec*.6));return;}if(this.type==='stag'&&this.alive){stagPoise(this,Math.min(.75,sec*.5));return;}if (!this.alive || this.state === 'dormant' || this.T.boss) return; this.stagger = Math.max(this.stagger, this.T.tough ? sec * 0.4 : sec); if (this.state === 'attack') this.state = 'chase'; this.play('Hit_A', { once: true, restart: true, speed: 0.8, fade: 0.05 }); }

  slowFor(sec) { if (!this.alive) return; this.slow = Math.max(this.slow, sec); this.tint = new THREE.Color(0.05, 0.25, 0.04); }

  /** Corpse is used up by Corpse Explosion. */
  consume() { this.consumed = true; this.t = Math.max(this.t, 7.5); this.root.visible = false; }

  freeze(sec) {
    if (!this.alive) return;
    if(this.T.episode===4&&this.T.boss)saltPoise(this,Math.min(.5,sec*.3));
    if(this.T.episode===3&&this.T.boss)ironPoise(this,Math.min(.4,sec*.2));
    if(this.type==='stag')stagPoise(this,Math.min(.35,sec*.15));
    if (this.T.tough) { this.slow = Math.max(this.slow, sec * 1.2); }
    else { this.frozen = Math.max(this.frozen, sec * 0.6); this.slow = Math.max(this.slow, sec * 1.6); }
    this.tint = new THREE.Color(0.1, 0.35, 0.9);
  }

  takeDamage(v, { from, knock = 0, quiet = false, stun = 0 } = {}) {
    if (!this.alive || this.invulnerable) return false;
    if(this.asleep&&this.T.boss){this.game.story.onTrigger(({stag:'stag_intro',blackknight:'knight_intro',ironking:'king_intro',saltpriest:'priest_intro',saltqueen:'queen_intro'})[this.type]??'boss_intro');return false;}
    this.hp -= v;
    this.flash(1);
    this.lastHit = { from: from ? from.clone?.() ?? { ...from } : null, knock, v, quiet };
    if (this.state === 'dormant') this.awaken(true);
    if (this.state === 'idle') { this.state = 'chase'; }
    if (from && knock && !this.T.tough) { const d = this.pos.clone().sub(from).setY(0).normalize(); this.knock.addScaledVector(d, knock * 4); }
    if (!this.T.tough && !quiet && this.state !== 'rising' && Math.random() < 0.55) {
      this.stagger = 0.28; if (this.state === 'attack') this.state = 'chase';
      this.play(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', { once: true, restart: true, speed: 1.6, fade: 0.05 });
    }
    if (stun && this.hp > 0) this.stun(stun);
    if (this.hp <= 0) this.die();
    return true;
  }

  die() {
    const g = this.game;
    this.alive = false; this.hp = 0; this.state = 'dead'; this.t = 0;
    // death launch: the body is thrown away from the killing blow, scaled by overkill and knockback
    const H = this.lastHit;
    if (!this.T.tough && !this.T.boss && H) {
      const src = H.from ?? g.player.pos;
      const d = new THREE.Vector3(this.pos.x - src.x, 0, this.pos.z - src.z);
      if (d.lengthSq() < 1e-4) d.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      d.normalize();
      const force = Math.min(1.6, 0.35 + (H.v / this.maxHp) * 0.6 + (H.knock ?? 0) * 0.28);
      this.fly = { v: d.multiplyScalar(3 + force * 5.5), vy: 2.2 + force * 4.2, air: true, pitch: 0, bounces: 0 };
      this.face(src.x, src.z);
      this.root.rotation.order = 'YXZ';
      if (force > 0.9) g.gfx.kick?.(this.fly.v, 0.25);
    }
    this.tint = null; this._dirty = true;
    this.play(Math.random() < 0.5 ? 'Death_A' : 'Death_B', { once: true, fade: 0.08, speed: this.T.boss ? 0.6 : 1.1 });
    g.audio.play(this.T.episode===3?'hurt':this.T.episode===2?this.voice():'bonedeath', this.pos, this.T.tough ? 1.1 : 0.65);
    g.particles.emit({ pos: { x: this.pos.x, y: 1.1 * this.scale, z: this.pos.z }, count: 16, speed: [2, 7], life: [0.3, 0.8], size: [0.2, 0.5], c0: PALETTE.bone.core, c1: PALETTE.bone.cool, gravity: 14 });
    g.smoke.emit({ pos: { x: this.pos.x, y: 0.6, z: this.pos.z }, count: 6, radius: 0.5, speed: [0.3, 1.2], life: [0.6, 1.3], size: [1.2, 2.4], c0: [0.4, 0.38, 0.33], c1: [0.2, 0.19, 0.17], alpha: 0.25, grow0: 0.5, grow1: 1.5 });
    if(this.type==='villager')poisonPool(g,this.pos,2.5,5,12);
    g.onEnemyKilled(this);
  }

  awaken(fast = false) {
    if (this.state !== 'dormant') return;
    this.state = 'rising';
    const sp = fast ? 2.6 : 1.7;
    this.t = this.duration('Skeletons_Awaken_Floor') / sp;
    this.play('Skeletons_Awaken_Floor', { once: true, speed: sp, fade: 0.05 });
    this.game.audio.play('awaken', this.pos);
    this.game.smoke.emit({ pos: { x: this.pos.x, y: 0.2, z: this.pos.z }, count: 8, radius: 0.8, flat: true, speed: [0.3, 1.2], life: [0.6, 1.4], size: [1, 2.2], c0: [0.22, 0.2, 0.17], c1: [0.1, 0.09, 0.08], alpha: 0.3, up: 0.8, grow0: 0.5, grow1: 1.5 });
    this.game.particles.emit({ pos: { x: this.pos.x, y: 0.3, z: this.pos.z }, count: 14, radius: 0.6, speed: [0.2, 1], up: 2.2, life: [0.5, 1.1], size: [0.2, 0.5], c0: [0.4, 2.2, 1.2], c1: [0, 0.4, 0.2] });
  }

  _walk(tx, tz, dt, speed) {
    const g = this.game;
    this.repath -= dt;
    if (this.repath <= 0 || !this.path.length) { this.repath = 0.45 + Math.random() * 0.2; this.path = g.level.findPath(this.pos.x, this.pos.z, tx, tz); }
    const wp = this.path[0];
    if (!wp) return;
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.4) { this.path.shift(); return; }
    const s = Math.min(d, speed * dt);
    g.level.move(this.pos, (dx / d) * s, (dz / d) * s, this.radius);
    this.facing = Math.atan2(dx, dz);
  }

  update(dt) {
    const g = this.game, T = this.T;
    // target: the player, or a summoned minion that is closer
    let pl = g.player;
    if (!T.boss && this.state !== 'dormant') { let bd = this.pos.distanceTo(pl.pos) - 2; for (const a of g.allies) if (a.alive && a.state !== 'rising') { const d = this.pos.distanceTo(a.pos); if (d < bd) { bd = d; pl = a; } } }
    this.tgt = pl;
    if (this.state === 'dead') {
      this.t += dt;
      const F = this.fly;
      if (F && (F.air || F.v.lengthSq() > 0.05)) {
        const nx = this.pos.x + F.v.x * dt, nz = this.pos.z + F.v.z * dt;
        if (g.level.blocked(nx, nz, this.radius * 0.8)) {
          // slam into the wall and drop
          F.v.multiplyScalar(-0.25);
          g.audio.play('e_hit', this.pos, 0.6); g.gfx.addShake(0.15);
          g.dusts?.emit({ pos: { x: this.pos.x, y: 1.2, z: this.pos.z }, count: 2, radius: 0.4, speed: [0.5, 2], life: [0.9, 1.4], size: [1.6, 2.4], c0: [0.6, 0.55, 0.5], c1: [0.45, 0.4, 0.36], alpha: 0.7, rot: [0, 6.28] });
        } else { this.pos.x = nx; this.pos.z = nz; }
        if (F.air) {
          F.vy -= 24 * dt; this.pos.y += F.vy * dt;
          F.pitch = Math.max(-0.55, F.pitch - dt * 1.8);
          if (this.pos.y <= 0) {
            this.pos.y = 0;
            if (F.vy < -4 && F.bounces < 1) { F.vy = -F.vy * 0.28; F.bounces++; } else F.air = false;
            g.dusts?.emit({ pos: { x: this.pos.x, y: 0.4, z: this.pos.z }, count: 2, radius: 0.5, flat: true, speed: [0.5, 2.2], life: [1, 1.6], size: [1.4, 2.4], c0: [0.62, 0.56, 0.5], c1: [0.45, 0.4, 0.36], alpha: 0.65, rot: [0, 6.28] });
          }
        } else {
          F.v.multiplyScalar(Math.max(0, 1 - dt * 7)); // skid along the floor
          F.pitch *= Math.max(0, 1 - dt * 6);
          if (Math.random() < 0.3) g.smoke.emit({ pos: { x: this.pos.x, y: 0.2, z: this.pos.z }, count: 1, speed: [0, 0.4], life: [0.5, 0.9], size: [0.6, 1.1], c0: [0.3, 0.27, 0.24], c1: [0.15, 0.13, 0.12], alpha: 0.35, tex: 'smoke' });
        }
        this.root.rotation.x = F.pitch;
      }
      if (this.t > 5) this.pos.y -= dt * 0.5;
      this.updateVisual(dt);
      return this.t < 8;
    }
    // status effects
    let ts = this.enraged?1.35:1;
    if (this.frozen > 0) { this.frozen -= dt; ts = 0; if (this.frozen <= 0) { g.audio.play('shatter', this.pos, 0.6); g.particles.emit({ pos: { x: this.pos.x, y: 1.2, z: this.pos.z }, count: 14, speed: [2, 6], life: [0.3, 0.6], size: [0.15, 0.4], c0: PALETTE.ice.core, c1: PALETTE.ice.cool, gravity: 12 }); } }
    else if (this.slow > 0) { this.slow -= dt; ts = 0.5; if (this.slow <= 0) { this.tint = this.tintBase ?? null; this._dirty = true; } }
    const edt = dt * ts;
    if (this.knock.lengthSq() > 0.01) { g.level.move(this.pos, this.knock.x * dt, this.knock.z * dt, this.radius); this.knock.multiplyScalar(Math.max(0, 1 - dt * 9)); }

    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, dist = Math.max(0.01, Math.hypot(dx, dz));
    const active = pl.alive && !g.cinematic;

    if(active&&saltUpdate(this,this.T.boss?dt:edt,dist)){this.mixer.timeScale=ts;this.updateVisual(dt,9);return true;}
    if(active&&ironUpdate(this,this.T.boss?dt:edt,dist)){this.mixer.timeScale=ts;this.updateVisual(dt,9);return true;}
    if (active && plagueUpdate(this,this.type==='stag'?dt:edt,dist)){this.mixer.timeScale=this.type==='stag'?1:ts;this.updateVisual(dt,9);return true;}
    if (this.state === 'dormant') {
      if (active && dist < 11.5 && (dist < 6 || g.level.clear(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z, 0.3))) this.awaken();
    } else if (this.state === 'rising') {
      this.t -= edt;
      if (this.t <= 0) { this.state = 'chase'; g.audio.play(this.voice(), this.pos); }
    } else if (this.stagger > 0) {
      this.stagger -= edt;
    } else if (this.asleep || !active) {
      if (this.state !== 'attack') this.play(T.boss ? 'Idle_B' : 'Idle');
      this.state = 'idle';
    } else if (T.boss) {
      this._boss(edt, dist, dx, dz);
    } else if (this.state === 'idle') {
      if (dist < 17 && g.level.clear(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z, 0.3)) { this.state = 'chase'; g.audio.play(this.voice(), this.pos); }
    } else if (this.state === 'chase') {
      this.cd -= edt;
      const los = dist < T.range && (!T.ranged || g.level.clear(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z, 0.25));
      if (los && this.cd <= 0) {
        this.state = 'attack'; this.t = 0; this.didHit = false;
        this.face(pl.pos.x, pl.pos.z);
        this.atkSpeed = T.atkSpeed;
        this.play('attack', { once: true, restart: true, speed: this.atkSpeed, fade: 0.08 });
        if (!T.ranged) g.audio.play(T.episode===3?'swing':'e_claw', this.pos);
      } else if (T.ranged && los) {
        this.face(pl.pos.x, pl.pos.z);
        if (dist < T.keep - 3) { // back away
          const moved = g.level.move(this.pos, (-dx / dist) * T.speed * 0.7 * edt, (-dz / dist) * T.speed * 0.7 * edt, this.radius);
          this.play(moved ? 'Walking_Backwards' : 'Idle');
        } else this.play('Idle');
      } else if (dist > (T.ranged ? T.keep : T.range * 0.8)) {
        this._walk(pl.pos.x, pl.pos.z, edt, T.speed);
        this.locomote(T.tough ? 'Running_B' : 'Running_A', T.speed);
      } else { this.face(pl.pos.x, pl.pos.z); this.play('Idle'); }
      if (dist > 46) { this.state = 'idle'; this.play('Idle'); }
    } else if (this.state === 'attack') {
      this.t += edt;
      const dur = this.duration('attack') / this.atkSpeed;
      if (!this.didHit && this.t >= dur * this.releaseAt('attack')) {
        this.didHit = true;
        const dmg = rnd(T.dmg[0], T.dmg[1])*(T.ranged?1:hasStandard(this)?1.25:1)*(this.enraged?1.2:1);
        if (T.ranged) this._fire(dmg);
        else if (dist < T.range + 0.9&&g.level.clear(this.pos.x,this.pos.z,pl.pos.x,pl.pos.z,.1)) { pl.hurt(dmg, this.pos); g.audio.play('e_hit', pl.pos); if (T.tough) { g.gfx.addShake(0.4); g.fx.ring(pl.pos, { color: [2, 0.4, 0.1], r0: 0.3, r1: 2.5, dur: 0.3 }); } }
      }
      if (this.t >= dur * 0.92) { this.state = 'chase'; this.cd = T.cd * rnd(0.8, 1.2); }
    }

    // keep enemies from stacking
    for (const o of g.enemies) {
      if (o === this || !o.alive || o.state === 'dormant') continue;
      const ex = this.pos.x - o.pos.x, ez = this.pos.z - o.pos.z, d2 = ex * ex + ez * ez, min = this.radius + o.radius + 0.25;
      if (d2 < min * min && d2 > 1e-4 && this.state !== 'dormant') { const d = Math.sqrt(d2), push = (min - d) * 0.5; g.level.move(this.pos, (ex / d) * push, (ez / d) * push, this.radius); }
    }
    this.mixer.timeScale = ts;
    this.updateVisual(dt, 9);
    return true;
  }

  _fire(dmg, dirOverride, speedMul = 1) {
    const g = this.game, pl = this.tgt ?? g.player, T = this.T;
    const from = new THREE.Vector3(this.pos.x + Math.sin(this.facing) * 0.8 * this.scale, 1.4 * this.scale, this.pos.z + Math.cos(this.facing) * 0.8 * this.scale);
    const dir = dirOverride ?? new THREE.Vector3(pl.pos.x - from.x, 0, pl.pos.z - from.z).normalize();
    if (T.proj === 'arrow') {
      g.audio.play(T.episode===3?'arrow':'e_throw', this.pos);
      const mesh = g.assets.prop('Skeleton_Arrow');
      mesh.rotation.set(0, Math.atan2(dir.x, dir.z), 0); mesh.rotateX(Math.PI / 2);
      g.gfx.scene.add(mesh);
      shoot(g, { team: 'enemy', pos: from, vel: dir.multiplyScalar(24), pal: 'bone', mesh, r: 0.5,
        trail: (dt, pr) => { if (Math.random() < 0.5) g.particles.emit({ pos: pr.pos, count: 1, speed: [0, 0.3], life: [0.15, 0.3], size: [0.15, 0.3], c0: [0.5, 0.5, 0.45], c1: [0.1, 0.1, 0.1] }); },
        onHit: (hit, pos) => { if (hit) { hit.hurt(dmg*(hasStandard(this)?1.25:1), pos); g.audio.play('e_hit', pos); } g.particles.emit({ pos, count: 6, speed: [1, 4], life: [0.2, 0.4], size: [0.12, 0.3], c0: PALETTE.bone.hot, c1: PALETTE.bone.cool, gravity: 8 }); } });
    } else {
      const pal=T.proj==='poison'?'poison':T.proj==='ice'?'ice':'dark';
      g.audio.play(T.proj==='poison'?'e_poison':'darkbolt', this.pos);
      g.particles.emit({ pos: from, count: 8, speed: [1, 4], life: [0.2, 0.5], size: [0.3, 0.7], c0: PALETTE.dark.core, c1: PALETTE.dark.cool });
      shoot(g, { team: 'enemy', pos: from, vel: dir.multiplyScalar(15 * speedMul), pal, size: 0.3 * Math.min(1.5, this.scale), r: 0.6, light: 40, life: 3.2,
        onHit: (hit, pos) => { g.fx.spark(pos, pal, 12); if (hit) { hit.hurt(dmg*(hasStandard(this)?1.25:1), pos); g.audio.play('e_hit', pos); } } });
    }
  }

  // ------------------------------------------------------------ boss brain
  _boss(dt, dist, dx, dz) {
    const g = this.game, pl = g.player, T = this.T;
    const hpK = this.hp / this.maxHp;
    this.phase = hpK < 0.5 ? 2 : 1;
    if (this.state === 'attack') {
      this.t -= dt;
      if (this.queue) for (const q of this.queue) if (!q.done && this.t <= q.at) { q.done = true; q.fn(); }
      if (this.t <= 0) { this.state = 'chase'; this.invulnerable = false; }
      return;
    }
    this.state = 'chase';
    this.face(pl.pos.x, pl.pos.z);
    // drift to keep distance
    if (dist > 17) { this._walk(pl.pos.x, pl.pos.z, dt, T.speed); this.locomote('Walking_A', T.speed); }
    else if (dist < 7) { const mv = g.level.move(this.pos, (-dx / dist) * T.speed * dt, (-dz / dist) * T.speed * dt, this.radius); this.play(mv ? 'Walking_Backwards' : 'Idle_B'); }
    else this.play('Idle_B');

    // speed argument kept for readability of the call sites; the clip is stretched to fill `dur`
    const begin = (anim, _speed, dur, queue) => { this.state = 'attack'; this.t = dur; this.queue = queue.map(([at, fn]) => ({ at: dur - at, fn, done: false })); this.play(anim, { once: true, restart: true, speed: Math.max(0.5, this.duration(anim) / dur), fade: 0.1 }); };
    const aim = (spread) => { const a = Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z) + spread; this.facing = Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z); return new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); };
    const dmg = () => rnd(T.dmg[0], T.dmg[1]);

    // summon thresholds
    const need = hpK < 0.33 ? 2 : hpK < 0.68 ? 1 : 0;
    if (this.summons < need) {
      this.summons++;
      this.invulnerable = true;
      g.audio.play('roar', this.pos); g.audio.play('e_summon', this.pos);
      g.ui.toast(this.summons === 1 ? '莫尔丹：「起来——都给我起来！」' : '莫尔丹：「钟声……不会停！」');
      g.fx.ring(this.pos, { color: PALETTE.dark.core, r0: 1, r1: 14, dur: 0.9 });
      g.gfx.addShake(0.7);
      begin('Spellcast_Summon', 2.4, 1.8, [[0.9, () => {
        const n = this.summons === 1 ? 4 : 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.283 + rnd(0, 1), r = rnd(5, 8);
          let x = pl.pos.x + Math.cos(a) * r, z = pl.pos.z + Math.sin(a) * r;
          if (g.level.blocked(x, z, 1)) { x = this.pos.x + Math.cos(a) * 3; z = this.pos.z + Math.sin(a) * 3; }
          if (g.level.blocked(x, z, 1)) continue;
          g.spawnEnemy(i === 0 && this.summons === 2 ? 'warrior' : 'minion', x, z, { spawnIn: true, tag: 'summon' });
          g.fx.pillar({ x, y: 0, z }, 'dark', 30, 5);
        }
      }]]);
      return;
    }

    this.bossT -= dt;
    if (this.bossT > 0) return;
    this.bossT = this.phase === 2 ? rnd(1.1, 1.7) : rnd(1.7, 2.4);
    const roll = Math.random();
    if (dist < 5.5 && roll < 0.7) {
      // teleport away
      begin('Spellcast_Raise', 3, 0.7, [[0.3, () => {
        const spots = [[12, 4], [20, 4], [11, 8], [21, 8], [16, 10], [13, 11], [19, 11]].map(([x, z]) => g.level.center(x, z)).filter((p) => p.distanceTo(pl.pos) > 12&&!g.level.blocked(p.x,p.z,this.radius));
        const to = spots[(Math.random() * spots.length) | 0] ?? this.home;
        g.fx.pillar(this.pos, 'dark', 50, 7); g.audio.play('e_blink', this.pos);
        this.pos.set(to.x, 0, to.z);
        g.fx.pillar(this.pos, 'dark', 50, 7);
      }]]);
    } else if (roll < 0.4) {
      // bolt volley
      const n = this.phase === 2 ? 5 : 3;
      begin('Spellcast_Shoot', 1.3, 0.75, [[0.3, () => { for (let i = 0; i < n; i++) this._fire(dmg(), aim((i - (n - 1) / 2) * 0.2), 1.15); }]]);
    } else if (roll < 0.75) {
      // bone spikes under the player
      const n = this.phase === 2 ? 5 : 3;
      const q = [];
      for (let i = 0; i < n; i++) q.push([0.25 + i * 0.32, () => {
        const p = pl.pos.clone().add(new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).multiplyScalar(i ? 2.2 : 0));
        g.fx.telegraph(p, 2.7, 0.85, [2.5, 0.4, 3.5]);
        g.after(0.85, () => {
          g.fx.spikes(p, { count: 11, radius: 2.4, color: 0xd8d2bd, emissive: 0x5a20a0, height: 3, hold: 0.5 });
          g.audio.play('e_spikes', p); g.gfx.addShake(0.3);
          g.particles.emit({ pos: { x: p.x, y: 0.3, z: p.z }, count: 24, radius: 1.5, flat: true, speed: [1, 5], up: 5, life: [0.3, 0.7], size: [0.3, 0.8], c0: PALETTE.dark.core, c1: PALETTE.dark.cool, gravity: 9 });
          if (pl.pos.distanceTo(p) < 2.9) pl.hurt(rnd(20, 27), p);
        });
      }]);
      begin('Spellcast_Raise', 1.6, 0.4 + n * 0.32, q);
    } else {
      // radial ring of bolts
      const n = this.phase === 2 ? 18 : 12, off = rnd(0, 1);
      begin('Spellcast_Long', 2.2, 1.15, [[0.55, () => {
        g.fx.ring(this.pos, { color: PALETTE.dark.core, r0: 0.5, r1: 6, dur: 0.4 });
        for (let i = 0; i < n; i++) { const a = off + (i / n) * 6.283; this._fire(dmg() * 0.8, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), 0.8); }
      }], ...(this.phase === 2 ? [[0.95, () => { for (let i = 0; i < n; i++) { const a = off + ((i + 0.5) / n) * 6.283; this._fire(dmg() * 0.8, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), 0.8); } }]] : [])]);
    }
  }
}
