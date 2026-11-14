import * as THREE from 'three';
import { Actor } from './actor.js';

/** Necromancer's summoned skeleton: follows the player, attacks the nearest enemy, crumbles after its time is up. */
export class Ally extends Actor {
  constructor(game, x, z, type = 'skeleton') {
    super(game, 'skeleton');
    this.summonType=type;
    const pl = game.player;
    this.pos.set(x, 0, z);
    this.radius = 0.55;
    const free=game.level.nearestFree(x,z,this.radius);if(free){this.pos.x=free.x;this.pos.z=free.z;}
    this.maxHp = Math.round(60 + pl.level * 14 + pl.stats.int * 1.5); this.hp = this.maxHp;
    this.alive = true; this.ally = true;
    this.life = 30; this.cd = 0.4; this.state = 'rising'; this.t = this.duration('Spawn_Ground') / 1.8;
    this.target = null; this.repath = 0; this.path = [];
    this.tint = new THREE.Color(0.02, 0.12, 0.05); this._dirty = true;
    this.play('Spawn_Ground', { once: true, speed: 1.8 });
    this.facing = pl.facing;
  }

  expire() { if (this.alive) { this.hp = 0; this.die(); } }

  hurt(dmg) {
    if (!this.alive) return;
    this.hp -= dmg; this.flash(0.8);
    if (this.hp <= 0) this.die();
  }

  die() {
    const g = this.game;
    if(this.explodeOnDeath){g.fx.explode(this.pos,8,'poison',1.5);for(const e of g.enemiesNear(this.pos,8))g.hurtEnemy(e,g.player.roll(90,120,'bone'),{pal:'poison',ally:true});}
    this.alive = false; this.state = 'dead'; this.t = 0;
    this.play('Death_A', { once: true, speed: 1.3 });
    g.particles.emit({ pos: { x: this.pos.x, y: 1, z: this.pos.z }, count: 16, speed: [1, 4], life: [0.4, 0.9], size: [0.4, 0.9], c0: [0.6, 2, 0.8], c1: [0, 0.2, 0.05], tex: 'smoke', up: 1 });
    g.audio.play('bonedeath', this.pos, 0.5);
  }

  _walk(tx, tz, dt, speed) {
    const g = this.game;
    this.repath -= dt;
    if (this.repath <= 0 || !this.path.length) { this.repath = 0.5; this.path = g.level.findPath(this.pos.x, this.pos.z, tx, tz); }
    const wp = this.path[0];
    if (!wp) return false;
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.4) { this.path.shift(); return true; }
    const s = Math.min(d, speed * dt);
    g.level.move(this.pos, (dx / d) * s, (dz / d) * s, this.radius);
    this.facing = Math.atan2(dx, dz);
    return true;
  }

  update(dt) {
    const g = this.game, pl = g.player;
    if (this.state === 'dead') { this.t += dt; if (this.t > 2) this.pos.y -= dt; this.updateVisual(dt); return this.t < 4; }
    this.life -= dt;
    if (this.life <= 0) { this.expire(); return true; }
    if (this.state === 'rising') { this.t -= dt; if (this.t <= 0) this.state = 'idle'; this.updateVisual(dt); return true; }
    this.cd -= dt;
    if (!this.target || !this.target.alive || this.target.pos.distanceTo(pl.pos) > 18) {
      this.target = null; let bd = 13;
      for (const e of g.enemies) if (e.alive && e.state !== 'dormant' && !e.asleep) { const d = e.pos.distanceTo(this.pos); if (d < bd) { bd = d; this.target = e; } }
    }
    const t = this.target;
    if (this.state === 'attack') {
      this.t += dt;
      const dur = this.duration('attack') / 1.5;
      if (!this.hit && this.t > dur * this.releaseAt('attack')) {
        this.hit = true;
        if (t && t.alive && t.pos.distanceTo(this.pos) < 2.8 + t.radius&&g.level.clear(this.pos.x,this.pos.z,t.pos.x,t.pos.z,.1)) { g.hurtEnemy(t, pl.roll(9*(this.damageMul??1), 13*(this.damageMul??1), 'bone'), { pal: 'bone', from: this.pos, quiet: true, ally: true }); g.audio.play('hit', this.pos, 0.4); }
      }
      if (this.t > dur * 0.9) this.state = 'idle';
    } else if (t) {
      const d = t.pos.distanceTo(this.pos) - t.radius;
      if(this.summonType==='mage' && d<13 && this.cd<=0){this.cd=1.5;g.fx.column(t.pos,{color:[0.4,1.6,0.6],r:0.4,h:4,dur:0.3});g.hurtEnemy(t,pl.roll(14,20,'bone'),{pal:'bone',ally:true});}
      else if (d < 2.2 && this.cd <= 0) { this.state = 'attack'; this.t = 0; this.hit = false; this.cd = 1.2; this.face(t.pos.x, t.pos.z); this.play('attack', { once: true, restart: true, speed: 1.5 }); }
      else if (d >= 2.2) { this._walk(t.pos.x, t.pos.z, dt, 6.5); this.locomote('Running_A', 6.5); }
      else { this.face(t.pos.x, t.pos.z); this.play('Idle'); }
    } else if (this.pos.distanceTo(pl.pos) > 4.5) { this._walk(pl.pos.x, pl.pos.z, dt, 7.4); this.locomote('Running_A', 7.4); }
    else this.play('Idle');
    this.updateVisual(dt, 10);
    return true;
  }
}
