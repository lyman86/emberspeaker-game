import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {dressBossMotion} from '../src/game/boss-motion.js';
import {GameAudio} from '../src/core/audio.js';
import {SALT_BOSS_SOUNDS,ABBESS_SOUNDS} from '../src/game/boss-sounds.js';
const root=new T.Group(),bone=new T.Bone();bone.name='HairL1';root.add(bone);const e={model:root,pos:new T.Vector3(),facing:0,alive:true};const dispose=dressBossMotion(e);let peak=0;
for(let i=0;i<3600;i++){e.pos.x+=.04;e.facing=Math.sin(i*.03)*Math.PI;e.resetSecondaryMotion();e.secondaryMotion(i%100===0?2:1/60);peak=Math.max(peak,bone.quaternion.angleTo(new T.Quaternion()));assert(bone.quaternion.toArray().every(Number.isFinite));assert(Math.abs(bone.quaternion.length()-1)<1e-6);}
assert(peak>.01&&peak<.16,'secondary motion responds and stays constrained');e.resetSecondaryMotion();assert(bone.quaternion.angleTo(new T.Quaternion())<1e-6,'no accumulated rotation');dispose();dispose();assert.equal(e.secondaryMotion,null);
const manifest=JSON.parse(fs.readFileSync('public/audio/manifest.json'));const hashes=new Set();for(const name of [...SALT_BOSS_SOUNDS,...ABBESS_SOUNDS]){const path=manifest.sfx[name].files[0],b=fs.readFileSync('public/audio/'+path);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert(b.length>22050);hashes.add(b.subarray(44,1044).toString('base64'));}assert.equal(hashes.size,20,'unique warning and impact waveforms');
const a=new GameAudio(),calls=[];a.ctx={};a.setMood=m=>a.mood=m;a.loadMood=async()=>{};a.loadOverrides=async()=>{a.manifest=manifest;a.pending??=new Map();};a._file=async f=>{calls.push(f);return {};};
await a.prepare('salt_boss',4);assert(SALT_BOSS_SOUNDS.every(n=>a.overrides[n]));assert(!calls.some(f=>f.startsWith('episode6/')));calls.length=0;await a.prepare('winter_boss',6);assert(SALT_BOSS_SOUNDS.every(n=>!a.overrides[n]));assert(ABBESS_SOUNDS.every(n=>a.overrides[n]));assert(!calls.some(f=>f.startsWith('episode4/')));await a.prepare('camp',1);assert(ABBESS_SOUNDS.every(n=>!a.overrides[n]));
console.log('Boss secondary motion: stable constrained response and disposal; 20 distinct audio waves, chapter preload/release isolation and real release-frame cues passed.');
