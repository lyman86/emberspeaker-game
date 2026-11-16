import {incomingDamage,damageGrowth,POTION_COOLDOWN,recoveryFactor} from './combat.js';
import * as THREE from 'three';
import { Actor } from './actor.js';
import { CLASS_SKILLS } from './skills.js';
import { CLASSES } from './classes.js';
import { PROFILES } from './models.js';
import { makeItem, canEquip, syncUid, BASES, LEGENDARIES } from './items.js';
import { XP_TABLE, earnedPoints, freeRank, requiredLevel, spentPoints, canUpgradeSlot, enhancedStats, enhance, salvageMaterials, MATERIALS } from './progression.js';
import { SwingTrail, aegisMaterial, energyMaterial } from './vfx.js';

export { XP_TABLE } from './progression.js';
export const BAG_SIZE = 40;
const EQUIP_SLOTS = ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'amulet', 'ring'];

export class Player extends Actor {
  constructor(game, cls = 'mage') {
    const C = CLASSES[cls];
    super(game, C.profile);
    this.cls = cls; this.C = C;
    this.skills = CLASS_SKILLS[cls];
    this.skillRanks = Object.fromEntries(this.skills.map(s=>[s.id, freeRank(s.slot)]));
    this.materials = {};
    this.radius = 0.6;
    this.level = 1; this.xp = 0;
    this.potions = { hp: 3, mp: 1 };
    this.gold = 0;
    this.cds = {};
    this.path = [];
    this.lock = 0;
    this.pending = null;
    this.queued = null;
    this.invuln = 0;
    this.alive = true;
    this.stepT = 0;
    this.interactTarget = null;
    this.buffs = {};
    this.shield = 0;
    this.bag = new Array(BAG_SIZE).fill(null);
    this.equip = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null]));
    for (const b of C.start) { const it = makeItem(b, { ilvl: 1 }); this.equip[BASES[b].slot] = it; }
    this.recalc();
    this.hp = this.maxHp; this.mp = this.maxMp * C.res.start;
    this.play('Idle');
    this.refreshGear();
    this._attachEmber();
  }

  _bone(re) { let b = null; this.model.traverse((o) => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; }

  /** Show the equipped items on the body (and hide the model's own baked-in weapon / shield / helmet). */
  refreshGear() {
    const P = PROFILES[this.C.profile];
    if (P.builtinGear) { let k = 0; this.model.traverse((o) => { if (o.isMesh) { if (P.builtinGear.includes(k)) o.visible = false; k++; } }); }
    this.game.gear?.dress(this, this.equip, { file: P.file });
  }

  _attachEmber() {
    if (this.cls !== 'mage' && this.cls !== 'necro') return;
    const hand = this._bone(/RightHand$/);
    if (!hand) return;
    const col = this.cls === 'mage' ? new THREE.Color(4, 1.6, 0.4) : new THREE.Color(0.6, 3, 1.2);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: col }));
    gem.position.set(0, 0.12, 0.03);
    hand.add(gem);
    this.gem = gem; this.gemCol = this.cls === 'mage' ? [[3, 1.3, 0.3], [0.8, 0.1, 0]] : [[0.6, 2.6, 1.1], [0, 0.3, 0.1]];
  }

  // ------------------------------------------------------------------ stats
  /** Recompute every derived stat from class, level, equipment and buffs. */
  recalc() {
    const C = this.C, L = this.level - 1;
    const st = { str: C.base.str + C.grow.str * L, dex: C.base.dex + C.grow.dex * L, int: C.base.int + C.grow.int * L, vit: C.base.vit + C.grow.vit * L,
      hp: 0, res: 0, armor: C.armor, crit: 5, critDmg: 50, atkSpd: 0, move: 0, dmgPct: 0, regen: 1, resRegen: 0, lifeHit: 0, cdr: 0, gold: 0 };
    let wdmg = null;
    this.flags = new Set();
    for (const it of Object.values(this.equip)) {
      if (!it) continue;
      const values = enhancedStats(it);
      if (values.armor) st.armor += values.armor;
      if (values.dmg && it.slot === 'weapon') wdmg = values.dmg;
      for (const a of values.affixes) st[a.k] = (st[a.k] ?? 0) + a.v;
      if (it.flag) this.flags.add(it.flag);
    }
    for (const b of Object.values(this.buffs)) if (b.armor) st.armor *= 1 + b.armor;
    this.stats = st;
    const main = st[C.main];
    const wAvg = wdmg ? (wdmg[0] + wdmg[1]) / 2 : 5;
    this.weaponFactor = wAvg / 10; // starter weapons average ~10
    this.dmgMul = damageGrowth(((1 + main / 100) * this.weaponFactor * (1 + st.dmgPct / 100) * (1 + 0.04 * L)) / 1.3); // ≈1.0 for a fresh character
    const oldMax = this.maxHp || 1;
    this.maxHp = Math.round(C.hp + st.vit * 6 + st.hp + L * 8);
    this.maxMp = Math.round(C.res.max + st.res);
    if (this.hp != null) this.hp = Math.min(this.maxHp, this.hp * (this.maxHp / oldMax));
    this.dr = st.armor / (st.armor + 120 + this.level * 25);
    this.speed = 6.6 * (1 + st.move / 100);
    this.atkSpeed = (1 + st.atkSpd / 100) * (this.buffs.berserk ? 1.3 : 1);
    this.game.ui?.refreshStats?.();
  }

  has(flag) { return this.flags?.has(flag); }

  roll(a, b, school) {
    const st = this.stats;
    const crit = Math.random() * 100 < st.crit;
    let mul = this.dmgMul;
    for (const bf of Object.values(this.buffs)) if (bf.dmg) mul *= 1 + bf.dmg;
    if (school === 'fire' && this.has('emberheart')) mul *= 1.1;
    const v = Math.round((a + Math.random() * (b - a)) * mul * (crit ? 1 + st.critDmg / 100 : 1));
    return { v, crit };
  }

  gainRes(n) { this.mp = Math.max(0, Math.min(this.maxMp, this.mp + n)); }

  heal(n, quiet = false) {
    n*=recoveryFactor(this);
    if (!this.alive) return;
    const v = Math.round(Math.min(n, this.maxHp - this.hp));
    if (v <= 0) return;
    this.hp += v;
    if (!quiet && v > 2) this.game.ui.number(this.pos, '+' + v, 'heal');
  }

  buff(name, dur, data) { this.buffs[name] = { t: dur, ...data }; this.recalc(); }

  onHit(crit=false) {
    const now=this.game.time;let healing=0;
    if(this.stats.lifeHit&&now>=(this._lifeHitAt??0)){this._lifeHitAt=now+.65;healing+=Math.min(this.stats.lifeHit,this.maxHp*.015);}
    if(crit&&this.has('bloodring')&&now>=(this._bloodAt??0)){this._bloodAt=now+1.2;healing+=this.maxHp*.02;}
    if(healing)this.heal(healing,true);
  }

  onKill(e) { if(e?.type==='saltseal'&&this.has('desertgrip')){this.heal(this.maxHp*.08);this.gainRes(15);} if(e?.T.episode===3&&this.has('ironmarch'))this.buff('ironmarch',4,{}); if (this.has('gravewalker')) this.buff('gravewalker', 3, {}); }

  /** Holy aegis: hexagonal light bubble with a rotating rune circle at the feet and drifting motes. */
  showShield(on) {
    const g = this.game, fx = g.fx;
    if (on && this.aegis?.dying) { const A = this.aegis; for (const o of [A.bubble, A.runes, A.halo]) { o.removeFromParent(); o.material.dispose(); } this.aegis = null; }
    if (on && !this.aegis) {
      const H = this.has('aegis') ? [1.6, 1.4, 0.8] : [1.6, 1.1, 0.4];
      const mat = aegisMaterial(H);
      const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 5), mat);
      bubble.scale.set(1.45, 1.75, 1.45); bubble.position.y = 1.45; bubble.renderOrder = 13;
      const runeMat = energyMaterial({ map: fx.tex.magic1, color: [1.3, 0.95, 0.35], polar: true, scale: 4, flow: [0.25, -0.3] });
      const runes = new THREE.Mesh(fx.planeGeo, runeMat); runes.scale.setScalar(1.9); runes.position.y = 0.08; runes.renderOrder = 4;
      const halo = new THREE.Mesh(fx.planeGeo, new THREE.MeshBasicMaterial({ alphaMap: fx.tex.lightdisc, color: new THREE.Color(0.7, 0.5, 0.2), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(2.4); halo.position.y = 0.06;
      this.root.add(bubble, runes, halo);
      this.aegis = { bubble, runes, halo, mat, runeMat, t: 0, dying: 0 };
      fx.shockwave(this.pos, { r1: 6, dur: 0.4, strength: 0.03, y: 1.3 });
      g.particles.emit({ pos: { x: this.pos.x, y: 0.2, z: this.pos.z }, count: 30, radius: 1.4, ring: true, speed: [0, 0.4], up: 4, life: [0.5, 1], size: [0.15, 0.35], c0: [3, 2.4, 1], c1: [0.8, 0.4, 0], tex: 'glint', spin: [1, 3] });
    } else if (!on && this.aegis && !this.aegis.dying) {
      // shatter: flash the shell outward, scatter shards of light
      this.aegis.dying = 0.0001;
      g.particles.emit({ pos: { x: this.pos.x, y: 1.4, z: this.pos.z }, count: 46, radius: 1.3, outward: true, speed: [3, 8], life: [0.3, 0.7], size: [0.15, 0.4], c0: [3, 2.4, 1.1], c1: [0.6, 0.3, 0], drag: 2, gravity: 4, tex: 'streak', align: true });
      fx.shockwave(this.pos, { r1: 5, dur: 0.3, strength: 0.025, y: 1.4 });
      g.audio.play('shatter', this.pos, 0.6);
    }
  }

  /** Ripple across the aegis from the direction of an absorbed blow. */
  shieldHit(from) {
    const A = this.aegis;
    if (!A || A.dying) return;
    const d = new THREE.Vector3((from?.x ?? this.pos.x + 1) - this.pos.x, 0.3, (from?.z ?? this.pos.z) - this.pos.z);
    d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.root.rotation.y);
    A.mat.uniforms.hitPos.value.copy(d.normalize()); A.mat.uniforms.hitT.value = 0;
    this.game.audio.play('e_blink', this.pos, 0.25);
  }

  _updateAegis(dt) {
    const A = this.aegis;
    if (!A) return;
    A.t += dt;
    const U = A.mat.uniforms;
    U.time.value += dt; U.hitT.value += dt;
    U.intro.value = Math.min(1, A.t / 0.45);
    A.runeMat.uniforms.time.value += dt;
    A.runes.rotation.y += dt * 0.6;
    const intro = Math.min(1, A.t / 0.3);
    A.runeMat.uniforms.progress.value = 1 - intro * 0.9;
    if (Math.random() < dt * 14) this.game.particles.emit({ pos: { x: this.pos.x, y: 0.3, z: this.pos.z }, count: 1, radius: 1.3, flat: true, speed: [0, 0.2], up: 1.8, life: [0.6, 1.2], size: [0.08, 0.18], c0: [2.6, 2, 0.8], c1: [0.6, 0.3, 0], tex: 'glint' });
    if (A.dying) {
      A.dying += dt;
      const k = A.dying / 0.35;
      U.fade.value = Math.max(0, 1 - k); A.bubble.scale.set(1.45 * (1 + k * 0.4), 1.75 * (1 + k * 0.4), 1.45 * (1 + k * 0.4));
      A.runeMat.uniforms.progress.value = Math.min(1, 0.1 + k);
      A.halo.material.opacity = 0.18 * (1 - k);
      if (k >= 1) { for (const o of [A.bubble, A.runes, A.halo]) { o.removeFromParent(); o.material.dispose(); } A.bubble.geometry.dispose(); this.aegis = null; }
    }
  }

  rank(s) { return canUpgradeSlot(s.slot) ? this.skillRanks[s.id] ?? 0 : 1; }
  get skillPoints() { return Math.max(0, earnedPoints(this.level)-spentPoints(this.skills,this.skillRanks)); }
  unlocked(s) { return this.level >= s.unlock && this.rank(s)>0; }
  canLearnSkill(s) { return !!s && canUpgradeSlot(s.slot) && this.rank(s)<5 && this.skillPoints>0 && this.level>=requiredLevel(s,this.rank(s)+1); }
  learnSkill(id) {
    const s=this.skills.find(s=>s.id===id), rank=s?this.rank(s):5;
    if(!this.canLearnSkill(s)) return false;
    this.skillRanks[id]=rank+1; this.game.ui.buildSkills(); this.game.save(); return true;
  }
  resetSkills() {
    const price=50+this.level*10;
    if(this.game.level.id!=='camp' || this.gold<price) return false;
    this.gold-=price; this.skillRanks=Object.fromEntries(this.skills.map(s=>[s.id,freeRank(s.slot)]));
    this.game.ui.buildSkills(); this.game.save(); return true;
  }
  addMaterial(id,n=1) {
    if(!MATERIALS[id]) return;
    this.materials[id]=(this.materials[id]??0)+n;
    this.game.ui.toast(`获得：${MATERIALS[id].name} ×${n}`);
    if(!this.materialTutorial) { this.materialTutorial=true; this.game.ui.toast('材料不占装备栏：背包「材料」页可出售，布拉姆处可强化或分解装备'); }
    this.game.save();
  }
  enhanceItem(it) {
    if(this.game.level.id!=='camp' || this.game.ui.shopMode!=='smith' || ![...this.bag,...Object.values(this.equip)].includes(it) || !enhance(it,this)) return false;
    this.recalc(); this.refreshGear(); this.game.save(); return true;
  }
  salvageItem(i) {
    const it=this.bag[i];
    if(!it || this.game.level.id!=='camp' || this.game.ui.shopMode!=='smith') return false;
    for(const [k,n] of Object.entries(salvageMaterials(it))) this.addMaterial(k,n);
    this.bag[i]=null; this.game.save(); return true;
  }

  castOrigin() {
    return new THREE.Vector3(this.pos.x + Math.sin(this.facing) * 0.9, 1.5, this.pos.z + Math.cos(this.facing) * 0.9);
  }

  moveTo(x, z) {
    if (!this.alive) return;
    this.path = this.game.level.findPath(this.pos.x, this.pos.z, x, z);
    this._bestD = 1e9;
  }

  stop() { this.path = []; }

  /** Cast the skill in a hotbar slot (0 = left click … 5 = space). target: hovered enemy, if any. */
  castSlot(i, aim, target = null) {
    const s = this.skills[i];
    if (!s) return false;
    // melee skills walk into range of the clicked enemy first
    if (s.melee && target && target.alive) {
      const d = this.pos.distanceTo(target.pos) - target.radius;
      if (d > s.melee - 0.4) {
        if (this.lock <= 0) { this.queued = { i, target }; this.moveTo(target.pos.x, target.pos.z); }
        return false;
      }
      aim = target.pos.clone();
    }
    return this.cast(s, aim);
  }

  skillCooldown(s) {
    const cdr=1-Math.min(40,this.stats.cdr)/100;
    return (s.primary?s.cd/this.atkSpeed:s.cd*cdr)*(s.slot!==6&&this.rank(s)>=3?.85:1);
  }
  cast(s, aim) {
    const g = this.game;
    if (!this.alive || this.lock > 0 && !s.instant) return false;
    if (!this.unlocked(s)) { g.ui.toast('达到解锁等级后，点击技能上方的 + 学习'); return false; }
    if ((this.cds[s.id] ?? 0) > 0) return false;
    if (this.mp < s.cost) { g.ui.noMana(this.C.res.name); return false; }
    this.mp -= s.cost;
    this.cds[s.id] = this.skillCooldown(s);
    g.ui.flashSkill(s.id);
    if (!s.self) this.face(aim.x, aim.z);
    this.queued = null;
    if (s.instant) { s.fire(g, this, aim); return true; }
    this.stop();
    this.interactTarget = null;
    const as = s.primary ? this.atkSpeed : 1;
    this.playTimed(s.anim, s.windup / as, { fade: 0.06 });
    this.lock = s.lock / as;
    this.pending = { s, aim: aim.clone(), t: s.windup / as };
    return true;
  }

  usePotion(kind) {
    if (!this.alive || this.potions[kind] <= 0) { this.game.audio.play('denied'); return; }
    const full = kind === 'hp' ? this.hp >= this.maxHp : this.mp >= this.maxMp;
    if (full) return;
    if((this.potionCd??0)>0){this.game.ui.toast(`药水准备中 · ${Math.ceil(this.potionCd)} 秒`);return;}
    this.potionCd=POTION_COOLDOWN;this.potions[kind]--;
    this.game.audio.play('potion');
    if (kind === 'hp') { this.heal(this.maxHp * 0.4); this.game.fx.pillar(this.pos, 'blood', 30, 4); }
    else { const v = Math.round(this.maxMp * 0.6); this.gainRes(v); this.game.ui.number(this.pos, '+' + v, 'info'); this.game.fx.pillar(this.pos, 'ice', 30, 4); }
    this.game.save();
  }

  gainXp(n) {
    this.xp += n;
    while (this.level < XP_TABLE.length && this.xp >= XP_TABLE[this.level]) {
      this.level++;
      this.recalc();
      this.hp = this.maxHp; this.mp = Math.max(this.mp, this.maxMp * this.C.res.start);
      const g = this.game;
      g.audio.play('levelup');
      g.fx.pillar(this.pos, 'holy', 120, 9);
      g.ui.toast(`等级提升 · ${this.level}，获得 ${this.level%10===0?2:1} 个技能点 · 点击技能上方 + 强化 Q/W/E/R`);
      for (const s of this.skills) if (s.unlock === this.level) g.ui.toast(`可学习：${s.name}（${s.key}），点击技能上方 +`);
      g.ui.buildSkills();
      g.save();
    }
  }

  xpText() { const a = XP_TABLE[this.level - 1], b = XP_TABLE[this.level]; return b ? `${this.xp - a} / ${b - a}` : '已满级'; }

  xpProgress() {
    if(this.level>=XP_TABLE.length)return 1;
    const a = XP_TABLE[this.level - 1], b = XP_TABLE[this.level] ?? a + 1;
    return Math.min(1, (this.xp - a) / (b - a));
  }

  hurt(dmg, from, attack) {
    if (!this.alive || this.invuln > 0 || this.buffs.divineWings || this.game.cinematic) return;
    const g = this.game;
    if (this.has('silentbell') && (this._bellCd ?? 0) <= 0) { this._bellCd = 8; g.ui.number(this.pos, '抵消', 'info'); g.audio.play('bell', this.pos, 0.2); return; }
    let v = incomingDamage(dmg,this,attack)*(this.buffs.ironmarch?.9:1);
    if (this.shield > 0) {
      if (this.has('aegis')) v *= 0.8;
      const ab = Math.min(this.shield, v); this.shield -= ab; v -= ab; this.shieldHit(from);
      if (this.shield <= 0) { this.showShield(false); delete this.buffs.shield; }
      if (v <= 0) { g.ui.number(this.pos, '吸收', 'info'); return; }
    }
    v = Math.max(1, Math.round(v));
    if(this.has('thorncrown') && (this._thornCd??0)<=0 && from && Math.hypot(from.x-this.pos.x,from.z-this.pos.z)<5){
      this._thornCd=3;g.fx.explode(this.pos,5,'poison',0.5);for(const e of g.enemiesNear(this.pos,5))g.hurtEnemy(e,this.roll(20,28,'poison'),{pal:'poison',quiet:true});
    }
    this.hp -= v;
    if(attack?.kind==='heavy')this.woundUntil=g.time+5;
    if(attack?.erosion){this.saltExposure=Math.min(3,(this.saltExposureUntil>g.time?this.saltExposure??0:0)+1);this.saltExposureUntil=g.time+4;}
    this.flash(0.8);
    if (this.cls === 'warrior') this.gainRes(4);
    g.ui.number(this.pos, '-' + v, 'hurt');
    g.ui.hurtFlash();
    g.audio.play('hurt');
    g.gfx.addShake(0.22);
    g.particles.emit({ pos: { x: this.pos.x, y: 1.3, z: this.pos.z }, count: 10, speed: [2, 6], life: [0.2, 0.5], size: [0.2, 0.45], c0: [1.6, 0.1, 0.06], c1: [0.4, 0, 0], gravity: 12, tex: 'dirt' });
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false; this.path = []; this.pending = null; this.queued = null;
      this.showShield(false); this.shield = 0;
      this.play('Death_A', { once: true });
      g.onPlayerDeath();
    }
  }

  revive(at) {
    this.plagueStacks=0;this.plagueUntil=0;
    this.potionCd=0;this._lifeHitAt=0;this._bloodAt=0;this.woundUntil=0;this.drenched=0;this.drenchedUntil=0;this.saltExposure=0;this.saltExposureUntil=0;
    this.alive = true; this.hp = this.maxHp; this.mp = this.maxMp * this.C.res.start; this.lock = 0; this.pending = null; this.path = [];
    this.pos.set(at.x, 0, at.z);
    this.play('Idle', { restart: true });
    this.invuln = 2;
  }

  // ------------------------------------------------------------------ inventory
  /** Compare unbuffed, enhanced equipment through the same stat rules as actual equipping. */
  compareGear(it) {
    if(!it||!canEquip(this.cls,it))return {status:'unusable',label:'职业不符',upgrade:false};
    const current=this.equip[it.slot];
    const profile=equip=>{
      const p=Object.assign(Object.create(Player.prototype),{C:this.C,cls:this.cls,level:this.level,equip,buffs:{},game:{}});p.recalc();const st=p.stats;
      const attack=p.dmgMul*(1+Math.min(100,st.crit)*st.critDmg/10000)*p.atkSpeed*Math.pow(1/(1-Math.min(40,st.cdr)/100),.35);
      const recovery=st.regen*.35+Math.min(st.lifeHit,p.maxHp*.015)/.65;
      const defence=p.maxHp/(1-p.dr)*(1+Math.min(.15,recovery/p.maxHp*3));
      const utility=Math.pow(1+st.move/100,.15)*Math.pow(1+st.resRegen/Math.max(5,Math.abs(this.C.res.regen)),.1)*Math.pow(p.maxMp/this.C.res.max,.05);
      return {attack,defence,score:Math.pow(attack,.6)*Math.pow(defence,.4)*utility};
    };
    const before=profile(this.equip),after=profile({...this.equip,[it.slot]:it}),gain=after.score/before.score-1;
    const result={current,gain,attack:after.attack/before.attack-1,defence:after.defence/before.defence-1};
    const special=LEGENDARIES.find(l=>l.id===it.legendary);
    if(special?.cls&&special.cls!==this.cls)return {...result,status:'choice',label:'特效不适用',upgrade:false,note:'这件传奇的专属特效适合'+CLASSES[special.cls].name};
    if(current?.flag&&current.flag!==it.flag)return {...result,status:'choice',label:'特效取舍',upgrade:false,note:'替换会失去当前传奇特效，请按技能搭配选择'};
    if((!current&&(gain>.001||it.flag))||gain>.005)return {...result,status:'upgrade',label:current?'面板提升':'空位可装备',upgrade:true,note:it.power?'同时获得传奇特效，收益取决于技能搭配':''};
    if(it.flag&&it.flag!==current?.flag)return {...result,status:'choice',label:'新传奇特效',upgrade:false,note:'面板没有明显提升，可按传奇特效选择'};
    return {...result,status:'normal',label:gain<-.005?'面板下降':'提升不明显',upgrade:false};
  }

  addItem(it, {notify=true}={}) {
    const i = this.bag.indexOf(null);
    if (i < 0) return false;
    this.bag[i] = it;
    if(notify)this.game.ui?.offerGear?.(it);
    return true;
  }

  equipFromBag(i) {
    const it = this.bag[i];
    if (!it) return false;
    if (!canEquip(this.cls, it)) { this.game.ui.toast('该职业无法装备此物品'); this.game.audio.play('denied'); return false; }
    const prev = this.equip[it.slot];
    this.equip[it.slot] = it;
    this.bag[i] = prev;
    this.recalc();
    this.refreshGear();
    this.game.audio.play('pickup');
    this.game.save();
    return true;
  }

  unequip(slot) {
    const it = this.equip[slot];
    if (!it) return false;
    if (!this.addItem(it,{notify:false})) { this.game.ui.toast('背包已满'); return false; }
    this.equip[slot] = null;
    this.recalc();
    this.refreshGear();
    this.game.save();
    return true;
  }

  /** Throw an item from the bag or from the body onto the ground next to the hero (it can be picked up again). */
  discard(from) {
    const g = this.game;
    const it = from.slot ? this.equip[from.slot] : this.bag[from.i];
    if (!it) return false;
    if (it.rarity === 'legendary' && !confirm(`确定要丢弃传奇物品「${it.name}」吗？\n（丢在地上后离开此区域就会消失）`)) return false;
    if (from.slot) { this.equip[from.slot] = null; this.recalc(); this.refreshGear(); }
    else this.bag[from.i] = null;
    g.dropItem(it, this.pos, { near: true });
    g.ui.toast('已丢弃：' + it.name);
    g.save();
    return true;
  }

  /** Move a bag item to another bag cell (swaps if occupied). */
  moveBag(i, j) { if (i === j) return; [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; this.game.save(); }

  /** Unequip into a specific bag cell. */
  unequipTo(slot, j) {
    const it = this.equip[slot];
    if (!it) return false;
    const other = this.bag[j];
    if (other && (other.slot !== slot || !canEquip(this.cls, other))) return this.unequip(slot);
    this.bag[j] = it; this.equip[slot] = other;
    this.recalc(); this.refreshGear(); this.game.audio.play('pickup'); this.game.save();
    return true;
  }

  toSave() {
    return { cls: this.cls, level: this.level, xp: this.xp, gold: this.gold, potions: this.potions, bag: this.bag, equip: this.equip, skillRanks: this.skillRanks, materials: this.materials, materialTutorial: this.materialTutorial };
  }

  fromSave(s) {
    this.level = Math.max(1, Math.min(30, s.level)); this.xp = Math.max(XP_TABLE[this.level-1],Number(s.xp)||0); this.gold = s.gold; this.potions = s.potions;
    this.bag = s.bag.concat(new Array(BAG_SIZE).fill(null)).slice(0, BAG_SIZE);
    this.equip = { ...this.equip, ...s.equip };
    this.materials = Object.fromEntries(Object.keys(MATERIALS).map(k=>[k, Math.max(0,Math.floor(Number(s.materials?.[k])||0))]));
    this.materialTutorial=!!s.materialTutorial;
    // Basic attacks and movement are fixed at rank one; old points invested there are refunded.
    this.skillRanks=Object.fromEntries(this.skills.map(skill=>[skill.id,canUpgradeSlot(skill.slot)?Math.max(0,Math.min(5,Math.floor(Number(s.skillRanks?.[skill.id])||0),1+Math.floor((this.level-skill.unlock)/3))):1]));
    if(spentPoints(this.skills,this.skillRanks)>earnedPoints(this.level)) this.skillRanks=Object.fromEntries(this.skills.map(skill=>[skill.id,freeRank(skill.slot)]));
    syncUid([...this.bag, ...Object.values(this.equip)]);
    this.recalc();
    this.refreshGear();
    this.hp = this.maxHp; this.mp = this.maxMp * this.C.res.start;
  }

  /** Glowing arc swept by the weapon during melee swings. */
  _updateSwing(dt) {
    const w = this.weaponObj;
    if (!w || !w.userData.tip || (this.cls !== 'warrior' && this.cls !== 'paladin')) return;
    this._swing ??= new SwingTrail(this.game.gfx.scene, { color: this.cls === 'paladin' ? [2.2, 1.8, 0.8] : [1.9, 1.3, 0.8] });
    const n = this.currentName, a = this.current;
    if (n && n.startsWith('atk_') && a && n !== 'atk_cry' && n !== 'atk_powerup') {
      const prog = a.time / (a.getClip().duration || 1), rel = this.releaseAt(n, 0.5);
      if (n === 'atk_spin' || Math.abs(prog - rel) < 0.28) {
        const tip = w.localToWorld(_t1.set(0, w.userData.tip, 0)), base = w.localToWorld(_t2.set(0, w.userData.tip * 0.3, 0));
        this._swing.push(base, tip);
      }
    }
    this._swing.update(dt);
  }

  dispose() { this._swing?.dispose(); super.dispose(); }

  update(dt) {
    const g = this.game, st = this.stats;
    this._updateSwing(dt);
    this._updateAegis(dt);
    for (const k in this.cds) if (this.cds[k] > 0) this.cds[k] -= dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.potionCd=Math.max(0,(this.potionCd??0)-dt);
    this._bellCd = (this._bellCd ?? 0) - dt;
    if(this.plagueStacks&&this.plagueUntil<=g.time)this.plagueStacks=0;
    this._thornCd=(this._thornCd??0)-dt; this._hookCd=(this._hookCd??0)-dt;
    let changed = false;
    for (const [k, b] of Object.entries(this.buffs)) { b.t -= dt; if (b.t <= 0) { delete this.buffs[k]; changed = true; if (k === 'shield') { this.shield = 0; this.showShield(false); } } }
    if (changed) this.recalc();

    if (this.alive) {
      const inCombat = g.enemies.some((e) => e.alive && e.state !== 'dormant' && !e.asleep && e.pos.distanceTo(this.pos) < (e.T?.boss?45:18));
      this.hp = Math.min(this.maxHp, this.hp + st.regen * dt * (inCombat?.35:1) * recoveryFactor(this));
      const regen = this.C.res.regen < 0 ? (inCombat ? 0 : this.C.res.regen) : this.C.res.regen * (1 + this.level * 0.05);
      this.gainRes((regen + st.resRegen) * dt);
      if (this.pending) {
        this.pending.t -= dt;
        if (this.pending.t <= 0) { const p = this.pending; this.pending = null; p.s.fire(g, this, p.aim); }
      }
      // queued melee attack: strike once in range
      const q = this.queued;
      if (q && (!q.target.alive || this.lock > 0 && false)) this.queued = null;
      else if (q && this.pos.distanceTo(q.target.pos) - q.target.radius <= this.skills[q.i].melee - 0.4) { this.stop(); this.castSlot(q.i, q.target.pos, q.target); }
      const speed = this.speed * (this.buffs.gravewalker ? 1.3 : this.buffs.ironmarch?1.18:1);
      if (this.lock > 0) this.lock -= dt;
      else if (this.manualMove||this.path.length) {
        const manual=this.manualMove,wp=manual?{x:this.pos.x+manual.x*3,z:this.pos.z+manual.z*3}:this.path[0];
        const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, d = Math.hypot(dx, dz);
        const step = speed * dt*(manual?.strength??1);
        if (!manual&&d <= step + 0.05) { this.path.shift(); this._bestD = 1e9; }
        if (d > 0.01) {
          const s = Math.min(step, d);
          const moved = g.level.move(this.pos, (dx / d) * s, (dz / d) * s, this.radius);
          this.facing = Math.atan2(dx, dz);
          if (d < (this._bestD ?? 1e9) - 0.04) { this._bestD = d; this._stall = 0; } else this._stall = (this._stall ?? 0) + dt;
          if (!moved || this._stall > 0.5) { this.path = []; this._bestD = 1e9; this._stall = 0; }
        }
        this.locomote('Running_A', speed);
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.17 / Math.max(0.6, this.current?.timeScale ?? 1) + 0.08; const L = g.level, ch = L.def.g[L.cellOf(this.pos.z)]?.[L.cellOf(this.pos.x)]; g.audio.play(L.spec.episode===5&&ch===';'?'h_plank':ch === ';' ? 'step_leaves' : (ch === ',' || L.spec.floor === 'dirt') && ch !== ':' ? 'step_dirt' : 'step_stone'); if ((this.cls === 'warrior' || this.cls === 'paladin') && Math.random() < 0.5) g.audio.play('clink', null, 0.8); if (g.level.spec.floor === 'dirt') g.smoke.emit({ pos: { x: this.pos.x, y: 0.15, z: this.pos.z }, count: 1, speed: [0.1, 0.5], life: [0.5, 0.9], size: [0.7, 1.2], c0: [0.2, 0.17, 0.14], c1: [0.1, 0.09, 0.08], alpha: 0.25, grow0: 0.5, grow1: 1.4, tex: 'smoke' }); }
      } else if (this.currentName !== 'Idle' && this.lock <= 0 && !this.pending) this.play('Idle', { fade: 0.2 });
    }
    if (this.gem && Math.random() < 0.3) {
      const p = this.gem.getWorldPosition(_v);
      g.particles.emit({ pos: p, count: 1, speed: [0.1, 0.5], up: 0.6, life: [0.3, 0.7], size: [0.12, 0.28], c0: this.gemCol[0], c1: this.gemCol[1] });
    }
    this.updateVisual(dt, 18);
  }
}
const _v = new THREE.Vector3();
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
