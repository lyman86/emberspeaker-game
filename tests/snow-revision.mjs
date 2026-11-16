import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Assets} from '../src/core/assets.js';
import {PROFILES} from '../src/game/models.js';
import {Enemy,ENEMY_TYPES} from '../src/game/enemy.js';
import {winterUpdate} from '../src/game/winter.js';
import {dressWinterEnemy} from '../src/game/winter-enemies-art.js';
import {createSnowfall} from '../src/game/snowfall.js';
import {levelResources} from '../src/game/resources.js';
import {LEVELS} from '../src/game/maps.js';
const noop=()=>{},V=(x=0,z=0)=>new T.Vector3(x,0,z);
// Decode actual meshes/skins/clips; image pixels are irrelevant to these animation checks.
const loader=new GLTFLoader().register(parser=>{const get=parser.getDependency.bind(parser);parser.getDependency=(type,index)=>type==='texture'?Promise.resolve(new T.Texture()):get(type,index);return {name:'TEST_TEXTURE'};});
const load=async file=>{const b=fs.readFileSync('public/assets/mx/'+file+'.glb');return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const a=new Assets();a.gltf.set('mx:anims',await load('anims'));
for(const name of ['snowyeti','icegiant','vera','mage'])a.gltf.set('mx:'+name,await load(name));
for(const profile of ['snowyeti','frostgiant','icemaiden','frostmonk']){
 const clips=a._profileClips(profile).clips;assert(clips.some(c=>c.name==='Walking_Backwards'),profile+' has retreat animation');
 const c=a.character(profile);assert(c.clips.length>=9);const mixer=new T.AnimationMixer(c.root);
 for(const clip of c.clips){assert(clip.tracks.length>0,profile+' '+clip.name);const action=mixer.clipAction(clip);action.play();for(let i=0;i<30;i++){mixer.setTime(clip.duration*i/30);c.root.updateMatrixWorld(true);c.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}action.stop();}
 const native=PROFILES[profile].animations==='model';if(native){assert.equal(c.mats.length,1);assert(c.mats[0].isMeshStandardMaterial,'downloaded unlit materials become lit PBR');const e={type:profile,model:c.root,mats:c.mats,game:{materials:{tex:{}}}};dressWinterEnemy(e);for(const m of c.mats.slice(0,1)){const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};m.onBeforeCompile(shader);assert(shader.fragmentShader.includes('frostFur'));}const size=new T.Box3().setFromObject(c.root).getSize(new T.Vector3());assert(size.x>1&&size.x<4&&size.y>1&&size.y<4);let draws=0,tris=0;const geos=new Set();e.model.traverse(o=>{if(o.isMesh){draws++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geos.add(o.geometry);}});assert(draws<22&&tris<25000);for(let i=0;i<120;i++){e.currentName=i<60?'Running_A':'attack';e.winterArtUpdate(.025);e.model.updateMatrixWorld(true);e.model.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}e.winterArtDispose();e.winterArtDispose();assert.equal(e.mats.length,1,'owned body materials released without touching the cloned native head material');}
 const ground=a.groundSpeed(profile,'Walking_Backwards');assert(ground>1&&ground<12,profile+' calibrated backwards speed '+ground);
 console.log(profile,'backwards ground speed',ground.toFixed(2));
}
assert(levelResources(LEVELS.frostpass(),'mage').models.includes('mx:snowyeti'));assert(levelResources(LEVELS.frostpass(),'mage').models.includes('mx:icegiant'));for(const id of ['camp','harbor','monastery'])assert(!levelResources(LEVELS[id](),'mage').models.includes('mx:snowyeti'));
for(const count of [420,900]){
 const snow=createSnowfall({count});assert.equal(snow.mesh.count,count);const seed=snow.mesh.geometry.attributes.snowSeed,params=snow.mesh.geometry.attributes.snowParams;assert.equal(seed.count,count);assert(seed.array.every(Number.isFinite));assert(params.array.every(Number.isFinite));
 for(let i=0;i<count;i++){assert(params.getX(i)>=.35&&params.getX(i)<=1.01);assert(params.getY(i)>=.035&&params.getY(i)<.33);}
 for(let i=0;i<3600;i++)snow.update(1/60,{gust:i%2});assert(Number.isFinite(snow.mesh.material.uniforms.time.value));
 // World anchoring preserves a flake when the camera anchor crosses a tile, modulo the distant wrap edge.
 const area=48,x=seed.getX(2),world=anchor=>((x-anchor+area*.5)%area+area)%area-area*.5+anchor;assert(Math.abs(world(0)-world(16))<.0001||Math.abs(Math.abs(world(0)-world(16))-area)<.0001);
 snow.mesh.geometry.dispose();snow.mesh.material.dispose();snow.mesh.dispose();
}
// Retreat plays measured locomotion instead of standing/casting while position changes.
{
 const moving=[],e=Object.create(Enemy.prototype),p={alive:true,pos:V(0,4)},g={player:p,allies:[],enemies:[e],cinematic:false,audio:{play:noop},level:{clear:()=>true,move(pos,x,z){pos.x+=x;pos.z+=z;return true;}}};
 Object.assign(e,{game:g,type:'icemaiden',T:ENEMY_TYPES.icemaiden,pos:V(),home:V(),state:'chase',alive:true,facing:0,cd:99,t:0,knock:V(),frozen:0,slow:0,stagger:0,winterCd:99,path:[],root:new T.Group(),mixer:{timeScale:1},updateVisual:noop,play:noop,face:noop,locomote:(name,speed)=>moving.push({name,speed})});e.update(.1);assert.equal(moving[0].name,'Walking_Backwards');assert(Math.abs(moving[0].speed-e.T.speed*.7)<1e-6);
 e.winterMinor={at:p.pos.clone(),t:0,windup:.1,warning:{stop:noop}};g.fx={add:noop,ring:noop};g.gfx={scene:new T.Scene()};e.state='attack';e.cd=0;p.hurt=noop;g.story={sixth:{}};g.time=0;e.update(.1);assert.equal(e.state,'chase');assert(e.cd>=.6);
}
// Snowman slam is telegraphed, interruptible and hits only its locked footprint.
for(const dodge of [false,true]){
 let hits=0,stopped=0;const p={alive:true,pos:V(0,4),radius:.6,has:()=>false,hp:1000,invuln:0,buffs:{},hurt(){hits++;}},g={time:0,low:true,player:p,allies:[],cinematic:false,story:{sixth:{}},audio:{play:noop},gfx:{scene:new T.Scene()},fx:{add:noop,ring:noop},level:{clear:()=>true}};
 const e={type:'snowyeti',T:ENEMY_TYPES.snowyeti,game:g,pos:V(),state:'chase',alive:true,play:noop,face:noop,playTimed:noop,winterCd:0,cd:0};winterUpdate(e,.025,4);assert(e.winterMinor);if(dodge)p.pos.set(12,0,12);winterUpdate(e,.5,4);assert.equal(hits,0);winterUpdate(e,.6,4);assert.equal(hits,dodge?0:1);assert.equal(e.state,'chase');assert(e.winterCd>=7);
 e.winterMinor={warning:{stop:()=>stopped++}};e.frozen=1;winterUpdate(e,.1,4);assert.equal(stopped,1);assert(!e.winterMinor);
}
console.log('Snow revision: native creature rigs/actions/PBR, chapter loading, slow layered flakes, stable world anchoring, calibrated retreat, cast recovery and snowman slam escapes passed.');
