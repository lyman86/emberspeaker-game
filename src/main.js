import * as THREE from 'three';
import { Assets } from './core/assets.js';
import { Gfx } from './core/gfx.js';
import { Particles } from './core/particles.js';
import { GameAudio } from './core/audio.js';
import { Materials } from './core/materials.js';
import { Level, CELL, containsTrigger } from './game/level.js';
import { LEVELS } from './game/maps.js';
import { Actor } from './game/actor.js';
import {XP_TABLE} from './game/progression.js';
import { Player } from './game/player.js';
import { Enemy } from './game/enemy.js';
import { Ally } from './game/ally.js';
import { Fx } from './game/fx.js';
import { Gear } from './game/gear.js';
import { Decals } from './game/decals.js';
import { paintSkillIcons } from './game/skillart.js';
import { CLASS_SKILLS } from './game/skills.js';
import { UI } from './game/ui.js';
import { TouchControls } from './game/touch.js';
import {saltDamage} from './game/salt.js';
import {ironDamage} from './game/iron.js';
import { bossDamage } from './game/stag.js';
import { SaltCampaign as Campaign } from './game/salt-campaign.js';
import { MENU_RESOURCES, SHARED_MATERIALS, levelResources } from './game/resources.js';
import { CHAPTERS, challengeSetup, prepareChallengePlayer, runSaveKey } from './game/runs.js';
import { rollDrop, makeItem, RARITY, BASES } from './game/items.js';
import { visualKind } from './game/gear.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const touchMode=params.has('touch')||matchMedia('(pointer:coarse)').matches;
document.body.classList.toggle('touch',touchMode);
const rnd = (a, b) => a + Math.random() * (b - a);
const SAVE_KEY = cls => runSaveKey(cls,import.meta.env.DEV&&params.has('qa'));

class Input {
  constructor(game) {
    this.g = game;
    this.mouse = new THREE.Vector2(0, 0);
    this.px = { x: innerWidth / 2, y: innerHeight / 2 };
    this.lmb = false; this.rmb = false; this.shift = false; this.blocked = false;
    this.ground = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pressed = [];
    const c = game.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => { this.px.x = e.clientX; this.px.y = e.clientY; this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
    c.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.lmb = true; this.pressed.push('lmb'); }
      if (e.button === 2) { this.rmb = true; this.pressed.push('rmb'); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) { this.lmb = false; this.blocked = false; } if (e.button === 2) this.rmb = false; });
    window.addEventListener('keydown', (e) => { this.shift = e.shiftKey; if (!e.repeat) this.pressed.push(e.code); if (e.code === 'Space' || e.code === 'Tab') e.preventDefault(); });
    window.addEventListener('keyup', (e) => { this.shift = e.shiftKey; });
    window.addEventListener('blur', () => { this.lmb = this.rmb = false; });
  }
  /** Ignore the mouse button currently held (used when a click closed a dialogue). */
  swallow() { if (this.lmb) this.blocked = true; this.pressed.length = 0; }
  update() {
    this.ray.setFromCamera(this.mouse, this.g.gfx.camera);
    this.ray.ray.intersectPlane(this.plane, this.ground);
  }
}

class Game {
  constructor() {
    this.canvas = $('#view');
    let q = params.get('q');
    try { q ??= localStorage.getItem('emberspeaker.quality'); } catch {}
    this.touchMode=touchMode;
    this.quality = ['high', 'mid', 'low'].includes(q) ? q : touchMode?'low':'high';
    this.low = this.quality === 'low';
    this.assets = new Assets();
    this.gfx = new Gfx(this.canvas, this.quality);
    this.materials = new Materials(this.gfx.renderer);
    this.materials.pom = !this.low;
    this.gear = new Gear(this.gfx.renderer, this.materials);
    this.decals = new Decals(this);
    paintSkillIcons(Object.values(CLASS_SKILLS).flat());
    this.audio = new GameAudio();
    this.fx = new Fx(this);
    this.ui = new UI(this);
    this.input = new Input(this);
    if(touchMode)this.touch=new TouchControls(this);
    this.enemies = []; this.allies = []; this.projectiles = []; this.npcs = []; this.loot = []; this.chests = []; this.timers = [];
    this.time = 0; this.timeScale = 1; this.slowT = 0; this.stopT = 0;
    this.cinematic = false; this.paused = false; this.started = false;
    this.inside = new Set();
    this.hover = null;
    this.clock = new THREE.Clock();
  }

  async boot() {
    await this.loadResources('准备英雄大厅', async progress=>{
      await Promise.all([this.assets.load(MENU_RESOURCES.models,p=>progress(p*.6)),this.materials.load(MENU_RESOURCES.materials),this.fx.load()]);
      progress(1);
    });
    this.particles = new Particles(this.gfx.scene, this.low ? 3000 : 7000, true, this.fx.tex.atlas);
    this.smoke = new Particles(this.gfx.scene, 1400, false, this.fx.tex.atlas, { lit: true });
    // fluid-simulated flipbooks (tools/bake-flipbooks.py)
    this.flames = new Particles(this.gfx.scene, this.low ? 300 : 700, true, this.fx.tex.flip_fire, { flip: true, fps: 30 });
    this.blazes = new Particles(this.gfx.scene, this.low ? 200 : 500, true, this.fx.tex.flip_blaze, { flip: true, fps: 26 });
    this.blasts = new Particles(this.gfx.scene, this.low ? 80 : 200, true, this.fx.tex.flip_explosion, { flip: true });
    this.puffs = new Particles(this.gfx.scene, this.low ? 300 : 700, false, this.fx.tex.flip_smoke, { flip: true, lit: true });
    this.dusts = new Particles(this.gfx.scene, this.low ? 200 : 500, false, this.fx.tex.flip_dust, { flip: true, lit: true });
    $('#loading .status').textContent = '余烬已燃。';
    $('#loading').classList.remove('hidden');
    const btn = $('#start');
    btn.classList.remove('hidden');
    const go = () => {
      btn.removeEventListener('click', go);
      this.audio.init();
      $('#loading').classList.add('hidden');
      if (params.has('cls')) this.begin(['warrior','ranger','mage','paladin','necro'].includes(params.get('cls'))?params.get('cls'):'mage', params.has('new'), {mode:['chapter','boss'].includes(params.get('mode'))?params.get('mode'):'story',chapter:Math.max(1,Math.min(4,Number(params.get('chapter'))||1))});
      else this.title();
    };
    btn.addEventListener('click', go);
    if (params.has('autostart')) go();
    this.loop();
  }

  title() {
    this.ui.modeSelect(selection=>this.ui.classSelect((cls,fresh)=>this.begin(cls,fresh,selection),selection));
  }

  async loadResources(title,work) {
    const loading=$('#loading'),status=loading.querySelector('.status'),bar=loading.querySelector('.progress i'),button=$('#start');
    loading.classList.remove('hidden');loading.querySelector('.ep').textContent=title;button.classList.add('hidden');
    for(;;){
      status.textContent='正在加载所需资源…';bar.style.width='0%';
      try{await work(p=>{bar.style.width=Math.round(p*100)+'%';status.textContent=`正在加载所需资源 · ${Math.round(p*100)}%`;});break;}
      catch(err){console.error(err);status.textContent='资源加载中断，请检查网络后重试。';button.textContent='重试加载';button.classList.remove('hidden');await new Promise(resolve=>button.addEventListener('click',resolve,{once:true}));button.classList.add('hidden');}
    }
    bar.style.width='100%';loading.classList.add('hidden');button.textContent='开始游戏';
  }

  finishRun() {
    if(this.run.mode==='story'||this.runFinished)return;
    this.runFinished=true;this.paused=true;this.ui.closePanels();
    document.querySelector('#boss-prep')?.remove();this.ui.runResult(this.run,this.runElapsed??0,this.runDeaths??0);
  }

  returnToTitle(){this.save(true);location.href=location.pathname+(this.touchMode?'?touch=1':'');}

  /** Idle character for the class-select showcase. */
  _makeShowcaseActor(cls) {
    const P = new Player(this, cls);
    P.play('Idle');
    return P;
  }

  /** Start (or continue) a game as the chosen class. */
  async begin(cls, fresh = false, selection = {mode:'story',chapter:1}) {
    this.run={mode:selection.mode,chapter:selection.chapter};this.bossReady=selection.mode!=='boss';this.runElapsed=0;
    const setup=selection.mode==='story'?null:challengeSetup(selection.mode,selection.chapter);
    const save = fresh||setup ? null : this.loadSave(cls);
    this.player = new Player(this, cls);
    this.gfx.scene.add(this.player.root);
    this.story = new Campaign(this);
    if (save) {
      this.player.fromSave(save.player);
      this.story.stage = save.story.stage; this.story.flags = save.story.flags;
      this._marks = save.marks ?? {};
    }
    this.ui.el.fade.classList.add('on');
    let startLevel=save?.level??'camp';
    if(setup){this.story.stage=setup.stage;this.story.flags=setup.flags;prepareChallengePlayer(this.player,setup);startLevel=setup.map;}
    if(import.meta.env.DEV && params.has('qa')) {
      this.player.level=30;this.player.gold=10000;this.player.materials={iron:99,soul:99,star:99,bone:10,venom:10};
      this.player.skillRanks=Object.fromEntries(this.player.skills.map(s=>[s.id,s.slot===6?5:1]));
      this.player.recalc();this.player.hp=this.player.maxHp;this.player.mp=this.player.maxMp;
      this.story.stage='done';this.story.flags={bossDead:true,key:true,counter1:true,tongues:1,ep2:{started:true,messenger:true,hunter:true,totems:['totem_0','totem_1','totem_2'],butcher:true}};
      const qa=params.get('qa');
      startLevel=qa==='stag'?'swamp':['forest','swamp'].includes(qa)?qa:['boss','collision'].includes(qa)?'crypt':['road','mill','grove'].includes(qa)?'forest':'camp';
      if(['boss','collision'].includes(qa)){this.story.stage='crypt';this.story.flags={key:true,bossTalk:params.has('retry')};}
      if(qa==='stag'){this.player.level=10;this.player.equip={};for(const base of this.player.C.start){const item=makeItem(base,{ilvl:9,rarity:'common'});this.player.equip[item.slot]=item;}this.player.skillRanks=Object.fromEntries(this.player.skills.map(s=>[s.id,s.slot===6?1:[2,3,4].includes(s.slot)?2:1]));this.player.recalc();this.player.refreshGear();this.player.hp=this.player.maxHp;this.player.mp=this.player.maxMp;this.player.potions={hp:6,mp:6};}
      if(['pass','fortress','knight','ironking'].includes(qa)){
        this.story.flags.ep2.done=true;this.story.flags.ep3={started:true,aida:qa!=='pass',orders:qa!=='pass',knight:qa==='ironking',standards:[]};
        startLevel=qa==='pass'?'pass':'fortress';this.player.level=qa==='pass'?10:qa==='ironking'?13:12;this.player.xp=XP_TABLE[this.player.level-1];
        this.player.equip={};for(const base of this.player.C.start){const it=makeItem(base,{ilvl:this.player.level-1,rarity:'rare'});this.player.equip[it.slot]=it;}
        this.player.skillRanks=Object.fromEntries(this.player.skills.map(s=>[s.id,s.slot===6?(this.player.level>=13?2:1):[2,3,4].includes(s.slot)?Math.min(3,1+Math.floor((this.player.level-s.unlock)/3)):1]));
        this.player.recalc();this.player.refreshGear();this.player.hp=this.player.maxHp;this.player.mp=this.player.maxMp;this.player.potions={hp:8,mp:8};
      }
      if(qa==='journey')this.story.flags.ep2={totems:[]};
      if(qa==='road')this.story.flags.ep2={started:true,totems:[]};
      if(qa==='grove')this.story.flags.ep2={started:true,messenger:true,totems:[]};
      if(qa==='mill')this.story.flags.ep2={started:true,messenger:true,hunter:true,totems:['totem_0','totem_1','totem_2']};
    }
    await this.loadLevel(startLevel, { silent: true });
    if(import.meta.env.DEV&&params.has('qa')){
      const point={boss:[15,13],collision:[25,27],phone:[7,23],stag:[17,11],mill:[25,14],grove:[19,40],knight:[21,32],ironking:[21,19]}[params.get('qa')];
      if(point){this.player.pos.copy(this.level.center(...point));this.gfx.snap(this.player.pos);}
      if(params.get('qa')==='stag'){const e=this.enemies.find(e=>e.type==='stag');if(e){const phase=Number(params.get('phase')??1);e.hp=e.maxHp*(phase===3?.2:phase===2?.5:1);if(params.has('move')){e.phase=phase;e.stag={phase,index:({roots:0,cleave:1,charge:2,nova:3})[params.get('move')]??0,rest:.5,cast:null,poise:0,exposed:0};}}}
      if(params.get('qa')==='ironking'){const e=this.enemies.find(e=>e.type==='ironking');e.hp=e.maxHp*(params.get('phase')==='3'?.25:params.get('phase')==='2'?.5:1);}
      const bar=document.createElement('div');bar.id='qa-campaign';bar.style.cssText='position:fixed;left:16px;top:135px;z-index:16;display:flex;gap:6px';
      const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.style.cssText='font-size:12px;letter-spacing:0;padding:7px 10px';b.onclick=fn;bar.appendChild(b);};
      if(['pass','fortress','knight','ironking'].includes(params.get('qa')))button('切换第三关测试点',()=>{location.href='?qa='+({pass:'knight',knight:'ironking',ironking:'pass',fortress:'ironking'}[params.get('qa')])+(this.touchMode?'&touch=1':'');});
      button('检查第二集音频',()=>{const keys=['e_villager','e_goblin','e_wolf','e_witch','e_butcher','e_poison','e_roots'];const ok=keys.filter(k=>this.audio.overrides[k]).length;const beds=['amb_forest','amb_swamp','amb_mill'].filter(k=>this.audio.loops?.[k]).length;this.ui.toast(`音频解码：怪物 ${ok}/7 · 环境 ${beds}/3`);this.audio.play('e_witch',this.player.pos);});
      if(params.get('qa')==='collision')button('冲向柜子背面',()=>{const b=this.level.boxes.filter(b=>b.prop==='cabinet').sort((a,b)=>Math.hypot(a.x-this.player.pos.x,a.z-this.player.pos.z)-Math.hypot(b.x-this.player.pos.x,b.z-this.player.pos.z))[0];if(b){const dir=new THREE.Vector3(b.x-this.player.pos.x,0,b.z-this.player.pos.z).normalize();this.player.castSlot(5,new THREE.Vector3(b.x,0,b.z).addScaledVector(dir,3));}});
      if(params.get('qa')==='boss'){
        button('走入祭坛侧边',()=>{this.player.moveTo(50,44);});
        button('验证重试',()=>{this.respawn();this.player.pos.copy(this.level.center(15,13));this.gfx.snap(this.player.pos);});
        button('结束 Boss 战',()=>{const e=this.enemies.find(e=>e.type==='boss'&&e.alive);if(e&&!e.asleep){e.invulnerable=false;e.takeDamage(99999);}});
      }
      if(params.has('hideqa'))bar.style.display='none';
      document.querySelector('#qa-campaign')?.remove();document.body.appendChild(bar);
    }
    this.ui.show();
    this.started = true;
    if(import.meta.env.DEV && params.get('qa')==='ultimate') {
      const replay=document.createElement('button');replay.id='qa-ultimate';replay.textContent='预览大招 · 慢放';
      replay.style.cssText='position:fixed;left:20px;top:150px;z-index:80;font-size:14px;letter-spacing:0;padding:8px 16px';
      replay.onclick=()=>{
        this.fx.clear();this.timers=[];for(const a of this.allies)a.dispose();this.allies=[];
        this.player.pos.y=0;this.player.lock=0;this.player.pending=null;this.player.cds[this.player.skills[6].id]=0;
        this.player.castSlot(6,this.player.pos.clone().add(new THREE.Vector3(0,0,-7)));
      };document.querySelector('#qa-ultimate')?.remove();document.body.appendChild(replay);
    }
    if(import.meta.env.DEV && params.get('qa')==='equipment'){
      this.player.bag=Object.keys(BASES).map((base,i)=>makeItem(base,{ilvl:10,rarity:i%3===0?'rare':'common'}));
      for(const base of ['chest','robe','leather','gloves','boots','helm','hood']){
        this.player.bag.push(makeItem(base,{ilvl:10,rarity:'legendary'}));
        if(['chest','gloves','boots','helm'].includes(base))this.player.equip[BASES[base].slot]=makeItem(base,{ilvl:10});
      }
      this.player.recalc();this.player.refreshGear();this.ui.toggleBag();
    }
    if(import.meta.env.DEV && params.get('qa')==='supplies')this.ui.openShop(['hunter','quartermaster','apothecary','smith'].includes(params.get('shop'))?params.get('shop'):'hunter');
    if(import.meta.env.DEV && params.get('qa')==='forge'){this.ui.openShop('smith');this.ui.openGrowth('forge');}
    if(setup){
      this.ui.fade(false);this.story.quest();this.ui.banner(CHAPTERS[setup.chapter-1].title,setup.mode==='boss'?'Boss 挑战 · 可先分配技能点':'关卡挑战 · 本次成长独立于故事');
      if(setup.chapter===1&&setup.mode==='chapter'){this.markNpc('roland',true);this.ui.setQuest('午夜钟声','与守夜人队长 <b>罗兰</b>交谈，开始本集冒险。');}
      $('#quit').textContent='结束挑战并返回标题';
      if(setup.mode==='boss')this.ui.prepareBoss();
    } else if(save?.story.stage==='intro'&&this.level.id==='camp'){
      this.story.onStart();
    } else if (save || import.meta.env.DEV && params.has('qa')) {
      this.ui.fade(false);
      this.audio.setMood(this.level.spec.audio);
      this.ui.setQuest(save?.quest?.[0] ?? '午夜钟声', save?.quest?.[1] ?? '');
      this.ui.banner(this.level.spec.name, '继续冒险');
      if(this.story.stage==='done')this.story.quest();
    } else if (params.has('skipintro')) {
      this.ui.fade(false); this.story.stage = 'talk_roland'; this.audio.setMood('camp');
      this.ui.setQuest('午夜钟声', '与守夜人队长 <b>罗兰</b> 交谈。'); this.markNpc('roland', true);
    } else this.story.onStart();
    this.save(true);
  }

  // ------------------------------------------------------------------ save / load
  loadSave(cls) { try { return JSON.parse(localStorage.getItem(SAVE_KEY(cls))); } catch { return null; } }
  saveInfo(cls) { const s = this.loadSave(cls); return s ? { level: s.player.level, where: LEVELS[s.level]?.()?.name, stage: s.story.stage } : null; }
  deleteSave(cls) { try { localStorage.removeItem(SAVE_KEY(cls)); } catch { /* storage unavailable */ } }

  /** Persist progress (debounced unless now=true). */
  save(now = false) {
    if (!this.player || !this.story || this.run?.mode!=='story') return;
    clearTimeout(this._saveT);
    const write = () => {
      const q = this.ui.el.quest;
      const data = { v: 3, player: this.player.toSave(), story: { stage: this.story.stage, flags: this.story.flags }, level: this.level?.id ?? 'camp', marks: this._marks,
        quest: [q.querySelector('.title').textContent, q.querySelector('.desc').innerHTML], at: Date.now() };
      try { localStorage.setItem(SAVE_KEY(this.player.cls), JSON.stringify(data)); } catch { /* storage unavailable */ }
    };
    if (now) write(); else this._saveT = setTimeout(write, 400);
  }

  // ------------------------------------------------------------------ levels
  async loadLevel(id, { silent = false } = {}) {
    if(this.loadingLevel)return;this.loadingLevel=true;
    const spec = LEVELS[id]();
    if(this.run?.mode==='boss'){const c=CHAPTERS[this.run.chapter-1];spec.def.spawns=spec.def.spawns.filter(s=>s.type===c.boss);spec.def.npcs=[];spec.def.chests=[];spec.def.triggers=spec.def.triggers.filter(t=>['boss_intro','stag_intro','king_intro','queen_intro'].includes(t.id));spec.def.start={x:c.point[0],z:c.point[1]};}
    const f=this.story.second,peaceful=id==='camp'&&['epilogue','done'].includes(this.story.stage);
    spec.def.spawns=peaceful?[]:spec.def.spawns.filter(s=>!(s.tag==='boss'&&this.story.flags.bossDead||s.tag==='elite'&&this.story.flags.key||s.tag?.startsWith('totem_')&&f.totems.includes(s.tag)||s.tag==='butcher'&&f.butcher||s.tag==='stag'&&f.bossDead||this.story.skipSpawn(s)));
    const needed=levelResources(spec,this.player.cls);
    const wasCinematic=this.cinematic;this.cinematic=true;
    await this.loadResources(spec.name,async progress=>{let a=0,b=0,c=0;const update=()=>progress(a*.65+b*.25+c*.1);await Promise.all([this.assets.load(needed.models,p=>{a=p;update();}),this.materials.load(needed.materials,p=>{b=p;update();}),this.audio.prepare(spec.audio,spec.episode??(['forest','swamp'].includes(id)?2:1)).then(()=>{c=1;update();})]);});
    if (!silent) { this.cinematic = true; await this.ui.fade(true); }
    for (const e of this.enemies) e.dispose();
    for (const a of this.allies) a.dispose();
    for (const n of this.npcs) n.actor?.dispose();
    for (const p of this.projectiles) p.mesh.removeFromParent();
    for (const l of this.loot) { l.mesh.removeFromParent(); l.label?.remove(); }
    this.enemies = []; this.allies = []; this.npcs = []; this.projectiles = []; this.loot = []; this.chests = []; this.timers = [];
    this.fx.clear(); for (const ps of [this.particles, this.smoke, this.flames, this.blazes, this.blasts, this.puffs, this.dusts]) ps.clear();
    this.level?.dispose();
    this.assets.retain(needed.models);this.materials.retain([...needed.materials,...SHARED_MATERIALS]);
    this.inside.clear();
    this.ui.prompt(null);

    const lv = (this.level = new Level(this, spec));
    this.gfx.scene.add(lv.group);
    this.decals.clear(); this.decals.scatter(lv);
    this.gfx.setMood(spec.mood);
    this.gfx.torches = lv.torches;
    const d = spec.def;
    for(const spawn of d.spawns)this.spawnEnemy(spawn.type,spawn.x*CELL+2,spawn.z*CELL+2,spawn);
    for (const n of d.npcs) this._makeNpc(n);
    for (const c of d.chests) this._makeChest(c);
    const st = lv.center(d.start.x, d.start.z);
    const start=lv.nearestFree(st.x,st.z,this.player.radius)??st;
    this.player.pos.set(start.x, 0, start.z);
    this.player.stop();
    this.player.facing = Math.PI;
    this.checkpoint = st.clone();
    this.gfx.snap(st);
    this.audio.setMood(spec.audio);
    this.story.onLevel(id);
    if (!silent) {
      await this.ui.fade(false);
      this.cinematic = false;
      this.ui.banner(spec.name, spec.sub);
    }
    this.cinematic=wasCinematic;this.loadingLevel=false;
    if(!silent){this.fx.glyph(this.player.pos,{tex:'magic1',color:[1.5,1.1,.5],r:3.5,dur:1.1,spin:.45});this.fx.pillar(this.player.pos,'holy',14,3);this.audio.play('e_blink',this.player.pos,.4);}
    this.save();
  }

  spawnEnemy(type, x, z, opts = {}) {
    const e = new Enemy(this, type, x, z, opts);
    this.gfx.scene.add(e.root);
    this.enemies.push(e);
    return e;
  }

  spawnAlly(type, x, z) {
    const a = new Ally(this, x, z, type);
    this.gfx.scene.add(a.root);
    this.allies.push(a);
    return a;
  }

  /** Fresh enemy corpses that Corpse Explosion can use. */
  corpses() { return this.enemies.filter((e) => !e.alive && !e.consumed && e.t < 6); }

  _makeNpc(n) {
    const p = this.level.center(n.x, n.z);
    const npc = { id: n.id, name: n.name, pos: p, marker: null, kind: 'npc' };
    if (n.model) {
      const a = (npc.actor = new Actor(this, n.model, { hide: n.hide }));
      a.pos.copy(p); a.facing = a.root.rotation.y = n.face ?? 0;
      a.play('Idle');
      this.gfx.scene.add(a.root);
    } else {
      const g = new THREE.Group(); g.position.copy(p);
      const wood = this.materials.get('wood');
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.5, 8), wood); post.position.y = 0.75; post.castShadow = true;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.9), wood); top.position.y = 1.55; top.rotation.x = 0.35; top.castShadow = true;
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.62), new THREE.MeshStandardMaterial({ color: 0xd8c9a0, emissive: 0x6a4a1a, emissiveIntensity: 0.9 })); book.position.set(0, 1.64, 0.02); book.rotation.x = 0.35;
      g.add(post, top, book);
      this.level.group.add(g);
      this.level.emitters.push({ kind: 'glint', x: p.x, y: 1.9, z: p.z, acc: 0 });
    }
    this.level.circles.push({ x: p.x, z: p.z, r: 0.9 });
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 0.5) }));
    m.position.set(p.x, 3.6, p.z); m.scale.y = 1.6; m.visible = false;
    this.level.group.add(m);
    npc.marker = m;
    if (this._marks?.[n.id]) m.visible = true;
    this.npcs.push(npc);
  }

  markNpc(id, on) {
    (this._marks ??= {})[id] = on;
    const n = this.npcs.find((x) => x.id === id);
    if (n) n.marker.visible = on;
  }

  _makeChest(c) {
    const p = this.level.center(c.x, c.z);
    const mesh = this.assets.prop('ph:treasure_chest');
    mesh.scale.setScalar(c.golden ? 1.9 : 1.6);
    mesh.position.copy(p); mesh.rotation.y = (c.rot ?? 0) + Math.PI;
    if (c.golden) mesh.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setRGB(1.25, 1.0, 0.55); } });
    this.level.group.add(mesh);
    let lid = null;
    mesh.traverse((o) => { if (!lid && /lid/i.test(o.name)) lid = o; });
    this.level.circles.push({ x: p.x, z: p.z, r: 1.1 });
    const opened = this.story.flags['chest_' + this.level.id + c.x + '_' + c.z];
    if (opened && lid) lid.rotation.x = -1.9;
    this.chests.push({ ...c, pos: p, mesh, lid, open: !!opened, kind: 'chest', name: c.golden ? '镀金宝箱' : '旧木箱' });
  }

  openChest(c) {
    if (c.open) return;
    c.open = true;
    this.story.flags['chest_' + this.level.id + c.x + '_' + c.z] = true;
    this.audio.play('chest', c.pos);
    this.fx.pillar(c.pos, 'holy', 40, 5);
    let t = 0;
    if (c.lid) this.level.anim.push((dt) => { t += dt; c.lid.rotation.x = -1.9 * Math.min(1, t / 0.45); return t < 0.45; });
    const n = c.golden ? 7 : 4;
    for (let i = 0; i < n; i++) this.dropLoot('gold', Math.round(c.gold / n), c.pos, true);
    for (const k of c.potions ?? []) this.dropLoot(k, 1, c.pos, true);
    const pl = this.player;
    pl.addMaterial('soul',c.golden?3:1);
    this.dropItem(c.golden ? rollDrop(pl.cls, pl.level + 1, 1,this.level.spec.episode??(['forest','swamp'].includes(this.level.id)?2:1)) : rollDrop(pl.cls, pl.level, 0,this.level.spec.episode??(['forest','swamp'].includes(this.level.id)?2:1)), c.pos);
    this.save();
  }

  // ------------------------------------------------------------------ loot
  dropLoot(kind, value, at, toss = false) {
    let mesh;
    if (kind === 'gold') { mesh = this.assets.prop('coin_stack_small'); mesh.scale.setScalar(0.9); }
    else {
      const col = kind === 'hp' ? [2, 0.15, 0.1] : [0.2, 0.5, 2.4];
      mesh = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(...col).multiplyScalar(0.4), emissive: new THREE.Color(...col).multiplyScalar(0.4), roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 })); glass.position.y = 0.3;
      const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.24, 8), this.materials.get('wood')); nk.position.y = 0.6;
      mesh.add(glass, nk);
    }
    const a = rnd(0, 6.28), r = toss ? rnd(1.6, 2.6) : rnd(0.3, 1.2);
    const target = new THREE.Vector3(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r);
    if (this.level.blocked(target.x, target.z, 0.4)) target.set(at.x, 0, at.z);
    mesh.position.set(at.x, 0.6, at.z);
    this.gfx.scene.add(mesh);
    this.loot.push({ kind, value, mesh, from: new THREE.Vector3(at.x, 0, at.z), target, t: 0 });
  }

  /**
   * Equipment on the ground: the item's own 3D model lying in the dirt, a floating name label, and a rarity glow —
   * none for common, a soft blue pool for magic, a gold beam for rare, a tall orange pillar with a rune circle for legendary.
   */
  dropItem(item, at, { near = false } = {}) {
    const R = RARITY[item.rarity];
    const col = new THREE.Color(R.color);
    const mesh = new THREE.Group();
    const m = this.gear.model(item);
    const kind = visualKind(item);
    if (['bracer', 'greave', 'quiver'].includes(kind)) m.rotation.set(0, 0, Math.PI / 2);
    else if (!['helm', 'hood', 'pauldron', 'orb', 'relic'].includes(kind)) m.rotation.set(-Math.PI / 2, 0, 0);
    const holder = new THREE.Group(); holder.add(m); holder.scale.setScalar(1.45 * (kind === 'ring' || kind === 'amulet' ? 2.2 : 1));
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder), c = box.getCenter(new THREE.Vector3());
    holder.position.set(-c.x, -box.min.y + 0.02, -c.z);
    holder.rotation.y = 0;
    const spin = new THREE.Group(); spin.rotation.y = rnd(0, 6.28); spin.add(holder);
    mesh.add(spin);
    const fx = {};
    const ADDM = (o) => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, ...o });
    if (item.rarity !== 'common') {
      const lvl = { magic: 0, rare: 1, legendary: 2 }[item.rarity];
      const k = [0.8, 1.1, 1.35][lvl];
      fx.disc = new THREE.Mesh(this.fx.planeGeo, ADDM({ alphaMap: this.fx.tex.lightdisc, color: col.clone().multiplyScalar(k * 0.6), opacity: 0.4 }));
      fx.disc.scale.setScalar([1.3, 1.8, 2.4][lvl]); fx.disc.position.y = 0.05; mesh.add(fx.disc);
      const H = [2.2, 7, 16][lvl];
      fx.beam = new THREE.Mesh(new THREE.CylinderGeometry([0.12, 0.16, 0.2][lvl], [0.22, 0.3, 0.4][lvl], H, 16, 1, true), ADDM({ alphaMap: beamTex(), color: col.clone().multiplyScalar(k), opacity: [0.18, 0.3, 0.32][lvl] }));
      fx.beam.position.y = H / 2; mesh.add(fx.beam);
      if (lvl === 2) {
        fx.core = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, H * 0.9, 8, 1, true), ADDM({ alphaMap: beamTex(), color: new THREE.Color(1.6, 1.15, 0.6), opacity: 0.45 }));
        fx.core.position.y = H * 0.45; mesh.add(fx.core);
        fx.ring = new THREE.Mesh(this.fx.planeGeo, ADDM({ alphaMap: this.fx.tex.magic1, color: col.clone().multiplyScalar(1.0), opacity: 0.5 }));
        fx.ring.scale.setScalar(2.6); fx.ring.position.y = 0.07; mesh.add(fx.ring);
      }
    }
    const a = rnd(0, 6.28), r = near ? rnd(0.8, 1.4) : rnd(1, 2.2);
    const target = new THREE.Vector3(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r);
    if (this.level.blocked(target.x, target.z, 0.4)) target.set(at.x, 0, at.z);
    mesh.position.set(at.x, 0.6, at.z);
    this.gfx.scene.add(mesh);
    const label = this.ui.groundLabel(item);
    const l = { kind: 'item', item, mesh, label, fx, from: new THREE.Vector3(at.x, 0, at.z), target, t: 0, pos: target, name: item.name, spin };
    label.addEventListener('click', (e) => { e.stopPropagation(); if (e.button === 0 && this.player.alive && !this.cinematic) { this.player.interactTarget = l; this.player.moveTo(l.pos.x, l.pos.z); } });
    this.loot.push(l);
    if (!near) {
      if (item.rarity === 'legendary') { this.audio.play('legendary', at); this.ui.toast('传奇物品掉落：' + item.name); this.gfx.flash(at, 0xff9a40, 260, 0.9, 18); }
      else if (item.rarity === 'rare') this.audio.play('raredrop', at, 0.8);
    } else this.audio.play('itemdrop', at, 0.7);
    return l;
  }

  pickupItem(l) {
    if (!this.player.addItem(l.item)) { this.ui.toast('背包已满'); this.audio.play('denied'); return; }
    this.audio.play('pickup');
    this.ui.number(this.player.pos, l.item.name, 'info');
    l.mesh.removeFromParent(); l.label.remove(); this.ui.hideTip();
    this.loot.splice(this.loot.indexOf(l), 1);
    this.ui.refreshBag();
    this.save();
  }

  _updateLoot(dt) {
    const pl = this.player;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      l.t += dt;
      const k = Math.min(1, l.t / 0.45);
      if (k < 1) { l.mesh.position.lerpVectors(l.from, l.target, k); l.mesh.position.y = Math.sin(k * Math.PI) * 1.8; }
      else if (l.kind === 'item') {
        l.mesh.position.y = 0;
        const r = l.item.rarity, F = l.fx, w = this.gfx.time;
        if (F.beam) F.beam.material.opacity = (r === 'legendary' ? 0.32 : r === 'rare' ? 0.28 : 0.16) * (0.8 + 0.2 * Math.sin(w * 3 + l.t));
        if (F.disc) { F.disc.material.opacity = 0.34 + 0.1 * Math.sin(w * 2.4 + l.t); F.disc.rotation.y += dt * 0.3; }
        if (F.ring) F.ring.rotation.y -= dt * 0.5;
        if (F.core) F.core.material.opacity = 0.35 + 0.12 * Math.sin(w * 7);
        const rate = { common: 0, magic: 0.04, rare: 0.12, legendary: 0.45 }[r];
        if (Math.random() < rate) {
          const c = new THREE.Color(RARITY[r].color).toArray().map((v) => v * 3);
          this.particles.emit({ pos: { x: l.pos.x, y: 0.3, z: l.pos.z }, count: 1, radius: r === 'legendary' ? 1.2 : 0.6, flat: true, speed: [0, 0.3], up: r === 'legendary' ? 3.5 : 1.5, life: [0.6, 1.4], size: [0.1, 0.24], c0: c, c1: [0.2, 0.08, 0], tex: r === 'legendary' ? 'flame' : 'glint', grow1: 0.4 });
        }
      } else {
        const d = l.mesh.position.distanceTo(pl.pos);
        if (pl.alive && d < 5) l.mesh.position.lerp(pl.pos, Math.min(1, dt * (9 - d)));
        if (pl.alive && d < 1.3) {
          if (l.kind === 'gold') { const v = Math.round(l.value * (1 + pl.stats.gold / 100)); pl.gold += v; this.audio.play('coin'); this.ui.number(pl.pos, '+' + v + ' 金币', 'info'); }
          else { pl.potions[l.kind]++; this.audio.play('pickup'); this.ui.number(pl.pos, l.kind === 'hp' ? '生命药水' : pl.C.res.name + '药水', l.kind === 'hp' ? 'heal' : 'info'); }
          l.mesh.removeFromParent(); this.loot.splice(i, 1); this.save(); continue;
        }
        l.mesh.rotation.y += dt * 1.5;
        if (Math.random() < 0.06) this.particles.emit({ pos: { x: l.mesh.position.x, y: 0.5, z: l.mesh.position.z }, count: 1, speed: [0, 0.3], up: 1, life: [0.4, 0.8], size: [0.12, 0.25], c0: l.kind === 'gold' ? [3, 2, 0.4] : l.kind === 'hp' ? [3, 0.3, 0.2] : [0.3, 0.8, 3], c1: [0.2, 0.1, 0], tex: 'glint' });
      }
    }
  }

  // ------------------------------------------------------------------ combat helpers
  enemiesNear(pos, r) { return this.enemies.filter((e) => e.alive && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < r + e.radius); }
  nearestEnemy(pos, r) {
    let best = null, bd = r;
    for (const e of this.enemies) { if (!e.alive) continue; const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) - e.radius; if (d < bd) { bd = d; best = e; } }
    return best;
  }

  hurtEnemy(e, dmg, opts = {}) {
    const multiplier=((e.markedUntil??0)>this.time?1.2:1)*((this.player.has('plagueband')||this.player.has('sunseal')) && (e.slow>0||e.frozen>0)?1.2:1);
    const v = typeof dmg === 'number' ? Math.round(dmg) : dmg.v, crit = typeof dmg === 'number' ? false : dmg.crit;
    const final=saltDamage(e,ironDamage(e,bossDamage(e,Math.round(v*multiplier)*(this.player.buffs.siegebreaker?1.15:1),opts,this),opts,this),opts,this);
    if (!e.takeDamage(final, opts)) { if (e.alive && e.invulnerable) this.ui.number({ x: e.pos.x, y: e.scale, z: e.pos.z }, '免疫', 'info'); return; }
    if(this.player.has('hookchain') && (this.player._hookCd??0)<=0 && e.alive && !e.T.tough && Math.random()<0.15){
      this.player._hookCd=3;e.stun(1);const dir=this.player.pos.clone().sub(e.pos).setY(0);if(dir.length()>2){dir.setLength(Math.min(3,dir.length()-2));this.level.move(e.pos,dir.x,dir.z,e.radius);}
    }
    this.ui.number({ x: e.pos.x, y: 0.6 * e.scale, z: e.pos.z }, final + (crit ? '!' : ''), crit ? 'crit' : opts.ally ? 'ally' : '');
    if(!opts.ally&&!opts.quiet&&this.player.has('ironseal')&&e.alive){
      const pl=this.player;pl._sealHits=pl._sealTarget===e?(pl._sealHits??0)+1:1;pl._sealTarget=e;
      if(pl._sealHits>=3&&!(pl._sealAt>this.time)){pl._sealHits=0;pl._sealAt=this.time+2;const extra=Math.round(final*.6);e.takeDamage(extra,{...opts,quiet:true});this.ui.number(e.pos,extra+' 印玺','crit');this.fx.spark(e.pos,'steel',12);}
    }
    if (!opts.ally) this.ui.setTarget(e);
    if (!opts.quiet) this.audio.play('hit', e.pos, 0.7);
    if (crit) this.hitStop(0.035);
    if(!opts.ally&&!opts.quiet)this.player.onHit(crit);
  }

  onEnemyKilled(e) {
    if (e.tag !== 'summon' || Math.random() < 0.5) this.after?.(0.5, () => this.decals.blood(e.pos, (e.T.tough ? 3.4 : 2.2) * (e.scale ?? 1)));
    const T = e.T, pl = this.player;
    if(e.tag!=='summon')pl.gainXp(T.xp);
    if(e.tag!=='summon' && e.type!=='totem'){
      pl.addMaterial(T.episode===4?'salt':T.episode===3?'insignia':T.episode===2?'venom':'bone',T.tough?3:1);
      if(T.boss)pl.addMaterial('star');
      else if(T.tough)pl.addMaterial('soul',2);
      else if(Math.random()<0.45)pl.addMaterial('iron');
    }
    pl.onKill(e);
    if (e.tag!=='summon'&&(Math.random() < 0.75 || T.tough)) { const n = T.tough ? 5 : 1; for (let i = 0; i < n; i++) this.dropLoot('gold', Math.round(rnd(T.gold[0], T.gold[1]) / n), e.pos, T.tough); }
    const r = Math.random();
    if (T.tough) { this.dropLoot('hp', 1, e.pos, true); this.dropLoot('mp', 1, e.pos, true); }
    else if (e.tag !== 'summon') { if (r < 0.13) this.dropLoot('hp', 1, e.pos); else if (r < 0.22) this.dropLoot('mp', 1, e.pos); }
    // equipment: special and legendary gear only comes from the field
    if(e.tag!=='summon'){
      const chapter=T.episode??1;
      if(T.boss){this.dropItem(rollDrop(pl.cls,Math.max(e.level,pl.level)+1,2,chapter),e.pos);this.dropItem(rollDrop(pl.cls,pl.level+1,1,chapter),e.pos);}
      else if(T.tough){this.dropItem(rollDrop(pl.cls,pl.level+1,1,chapter),e.pos);this.dropItem(rollDrop(pl.cls,pl.level,0,chapter),e.pos);}
      else if(Math.random()<.14)this.dropItem(rollDrop(pl.cls,pl.level,0,chapter),e.pos);
    }
    this.story.onKill(e);
  }

  onPlayerDeath() {
    this.runDeaths=(this.runDeaths??0)+1;
    this.audio.setMood('none');
    this.after(1.6, () => this.ui.el.death.classList.remove('hidden'));
  }

  respawn() {
    this.timers=[];this.fx.clear();
    this.ui.el.death.classList.add('hidden');
    for (const p of this.projectiles) p.mesh.removeFromParent();
    this.projectiles = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.saltMinor=null;e.saltCd=2;e.ironMove=null;e.ironCd=2;e.stagger=0;e.frozen=0;e.slow=0;
      if (e.tag === 'summon') { e.dispose(); e.gone = true; continue; }
      if (e.T.boss) { e.asleep = true; e.hp = e.maxHp; e.summons = 0; e.phase=1; e.stag=null;e.iron=null;e.salt=null;e.ironMove=null;e.intent='';e.barkUntil=0; e.bossT=1.2; e.specialCd=2; e.queue=[]; e.invulnerable = false; e.state = 'idle'; e.pos.copy(e.home); }
      else if (e.state !== 'dormant' && e.state !== 'rising') { e.state = 'idle'; e.pos.copy(e.home); e.hp = e.maxHp; }
    }
    this.enemies = this.enemies.filter((e) => !e.gone);
    for (const a of this.allies) a.expire();
    this.inside.clear();
    this.player.revive(this.checkpoint);
    this.gfx.snap(this.player.pos);
    this.fx.pillar(this.player.pos, 'fire', 80, 8);
    this.audio.setMood(this.level.spec.audio);
  }

  torchAt(x, y, z, color, power) { this.level.torches.push({ x, y, z, color, power, seed: Math.random() * 60 }); }

  // ------------------------------------------------------------------ time helpers
  after(sec, fn) { this.timers.push({ t: sec, fn }); }
  wait(sec) { return new Promise((r) => this.after(sec, r)); }
  hitStop(sec) { this.stopT = Math.max(this.stopT, sec); }
  slowMo(sec, scale) { this.slowT = sec; this.slowScale = scale; }

  // ------------------------------------------------------------------ frame
  loop() {
    requestAnimationFrame(() => this.loop());
    let real = Math.min(0.05, this.clock.getDelta());
    if (!this.started) { if (this.ui.selecting) this.ui.updateSelect(real); return; }
    if(this.touchMode&&innerWidth<innerHeight){this.input.swallow();this.touch.reset();return;}
    if (this.paused||this.loadingLevel) { this.input.pressed.length = 0; return; }
    let dt = real;
    if (this.stopT > 0) { this.stopT -= real; dt = 0; }
    if (this.slowT > 0) { this.slowT -= real; dt *= this.slowScale; }
    if(import.meta.env.DEV && params.get('qa')==='ultimate')dt*=0.2;
    if(import.meta.env.DEV&&params.get('qa')==='stag'&&params.has('slow'))dt*=.4;
    this.update(dt, real);
    this.gfx.render();
  }

  update(dt, real) {
    this.time += dt;
    if(this.bossReady&&!this.cinematic&&!this.ui.inDialogue&&!this.runFinished)this.runElapsed=(this.runElapsed??0)+real;
    const pl = this.player, inp = this.input, lv = this.level;
    inp.update();
    this._handleInput(dt);

    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }

    this.touch?.update();
    pl.update(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) { const e = this.enemies[i]; const far=e.pos.distanceToSquared(this.player.pos)>70*70;e.root.visible=!far;if(far&&e.alive&&(e.state==='idle'||e.asleep))continue; if (!e.update(dt)) { e.dispose(); this.enemies.splice(i, 1); } }
    for (let i = this.allies.length - 1; i >= 0; i--) { const a = this.allies[i]; if (!a.update(dt)) { a.dispose(); this.allies.splice(i, 1); } }
    for (const n of this.npcs) {
      if (n.actor) {
        if (n.actor.pos.distanceTo(pl.pos) < 9) n.actor.face(pl.pos.x, pl.pos.z);
        n.actor.updateVisual(dt, 4);
      }
      if (n.marker.visible) { n.marker.position.y = 3.6 + Math.sin(this.time * 3) * 0.15; n.marker.rotation.y += dt * 2; }
    }
    this._updateProjectiles(dt);
    this._updateLoot(dt);
    this._updateEmitters(dt);
    this._updateTriggers();
    lv.update(dt);
    this.fx.update(dt);
    this.decals.update(dt);
    this.particles.update(dt, innerHeight, this.gfx.camera.fov);
    for (const ps of [this.particles, this.smoke, this.flames, this.blazes, this.blasts, this.puffs, this.dusts]) { if (ps !== this.particles) ps.update(dt, innerHeight, this.gfx.camera.fov); ps.setLights(this.gfx); }
    this.gfx.update(real, pl.pos);
    this.audio.listener.x = pl.pos.x; this.audio.listener.z = pl.pos.z;
    let threat = 0;
    for (const e of this.enemies) if (e.alive && (e.state === 'chase' || e.state === 'attack') && Math.abs(e.pos.x - pl.pos.x) + Math.abs(e.pos.z - pl.pos.z) < 24) threat += e.T.boss ? 4 : e.T.tough ? 2 : 1;
    this.audio.setIntensity(Math.min(1, threat / 4));
    this.ui.update(real);
    // performance hint: if the high preset struggles for a while, suggest a lower one (once)
    if (!this._perfHinted && this.quality !== 'low') {
      this._fpsT = (this._fpsT ?? 0) + real; this._fpsN = (this._fpsN ?? 0) + 1;
      if (this._fpsT > 12) { const fps = this._fpsN / this._fpsT; this._fpsT = 0; this._fpsN = 0; if (fps < 35) { this._perfHinted = true; this.ui.toast('画面不够流畅？可以按 Esc 在菜单里把画质调低'); } }
    }
  }

  _pickHover() {
    const px = this.input.px, cam = this.gfx;
    let best = null, bd = 1e9;
    const test = (obj, y, rad) => {
      const s = cam.project(_v.set(obj.pos.x, y, obj.pos.z), _s);
      const d = Math.hypot(s.x - px.x, (s.y - px.y) * 0.6);
      if (d < rad && d < bd) { bd = d; best = obj; }
    };
    const scale = innerHeight / 900;
    for (const e of this.enemies) if (e.alive) test(e, 1.2 * e.scale, 50 * scale * e.scale);
    for (const n of this.npcs) test(n, 1.3, 50 * scale);
    for (const c of this.chests) if (!c.open) test(c, 0.6, 46 * scale);
    for (const l of this.loot) if (l.kind === 'item' && l.t > 0.45) test(l, 0.3, 34 * scale);
    return best;
  }

  _handleInput(dt) {
    const inp = this.input, pl = this.player, ui = this.ui;
    const keys = inp.pressed.splice(0);
    if (keys.includes('KeyM')) ui.toast(this.audio.toggleMute() ? '已静音' : '声音已开启');
    if (ui.inDialogue) { if (keys.includes('Space') || keys.includes('Enter')) ui.advance(); return; }
    if (keys.includes('KeyI') || keys.includes('KeyB') || keys.includes('KeyC')) ui.toggleBag();
    if (keys.includes('KeyK')) ui.openGrowth('skills');
    if (keys.includes('Escape') && ui.panelOpen) { ui.closePanels(); return; }
    if(ui.panelOpen)return;
    if (this.cinematic || !pl.alive) { this.hover = null; return; }

    const hover = (this.hover = this.touchMode?null:this._pickHover());
    const enemy = hover && !hover.kind ? hover : null;
    this.canvas.style.cursor = hover ? (hover.kind ? 'pointer' : 'crosshair') : 'default';
    if (enemy) ui.setTarget(enemy);
    const aim = enemy ? _aim.set(enemy.pos.x, 0, enemy.pos.z) : _aim.copy(inp.ground);

    for (const k of keys) {
      if (k === 'KeyQ') pl.castSlot(2, aim, enemy);
      else if (k === 'KeyW') pl.castSlot(3, aim, enemy);
      else if (k === 'KeyE') pl.castSlot(4, aim, enemy);
      else if (k === 'KeyR') pl.castSlot(6, aim, enemy);
      else if (k === 'Space') pl.castSlot(5, inp.ground.clone(), null);
      else if (k === 'Digit1') pl.usePotion('hp');
      else if (k === 'Digit2') pl.usePotion('mp');
      else if (k === 'lmb' && hover?.kind) { pl.interactTarget = hover; pl.queued = null; pl.moveTo(hover.pos.x, hover.pos.z); inp.blocked = true; }
    }
    if (inp.rmb || keys.includes('rmb')) pl.castSlot(1, aim, enemy);
    if ((inp.lmb || keys.includes('lmb')) && !inp.blocked) {
      if (inp.shift || enemy) pl.castSlot(0, aim, enemy);
      else if (pl.lock <= 0) {
        this._mv = (this._mv ?? 0) - dt;
        if (this._mv <= 0 || keys.includes('lmb')) { this._mv = 0.1; pl.interactTarget = null; pl.queued = null; pl.moveTo(inp.ground.x, inp.ground.z); }
      }
    }
    const it = pl.interactTarget;
    if (it && pl.pos.distanceTo(it.pos) < (it.kind === 'item' ? 1.8 : 3.4)) {
      pl.interactTarget = null; pl.stop(); pl.face(it.pos.x, it.pos.z);
      if (it.kind === 'item') this.pickupItem(it);
      else { this.audio.play('ui'); if (it.kind === 'npc') this.story.onTalk(it.id); else this.openChest(it); }
    } else if (it && !pl.path.length && pl.lock <= 0) pl.interactTarget = null;
    if (hover?.kind === 'npc') ui.prompt(hover.name);
    else if (hover?.kind === 'chest') ui.prompt('打开' + hover.name);
    else if (hover?.kind === 'item') ui.prompt('拾取 ' + hover.name);
    else if (this._hoverPrompt) ui.prompt(null);
    this._hoverPrompt = !!hover?.kind;
  }

  _updateProjectiles(dt) {
    const pl = this.player, lv = this.level;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const previous=p.pos.clone();
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.trail(dt, p);
      if (p.light && p.light.userData.token === p.lightTok) p.light.position.copy(p.pos);
      let hit = null, done = false;
      if (!lv.clear(previous.x,previous.z,p.pos.x,p.pos.z,0.12) || p.life <= 0) done = true;
      else if (p.team === 'player') {
        for (const e of this.enemies) if (e.alive && !p.hits.has(e) && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < p.r + e.radius) {
          if (p.pierce) { p.hits.add(e); p.onHit?.(e, p.pos.clone()); } else { hit = e; done = true; break; }
        }
      } else {
        if (pl.alive && pl.invuln <= 0 && Math.hypot(pl.pos.x - p.pos.x, pl.pos.z - p.pos.z) < p.r + 0.55) { hit = pl; done = true; }
        else for (const a of this.allies) if (a.alive && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < p.r + a.radius) { hit = a; done = true; break; }
      }
      if (done) {
        if (!(p.pierce && !hit)) p.onHit?.(hit, p.pos);
        else p.onHit?.(null, p.pos);
        p.mesh.removeFromParent();
        if (p.light && p.light.userData.token === p.lightTok) p.light.userData.t = p.light.userData.dur;
        this.projectiles.splice(i, 1);
      }
    }
  }

  /** Ambient atmosphere around the hero: drifting ground mist (lit by torches) and floating dust motes. */
  _updateAtmosphere(dt) {
    const pl = this.player, id = this.level.id;
    const A = { camp: { mist: 1.1, motes: 6, mistA: 0.12 }, graveyard: { mist: 1.6, motes: 3, mistA: 0.16 }, crypt: { mist: 0.8, motes: 12, mistA: 0.1 } }[id] ?? { mist: 0.7, motes: 6, mistA: 0.1 };
    const k = this.low ? 0.4 : 1;
    this._mistAcc = (this._mistAcc ?? 0) + dt * A.mist * k;
    while (this._mistAcc > 1) {
      this._mistAcc -= 1;
      const a = Math.random() * 6.283, r = 5 + Math.random() * 16;
      const x = pl.pos.x + Math.cos(a) * r, z = pl.pos.z + Math.sin(a) * r;
      if (this.level.blocked(x, z, 1)) continue;
      const tint = id === 'graveyard' ? [0.42, 0.5, 0.55] : [0.45, 0.42, 0.4];
      this.puffs.emit({ pos: { x, y: 0.9, z }, count: 1, speed: [0.2, 0.6], dir: { x: 1, y: 0, z: 0.3 }, spread: 1, life: [9, 13], size: [7, 11], grow0: 0.8, grow1: 1.3, c0: tint, c1: tint, alpha: A.mistA, rot: [0, 6.28], spin: [0.01, 0.05] });
    }
    this._moteAcc = (this._moteAcc ?? 0) + dt * A.motes * k;
    while (this._moteAcc > 1) {
      this._moteAcc -= 1;
      const a = Math.random() * 6.283, r = Math.random() * 14;
      this.particles.emit({ pos: { x: pl.pos.x + Math.cos(a) * r, y: 0.5 + Math.random() * 3.5, z: pl.pos.z + Math.sin(a) * r }, count: 1, speed: [0.05, 0.3], up: 0.05, life: [4, 7], size: [0.05, 0.11], grow0: 1, grow1: 1, c0: [0.9, 0.75, 0.55], c1: [0.4, 0.3, 0.2], alpha: 0.5, tex: 'glow' });
    }
  }

  _updateEmitters(dt) {
    this._updateAtmosphere(dt);
    const pl = this.player, P = this.particles;
    for (const e of this.level.emitters) {
      if (Math.abs(e.x - pl.pos.x) + Math.abs(e.z - pl.pos.z) > 70) continue;
      e.acc += dt;
      const c = e.color;
      if (e.kind === 'torch') {
        while (e.acc > 0.04) { e.acc -= 0.04;
          if (Math.random() < 0.12) this.flames.emit({ pos: { x: e.x, y: e.y + 0.35, z: e.z }, count: 1, radius: 0.04, speed: [0, 0.1], up: 0.5, life: [0.5, 0.8], size: [1.1, 1.4], c0: [c.r * 0.55 + 0.1, c.g * 0.55 + 0.05, c.b * 0.6 + 0.05], c1: [c.r * 0.5, c.g * 0.35, c.b * 0.3], loop: true, rot: [-0.08, 0.08], alpha: 0.85 });
          P.emit({ pos: e, count: 1, radius: 0.04, speed: [0, 0.15], up: 0.9, life: [0.15, 0.3], size: [0.35, 0.5], c0: [c.r * 1.6 + 0.3, c.g * 1.4 + 0.15, c.b * 1.4], c1: [c.r * 0.6, c.g * 0.15, c.b * 0.2], drag: 0.5, grow0: 0.9, grow1: 0.3, tex: 'glow' });
          if (Math.random() < 0.08) P.emit({ pos: e, count: 1, speed: [0.3, 1.2], up: 1.5, life: [0.5, 1.2], size: [0.07, 0.14], c0: [c.r * 4, c.g * 3, c.b * 2], c1: [c.r, 0.1, 0.05], gravity: -1 });
          if (Math.random() < 0.05) this.smoke.emit({ pos: { x: e.x, y: e.y + 0.6, z: e.z }, count: 1, speed: [0, 0.2], up: 0.8, life: [1, 2], size: [0.5, 1], c0: [0.06, 0.05, 0.05], c1: [0.02, 0.02, 0.02], alpha: 0.3, grow1: 2, tex: 'smoke' });
        }
      } else if (e.kind === 'candle') {
        if (e.acc > 0.06) { e.acc = 0; P.emit({ pos: e, count: 1, speed: [0, 0.05], up: 0.3, life: [0.15, 0.3], size: [0.2, 0.32], c0: [2.4, 1.3, 0.4], c1: [0.8, 0.2, 0.05], tex: 'candle', rot: [-0.05, 0.05] }); }
      } else if (e.kind === 'campfire') {
        while (e.acc > 0.025) { e.acc -= 0.025;
          if (Math.random() < 0.15) this.blazes.emit({ pos: { x: e.x, y: 1.45, z: e.z }, count: 1, radius: 0.2, flat: true, speed: [0, 0.1], up: 0.25, life: [0.8, 1.2], size: [2.8, 3.4], c0: [0.5, 0.3, 0.17], c1: [0.5, 0.32, 0.22], loop: true, rot: [-0.12, 0.12], alpha: 0.9 });
          if (Math.random() < 0.25) P.emit({ pos: e, count: 1, radius: 0.3, speed: [0.3, 1.5], up: 3, life: [0.8, 2], size: [0.08, 0.16], c0: [4, 2, 0.5], c1: [1, 0.2, 0], gravity: -1.2, drag: 0.3 });
          if (Math.random() < 0.05) this.puffs.emit({ pos: { x: e.x, y: 3.2, z: e.z }, count: 1, radius: 0.4, speed: [0, 0.3], up: 1.4, life: [3, 4.5], size: [3, 4.5], c0: [0.35, 0.32, 0.3], c1: [0.2, 0.19, 0.18], alpha: 0.45, rot: [-0.3, 0.3], spin: [0.02, 0.08], grow0: 0.6, grow1: 1.4 });
        }
      } else if (e.kind === 'mist' || e.kind === 'bellmist') {
        while (e.acc > 0.06) { e.acc -= 0.06;
          const bell = e.kind === 'bellmist';
          P.emit({ pos: e, count: 1, radius: bell ? 1.6 : 1, ring: bell, speed: [0, 0.5], up: bell ? -0.8 : 0.7, life: [1, 2.2], size: [0.4, 1], c0: [c.r * 1.6, c.g * 1.6, c.b * 1.6], c1: [c.r * 0.2, c.g * 0.2, c.b * 0.2], alpha: 0.6, tex: 'smoke', spin: [0.2, 0.8] });
        }
      } else if (e.kind === 'portal') {
        while (e.acc > 0.015) { e.acc -= 0.015;
          const a = this.time * 3 + Math.random() * 6.28, r = 1.5;
          P.emit({ pos: { x: e.x + Math.cos(a) * r, y: 0.2, z: e.z + Math.sin(a) * r }, count: 1, speed: [0, 0.4], up: 4, life: [0.6, 1.3], size: [0.3, 0.7], c0: [3.5, 2.2, 0.6], c1: [1, 0.3, 0.05], drag: 0.8, tex: 'glint' });
        }
      } else if (e.kind === 'glint') {
        if (e.acc > 0.25) { e.acc = 0; P.emit({ pos: e, count: 1, radius: 0.4, speed: [0, 0.2], up: 0.6, life: [0.6, 1.2], size: [0.2, 0.4], c0: [3, 2.2, 0.8], c1: [0.6, 0.3, 0], tex: 'glint' }); }
      }
    }
  }

  _updateTriggers() {
    if (this.cinematic || !this.player.alive) return;
    const pl = this.player;
    for (const t of this.level.def.triggers) {
      const inside = containsTrigger(t,pl.pos);
      if (inside && !this.inside.has(t.id)) { this.inside.add(t.id); this.story.onTrigger(t.id, t); if(this.cinematic)break; }
      else if (!inside && this.inside.has(t.id)) { this.inside.delete(t.id); this.story.onTriggerLeave(t.id); }
    }
  }
}
const _v = new THREE.Vector3(), _s = {}, _aim = new THREE.Vector3();

const fitUi = () => document.documentElement.style.setProperty('--ui', Math.max(0.55, Math.min(1.2, Math.min(innerWidth / 1280, innerHeight / 760))).toFixed(3));
fitUi();
window.addEventListener('resize', fitUi);
const game = new Game();
window.game = game;
window.makeItem = makeItem;
$('#respawn').addEventListener('click', () => game.respawn());
for (const btn of document.querySelectorAll('#qualrow button')) {
  btn.classList.toggle('on', btn.dataset.q === game.quality);
  btn.addEventListener('click', () => {
    if (btn.dataset.q === game.quality) return;
    try { localStorage.setItem('emberspeaker.quality', btn.dataset.q); } catch {}
    game.save?.(true);
    location.reload();
  });
}
$('#resume').addEventListener('click', () => { game.paused = false; $('#pause').classList.add('hidden'); });
$('#quit').addEventListener('click', () => game.returnToTitle());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game.started && !game.ui.inDialogue && !game.ui.panelOpen) { game.paused = !game.paused; $('#pause').classList.toggle('hidden', !game.paused); game.clock.getDelta(); }
});
window.addEventListener('beforeunload', () => game.save(true));
game.boot();

let _beamTex = null;
/** Vertical fade (bright at the floor, gone at the top) for loot beams. */
function beamTex() {
  if (_beamTex) return _beamTex;
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#3a3a3a'); gr.addColorStop(0.92, '#d0d0d0'); gr.addColorStop(1, '#fff');
  x.fillStyle = gr; x.fillRect(0, 0, 4, 128);
  return (_beamTex = new THREE.CanvasTexture(c));
}
