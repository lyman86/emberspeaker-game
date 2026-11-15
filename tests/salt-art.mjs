import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {dressSaltQueen} from '../src/game/salt-queen-art.js';
// The shipped Vera bind pose supplies real joint coordinates, without loading browser textures.
const b=readFileSync('public/assets/mx/vera.glb'),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12))),joints=new Set(j.skins.flatMap(s=>s.joints));
const nodes=j.nodes.map((n,i)=>{const o=joints.has(i)?new T.Bone():new T.Group();o.name=n.name??'';if(n.matrix)o.applyMatrix4(new T.Matrix4().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
j.nodes.forEach((n,i)=>n.children?.forEach(k=>nodes[i].add(nodes[k])));const source=new T.Group();j.scenes[j.scene??0].nodes.forEach(i=>source.add(nodes[i]));source.updateMatrixWorld(true);
const e={model:source.clone(true),mats:[],game:{assets:{gltf:new Map([['mx:vera',{scene:source}]])},materials:{tex:{rock_surface:{nor:new T.Texture()}}}},salt:{phase:3,cast:{}}};
const art=dressSaltQueen(e);for(let i=0;i<300;i++)art.update(.016);e.model.updateMatrixWorld(true);
let draws=0,triangles=0,disposedGeo=0,disposedMat=0;const mats=new Set(),geos=new Set();
e.model.traverse(o=>{if(!o.isMesh)return;draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geos.add(o.geometry);mats.add(o.material);});
const bounds=new T.Box3().setFromObject(e.model),size=bounds.getSize(new T.Vector3());assert(size.toArray().every(n=>Number.isFinite(n)&&n>0&&n<4));assert(draws<=28);assert(triangles<22000);
for(const g of geos)g.addEventListener('dispose',()=>disposedGeo++);for(const m of mats)m.addEventListener('dispose',()=>disposedMat++);
art.dispose();art.dispose();assert.equal(disposedGeo,geos.size);assert.equal(disposedMat,mats.size);art.update(.1);
console.log('Salt Queen bind-pose bounds, batched geometry budget, phase animation and repeat-safe disposal passed.');
