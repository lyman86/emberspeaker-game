import * as THREE from 'three';
import { clipMap } from '../core/assets.js';

/** Animated character wrapper shared by the player, NPCs and enemies. */
export class Actor {
  constructor(game, model, { scale = 1, hide = [] } = {}) {
    this.game = game;
    this.key = model;
    const { root, clips, mats, release, scale: base } = game.assets.character(model);
    this.release = release;
    this.model = root;
    this.mats = mats;
    this.root = new THREE.Group();
    this.root.add(root);
    root.scale.setScalar(scale * base);
    this.scale = scale;
    this.clips = clipMap(clips);
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    this.current = null;
    this.pos = this.root.position;
    this.facing = 0;
    this.flashT = 0;
    this.tint = null;
    for (const n of hide) { const o = root.getObjectByName(n); if (o) o.visible = false; }
  }

  bone(name) { return this.model.getObjectByName(name); }

  attach(boneName, object) { const b = this.bone(boneName); if (b) b.add(object); return object; }

  action(name) {
    if (!this.clips[name]) name = 'Idle';
    if (!this.actions[name]) {
      const clip = this.clips[name];
      if (!clip) return null;
      this.actions[name] = this.mixer.clipAction(clip);
    }
    return this.actions[name];
  }

  duration(name) { return (this.clips[name] ?? this.clips.Idle)?.duration ?? 1; }

  /** Fraction of the clip at which its blow / spell lands. */
  releaseAt(name, fallback = 0.4) { return this.release?.[name] ?? fallback; }

  /** Play once at the speed that makes the release frame land after `sec` seconds; returns the speed used. */
  playTimed(name, sec, opts = {}) {
    const speed = Math.max(0.4, Math.min(4, (this.duration(name) * this.releaseAt(name)) / Math.max(0.05, sec)));
    this.play(name, { once: true, restart: true, fade: 0.08, ...opts, speed });
    return speed;
  }

  /** Cross-fade to an animation. once=true plays a single time and holds the last frame. */
  play(name, { once = false, fade = 0.14, speed = 1, restart = false } = {}) {
    const a = this.action(name);
    if (!a) return;
    if (this.current === a && !restart) { if (!once) a.timeScale = speed; return; }
    a.reset();
    a.timeScale = speed;
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
    this.currentName = name;
  }

  /** Loop a locomotion clip at the rate that keeps planted feet still while moving at `moveSpeed` (m/s). */
  locomote(name, moveSpeed, { min = 0.55, max = 2.2 } = {}) {
    if (!this.clips[name]) name = 'Running_A';
    const gs = this.game.assets.groundSpeed(this.key, name) * this.scale;
    this.play(name, { speed: Math.max(min, Math.min(max, moveSpeed / gs)) });
  }

  face(x, z) { this.facing = Math.atan2(x - this.pos.x, z - this.pos.z); }

  flash(amount = 1) { this.flashT = amount; }

  updateVisual(dt, turnRate = 14) {
    let d = this.facing - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * turnRate);
    this.resetSecondaryMotion?.();
    this.mixer.update(dt);
    this.secondaryMotion?.(dt);
    if (this.flashT > 0 || this.tint || this._dirty) {
      this.flashT = Math.max(0, this.flashT - dt * 5);
      for (const m of this.mats) {
        m.emissive.copy(m.userData.baseEmissive);
        if (this.tint) m.emissive.add(this.tint);
        if (this.flashT > 0) { const f = this.flashT * 0.4; m.emissive.r += f; m.emissive.g += f * 0.8; m.emissive.b += f * 0.65; }
      }
      this._dirty = this.flashT > 0 || !!this.tint;
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    for (const m of this.mats) m.dispose();
  }
}
