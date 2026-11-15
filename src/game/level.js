import {saltProp,saltScenery} from './salt-art.js';
import {ironProp} from './iron-art.js';
import * as THREE from 'three';
import { episodeProp, episodeScenery, episodeGate } from './episode-scenery.js';

export const CELL = 4;
/** Arena triggers cover their full room, including side approaches and displacement landings. */
export function containsTrigger(t, pos) {
  if (t.bounds) { const [x0,z0,x1,z1]=t.bounds;return pos.x>=x0*CELL && pos.x<(x1+1)*CELL && pos.z>=z0*CELL && pos.z<(z1+1)*CELL; }
  return Math.hypot(pos.x-(t.x*CELL+2),pos.z-(t.z*CELL+2))<t.r;
}
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const RADIUS = { '@house':2.8,'@church':2.8,'@mill':2.8,'@well':1.5, pillar: 1.15, pillar_decorated: 1.3, barrel_large: 1.15, crates_stacked: 1.5, keg: 1.3, table_long_decorated_A: 1.6,
  trunk_large_A: 1.0, barrel_small_stack: 1.5, '@grave': 0.75, '@tree': 0.8, '@campfire': 1.5, '@bell': 2.4, statue: 1.3, cabinet: 1.2 };

/** Old map prop names -> photo-scanned replacements (scale in world units per metre; '@' = procedural). */
export const PROP_MAP = {
  crates_stacked: [{ m: 'wooden_crate_01', s: 1.7 }, { m: 'wooden_crate_01', s: 1.6, y: 0.57, rot: 0.35 }, { m: 'wooden_crate_02', s: 1.5, ox: 0.6, oz: 0.9, rot: 1.4 }],
  barrel_large: [{ m: 'wine_barrel_01', s: 1.7 }, { m: 'wine_barrel_01', s: 1.6, ox: 1.1, oz: 0.4, rot: 2 }],
  keg: [{ m: 'wine_barrel_01', s: 1.8 }, { m: 'wooden_bucket_01', s: 1.6, ox: 1.1, oz: -0.5 }],
  barrel_small_stack: { m: 'wooden_barrels_01', s: 0.75 },
  box_large: { m: 'wooden_crate_02', s: 1.7 },
  table_long_decorated_A: [{ m: 'WoodenTable_01', s: 2.1 }, { m: 'wooden_candlestick', s: 3, y: 1.15, ox: 0.6, flame: 1.82 }, { m: 'wooden_stool_01', s: 1.5, oz: 1.2 }],
  trunk_large_A: { m: 'treasure_chest', s: 1.6, rot: Math.PI },
  candle_triple: { m: 'wooden_candlestick', s: 3.2, flame: 0.72 },
  rubble_half: { m: 'rock_moss_set_01', s: 0.32 },
  rubble_large: { m: 'rock_moss_set_01', s: 0.45 },
  sword_shield: { m: 'kite_shield', s: 1.6, y: 1.1 },
  statue: { m: 'gothic_statue', s: 1.6 },
  cabinet: { m: 'GothicCabinet_01', s: 1.5 },
  lamp: { m: 'vintage_oil_lamp', s: 1.6, flame: 0.75 },
  lantern: { m: 'wooden_lantern_01', s: 1.6, flame: 0.4 },
  log: { m: 'dead_tree_trunk', s: 1.45 },
  stump: { m: 'tree_stump_01', s: 1.4 },
  boulder: { m: 'boulder_01', s: 1.6 },
  pillar: { m: '@pillar' },
  pillar_decorated: { m: '@pillar2' },
  column: { m: '@column' },
};

export class Level {
  constructor(game, spec) {
    this.game = game;
    this.spec = spec;
    this.id = spec.id;
    const d = (this.def = spec.def);
    this.w = d.w; this.h = d.h;
    this.solidGrid = new Uint8Array(d.w * d.h);
    for (let z = 0; z < d.h; z++) for (let x = 0; x < d.w; x++) this.solidGrid[z * d.w + x] = d.g[z][x] === '#' ? 1 : 0;
    this.circles = [];this.boxes=[];
    this.emitters = [];
    this.torches = [];
    this.gates = {};
    this.anim = [];
    this.group = new THREE.Group();
    this._build();
  }

  // ---------- grid queries ----------
  isFloor(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h && this.def.g[cz][cx] !== '#'; }
  solid(cx, cz) { return cx < 0 || cz < 0 || cx >= this.w || cz >= this.h || this.solidGrid[cz * this.w + cx] === 1; }
  cellOf(v) { return Math.floor(v / CELL); }
  center(cx, cz) { return new THREE.Vector3(cx * CELL + 2, 0, cz * CELL + 2); }
  wallBlocked(x,z,r=0.6) {
    for(let cz=this.cellOf(z-r);cz<=this.cellOf(z+r);cz++)for(let cx=this.cellOf(x-r);cx<=this.cellOf(x+r);cx++)if(this.solid(cx,cz))return true;
    return false;
  }
  blocked(x,z,r=0.6) {
    if(this.wallBlocked(x,z,r))return true;
    for(const c of this.circles)if(Math.hypot(x-c.x,z-c.z)<c.r+r-0.001)return true;
    for(const b of this.boxes??[]){
      const dx=x-b.x,dz=z-b.z,lx=dx*b.cos-dz*b.sin,lz=dx*b.sin+dz*b.cos;
      const qx=Math.max(0,Math.abs(lx)-b.hx),qz=Math.max(0,Math.abs(lz)-b.hz);
      if(qx*qx+qz*qz<r*r-0.001||r===0&&Math.abs(lx)<b.hx&&Math.abs(lz)<b.hz)return true;
    }
    return false;
  }
  /** Find a legal landing / interaction point; also frees actors from legacy decoration overlaps. */
  nearestFree(x,z,r=0.6,max=12) {
    if(!this.blocked(x,z,r))return {x,z};
    for(let d=0.25;d<=max;d+=0.25)for(let i=0;i<32;i++){
      const a=i*Math.PI/16,nx=x+Math.sin(a)*d,nz=z+Math.cos(a)*d;
      if(!this.blocked(nx,nz,r))return {x:nx,z:nz};
    }
    return null;
  }
  /** Substeps prevent fast charges and knockback tunnelling; all actors use the same footprint checks. */
  move(pos,dx,dz,r=0.6) {
    const ox=pos.x,oz=pos.z;
    if(this.blocked(ox,oz,r)){const free=this.nearestFree(ox,oz,r);if(!free)return false;pos.x=free.x;pos.z=free.z;}
    const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.2)),sx=dx/n,sz=dz/n;
    for(let i=0;i<n;i++){
      if(!this.blocked(pos.x+sx,pos.z+sz,r)){pos.x+=sx;pos.z+=sz;}
      else {if(!this.blocked(pos.x+sx,pos.z,r))pos.x+=sx;if(!this.blocked(pos.x,pos.z+sz,r))pos.z+=sz;}
    }
    return Math.abs(pos.x-ox)+Math.abs(pos.z-oz)>1e-5;
  }
  /** A straight sweep used by line of sight and displacement, with no obstacle exemptions. */
  clear(ax,az,bx,bz,r=0.7) {
    const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/0.2));
    for(let i=1;i<=n;i++){const t=i/n;if(this.blocked(ax+(bx-ax)*t,az+(bz-az)*t,r))return false;}
    return true;
  }
  displacement(from,target,r=0.6) {
    const to=from.clone(),dx=target.x-from.x,dz=target.z-from.z,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.15));
    for(let i=1;i<=n;i++){const x=from.x+dx*i/n,z=from.z+dz*i/n;if(this.blocked(x,z,r))break;to.x=x;to.z=z;}
    return to;
  }
  addBox(x,z,hx,hz,rot=0,prop='') {this.boxes.push({x,z,hx,hz,cos:Math.cos(rot),sin:Math.sin(rot),prop});}
  addModelCollider(name,x,z,scale,rot,prop) {
    const box=this.game.assets.bounds(name),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
    if(size.y*scale<0.35)return;
    const c=Math.cos(rot),s=Math.sin(rot);
    this.addBox(x+center.x*c+center.z*s,z-center.x*s+center.z*c,size.x*scale/2,size.z*scale/2,rot,prop);
  }
  /** A* on the grid, then string-pulled. Returns world-space waypoints (excluding the start). */
  findPath(ax, az, bx, bz) {
    const free=this.nearestFree(bx,bz,0.7);
    if(!free)return [];bx=free.x;bz=free.z;
    if (this.clear(ax, az, bx, bz)) return [{ x: bx, z: bz }];
    const w = this.w, sx = this.cellOf(ax), sz = this.cellOf(az);
    let tx = this.cellOf(bx), tz = this.cellOf(bz);
    if (this.solid(tx, tz)) {
      // nearest walkable cell to the clicked point
      let best = null, bd = 1e9;
      for (let z = tz - 2; z <= tz + 2; z++) for (let x = tx - 2; x <= tx + 2; x++) if (!this.solid(x, z)) {
        const dd = (x * CELL + 2 - bx) ** 2 + (z * CELL + 2 - bz) ** 2;
        if (dd < bd) { bd = dd; best = [x, z]; }
      }
      if (!best) return [];
      [tx, tz] = best; bx = tx * CELL + 2; bz = tz * CELL + 2;
    }
    const start = sz * w + sx, goal = tz * w + tx;
    const g = new Map([[start, 0]]), came = new Map(), open = [[0, start]], closed = new Set();
    let found = false, guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === goal) { found = true; break; }
      if (closed.has(cur)) continue;
      closed.add(cur);
      const cx = cur % w, cz = (cur / w) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (this.solid(nx, nz)) continue;
        if (dx && dz && (this.solid(cx + dx, cz) || this.solid(cx, cz + dz))) continue;
        const id = nz * w + nx, cost = g.get(cur) + (dx && dz ? 1.414 : 1);
        const ex=id===goal?bx:nx*CELL+2,ez=id===goal?bz:nz*CELL+2;
        if(this.blocked(ex,ez,0.7))continue;
        const fx=cur===start?ax:cx*CELL+2,fz=cur===start?az:cz*CELL+2;
        if(!this.clear(fx,fz,ex,ez,0.7))continue;
        if (cost < (g.get(id) ?? 1e9)) {
          g.set(id, cost); came.set(id, cur);
          open.push([cost + Math.hypot(nx - tx, nz - tz), id]);
        }
      }
    }
    if (!found) return [];
    const cells = [];
    for (let c = goal; c !== start; c = came.get(c)) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => ({ x: (c % w) * CELL + 2, z: ((c / w) | 0) * CELL + 2 }));
    pts[pts.length - 1] = { x: bx, z: bz };
    const out = [];
    let px = ax, pz = az, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.clear(px, pz, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]); px = pts[j].x; pz = pts[j].z; i = j + 1;
    }
    return out;
  }

  // ---------- construction ----------
  _tall(cx, cz) {
    return this.def.g[cz]?.[cx] === '#' || cx < 0 || cz < 0 || cx >= this.w || cz >= this.h
      ? !(this.isFloor(cx, cz - 1) || this.isFloor(cx - 1, cz) || this.isFloor(cx - 1, cz - 1)) : false;
  }

  _build() {
    const A = this.game.assets, MAT = this.game.materials, d = this.def, inst = new Map();
    const add = (name, m) => {
      const parts = A.parts(name);
      parts.forEach((p, i) => {
        const key = name + ':' + i;
        if (!inst.has(key)) inst.set(key, { p, mats: [] });
        inst.get(key).mats.push(m.clone().multiply(p.matrix));
      });
    };
    const M = (x, y, z, rot = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, rot), new THREE.Vector3(s, s, s));
    const tallBoxes = [], lowBoxes = [], floors = {};
    const outdoor = this.spec.floor === 'dirt';

    for (let z = 0; z < d.h; z++) for (let x = 0; x < d.w; x++) {
      const ch = d.g[z][x], cx = x * CELL + 2, cz = z * CELL + 2, h = hash(x, z);
      if (ch === '#') {
        let near = false;
        for (let a = -1; a <= 1 && !near; a++) for (let b = -1; b <= 1; b++) if (this.isFloor(x + a, z + b)) { near = true; break; }
        if (near) (this._tall(x, z) ? tallBoxes : lowBoxes).push([cx, cz]);
        continue;
      }
      const kind = { ',': 'dirt', ';': 'leaves', ':': 'altarFloor', '~':'mossy' }[ch] ?? 'stoneFloor';
      (floors[this.spec.episode===4?(kind==='dirt'?'saltSand':'saltStone'):this.id==='forest'&&kind==='leaves'?'forestFloor':kind] ??= []).push(M(cx, 0, cz, Math.floor(h * 4) * (Math.PI / 2)));
    }

    // floor: one instanced quad per cell with photo-scanned PBR material (random 90° turns hide tiling)
    const quad = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2);
    for (const [kind, list] of Object.entries(floors)) {
      const im = new THREE.InstancedMesh(quad, MAT.get(kind, 1.5), list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.receiveShadow = true;
      this.group.add(im);
    }
    // walls: solid blocks with masonry sides and rough rock tops
    const wallMat = MAT.get(this.spec.episode===4?'saltWall':outdoor ? 'wall' : 'cryptWall', 1.5), topMat = MAT.get(this.spec.episode===4?'saltStone':'rockTop', 1.5);
    const mkBoxes = (list, hgt) => {
      if (!list.length) return;
      const geo = new THREE.BoxGeometry(CELL, hgt, CELL);
      const uv = geo.attributes.uv; // side faces: keep texel density equal to the 4 m width
      for (let i = 0; i < uv.count; i++) { const n = geo.attributes.normal.getY(i); if (Math.abs(n) < 0.5) uv.setY(i, uv.getY(i) * (hgt / CELL)); }
      const im = new THREE.InstancedMesh(geo, [wallMat, wallMat, topMat, topMat, wallMat, wallMat], list.length);
      list.forEach(([x, z], i) => im.setMatrixAt(i, M(x, hgt / 2 - 0.02, z, (hash(x, z) > 0.5 ? 1 : 0) * Math.PI)));
      im.receiveShadow = true; im.castShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
    };
    if(this.id==='forest') {
      const trees=[...tallBoxes,...lowBoxes].filter(([x,z])=>hash(x,z)>0.3),trunkGeo=new THREE.CylinderGeometry(0.2,0.5,6,7),branchGeo=new THREE.CylinderGeometry(0.04,0.16,1,5);
      const trunks=new THREE.InstancedMesh(trunkGeo,MAT.get('bark'),trees.length),branches=new THREE.InstancedMesh(branchGeo,MAT.get('bark'),trees.length*6);
      trees.forEach(([x,z],i)=>{
        const seed=hash(x,z),y=3+seed;
        trunks.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(1,y/3,1)));
        for(let j=0;j<6;j++){
          const a=j*2.3+seed*6,len=1.5+hash(z+j,x)*2;
          const dir=new THREE.Vector3(Math.sin(a)*0.7,0.7,Math.cos(a)*0.7).normalize();
          const q=new THREE.Quaternion().setFromUnitVectors(UP,dir),pos=new THREE.Vector3(x,2+j*0.55,z).addScaledVector(dir,len/2);
          branches.setMatrixAt(i*6+j,new THREE.Matrix4().compose(pos,q,new THREE.Vector3(1,len,1)));
        }
      });trunks.castShadow=branches.castShadow=true;this.group.add(trunks,branches);
    } else if(this.id==='saltflat'){mkBoxes([...tallBoxes,...lowBoxes],1.3);}
    else if(this.id!=='swamp'){mkBoxes(tallBoxes, 4.6);mkBoxes(lowBoxes, 0.9);}

    // props
    for (const p of d.props) {
      const cx = p.x * CELL + 2 + (p.ox ?? 0), cz = p.z * CELL + 2 + (p.oz ?? 0);
      const collides=p.collision!==false&&(RADIUS[p.prop]!=null||['box_large','boulder','log','stump','column','bed_floor','@wagon','@ruin','@butchery','@roots','@sign','@war_tent','@barricade','@iron_brazier','@war_table','@iron_throne','@salt_crystal','@salt_obelisk','@salt_ruin','@salt_brazier','@salt_archive'].includes(p.prop));
      if (p.prop[0] === '@') this._special(p, cx, cz);
      else if (PROP_MAP[p.prop]) {
        for (const e of [].concat(PROP_MAP[p.prop])) {
          const rot = (p.rot ?? 0) + (e.rot ?? 0), s = (e.s ?? 1.45) * (p.s ?? 1);
          const off = new THREE.Vector3(e.ox ?? 0, 0, e.oz ?? 0).applyAxisAngle(UP, p.rot ?? 0);
          if (e.m[0] === '@') this._special({ ...p, prop: e.m }, cx + off.x, cz + off.z);
          else {add('ph:' + e.m, M(cx + off.x, (p.oy ?? 0) + (e.y ?? 0), cz + off.z, rot, s));if(collides&&!(e.y>1))this.addModelCollider('ph:'+e.m,cx+off.x,cz+off.z,s,rot,p.prop);}
          if (e.flame) this.emitters.push({ kind: 'candle', x: cx + off.x, y: (p.oy ?? 0) + e.flame, z: cz + off.z, acc: 0 });
        }
      } else if (A.gltf.has(p.prop)) {add(p.prop, M(cx, p.oy ?? 0, cz, p.rot ?? 0, p.s ?? 1));if(collides)this.addModelCollider(p.prop,cx,cz,p.s??1,p.rot??0,p.prop);}
      if(collides&&(p.prop[0]==='@'||PROP_MAP[p.prop]?.m?.[0]==='@')){
        const half=({'@house':[2.5,2.5],'@church':[2.5,2.5],'@mill':[2.5,2.5],'@wagon':[2.1,1.4],'@ruin':[2.8,.7],'@butchery':[1.5,.9],'@war_tent':[3,2],'@barricade':[2.5,1.2],'@war_table':[1.8,1.1],'@salt_ruin':[3,.9],'@salt_archive':[1.5,1.2],'@iron_throne':[2.5,1.5]})[p.prop];
        if(half)this.addBox(cx,cz,half[0]*(p.s??1),half[1]*(p.s??1),p.rot??0,p.prop);
        else this.circles.push({x:cx,z:cz,r:(RADIUS[p.prop]??({'@salt_crystal':1.1,'@salt_obelisk':1.1,'@salt_brazier':.8,'@roots':.6,'@sign':.2,column:.6})[p.prop]??1)*(p.s??1),prop:p.prop});
      }
    }

    // torches
    for (const t of d.torches) {
      const cx = t.x * CELL + 2, cz = t.z * CELL + 2;
      const n = t.side === 'N';
      if (!this._tall(n ? t.x : t.x - 1, n ? t.z - 1 : t.z)) { console.warn('torch without wall', t); continue; }
      const tx = n ? cx : cx - 1.5, tz = n ? cz - 1.5 : cz;
      add('torch_mounted', M(tx, 2.2, tz, n ? 0 : Math.PI / 2));
      const fx = n ? tx : tx + 0.42, fz = n ? tz + 0.42 : tz;
      const col = new THREE.Color(t.color);
      this.emitters.push({ kind: 'torch', x: fx, y: 3.0, z: fz, color: col, acc: 0 });
      this.torches.push({ x: fx + (n ? 0 : 0.8), y: 3.3, z: fz + (n ? 0.8 : 0), color: t.color, power: 90, seed: hash(t.x, t.z) * 60 });
    }

    // flush instances
    for (const { p, mats } of inst.values()) {
      const im = new THREE.InstancedMesh(p.geometry, p.material, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.group.add(im);
    }

    // gates: scanned wrought-iron gate scaled to the cell
    for (const gt of d.gates) {
      const m = episodeGate(this,gt)??A.prop('ph:large_iron_gate');
      const along = this.solid(gt.x - 1, gt.z) && this.solid(gt.x + 1, gt.z);
      if(!['plague_fog','roots'].includes(gt.id))m.scale.setScalar(CELL / 2.96);
      m.position.set(gt.x * CELL + 2, 0, gt.z * CELL + 2);
      m.rotation.y = along ? 0 : Math.PI / 2;
      this.group.add(m);
      this.solidGrid[gt.z * this.w + gt.x] = 1;
      this.gates[gt.id] = { ...gt, mesh: m, open: false };
    }
    episodeScenery(this);saltScenery(this);
  }

  openGate(id) {
    const g = this.gates[id];
    if (!g || g.open) return;
    g.open = true;
    this.game.audio.play('gate', g.mesh.position);
    this.game.gfx.addShake(0.25);
    let t = 0;
    this.anim.push((dt) => {
      t += dt;
      g.mesh.position.y = -4.3 * Math.min(1, t / 1.6) ** 2;
      if (t > 0.9) this.solidGrid[g.z * this.w + g.x] = 0;
      if(t>=1.6)g.mesh.visible=false;
      return t < 1.6;
    });
  }

  _special(p, cx, cz) {
    if(saltProp(this,p,cx,cz))return;
    if(ironProp(this,p,cx,cz))return;
    if(episodeProp(this,p,cx,cz))return;
    const G = this.group, h = hash(p.x, p.z), MAT = this.game.materials, A = this.game.assets;
    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...o });
    const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; G.add(m); return m; };
    const scan = (name, x, y, z, s = 1.45, rot = 0) => { const m = A.prop('ph:' + name); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.y = rot; G.add(m); return m; };
    // UVs for procedural stone so texel size matches the walls (~4 m per repeat)
    const worldUV = (geo, size = 2.7) => { geo.computeBoundingBox(); const b = geo.boundingBox, uv = geo.attributes.uv, pos = geo.attributes.position, nor = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)); const u = ny > 0.7 ? pos.getX(i) : nx > 0.7 ? pos.getZ(i) : pos.getX(i) + pos.getZ(i); const v = ny > 0.7 ? pos.getZ(i) : pos.getY(i); uv.setXY(i, u / size, v / size); } return geo; };
    if (p.prop === '@grave') {
      const mat = MAT.get(h > 0.6 ? 'mossy' : 'headstone');
      const rot = (h - 0.5) * 0.5, hgt = 1.2 + h * 0.8;
      const s = mesh(worldUV(new THREE.BoxGeometry(1.15, hgt, 0.3), 2), mat, cx, hgt / 2 - 0.05, cz); s.rotation.set((h - 0.5) * 0.25, rot, (hash(p.z, p.x) - 0.5) * 0.2);
      if (h > 0.4) { const c = mesh(worldUV(new THREE.CylinderGeometry(0.575, 0.575, 0.3, 16, 1, false, 0, Math.PI), 2), mat, 0, 0, 0); c.rotation.set(Math.PI / 2, Math.PI / 2, 0); s.add(c); c.position.set(0, hgt / 2, 0); }
      else { const a = mesh(worldUV(new THREE.BoxGeometry(0.3, 0.95, 0.28), 2), mat, 0, 0, 0); s.add(a); a.position.set(0, hgt / 2 + 0.32, 0); const b = mesh(worldUV(new THREE.BoxGeometry(0.95, 0.28, 0.28), 2), mat, 0, 0, 0); s.add(b); b.position.set(0, hgt / 2 + 0.38, 0); }
      // burial mound of loose earth
      const mound = mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.get('dirt', 0.6), cx, -0.05, cz + 1.35);
      mound.scale.set(0.85, 0.28, 1.35); mound.rotation.y = rot;
    } else if (['@house','@church','@mill','@well'].includes(p.prop)) {
      const stone=MAT.get('wall',1),wood=MAT.get('wood',1);
      if(p.prop==='@well') {
        mesh(new THREE.CylinderGeometry(1.3,1.5,1.1,16,1,true),stone,cx,0.6,cz);
        mesh(new THREE.CylinderGeometry(1.1,1.1,0.05,16),std(0x173a22),cx,0.4,cz);
      } else {
        const church=p.prop==='@church',height=church?6:4;
        mesh(new THREE.BoxGeometry(5,height,5),stone,cx,height/2,cz);
        const roof=mesh(new THREE.ConeGeometry(4.4,2.6,4),wood,cx,height+1.3,cz);roof.rotation.y=Math.PI/4;
        mesh(new THREE.BoxGeometry(1.4,2.5,0.12),wood,cx,1.25,cz+2.55);
        if(church){mesh(new THREE.BoxGeometry(0.35,3,0.35),wood,cx,height+4,cz);mesh(new THREE.BoxGeometry(2,0.35,0.35),wood,cx,height+4.4,cz);}
        if(p.prop==='@mill')for(let i=0;i<4;i++){
          const sail=mesh(new THREE.BoxGeometry(0.35,4,0.2),wood,cx,height,cz+2.7);sail.rotation.z=i*Math.PI/2;sail.translateY(1.8);
        }
      }
    } else if (p.prop === '@tree') {
      const mat = MAT.get('bark', 1);
      const trunk = mesh(new THREE.CylinderGeometry(0.24, 0.55, 5.8, 9), mat, cx, 2.9, cz);
      if(p.s){trunk.scale.setScalar(p.s);trunk.position.y=2.9*p.s;} trunk.rotation.z = (h - 0.5) * 0.25;
      for (let i = 0; i < 6; i++) {
        const hh = hash(p.x + i * 3, p.z + i), len = 1.6 + hh * 1.8;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.14, len, 6), mat); b.castShadow = true;
        b.position.set(0, 0.6 + i * 0.4, 0); b.rotation.set(0, i * 2.3 + h * 6, 0.7 + hh * 0.6); b.translateY(len / 2);
        trunk.add(b);
        const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, len * 0.6, 5), mat); t2.castShadow = true;
        t2.position.set(0, len * 0.2, 0); t2.rotation.z = -0.9; t2.translateY(len * 0.3); b.add(t2);
      }
      scan('tree_stump_01', cx + 0.9, 0, cz + 0.7, 0.9, h * 6); // roots flare at the base
    } else if (p.prop === '@campfire') {
      scan('stone_fire_pit', cx, 0.27, cz, 1.6);
      const wood = MAT.get('bark');
      for (let i = 0; i < 5; i++) { const l = mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.5, 7), wood, cx, 0.45, cz); l.rotation.set(Math.PI / 2 - 0.5, (i / 5) * Math.PI * 2, 0); }
      mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.45, 0.08) }), cx, 0.32, cz).scale.y = 0.5;
      this.emitters.push({ kind: 'campfire', x: cx, y: 0.45, z: cz, color: new THREE.Color(0xff8a3c), acc: 0 });
      this.torches.push({ x: cx, y: 2.4, z: cz, color: 0xff7a2c, power: 120, seed: 3 });
      scan('wooden_stool_01', cx + 2.4, 0, cz - 0.6, 1.45, 0.4);
      scan('dead_tree_trunk', cx - 2.2, 0.25, cz + 1.6, 0.8, 0.6);
    } else if (p.prop === '@cryptdoor') {
      const door = scan('large_castle_door', cx, 0, cz - 1.75, 1.45);
      const stone = MAT.get('cryptWall');
      for (const sx of [-1, 1]) mesh(worldUV(new THREE.BoxGeometry(0.7, 4.8, 0.9)), stone, cx + sx * 1.75, 2.4, cz - 1.7);
      mesh(worldUV(new THREE.BoxGeometry(4.3, 0.8, 1.0)), stone, cx, 4.6, cz - 1.7);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 0.9), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(cx, 0.15, cz - 1.5); glow.rotation.x = -1.2; G.add(glow);
      this.emitters.push({ kind: 'mist', x: cx, y: 0.3, z: cz - 1, color: new THREE.Color(0.2, 1, 0.7), acc: 0 });
      void door;
    } else if (p.prop === '@bell') {
      const wood = MAT.get('wood'), bronze = new THREE.MeshStandardMaterial({ color: 0x7a5c32, roughness: 0.42, metalness: 0.9, normalMap: MAT.tex.rock_surface.nor });
      mesh(new THREE.BoxGeometry(0.55, 6.4, 0.55), wood, cx - 2.3, 3.2, cz);
      mesh(new THREE.BoxGeometry(0.55, 6.4, 0.55), wood, cx + 2.3, 3.2, cz);
      mesh(new THREE.BoxGeometry(5.8, 0.55, 0.65), wood, cx, 6.3, cz);
      const pts = [[0.05, 0], [0.5, -0.1], [0.95, -0.5], [1.15, -1.3], [1.3, -2.1], [1.75, -2.75], [1.9, -2.9]].map(([x, y]) => new THREE.Vector2(x, y));
      const bell = mesh(new THREE.LatheGeometry(pts, 36), bronze, cx, 6.0, cz); bell.material.side = THREE.DoubleSide;
      const crack = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 3.2) })); crack.rotation.x = Math.PI / 2; crack.position.y = -2.45; bell.add(crack);
      this.bell = bell; this.bellGlow = crack;
      mesh(worldUV(new THREE.CylinderGeometry(3, 3.3, 0.5, 10)), MAT.get('slate'), cx, 0.25, cz);
      this.emitters.push({ kind: 'bellmist', x: cx, y: 3.2, z: cz, color: new THREE.Color(0.7, 0.2, 1), acc: 0 });
    } else if (p.prop === '@pillar' || p.prop === '@pillar2') {
      const stone = MAT.get(this.spec.floor === 'dirt' ? 'wall' : 'cryptWall');
      mesh(worldUV(new THREE.CylinderGeometry(0.72, 0.8, 4.6, 14)), stone, cx, 2.3, cz);
      mesh(worldUV(new THREE.BoxGeometry(2, 0.5, 2)), stone, cx, 0.25, cz);
      if (p.prop === '@pillar2') { mesh(worldUV(new THREE.BoxGeometry(1.9, 0.45, 1.9)), stone, cx, 4.2, cz); mesh(worldUV(new THREE.CylinderGeometry(0.95, 0.85, 0.35, 14)), stone, cx, 3.85, cz); }
    } else if (p.prop === '@column') {
      const stone = MAT.get('mossy');
      const c = mesh(worldUV(new THREE.CylinderGeometry(0.42, 0.48, 1.6 + h, 12), 2), stone, cx, (1.6 + h) / 2, cz); c.rotation.z = (h - 0.5) * 0.3;
    }
  }

  update(dt) {
    for (let i = this.anim.length - 1; i >= 0; i--) if (!this.anim[i](dt)) this.anim.splice(i, 1);
    if (this.bell) this.bell.rotation.z = Math.sin(this.game.time * 1.3) * 0.05 * (this.bellSwing ?? 1);
  }

  dispose() {
    this.group.traverse(o=>{o.userData.ironDispose?.();o.userData.saltDispose?.();});
    const sharedGeometry=new Set(),sharedMaterial=new Set(Object.values(this.game.materials.cache));
    if(this.game.decals){sharedGeometry.add(this.game.decals.geo);for(const list of Object.values(this.game.decals.mats))for(const m of list)sharedMaterial.add(m);}
    for(const g of this.game.assets.gltf.values())g.scene.traverse(o=>{if(o.geometry)sharedGeometry.add(o.geometry);for(const m of [].concat(o.material??[]))sharedMaterial.add(m);});
    const geometries=new Set(),materials=new Set();
    this.group.traverse(o=>{
      for(let p=o;p&&p!==this.group;p=p.parent)if(p.userData.saltDispose||p.userData.ironDispose)return;
      if(o.isInstancedMesh)o.dispose();
      if(o.geometry&&!sharedGeometry.has(o.geometry))geometries.add(o.geometry);
      for(const m of [].concat(o.material??[]))if(!sharedMaterial.has(m))materials.add(m);
    });
    for(const geo of geometries)geo.dispose();for(const mat of materials)mat.dispose();
    this.group.removeFromParent();
  }
}
const UP = new THREE.Vector3(0, 1, 0);
