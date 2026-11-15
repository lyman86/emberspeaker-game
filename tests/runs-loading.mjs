import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { Assets } from '../src/core/assets.js';
import { Materials, PBR_SETS } from '../src/core/materials.js';
import { levelResources, MENU_RESOURCES } from '../src/game/resources.js';
import { LEVELS } from '../src/game/maps.js';
import { Level } from '../src/game/level.js';
import { PROFILES } from '../src/game/models.js';
import { ENEMY_TYPES } from '../src/game/enemy.js';
import { CHAPTERS, challengeSetup, prepareChallengePlayer, runSaveKey } from '../src/game/runs.js';
import { Player } from '../src/game/player.js';
import { CLASSES } from '../src/game/classes.js';
import { CLASS_SKILLS } from '../src/game/skills.js';
import { GameAudio } from '../src/core/audio.js';
const noop=()=>{};
// Resource plans must cover actual map constructors, including scanned props hidden behind legacy names.
for(const factory of Object.values(LEVELS)){
 const spec=factory(),needed=levelResources(spec,'mage'),usedModels=new Set(),usedMaterials=new Set(),mat=new T.MeshStandardMaterial();
 for(const name of needed.models){const file=name.startsWith('mx:')?'mx/'+name.slice(3)+'.glb':name.startsWith('ph:')?'ph/'+name.slice(3)+'.glb':name==='Skeleton_Arrow'?'weapons/'+name+'.gltf':'props/'+name+'.glb';assert(fs.existsSync('public/assets/'+file),file);}
 const assets={parts:name=>{usedModels.add(name);return [];},prop:name=>{usedModels.add(name);return new T.Group();},bounds:name=>{usedModels.add(name);return new T.Box3(V(-.1),V(.1));},gltf:{has:n=>fs.existsSync('public/assets/props/'+n+'.glb'),values:()=>[]}};
 const materials={cache:{shared:mat},tex:{rock_surface:{nor:null}},get:name=>{usedMaterials.add(name);return mat;}};
 const g={assets,materials,low:true,player:{pos:new T.Vector3()},audio:{play:noop},gfx:{addShake:noop},smoke:{emit:noop}};
 const warn=console.warn;console.warn=noop;const level=new Level(g,spec);console.warn=warn;
 for(const name of usedModels)assert(needed.models.includes(name),spec.id+' unplanned model '+name);
 const ids=new Set(needed.materials.map(k=>PBR_SETS[k].id));for(const name of usedMaterials)assert(ids.has(PBR_SETS[name].id),spec.id+' unplanned material '+name);
 level.dispose();
}
function V(v){return new T.Vector3(v,v,v);}
assert(!MENU_RESOURCES.models.includes('mx:boss'));assert(!MENU_RESOURCES.models.some(x=>x.startsWith('ph:')));
const flat=levelResources(LEVELS.saltflat(),'mage');assert(!flat.models.includes('mx:boss'));assert(!flat.models.includes('mx:minion'));assert(!flat.models.includes('ph:GothicCabinet_01'));
const camp=levelResources(LEVELS.camp(),'mage');assert(!camp.models.includes('mx:boss'));assert(!camp.models.includes('mx:elite'));assert(!camp.materials.includes('forestFloor'));
for(const c of CHAPTERS){const spec=LEVELS[c.bossMap]();spec.def.spawns=spec.def.spawns.filter(e=>e.type===c.boss);const list=levelResources(spec,'mage').models;
 for(const child of ({boss:['minion','warrior'],stag:['minion'],ironking:['rebel'],saltqueen:['warrior','mage']})[c.boss])assert(list.includes('mx:'+PROFILES[child].file),'boss summon model');}
// Concurrent requests deduplicate; failures can retry; release skips retained shared models.
{
 const a=new Assets(),calls=[],disposed=[];let fail=true;
 a.loader.loadAsync=async url=>{calls.push(url);await Promise.resolve();if(url.includes('boss')&&fail)throw new Error('test interrupted download');const scene=new T.Group(),geo=new T.BoxGeometry(),m=new T.MeshBasicMaterial();geo.addEventListener('dispose',()=>disposed.push(url));scene.add(new T.Mesh(geo,m));return {scene,animations:[]};};
 await Promise.all([a.load(['mx:player']),a.load(['mx:player','mx:anims'])]);assert.equal(calls.length,2);
 await assert.rejects(a.load(['mx:boss']));fail=false;await a.load(['mx:boss']);assert(a.gltf.has('mx:boss'));
 a.retain(['mx:player','mx:anims']);assert(!a.gltf.has('mx:boss'));assert.equal(disposed.length,1);a.retain([]);
}
{
 const m=new Materials({capabilities:{getMaxAnisotropy:()=>1}}),urls=[];m.loader.loadAsync=async url=>{urls.push(url);return new T.Texture();};
 await Promise.all([m.load(['wall']),m.load(['cryptWall'])]);assert.equal(urls.length,3,'same physical PBR set should load once');m.get('wall',1.5);m.retain(['cryptWall']);assert(m.tex.medieval_blocks_02);m.retain([]);assert.equal(Object.keys(m.tex).length,0);
}
// Challenges get their own clean progression; no story save is imported or overwritten.
assert.equal(runSaveKey('mage'),'emberspeaker.save.mage');assert.equal(runSaveKey('mage',true),'emberspeaker.qa.mage');
for(const mode of ['chapter','boss'])for(const c of CHAPTERS)for(const cls of Object.keys(CLASSES)){
 const setup=challengeSetup(mode,c.id),p=Object.assign(Object.create(Player.prototype),{cls,C:CLASSES[cls],skills:CLASS_SKILLS[cls],buffs:{},game:{ui:{refreshStats:noop}},refreshGear:noop});
 prepareChallengePlayer(p,setup);assert.equal(p.level,mode==='boss'?c.bossLevel:c.level);assert(p.skillPoints>=0);assert.equal(p.hp,p.maxHp);assert(Object.values(p.equip).length>=6);assert(!setup.flags.ep4?.done);
 if(c.id===1)assert(!setup.flags.bossDead);if(c.id>1)assert(setup.flags.bossDead);if(c.id>2)assert(setup.flags.ep2.done);if(c.id>3)assert(setup.flags.ep3.done);
}
// Recorded loops request only the active mood, and episode-two effects are not fetched by other chapters.
{
 const a=new GameAudio(),calls=[];a.ctx={};a._applyLoops=noop;a.setMood=m=>{a.mood=m;};a.manifest={sfx:{hit:{files:['hit.mp3']},e_wolf:{files:['episode2/wolf.mp3']}},amb:{amb_wind:{file:'wind.mp3'},amb_swamp:{file:'episode2/swamp.mp3'},amb_cave:{file:'cave.mp3'}},music:{mus_crypt:{file:'crypt.mp3'}}};a.loadOverrides=async()=>{a.loops??={};a.pending??=new Map();return a.manifest;};a._file=async f=>{calls.push(f);return {};};
 await a.prepare('salt',4);assert(!calls.some(f=>f.startsWith('episode2/')));assert(!calls.includes('cave.mp3'));
 await a.prepare('swamp',2);assert(calls.includes('episode2/wolf.mp3'));assert(a.loops.amb_swamp);assert(!a.loops.amb_wind);
 await a.prepare('salt',4);assert(!a.overrides.e_wolf);assert(!a.loops.amb_swamp);
}
console.log('Per-map dependency coverage, model/texture deduplication, failed-load retry, resource release, independent challenge setup and audio isolation passed.');
