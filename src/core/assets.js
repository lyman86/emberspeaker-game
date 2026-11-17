import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PROFILES, MX_ANIM_REF_HIPS, MX_WORLD_SCALE } from '../game/models.js';

const BASE = import.meta.env.BASE_URL + 'assets/';

export const WEAPONS = ['Skeleton_Arrow'];
/** Photo-scanned props from Poly Haven (CC0), real-world metres. */
export const PH_PROPS = ['stone_fire_pit', 'wine_barrel_01', 'wooden_barrels_01', 'wooden_crate_01', 'wooden_crate_02', 'treasure_chest', 'WoodenTable_01',
  'wooden_stool_01', 'dead_tree_trunk', 'dead_tree_trunk_02', 'tree_stump_01', 'boulder_01', 'rock_moss_set_01', 'large_iron_gate', 'large_castle_door',
  'ornate_war_hammer', 'kite_shield', 'gothic_statue', 'wooden_candlestick', 'vintage_oil_lamp', 'GothicCabinet_01', 'wooden_lantern_01', 'wooden_bucket_01'];
export const PROPS = ['torch_mounted', 'banner_patternA_red', 'banner_shield_red', 'bed_floor', 'coin_stack_small'];

export class Assets {
  constructor() {
    this.gltf = new Map();
    this.loader = new GLTFLoader();
  }

  async load(names, onProgress) {
    this.pending ??= new Map();
    const jobs = [...new Set(names)].filter(name => !this.gltf.has(name));
    let done = 0;
    await Promise.all(
      jobs.map(async (name) => {
        if (!this.pending.has(name)) this.pending.set(name, (async () => {
        const url = name.startsWith('mx:') ? 'mx/'+name.slice(3)+'.glb' : name.startsWith('ph:') ? 'ph/'+name.slice(3)+'.glb' : WEAPONS.includes(name) ? 'weapons/'+name+'.gltf' : 'props/'+name+'.glb';
        const g = await this.loader.loadAsync(BASE + url);
        const mx = name.startsWith('mx:') || name.startsWith('ph:');
        g.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = !mx;
            if (o.material) {
              const authored=['mx:snowbeast','mx:winter_abbess','mx:salt_sovereign'].includes(name);
              if(!authored)o.material.metalness = Math.min(o.material.metalness ?? 0, mx ? 0.05 : 0.1);
              o.material.roughness = Math.max(o.material.roughness ?? 1, authored ? 0.22 : mx ? 0.62 : 0.75);
            }
          }
        });
        this.gltf.set(name, g);
        })().finally(() => this.pending.delete(name)));
        await this.pending.get(name);
        onProgress?.(++done / jobs.length);
      })
    );
    onProgress?.(1);
  }

  /** Called only after outgoing actors/instances are disposed. Browser HTTP cache still supports revisits. */
  retain(names) {
    const keep = new Set(names);
    for (const [name,g] of this.gltf) if (!keep.has(name)) {
      const owned = new Set();
      g.scene.traverse(o => { if(o.geometry) owned.add(o.geometry); for(const m of [].concat(o.material??[])){owned.add(m);for(const v of Object.values(m))if(v?.isTexture)owned.add(v);} });
      for(const value of owned)value.dispose();
      this.gltf.delete(name);
    }
    this._clips = {}; this._gs = {};
  }

  /** Model bounds share the exact transforms used by the rendered scanned props. */
  bounds(name){const g=this.gltf.get(name);return g._bounds??=new THREE.Box3().setFromObject(g.scene);}

  /** Static prop clone (shares geometry and materials). */
  prop(name) {
    return this.gltf.get(name).scene.clone(true);
  }

  /** List of {geometry, material, matrix} for instancing a prop. */
  parts(name) {
    const g = this.gltf.get(name);
    if (!g._parts) {
      g.scene.updateMatrixWorld(true);
      g._parts = [];
      g.scene.traverse((o) => {
        if (o.isMesh) g._parts.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() });
      });
    }
    return g._parts;
  }

  /** Clips for one character profile: renamed to game names, trimmed, and hips motion scaled to the rig. */
  _profileClips(key) {
    this._clips ??= {};
    if (this._clips[key]) return this._clips[key];
    const P = PROFILES[key];
    const lib = P.animations==='model'?this.gltf.get('mx:'+P.file).animations:this.gltf.get('mx:anims').animations;
    const scene = this.gltf.get('mx:' + P.file).scene;
    let hips = 0;
    const names = new Set();
    scene.traverse((o) => { names.add(o.name); if (!hips && o.isBone && /Hips$/.test(o.name)) hips = o.position.y * (o.parent?.scale?.y ?? 1); });
    const ratio = hips ? hips / MX_ANIM_REF_HIPS : 1;
    const clips = [], release = {};
    for (const [game, spec] of Object.entries(P.map)) {
      const [src, from = 0, to = 1, rel] = Array.isArray(spec) ? spec : [spec];
      const base = lib.find((c) => c.name === src);
      if (!base) { console.warn('missing clip', src); continue; }
      const fps = 30, frames = Math.round(base.duration * fps);
      const clip = from > 0 || to < 1
        ? THREE.AnimationUtils.subclip(base, game, Math.floor(from * frames), Math.max(Math.floor(from * frames) + 1, Math.ceil(to * frames)), fps)
        : base.clone();
      clip.name = game;
      clip.tracks = clip.tracks.filter((t) => names.has(t.name.slice(0, t.name.lastIndexOf('.')))); // some rigs lack finger bones
      for (const t of clip.tracks) {
        if (/Hips\.position$/.test(t.name)&&P.animations!=='model') { t.values=t.values.slice();for(let i=0;i<t.values.length;i++)t.values[i]*=ratio; }
        if(t.name.endsWith('.position')&&P.lockRoot?.includes(t.name.slice(0,-9))){t.values=t.values.slice();for(let i=0;i<t.values.length;i+=3){t.values[i]=t.values[0];t.values[i+2]=t.values[2];}}
      }
      clips.push(clip);
      if (rel != null) release[game] = rel;
    }
    return (this._clips[key] = { clips, release });
  }

  /**
   * Ground speed (world m/s at playback speed 1) of an in-place locomotion clip: how fast a planted foot slides
   * backwards under the body. Used to set the clip's playback rate so feet do not skate.
   */
  groundSpeed(key, clipName = 'Running_A') {
    this._gs ??= {};
    const id = key + ':' + clipName;
    if (this._gs[id] != null) return this._gs[id];
    const P = PROFILES[key];
    const clip = this._profileClips(key).clips.find((c) => c.name === clipName);
    if (!clip) return (this._gs[id] = 4);
    const root = SkeletonUtils.clone(this.gltf.get('mx:' + P.file).scene);
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const feet = ['LeftFoot', 'RightFoot'].map((n) => { let b = null; root.traverse((o) => { if (!b && o.isBone && (o.name.endsWith(n)||o.name===({LeftFoot:'footL',RightFoot:'footR'})[n]||o.name===({LeftFoot:'foot.L',RightFoot:'foot.R'})[n])) b = o; }); return b; }).filter(Boolean);
    if(!feet.length)return(this._gs[id]=3.6*(P.scale??1)*MX_WORLD_SCALE);
    const N = 90, dt = clip.duration / N, v = new THREE.Vector3();
    const tr = feet.map(() => []);
    for (let i = 0; i <= N; i++) {
      mixer.setTime(i * dt); root.updateMatrixWorld(true);
      feet.forEach((f, k) => { f.getWorldPosition(v); tr[k].push([v.y, v.z]); });
    }
    const speeds = [];
    for (const t of tr) {
      const ys = t.map((p) => p[0]), lo = Math.min(...ys), hi = Math.max(...ys);
      for (let i = 1; i < t.length; i++) {
        if (t[i][0] < lo + (hi - lo) * 0.2 && t[i - 1][0] < lo + (hi - lo) * 0.2) speeds.push((t[i - 1][1] - t[i][1]) / dt);
      }
    }
    speeds.sort((a, b) => a - b);
    const med = speeds.length ? speeds[Math.floor(speeds.length / 2)] : 3;
    return (this._gs[id] = Math.max(0.5, Math.abs(med)) * (P.scale ?? 1) * MX_WORLD_SCALE);
  }

  /** Skinned character clone with its own materials and animation clips. key = profile name in models.js */
  character(key) {
    const P = PROFILES[key];
    const g = this.gltf.get('mx:' + P.file);
    const root = SkeletonUtils.clone(g.scene);
    const mats = [];
    const cache = new Map();
    root.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (!cache.has(o.material)) {
          const m = o.material.clone();
          m.userData.baseEmissive = m.emissive.clone();
          cache.set(o.material, m);
          mats.push(m);
        }
        o.material = cache.get(o.material);
      }
    });
    const { clips, release } = this._profileClips(key);
    return { root, clips, mats, release, scale: (P.scale ?? 1) * MX_WORLD_SCALE };
  }
}

export function clipMap(clips) {
  const m = {};
  for (const c of clips) m[c.name] = c;
  return m;
}

export { THREE };
