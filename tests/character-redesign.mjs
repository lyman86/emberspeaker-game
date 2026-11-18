import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Assets} from '../src/core/assets.js';
import {Actor} from '../src/game/actor.js';
import {PROFILES} from '../src/game/models.js';
import {dressWinterEnemy} from '../src/game/winter-enemies-art.js';
import {dressSaltQueen} from '../src/game/salt-queen-art.js';
import {levelResources,MENU_RESOURCES} from '../src/game/resources.js';
import {LEVELS} from '../src/game/maps.js';
// Use shipped skin weights, meshes and animations; only browser image decoding is stubbed.
const loader=new GLTFLoader().register(p=>{const get=p.getDependency.bind(p);p.getDependency=(t,i)=>t==='texture'?Promise.resolve(new T.Texture()):get(t,i);return {name:'TEST_TEXTURE'};});
const assets=new Assets(),env=new T.Texture();let borrowedDisposed=0;env.addEventListener('dispose',()=>borrowedDisposed++);
for(const key of ['snowyeti','winterabbess','saltqueen']){
 const file=PROFILES[key].file,b=fs.readFileSync('public/assets/mx/'+file+'.glb'),g=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');assets.gltf.set('mx:'+file,g);
 assert.equal(PROFILES[key].animations,'model');assert(b.length<3*1024*1024,'bounded chapter download');
 const actor=new Actor({assets,gear:{env}},key);if(key==='saltqueen')for(const m of actor.mats){assert(!m.transparent&&m.depthWrite,'body and hair must depth-test without per-mesh blend sorting');}let skins=0,draws=0,tris=0;actor.model.traverse(o=>{if(o.isMesh){draws++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.isSkinnedMesh){skins++;assert(o.skeleton.bones.length>=10);}}});assert(skins>0);assert(draws<16);assert(tris<90000);
 for(const name of Object.keys(PROFILES[key].map)){
  const clip=actor.clips[name];assert(clip?.tracks.length,key+' '+name+' has native tracks');actor.mixer.stopAllAction();const action=actor.mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  for(const f of [.001,.25,.5,.75,.995]){actor.mixer.setTime(clip.duration*f);actor.model.updateMatrixWorld(true);actor.model.traverse(o=>{assert(o.matrixWorld.elements.every(Number.isFinite));o.skeleton?.update();});const box=new T.Box3().setFromObject(actor.model,true),size=box.getSize(new T.Vector3());assert(size.toArray().every(v=>Number.isFinite(v)&&v>0&&v<20),key+' '+name+' skin remains bounded');}
 }
 actor.mixer.stopAllAction();actor.mixer.clipAction(actor.clips.Idle).play();actor.mixer.setTime(.01);actor.model.updateMatrixWorld(true);actor.model.traverse(o=>o.skeleton?.update());const box=new T.Box3().setFromObject(actor.model,true);assert(Math.abs(box.min.y)<.03);assert(box.max.y/actor.model.scale.y>2&&box.max.y/actor.model.scale.y<2.3,key+' feet and scale match actor origin');
 actor.type=key;if(key==='saltqueen'){const art=dressSaltQueen(actor);art.update(.1);art.dispose();art.dispose();}else{dressWinterEnemy(actor);actor.winterArtUpdate(.1);actor.winterArtDispose();actor.winterArtDispose();}
 assert.equal(borrowedDisposed,0,'costumes do not destroy shared environment textures');
 for(const m of actor.mats)m.dispose();
 assert(!MENU_RESOURCES.models.includes('mx:'+file));
}
for(const [map,expected] of [['camp',[]],['frostpass',['snowbeast']],['monastery',['winter_abbess']],['salttomb',['salt_sovereign']]]){const spec=LEVELS[map]?.();assert(spec,map+' factory');const models=levelResources(spec,'mage').models;for(const file of ['snowbeast','winter_abbess','salt_sovereign'])assert.equal(models.includes('mx:'+file),expected.includes(file),map+' only loads its own replacement characters');}
console.log('Complete replacement characters: actual skinned poses, native clips, draw/download bounds, feet alignment, shared texture ownership and chapter-only loading passed.');
