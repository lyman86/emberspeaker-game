import * as THREE from 'three';

/**
 * Photo-scanned PBR materials (Poly Haven, CC0) in public/assets/pbr/<id>/{diff,nor,arm}.jpg.
 * arm = ambient occlusion (R), roughness (G), metalness (B).
 */
export const PBR_SETS = {
  wetDock:{id:'weathered_brown_planks',tint:0x8e9c91},
  wetStone:{id:'slate_floor_03',tint:0x9eaba6},
  saltSand:{id:'brown_mud_rocks_01',tint:0xd6c49b,pom:.02},
  saltStone:{id:'monastery_stone_floor',tint:0xe0d5bb,pom:.035},
  saltWall:{id:'medieval_blocks_02',tint:0xc4bc9f},
  dirt: { id: 'brown_mud_rocks_01', pom: 0.05 },
  forestFloor:{id:'forest_leaves_02',tint:0xa1a48a,pom:0.025},
  leaves: { id: 'dry_decay_leaves', tint: 0x9a8f86, pom: 0.035 },
  stoneFloor: { id: 'monastery_stone_floor', tint: 0xb4aca4, pom: 0.045 },
  altarFloor: { id: 'rock_tile_floor_02', tint: 0xa79ea0, pom: 0.045 },
  wall: { id: 'medieval_blocks_02', tint: 0x8a8079 },
  cryptWall: { id: 'medieval_blocks_02', tint: 0x7e7672 },
  rockTop: { id: 'dark_rock', tint: 0x6b6763 },
  headstone: { id: 'rock_surface', tint: 0x8c8a88 },
  mossy: { id: 'mossy_rock', tint: 0x8f938c },
  slate: { id: 'slate_floor_03', tint: 0x8c7f76 },
  wood: { id: 'weathered_brown_planks', tint: 0x8a7a6a },
  bark: { id: 'dark_rock', tint: 0x5a4636 },
};

export class Materials {
  constructor(renderer) {
    this.loader = new THREE.TextureLoader();
    this.cache = {};
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
  }

  async load(names, onProgress) {
    const ids = [...new Set(names.map(name => PBR_SETS[name].id))];
    const base = import.meta.env.BASE_URL + 'assets/pbr/';
    let done = 0;
    this.tex ??= {};this.pending ??= new Map();
    await Promise.all(ids.map(async (id) => {
      if(this.tex[id]){onProgress?.(++done/ids.length);return;}
      if(!this.pending.has(id))this.pending.set(id,(async()=>{
      const [diff, nor, arm] = await Promise.all(['diff', 'nor', 'arm'].map((m) => this.loader.loadAsync(`${base}${id}/${m}.jpg`)));
      diff.colorSpace = THREE.SRGBColorSpace;
      for (const t of [diff, nor, arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, this.maxAniso); }
      this.tex[id] = { diff, nor, arm };
      })().finally(()=>this.pending.delete(id)));
      await this.pending.get(id);
      onProgress?.(++done / ids.length);
    }));
    onProgress?.(1);
  }

  retain(names) {
    const keep=new Set(names.map(name=>PBR_SETS[name].id));
    for(const [key,m] of Object.entries(this.cache))if(!keep.has(PBR_SETS[key.split(':')[0]].id)){
      for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();delete this.cache[key];
    }
    for(const [id,textures] of Object.entries(this.tex))if(!keep.has(id)){for(const t of Object.values(textures))t.dispose();delete this.tex[id];}
  }

  /** Shared material for a named set. repeat = texture repeats per geometry UV unit. */
  get(name, repeat = 1) {
    const key = name + ':' + repeat;
    if (this.cache[key]) return this.cache[key];
    const S = PBR_SETS[name], T = this.tex[S.id];
    const clone = (t) => { if (repeat === 1) return t; const c = t.clone(); c.repeat.set(repeat, repeat); c.needsUpdate = true; return c; };
    const arm = clone(T.arm);
    const m = new THREE.MeshStandardMaterial({
      map: clone(T.diff), normalMap: clone(T.nor), aoMap: arm, roughnessMap: arm, metalnessMap: arm,
      color: S.tint ?? 0xffffff, roughness: 1, metalness: 1, aoMapIntensity: 0.9,
    });
    m.normalScale.set(1.2, 1.2);
    if(['wetDock','wetStone'].includes(name)){
      m.roughness=.48;m.metalness=.06;m.normalScale.set(.65,.65);
      m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
        float wetLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.022,.028,.03)+wetLuma*vec3(.83,1.,1.08),.72);`);};
      m.customProgramCacheKey=()=> 'harbor-wet-stone-v1';
    }
    if (S.pom && this.pom !== false) addParallax(m, S.pom);
    if(name==='saltSand'){
      const before=m.onBeforeCompile;
      m.onBeforeCompile=sh=>{before(sh);sh.fragmentShader=sh.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
        float saltLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=vec3(.25,.265,.25)+saltLuma*vec3(1.65,1.59,1.4);`);};
      m.customProgramCacheKey=()=> 'salt-sand-'+(this.pom!==false);
    }
    return (this.cache[key] = m);
  }
}

/**
 * Parallax occlusion mapping: the ambient-occlusion channel doubles as a height map (crevices are dark),
 * so stones and cracks gain real depth and self-occlusion as the camera moves. The tangent frame is
 * rebuilt from screen-space derivatives, so it works on any rotated floor tile without tangents.
 */
function addParallax(m, scale) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.pomScale = { value: scale };
    const swap = (name) => THREE.ShaderChunk[name].replaceAll('vMapUv', 'pUv').replaceAll('vNormalMapUv', 'pUv').replaceAll('vAoMapUv', 'pUv').replaceAll('vRoughnessMapUv', 'pUv').replaceAll('vMetalnessMapUv', 'pUv');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float pomScale;
vec2 parallaxUv(vec2 uv) {
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 N = normalize(vNormal);
  vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B));
  if (det == 0.0) return uv;
  float sc = inversesqrt(det);
  mat3 tbn = mat3(T * sc, B * sc, N);
  vec3 V = normalize(vViewPosition) * tbn;
  const float L = 14.0;
  float layer = 1.0 / L, cur = 0.0;
  vec2 dUv = V.xy / max(V.z, 0.25) * pomScale / L;
  vec2 p = uv;
  float h = 1.0 - texture2D(aoMap, p).r;
  for (int i = 0; i < 14; i++) { if (cur >= h) break; p -= dUv; h = 1.0 - texture2D(aoMap, p).r; cur += layer; }
  vec2 prev = p + dUv;
  float after = h - cur, before = (1.0 - texture2D(aoMap, prev).r) - cur + layer;
  float w = after / (after - before + 1e-5);
  return mix(p, prev, clamp(w, 0.0, 1.0));
}
void main() {
  vec2 pUv = parallaxUv(vMapUv);`)
      .replace('#include <map_fragment>', swap('map_fragment'))
      .replace('#include <normal_fragment_maps>', swap('normal_fragment_maps'))
      .replace('#include <aomap_fragment>', swap('aomap_fragment'))
      .replace('#include <roughnessmap_fragment>', swap('roughnessmap_fragment'))
      .replace('#include <metalnessmap_fragment>', swap('metalnessmap_fragment'));
  };
  m.customProgramCacheKey = () => 'pom' + scale;
}
