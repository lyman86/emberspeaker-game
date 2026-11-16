import {recoveryFactor} from './combat.js';
import * as THREE from 'three';
import {Minimap} from './minimap.js';
import {TRANSITIONS} from './portals.js';
import { CLASSES, CLASS_ORDER, RES_COLORS } from './classes.js';
import { CLASS_SKILLS } from './skills.js';
import { SLOTS, SLOT_NAMES, RARITY, BASES, AFFIXES, itemIcon, potionIcon, affixText, canEquip, shopStock } from './items.js';
import { BAG_SIZE } from './player.js';
import { MATERIALS, HOTBAR_ORDER, canUpgradeSlot, requiredLevel, enhancedStats, enhanceCost, salePrice } from './progression.js';
import { PROFILES } from './models.js';
import { CHAPTERS, MODES } from './runs.js';

const $ = (s) => document.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const STAT_ROWS = [['str', '力量'], ['dex', '敏捷'], ['int', '智力'], ['vit', '体能']];

export class UI {
  constructor(game) {
    this.game = game;
    this.numbers = [];
    this.typing = null;
    this.labels = [];
    this.el = {
      hud: $('#hud'), hp: $('#hpfill'), mp: $('#mpfill'), hpt: $('#hptext'), mpt: $('#mptext'), xp: $('#xp i'), lvl: $('#lvl'), skills: $('#skills'),
      quest: $('#quest'), gold: $('#gold'), shield: $('#shieldfill'), plvl: $('#plvl'), target: $('#target'), toast: $('#toast'), prompt: $('#prompt'), dialogue: $('#dialogue'), banner: $('#banner'),
      fade: $('#fade'), story: $('#story'), dmg: $('#dmg'), hurt: $('#hurt'), death: $('#death'), pause: $('#pause'), hint: $('#hint'),
      bag: $('#bagpanel'), shop: $('#shoppanel'), tip: $('#tooltip'), labels: $('#labels'), select: $('#select'), mporb: $('.orb.mp'),
    };
    this.minimap=new Minimap(game,this.el.hud);
    this.el.lootTray=h('section','loot-tray','<header><div><small>FIELD SPOILS</small><b>附近战利品 <span></span></b></div><button type="button" aria-expanded="false">展开全部</button></header><div class="loot-grid"></div><p>点击装备，走近拾取</p>');
    this.el.portalCaption=h('div','portal-caption');this.el.portalCaption.hidden=true;this.el.labels.appendChild(this.el.portalCaption);
    this.el.lootTray.hidden=true;this.el.labels.appendChild(this.el.lootTray);this.el.lootGrid=this.el.lootTray.querySelector('.loot-grid');
    this.gearOffers=[];this.el.gearOffer=h('aside','gear-offer');this.el.gearOffer.hidden=true;this.el.gearOffer.setAttribute('aria-label','新装备推荐');this.el.gearOffer.setAttribute('aria-live','polite');document.body.appendChild(this.el.gearOffer);
    this.el.lootTray.querySelector('button').onclick=()=>{this.lootExpanded=!this.lootExpanded;this._lootAt=0;};
    this.el.bossDetails=h('div','boss-details','<span class="boss-phase"></span><span class="boss-intent"></span><div class="poise-track"><i></i></div>');this.el.target.appendChild(this.el.bossDetails);
    this.el.ailment=h('div','player-ailment');this.el.hud.appendChild(this.el.ailment);
    this.el.growth=h('section','panel hidden'); this.el.growth.id='growthpanel';
    this.el.growth.setAttribute('aria-label','技能与工坊');
    document.body.appendChild(this.el.growth);
    this.el.skillPoints=h('div','skill-point-counter');this.el.skills.before(this.el.skillPoints);
    const skillButton=h('button','',game.touchMode?'技能':'技能说明 K'); skillButton.id='skillbtn';
    if(game.touchMode){skillButton.innerHTML='<svg viewBox="0 0 24 24"><path d="m12 2 3 6 7 4-7 4-3 6-3-6-7-4 7-4z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';skillButton.setAttribute('aria-label','技能');$('#bagbtn').setAttribute('aria-label','背包');$('#menubtn').setAttribute('aria-label','菜单');}
    skillButton.onclick=()=>this.openGrowth('skills'); $('#bagbtn').after(skillButton);
    this.el.dialogue.addEventListener('click', () => this.advance());
    $('#bagbtn').addEventListener('click', () => this.toggleBag());
    $('#menubtn').addEventListener('click', () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })));
    // generic HUD hover tips: data-tip="title|body|hotkey" (or a function set in this.hudTips)
    document.addEventListener('mouseover', (e) => {
      if(this.game.touchMode)return;
      const t = e.target.closest?.('[data-tip], .skill');
      if (!t || this.drag || !t.closest('#hud')) return;
      const html = this._hudTip(t);
      if (html) { this.el.tip.innerHTML = html; this.el.tip.classList.remove('hidden'); this._moveTip(e); this._tipEl = t; this._tipAnchor = t; }
    });
    document.addEventListener('mouseout', (e) => { if (this._tipEl && !this._tipEl.contains(e.relatedTarget)) { this._tipEl = null; this.hideTip(); } });
    for (const b of document.querySelectorAll('.panel .close')) {b.setAttribute('role','button');b.setAttribute('aria-label','关闭面板');b.tabIndex=0;b.addEventListener('click', () => this.closePanels());}
    window.addEventListener('mousemove', (e) => this._moveTip(e));
  }

  show() {
    this.gearOffers=[];this.gearOfferItem=null;this.el.gearOffer.hidden=true;
    this.el.hud.classList.remove('hidden');
    const pl = this.game.player, s = pl.skills;
    this.el.hint.innerHTML = `左键 移动 / ${s[0].name} · 右键 ${s[1].name} · Q W E 技能 · 空格 ${s[5].name} · 1 / 2 药水 · R 大招 · 技能上方 + 强化 · I 背包 · Esc 菜单`;
    if(this.game.touchMode){const color=RES_COLORS[pl.C.res.color];this.game.touch.vitals.querySelector('.touch-mp i').style.background=`linear-gradient(90deg,${color[2]},${color[0]})`;}
    this.el.hint.classList.remove('fade'); clearTimeout(this._hintT); this._hintT = setTimeout(() => this.el.hint.classList.add('fade'), 25000);
    const [c1, c2, c3] = RES_COLORS[pl.C.res.color];
    this.el.mp.style.background = `radial-gradient(circle at 40% 30%, ${c1}, ${c2} 55%, ${c3})`;
    $('#pname').textContent = pl.C.name;
    $('#ptitle').textContent = pl.C.title;
    const PF = PROFILES[pl.C.profile];
    $('#pemb').innerHTML = `<img src="${this.game.gear.portrait(this.game, PF.file, PF.builtinGear ?? [])}">`;
    $('#hud').dataset.cls = pl.cls;
    this.buildSkills();
    this.game.touch?.skin();
  }

  get panelOpen() { return !this.el.bag.classList.contains('hidden') || !this.el.shop.classList.contains('hidden') || !this.el.growth.classList.contains('hidden'); }

  // ================================================================== skill bar
  buildSkills() {
    const pl = this.game.player, box = this.el.skills;
    box.innerHTML = '';
    this.skillEls = {};
    HOTBAR_ORDER.forEach(i => {
      const s=pl.skills[i], upgrade=canUpgradeSlot(i);
      const wrap=h('div','skill-slot'+([2,5].includes(i)?' gap':'')+(i===6?' ultimate-slot':''));
      wrap.dataset.slot=i;
      const d=h('div','skill'+(pl.unlocked(s)?'':' locked'));
      d.dataset.skill=s.id;d.dataset.slot=i;
      if(this.game.touchMode){d.setAttribute('role','button');d.setAttribute('aria-label','施放 '+s.name);d.tabIndex=0;d.onclick=()=>this.game.touch.cast(i);}
      d.innerHTML=`<div class="ico">${s.icon}</div><div class="cd"></div><div class="cdn"></div><div class="key">${s.key}</div>`;
      wrap.appendChild(d);
      let learn=null,pips=null;
      if(upgrade){
        learn=h('button','skill-upgrade','+');learn.type='button';
        learn.setAttribute('aria-label',`强化 ${s.key} ${s.name}`);
        learn.onclick=e=>{e.preventDefault();e.stopPropagation();this.hideTip();if(pl.learnSkill(s.id)){this.game.audio.play('ui');if(!this.el.growth.classList.contains('hidden'))this.refreshGrowth();}};
        wrap.appendChild(learn);pips=h('div','rank-pips',Array.from({length:5},()=>'<i></i>').join(''));wrap.appendChild(pips);
      } else wrap.appendChild(h('span','basic-skill-label','基础'));
      box.appendChild(wrap);
      this.skillEls[s.id]={root:d,wrap,learn,pips,cd:d.querySelector('.cd'),cdn:d.querySelector('.cdn'),s};
    });
    this._skillProgress=null;this.updateSkillProgress();
    for (const [k, key] of [['hp', '1'], ['mp', '2']]) {
      const d = h('div', 'skill potion' + (k === 'hp' ? ' gap' : ''), `<div class="ico">${potionIcon(k)}</div><div class="key">${key}</div><div class="cnt"></div><div class="cdn"></div>`);
      d.dataset.potion = k;
      if(this.game.touchMode){d.setAttribute('role','button');d.setAttribute('aria-label',k==='hp'?'使用生命药水':'使用资源药水');d.onclick=()=>this.game.player.usePotion(k);}
      box.appendChild(d);
      this.skillEls[k] = { root: d, cnt: d.querySelector('.cnt'),cdn:d.querySelector('.cdn') };
    }
  }

  updateSkillProgress() {
    const p=this.game.player;
    const state=[p.level,p.skillPoints,...p.skills.map(s=>p.rank(s))].join(':');
    if(this._skillProgress===state)return;this._skillProgress=state;
    const allMax=p.skills.filter(s=>canUpgradeSlot(s.slot)).every(s=>p.rank(s)===5);
    this.el.skillPoints.textContent=`技能点 ${p.skillPoints}${allMax?' · QWER 已满阶':p.skillPoints?' · 点击 + 强化 Q / W / E / R':''}`;
    this.el.skillPoints.classList.toggle('available',p.skillPoints>0&&!allMax);
    for(const entry of Object.values(this.skillEls))if(entry.s&&entry.learn){
      const rank=p.rank(entry.s);entry.learn.hidden=!p.canLearnSkill(entry.s);
      entry.learn.title=`${rank?'强化':'学习'} ${entry.s.name} · 消耗 1 技能点`;
      entry.wrap.classList.toggle('can-upgrade',!entry.learn.hidden);
      [...entry.pips.children].forEach((pip,i)=>pip.classList.toggle('filled',i<rank));
    }
  }

  /** Tooltip HTML for a HUD element. */
  _hudTip(t) {
    const pl = this.game.player;
    if (!pl) return '';
    const box = (title, body, key, extra = '') => `<div class="box hudtip"><div class="ht"><b>${title}</b>${key ? `<kbd>${key}</kbd>` : ''}</div>${extra}${body ? `<div class="hb">${body}</div>` : ''}</div>`;
    if (t.dataset.skill) {
      const s = pl.skills.find((x) => x.id === t.dataset.skill);
      const meta = [];
      if (s.cost > 0) meta.push(`消耗 <b>${s.cost}</b> ${pl.C.res.name}`);
      else if (s.cost < 0 || s.gain) meta.push(`产生 ${pl.C.res.name}`);
      else meta.push('无消耗');
      if (s.cd > 0.6) meta.push(`冷却 <b>${Number(pl.skillCooldown(s).toFixed(1))}</b> 秒`);
      const upgrade=canUpgradeSlot(s.slot),rank=pl.rank(s);
      const lock=pl.unlocked(s)?`<div class="meta">${upgrade?`第 ${rank} / 5 阶`:'基础技能 · 固定效果，无需加点'}</div>`:`<div class="lockline">需要等级 ${s.unlock}${upgrade?'，点击技能上方 + 学习':''}（当前 ${pl.level}）</div>`;
      const next=upgrade&&rank<5?`<div class="hb">下一阶：${s.rankDescriptions[rank]}<br>需要等级 ${requiredLevel(s,rank+1)} · 1 技能点</div>`:'';
      return box(s.name, s.desc, s.key, `<div class="meta">${meta.join(' · ')}</div>${lock}${next}`);
    }
    if (t.dataset.potion) {
      const k = t.dataset.potion, n = pl.potions[k];
      return k === 'hp' ? box('生命药水', `立即回复 40% 最大生命。<br>剩余 <b>${n}</b> 瓶；两种药水共用 10 秒冷却。`, '1') : box(pl.C.res.name + '药水', `立即回复 60% ${pl.C.res.name}。<br>剩余 <b>${n}</b> 瓶；两种药水共用 10 秒冷却。`, '2');
    }
    if (t.id === 'xp') return box('经验', `等级 ${pl.level} · ${pl.xpText?.() ?? Math.round(pl.xpProgress() * 100) + '%'}`, '');
    if (t.classList.contains('hp')) return box('生命', `${Math.ceil(pl.hp)} / ${pl.maxHp}${pl.shield > 0 ? `<br>护盾 <b>${Math.round(pl.shield)}</b>（先于生命承受伤害）` : ''}<br>每秒回复 ${pl.stats.regen.toFixed(1)}`, '');
    if (t.classList.contains('mp')) return box(pl.C.res.name, `${Math.floor(pl.mp)} / ${pl.maxMp}<br>${{ mana: '随时间回复，用于施放法术。', rage: '攻击和受到伤害时产生，脱战后逐渐消退。', focus: '快速回复，用于施放技能。', holy: '随时间回复，用于施放圣光技能。', essence: '随时间回复，主攻击可额外汲取。' }[pl.C.res.color] ?? ''}`, '');
    const [a, b, c] = (t.dataset.tip ?? '').split('|');
    return a ? box(a, b, c) : '';
  }

  flashSkill(id) { const e = this.skillEls?.[id]?.root; if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } }
  noMana(name = '法力') { this.game.audio.play('denied'); if (!this._nm || performance.now() - this._nm > 1500) { this._nm = performance.now(); this.number(this.game.player.pos, name + '不足', 'info'); } }

  // ================================================================== class select
  modeSelect(cb) {
    const root=this.el.modes??=h('section','mode-screen');root.id='mode-select';root.setAttribute('aria-label','选择游戏模式');document.body.appendChild(root);
    this.el.select.classList.add('hidden');root.classList.remove('hidden');
    let mode='story',chapter=1;
    const art=[`<circle cx="48" cy="49" r="28"/><path d="M29 59q19-34 38 0M36 29v-8m24 8v-8M48 13v52m-8 7h16"/>`,`<path d="m15 29 22-11 23 11 21-11v54L60 83 37 72 15 83zm22-11v54m23-43v54M25 52l9-7m13 10 8 4m12-14 8-5"/>`,`<path d="m19 35 15 13 14-27 14 27 15-13-7 35H26zM29 80h38M48 46v18M40 55h16"/>`];
    const render=()=>{
      const m=MODES.find(m=>m.id===mode);
      root.innerHTML=`<header><div class="mode-wordmark">烬语者<small>EMBERSPEAKER</small></div><p>七时之钟 <i>／</i> 选择你的征途</p></header><main><div class="mode-choices">${MODES.map((m,i)=>`<button class="mode-card ${mode===m.id?'on':''}" data-mode="${m.id}" aria-pressed="${mode===m.id}"><svg viewBox="0 0 96 96" aria-hidden="true">${art[i]}</svg><small>${m.en}</small><h2>${m.name}</h2><p>${m.desc}</p><span>${mode===m.id?'已选择':'选择模式'} →</span></button>`).join('')}</div><section class="chapter-picker" aria-label="选择章节">${mode==='story'?'<div class="story-mode-note"><b>六集战役 · 一段连续旅程</b><span>选择英雄后继续原有存档，或从第一集重新出发。</span></div>':CHAPTERS.map(c=>`<button data-chapter="${c.id}" class="chapter-choice ${chapter===c.id?'on':''}" style="--chapter:${c.color}" aria-pressed="${chapter===c.id}"><small>CHAPTER 0${c.id} · Lv.${mode==='boss'?c.bossLevel:c.level}</small><b>${mode==='boss'?c.bossName:c.title}</b><span>${mode==='boss'?c.title:c.feature}</span></button>`).join('')}</section></main><footer><p>${mode==='story'?'故事成长自动保存':mode==='chapter'?'独立挑战 · 对应等级装备 · 不影响故事存档':'独立挑战 · 直接进入 Boss 场地 · 不影响故事存档'}</p><button class="mode-enter">选择英雄 <span>→</span></button></footer>`;
      for(const b of root.querySelectorAll('[data-mode]'))b.onclick=()=>{mode=b.dataset.mode;this.game.audio.play('ui');render();};
      for(const b of root.querySelectorAll('[data-chapter]'))b.onclick=()=>{chapter=Number(b.dataset.chapter);this.game.audio.play('ui');render();};
      root.querySelector('.mode-enter').onclick=()=>{root.classList.add('hidden');cb({mode,chapter});};
    };render();
  }

  prepareBoss(){
    const g=this.game,root=h('section','boss-prep');root.id='boss-prep';
    root.innerHTML=`<small>KEEPER TRIAL</small><h3>准备迎战</h3><p>可先强化 Q / W / E / R，技能栏实时显示剩余点数。</p><div><button class="allocate">技能与加点</button><button class="ready">准备完成 · 迎战 Boss</button></div>`;
    document.body.appendChild(root);root.querySelector('.allocate').onclick=()=>this.openGrowth('skills');
    root.querySelector('.ready').onclick=()=>{this.closePanels();root.remove();g.bossReady=true;g.story.onTrigger(({boss:'boss_intro',stag:'stag_intro',ironking:'king_intro',saltqueen:'queen_intro',angler:'angler_intro',winterabbess:'abbess_intro'})[CHAPTERS[g.run.chapter-1].boss]);};
  }

  runResult(run,seconds,deaths) {
    const c=CHAPTERS[run.chapter-1],root=h('section','run-result');root.id='run-result';
    root.innerHTML=`<div><small>${run.mode==='boss'?'KEEPER DEFEATED':'EXPEDITION COMPLETE'}</small><h2>${run.mode==='boss'?'守关者已倒下':'本集挑战完成'}</h2><p>${c.title} · ${this.game.player.C.name}</p><dl><div><dt>用时</dt><dd>${Math.floor(seconds/60)} 分 ${Math.floor(seconds%60)} 秒</dd></div><div><dt>倒下次数</dt><dd>${deaths}</dd></div></dl><p class="result-note">故事模式的存档保持独立。</p><button class="retry">再战一次</button><button class="back">返回模式选择</button></div>`;
    document.body.appendChild(root);root.querySelector('.back').onclick=()=>this.game.returnToTitle();
    root.querySelector('.retry').onclick=()=>{location.href=location.pathname+'?'+new URLSearchParams({mode:run.mode,chapter:run.chapter,cls:this.game.player.cls,autostart:'1',...(this.game.touchMode?{touch:'1'}:{})});};
  }

  /** Title screen: choose a class (each class has its own save). cb(cls, fresh) */
  classSelect(cb, selection={mode:'story',chapter:1}) {
    const g = this.game, sel = this.el.select;
    sel.classList.remove('hidden');
    this.selecting = true;
    this._buildShowcase();
    if(g.touchMode){sel.innerHTML='<header class="select-header"><div class="logo">烬语者<small>EMBERSPEAKER</small></div><span>选择你的烬语者</span><b>故事战役 · 七时之钟</b></header><div class="cards" role="listbox" aria-label="选择英雄"></div><section class="detail"></section><div class="select-stage-caption">灰烬仍在低语<small>五种命运 · 一段旅程</small></div>';this.show_.cam.position.set(0,1.9,6.5);this.show_.cam.lookAt(0,1.5,0);}
    const mode=MODES.find(m=>m.id===selection.mode);
    const back=h('button','mode-back','‹ 返回模式');back.onclick=()=>{this.selecting=false;this._disposeShowcase();sel.classList.add('hidden');g.title();};sel.querySelector('.mode-back')?.remove();sel.appendChild(back);
    if(g.touchMode)sel.querySelector('.select-header>b').textContent=mode.name+' · '+(selection.mode==='story'?'七时之钟':CHAPTERS[selection.chapter-1].title);
    const list = sel.querySelector('.cards');
    list.innerHTML = '';
    let cur = CLASS_ORDER[2];
    const detail = sel.querySelector('.detail');
    const render = () => {
      for (const c of list.children){c.classList.toggle('on',c.dataset.cls===cur);c.setAttribute('aria-selected',String(c.dataset.cls===cur));}
      const C = CLASSES[cur], info = selection.mode==='story'?g.saveInfo(cur):null;
      const bars = Object.entries(C.stats).map(([k, v]) => `<div class="bar"><span>${k}</span><b style="width:${v * 20}%"></b></div>`).join('');
      const skills = CLASS_SKILLS[cur].map((s) => `<div class="sk" title="${s.name}：${s.desc}">${s.icon}<i>${s.name}</i></div>`).join('');
      detail.innerHTML = `<h2>${C.name}<small>${C.title}</small></h2><p>${C.desc}</p><div class="bars">${bars}</div>
        <div class="res">资源：<b>${C.res.name}</b>　主属性：<b>${{ str: '力量', dex: '敏捷', int: '智力' }[C.main]}</b></div><div class="sks">${skills}</div>
        <div class="btns">${info ? `<button class="go">继续冒险</button><div class="saveinfo">存档：等级 ${info.level} · ${info.where ?? ''}</div><button class="new small">重新开始</button>` : '<button class="go">以此职业开始</button>'}</div>`;
      if(g.touchMode){
        const roles={warrior:['近战 · 破甲','生存 / 爆发'],ranger:['远程 · 机动','单体 / 风筝'],mage:['远程 · 法术','范围 / 控场'],paladin:['近战 · 圣光','护盾 / 治疗'],necro:['远程 · 召唤','军团 / 消耗']}[cur];
        detail.innerHTML=`<div class="hero-heading"><small>EMBER ${String(CLASS_ORDER.indexOf(cur)+1).padStart(2,'0')}</small><h2>${C.name}<small>${C.title}</small></h2><div class="hero-tags"><span>${roles[0]}</span><span>${roles[1]}</span></div></div><div class="hero-copy"><p>${C.desc}</p><div class="sks">${CLASS_SKILLS[cur].map((s,i)=>`<button class="sk" aria-label="预览 ${s.name}" data-preview="${i}">${s.icon}</button>`).join('')}</div><div class="ability-preview"></div><p class="hero-advice">${{warrior:'抓住重击后的破绽，近身压制；留意正面横扫。',ranger:'拉开距离持续输出；用翻滚躲开锁定地面的根刺。',mage:'火焰灼烧木甲，寒冰削弱追击；避免被蓄力冲撞命中。',paladin:'用护盾承受重击，圣光压制疫病；抓住收招空档反击。',necro:'军团分担近战压力；钟波会伤害召唤物，及时补充部队。'}[cur]}</p></div><div class="btns">${info?`<div class="saveinfo">Lv.${info.level} · ${info.where??'霜暮营地'}</div><button class="go">继续冒险 <span>→</span></button><button class="new small">重新开始</button>`:'<button class="go">踏入故事 <span>→</span></button>'}</div>`;
        const preview=i=>{const skill=CLASS_SKILLS[cur][i];detail.querySelector('.ability-preview').innerHTML=`<b>${skill.name}</b><span>${skill.desc}</span>`;for(const b of detail.querySelectorAll('.sk'))b.classList.toggle('on',+b.dataset.preview===i);};
        for(const b of detail.querySelectorAll('.sk'))b.onclick=()=>preview(+b.dataset.preview);preview(0);
      }
      if(selection.mode!=='story'){detail.querySelector('.go').textContent='开始'+mode.name+' →';detail.querySelector('.btns').prepend(h('p','challenge-note',CHAPTERS[selection.chapter-1].title+' · Lv.'+(selection.mode==='boss'?CHAPTERS[selection.chapter-1].bossLevel:CHAPTERS[selection.chapter-1].level)));}
      detail.querySelector('.go').onclick = () => finish(false);
      const nb = detail.querySelector('.new');
      if (nb) nb.onclick = () => { if (confirm(`确定要删除「${C.name}」的存档并重新开始吗？`)) { g.deleteSave(cur); finish(true); } };
      this._showcaseClass(cur);
    };
    const finish = (fresh) => { sel.classList.add('hidden'); this.selecting = false; this._disposeShowcase(); g.audio.play('ui'); cb(cur, fresh); };
    for (const k of CLASS_ORDER) {
      const C = CLASSES[k], info = g.saveInfo(k);
      const PF = PROFILES[C.profile];
      const card = h('div', 'card', `<img class="pt" src="${g.gear.portrait(g, PF.file, PF.builtinGear ?? [])}"><div class="nm">${C.name}</div><div class="sub">${info ? '等级 ' + info.level : '新角色'}</div>`);
      card.dataset.cls = k;card.setAttribute('role','option');card.setAttribute('aria-label',C.name);card.tabIndex=0;
      card.onclick = () => { cur = k; g.audio.play('ui'); render(); };card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}};
      list.appendChild(card);
    }
    render();
  }

  _buildShowcase() {
    const g = this.game;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080c);
    scene.fog = new THREE.FogExp2(0x07080c, 0.06);
    const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
    cam.position.set(0, 2.4, 9.5); cam.lookAt(0, 1.6, 0);
    scene.add(new THREE.HemisphereLight(0x6a78a8, 0x1a1410, 0.6));
    const key = new THREE.SpotLight(0xffb070, 260, 30, 0.6, 0.6, 1.6); key.position.set(3, 7, 4); key.castShadow = true; scene.add(key, key.target);
    const rim = new THREE.PointLight(0x6a8cff, 60, 14, 1.6); rim.position.set(-3, 3, -3); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48).rotateX(-Math.PI / 2), g.materials.get('stoneFloor', 1.5)); floor.receiveShadow = true; scene.add(floor);
    this.show_ = { scene, cam, actors: {}, cur: null, t: 0, fire: { x: 0, y: 0.1, z: 1.8, acc: 0 } };
  }

  _showcaseClass(cls) {
    const S = this.show_, g = this.game;
    if (!S) return;
    if (!S.actors[cls]) {
      const P = g._makeShowcaseActor?.(cls);
      S.actors[cls] = P;
      if (P) S.scene.add(P.root);
    }
    for (const [k, a] of Object.entries(S.actors)) if (a) a.root.visible = k === cls;
    S.cur = cls;
  }

  updateSelect(dt) {
    const S = this.show_, g = this.game;
    if (!S) return;
    S.t += dt;
    const a = S.actors[S.cur];
    if (a) { a.root.rotation.y = Math.sin(S.t * 0.4) * 0.5 + 0.2; a.mixer.update(dt); }
    S.cam.aspect = innerWidth / innerHeight; S.cam.updateProjectionMatrix();
    S.cam.position.x = g.touchMode?0:innerWidth > 900 ? 1.8 : 0;
    if(g.touchMode){S.cam.position.z=innerWidth<740?7:6.5;S.cam.setViewOffset(innerWidth,innerHeight,69,0,innerWidth,innerHeight);}else S.cam.clearViewOffset();
    g.gfx.renderer.render(S.scene, S.cam);
  }

  _disposeShowcase() { if (this.show_) for (const a of Object.values(this.show_.actors)) a?.dispose(); this.show_ = null; }

  // ================================================================== inventory
  toggleBag() {
    const open = this.el.bag.classList.contains('hidden');
    this.closePanels();
    if (open) { this.el.bag.classList.remove('hidden'); this.refreshBag(); this.game.audio.play('ui'); }
  }

  closePanels() { this.el.growth.classList.add('hidden'); this.el.bag.classList.add('hidden'); this.el.shop.classList.add('hidden'); this.hideTip(); this.shopMode = null; this.el.gearOffer.hidden=true;this.gearOfferItem=null; }

  refreshStats() { if (!this.el.bag.classList.contains('hidden')) this.refreshBag(); }

  icon(it) { return `<img class="gi" alt="${BASES[it.base]?.name??'装备'}" draggable="false" src="${this.game.gear.icon(it)}">${it.apex?'<b class="apex-badge" title="远古圣遗">✦</b>':''}${it.stars?`<b class="itemstars">${'★'.repeat(it.stars)}</b>`:''}`; }

  refreshBag() {
    const pl = this.game.player, P = this.el.bag;
    if (!pl || P.classList.contains('hidden') && this.el.shop.classList.contains('hidden')) return;
    if(!P.querySelector('.bag-tabs')) {
      const tabs=h('div','bag-tabs','<button>装备</button><button>材料</button>');
      tabs.children[0].onclick=()=>{this.materialTab=false;this.refreshBag();};
      tabs.children[1].onclick=()=>{this.materialTab=true;this.refreshBag();};
      P.querySelector('.grid').before(tabs);
    }
    const eq = P.querySelector('.equip'), bag = P.querySelector('.grid'), st = P.querySelector('.stats');
    eq.innerHTML = '';
    for (const s of SLOTS) {
      const it = pl.equip[s];
      const d = h('div', 'slot ' + s + (it ? ' full r-' + it.rarity : ''), (it ? this.icon(it) : '') + `<span>${SLOT_NAMES[s]}</span>`);
      d.dataset.slot = s;
      if (it) {
        d.onmouseenter = () => !this.drag && this.showTip(it, null, 'equipped');
        d.onmouseleave = () => {if(!this.game.touchMode)this.hideTip();};
        this._dragSource(d, { slot: s }, () => { pl.unequip(s); this.hideTip(); this.refreshBag(); });
        d.oncontextmenu = (e) => { e.preventDefault(); this.hideTip(); if (pl.discard({ slot: s })) this.refreshBag(); };
      }
      eq.appendChild(d);
    }
    bag.innerHTML = '';
    bag.classList.toggle('materials-tab',!!this.materialTab);
    if(this.materialTab) for(const [id,m] of Object.entries(MATERIALS)){
      const count=pl.materials[id]??0;
      const row=h('div','material-row',`<b>${m.name} ×${count}</b><span>单价 ${m.price} 金币</span>`);
      if(this.shopMode){const sell=h('button','','全部出售');sell.disabled=!count;sell.onclick=()=>{pl.gold+=count*m.price;pl.materials[id]=0;this.refreshBag();this.refreshShop();this.game.save();};row.appendChild(sell);}
      bag.appendChild(row);
    }
    if(!this.materialTab) pl.bag.forEach((it, i) => {
      const d = h('div', 'cell' + (it ? ' r-' + it.rarity + (canEquip(pl.cls, it) ? '' : ' na') : ''), it ? this.icon(it) : '');
      d.dataset.i = i;
      if (it) {
        const advice=pl.compareGear(it);d.classList.toggle('gear-upgrade',advice.upgrade);
        if(advice.status!=='normal'){const badge=h('b','gear-badge '+advice.status,advice.upgrade?'↑ 提升':advice.status==='choice'?'◇ 特效':'× 职业');d.appendChild(badge);d.title=advice.label;d.setAttribute('aria-label',it.name+' · '+advice.label);}

        d.onmouseenter = () => !this.drag && this.showTip(it, pl.equip[it.slot], this.shopMode ? 'sell' : 'bag');
        d.onmouseleave = () => {if(!this.game.touchMode)this.hideTip();};
        this._dragSource(d, { i }, () => { if (this.shopMode) this.sell(i); else { pl.equipFromBag(i); this.hideTip(); this.refreshBag(); } });
        d.oncontextmenu = (e) => { e.preventDefault(); this.hideTip(); if (this.shopMode) this.sell(i); else if (pl.discard({ i })) this.refreshBag(); };
      }
      bag.appendChild(d);
    });
    const s = pl.stats;
    const dps = Math.round(pl.dmgMul * 15);
    st.innerHTML = `<div class="who">${pl.C.name} · 等级 ${pl.level}</div>` +
      STAT_ROWS.map(([k, n]) => `<div><span>${n}</span><b class="${k === pl.C.main ? 'main' : ''}">${Math.round(s[k])}</b></div>`).join('') +
      `<div class="sep"></div><div><span>生命</span><b>${pl.maxHp}</b></div><div><span>${pl.C.res.name}</span><b>${pl.maxMp}</b></div>
       <div><span>护甲</span><b>${Math.round(s.armor)}<small> (减伤 ${Math.round(pl.dr * 100)}%)</small></b></div>
       <div><span>伤害系数</span><b>${dps}</b></div><div><span>暴击</span><b>${s.crit.toFixed(1)}% / +${Math.round(s.critDmg)}%</b></div>
       <div><span>攻击速度</span><b>+${Math.round(s.atkSpd)}%</b></div><div><span>移动速度</span><b>+${Math.round(s.move)}%</b></div>
       ${s.cdr ? `<div><span>冷却缩减</span><b>${Math.round(s.cdr)}%</b></div>` : ''}${s.lifeHit ? `<div><span>击中回复</span><b>${Math.round(Math.min(s.lifeHit,pl.maxHp*.015))}<small> / 0.65秒</small></b></div>` : ''}`;
    P.querySelector('.goldline b').textContent = pl.gold;
    P.querySelector('.hint').innerHTML = this.game.touchMode?'点击物品查看详情，再选择装备、卸下或出售':this.shopMode ? '左键 / 右键：出售给商人' : '左键 装备/卸下 · 右键 丢弃 · 拖动可整理，拖到面板外即丢弃';
  }

  gearComparisonHtml(cmp) {
    if(cmp.status==='unusable')return '<div class="gear-comparison unusable"><b>职业不符</b><span>当前职业无法装备此物品。</span></div>';
    if(cmp.status==='unusable')return '<div class="gear-comparison unusable">当前职业无法装备</div>';
    const percent=v=>(v>=0?'+':'')+(v*100).toFixed(1)+'%';
    return `<div class="gear-comparison ${cmp.status}"><b>${cmp.upgrade?'↑ ':cmp.status==='choice'?'◇ ':''}${cmp.label}</b><span>预估输出 ${percent(cmp.attack)} · 生存 ${percent(cmp.defence)}</span>${cmp.note?`<span>${cmp.note}</span>`:''}<small>按本职业面板估算，传奇特效需按流派选择。</small></div>`;
  }

  offerGear(it) {
    if(!this.game.player.compareGear(it).upgrade)return;
    this._gearOfferAt=0;this.gearOffers??=[];if(!this.gearOffers.includes(it)){this.gearOffers.push(it);if(this.game.enemies.some(e=>e.alive&&!e.asleep&&e.pos.distanceTo(this.game.player.pos)<18))this.toast('发现更好装备：'+it.name+' · 脱离战斗后可选择装备');}
  }

  updateGearOffer(dt=1) {
    this._gearOfferAt=(this._gearOfferAt??0)-dt;if(this._gearOfferAt>0)return;this._gearOfferAt=.2;
    const g=this.game,p=g.player,card=this.el.gearOffer;
    this.gearOffers=(this.gearOffers??[]).filter(it=>p.bag.includes(it)&&p.compareGear(it).upgrade);
    const it=this.gearOffers[0];
    const danger=g.enemies.some(e=>e.alive&&!e.asleep&&e.pos.distanceTo(p.pos)<18);
    const blocked=!it||!p.alive||g.cinematic||g.paused||g.loadingLevel||g.runFinished||this.drag||danger||(this.panelOpen&&!this.shopMode);
    card.hidden=!!blocked;if(blocked){this.gearOfferItem=null;return;}
    if(this.gearOfferItem===it)return;this.gearOfferItem=it;this.renderGearOffer(it,p.compareGear(it));
  }

  renderGearOffer(it,cmp) {
    const card=this.el.gearOffer;
    card.innerHTML=`<header><small>GEAR DISCOVERED</small><span>适合${this.game.player.C.name}的新装备</span></header><div class="gear-offer-item"><div class="gear-offer-art">${this.icon(it)}</div><div><b style="color:${RARITY[it.rarity].color}">${it.name}</b><p>${SLOT_NAMES[it.slot]} · Lv.${it.ilvl}${it.stars?' · '+'★'.repeat(it.stars):''}</p><p>替换：${cmp.current?.name??'当前空位'}</p></div></div>${this.gearComparisonHtml(cmp)}<footer><button type="button" class="equip-new">立即装备</button><button type="button" class="keep-new">暂不装备</button></footer><small class="gear-offer-remaining">${this.gearOffers.length>1?'另有 '+(this.gearOffers.length-1)+' 件待比较 · ':''}装备已放入背包，可稍后选择</small>`;
    card.querySelector('.equip-new').onclick=()=>this.resolveGearOffer(true);
    card.querySelector('.keep-new').onclick=()=>this.resolveGearOffer(false);
  }

  resolveGearOffer(equip) {
    const p=this.game.player,it=this.gearOfferItem;if(!it||this.gearOffers?.[0]!==it)return;const i=p.bag.indexOf(it);
    if(equip&&i>=0&&p.compareGear(it).upgrade){if(p.equipFromBag(i)){this.toast('已装备：'+it.name);this.refreshBag();}}
    this.gearOffers?.shift();this.gearOfferItem=null;this.el.gearOffer.hidden=true;this.game.input?.swallow();
  }

  /** Click-or-drag behaviour for an item element. from = { i } (bag) or { slot } (equipped). */
  _dragSource(el, from, onClick) {
    if(this.game.touchMode){
      el.setAttribute('role','button');el.tabIndex=0;el.onmouseenter=el.onmouseleave=null;
      const p=this.game.player,it=from.slot?p.equip[from.slot]:p.bag[from.i];el.setAttribute('aria-label',(from.slot?'已装备 ':'背包 ')+(it?.name??'物品'));
      el.onclick=()=>{const p=this.game.player,it=from.slot?p.equip[from.slot]:p.bag[from.i];if(it)this.touchItem(it,from.slot?'卸下装备':this.shopMode?`出售 · ${salePrice(it)} 金币`:'装备物品',onClick);};
      return;
    }
    el.onmousedown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const x0 = e.clientX, y0 = e.clientY;
      let ghost = null;
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) {
          ghost = h('div', 'dragghost', el.querySelector('img')?.outerHTML ?? '');
          document.body.appendChild(ghost); this.drag = from; this.hideTip(); el.classList.add('dragging');
        }
        if (ghost) ghost.style.transform = `translate(${ev.clientX - 26}px, ${ev.clientY - 26}px)`;
      };
      const up = (ev) => {
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
        if (!ghost) { onClick(); return; }
        ghost.remove(); this.drag = null; el.classList.remove('dragging');
        this._drop(from, ev.clientX, ev.clientY);
      };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    };
  }

  _drop(from, x, y) {
    const pl = this.game.player;
    const t = document.elementFromPoint(x, y);
    const cell = t?.closest('#bagpanel .grid .cell'), slot = t?.closest('#bagpanel .equip .slot'), panel = t?.closest('.panel');
    if (cell) {
      const j = +cell.dataset.i;
      if (from.slot) pl.unequipTo(from.slot, j); else pl.moveBag(from.i, j);
    } else if (slot) {
      if (from.i != null && pl.bag[from.i]?.slot === slot.dataset.slot) pl.equipFromBag(from.i);
      else if (from.i != null) { this.toast('该物品不能放在这个部位'); this.game.audio.play('denied'); }
    } else if (!panel) {
      if (this.shopMode && from.i != null) { /* dragging out while shopping does nothing */ }
      else pl.discard(from);
    }
    this.refreshBag();
  }

  // ================================================================== shop
  /** mode: 'smith' (equipment) or 'apothecary' (potions) */
  openShop(mode) {
    const g = this.game, pl = g.player;
    this.closePanels();
    this.shopMode = mode;
    const S = this.el.shop;
    S.classList.remove('hidden');
    this.el.bag.classList.remove('hidden');
    if(!S.querySelector('.workshop-button')){const b=h('button','workshop-button','强化装备 / 分解装备');b.onclick=()=>this.openGrowth('forge');S.querySelector('h3').after(b);}
    S.querySelector('.workshop-button').hidden=mode!=='smith';
    S.querySelector('h3').textContent = mode === 'smith' ? '布拉姆的铁匠铺' : mode==='quartermaster'?'艾达的军需站':mode==='wintermerchant'?'奥文的寒脊补给':mode==='harbormerchant'?'莫娅的船坞补给':mode==='saltmerchant'?'萨米尔的盐路补给':mode==='hunter'?'哈罗德的补给':'艾琳的药剂摊';
    if (mode === 'smith' && (!this._stock || this._stockLvl !== pl.level || this._stockCls !== pl.cls)) { this._stock = shopStock(pl.cls, pl.level); this._stockLvl = pl.level; this._stockCls = pl.cls; }
    this.refreshShop();
    this.refreshBag();
    g.audio.play('chest', null, 0.4);
  }

  refreshShop() {
    const g = this.game, pl = g.player, S = this.el.shop, grid = S.querySelector('.grid');
    grid.innerHTML = '';
    grid.classList.toggle('supply-grid',this.shopMode!=='smith');
    if (this.shopMode === 'apothecary'||['hunter','quartermaster','saltmerchant','harbormerchant','wintermerchant'].includes(this.shopMode)) {
      const supply=(icon,name,description,price,buy)=>{
        const row=h('button','ware',`<span class="ico" aria-hidden="true">${icon}</span><span class="nm">${name}</span><span class="ds">${description}</span><span class="pr">${price} 金币</span>`);
        row.type='button';row.onclick=buy;grid.appendChild(row);
      };
      const potions = [['hp', '生命药水', 25, '回复 40% 生命'], ['mp', pl.C.res.name + '药水', 20, `回复 60% ${pl.C.res.name}`]];
      for(const [k,n,price,desc] of potions)supply(potionIcon(k),n,desc,price,()=>this.buyPotion(k,price,n));
      supply(potionIcon('hp'),'药剂礼包',`生命药水 ×4，${pl.C.res.name}药水 ×2`,110,()=>{
        if(pl.gold<110)return this._poor();pl.gold-=110;pl.potions.hp+=4;pl.potions.mp+=2;g.audio.play('coin');this.toast('购买：药剂礼包');g.save();this.refreshShop();this.refreshBag();
      });
      if(['hunter','quartermaster','saltmerchant','harbormerchant','wintermerchant'].includes(this.shopMode))for(const id of ['iron','soul']){
        const m=MATERIALS[id],price=m.price*2;
        const icon=id==='iron'?'<svg viewBox="0 0 40 40"><path d="m6 17 19-8 9 7-19 9z" fill="#b3b7b5" stroke="#d5c091"/><path d="M6 17v9l9 6v-7m0 7 19-9v-7" fill="#606c72" stroke="#b8aa85"/><path d="m12 16 12-5m-4 13 10-5" stroke="#e1e4df"/></svg>':'<svg viewBox="0 0 40 40"><path d="m20 4 11 13-4 15-10 4-9-15z" fill="#7464af" stroke="#c7b7ec"/><path d="m20 4-3 18 14-5m-14 5 10 10m-10-10v14l-9-15z" fill="#aa9ae0" stroke="#d7cef5"/></svg>';
        supply(icon,m.name,'强化装备材料 ×1',price,()=>{if(pl.gold<price)return this._poor();pl.gold-=price;pl.addMaterial(id);g.audio.play('coin');g.save();this.refreshShop();this.refreshBag();});
      }
    } else {
      this._stock.forEach((it, i) => {
        const d = h('div', 'cell r-' + it.rarity, this.icon(it) + `<div class="price">${it.price}</div>`);
        d.onmouseenter = () => this.showTip(it, pl.equip[it.slot], 'buy');
        d.onmouseleave = () => {if(!this.game.touchMode)this.hideTip();};
        if(this.game.touchMode){d.setAttribute('role','button');d.setAttribute('aria-label','查看商品 '+it.name);d.tabIndex=0;}
        d.onclick = () => this.game.touchMode?this.touchItem(it,`购买 · ${it.price} 金币`,()=>this.buy(i)):this.buy(i);
        grid.appendChild(d);
      });
    }
    S.querySelector('.gold').textContent = pl.gold;
  }

  _poor() { this.game.audio.play('denied'); this.toast('金币不足'); }

  buy(i) {
    const g = this.game, pl = g.player, it = this._stock[i];
    if (pl.gold < it.price) return this._poor();
    if (!pl.addItem(it)) { this.toast('背包已满'); return; }
    pl.gold -= it.price;
    this._stock.splice(i, 1);
    g.audio.play('coin');
    this.hideTip(); this.refreshShop(); this.refreshBag(); g.save();
  }

  buyPotion(k, price, n) {
    const g = this.game, pl = g.player;
    if (pl.gold < price) return this._poor();
    pl.gold -= price; pl.potions[k]++;
    g.audio.play('coin'); this.toast('购买：' + n);
    this.refreshShop(); this.refreshBag(); g.save();
  }

  sell(i) {
    const g = this.game, pl = g.player, it = pl.bag[i];
    if (!it) return;
    const v = salePrice(it);
    pl.bag[i] = null; pl.gold += v;
    g.audio.play('coin');
    this.hideTip(); this.refreshBag(); if (this.shopMode === 'smith') this.refreshShop(); else this.el.shop.querySelector('.gold').textContent = pl.gold;
    g.save();
  }


  openGrowth(mode='skills',respec=false) {
    const wasOpen=!this.el.growth.classList.contains('hidden');
    if(mode==='skills' && wasOpen && this.growthMode===mode && !respec){this.closePanels();return;}
    this.closePanels();this.growthMode=mode;this.respecAllowed=respec;
    if(mode==='forge')this.shopMode='smith';
    this.el.growth.classList.remove('hidden');this.refreshGrowth();
  }
  refreshGrowth() {
    const g=this.game,p=g.player,P=this.el.growth;
    const button=(label,action,disabled=false)=>{const b=h('button','',label);b.disabled=disabled;b.onclick=()=>{this.hideTip();action();this.refreshGrowth();};return b;};
    P.innerHTML=`<button class="close" aria-label="关闭">×</button><h3>${this.growthMode==='skills'?'余烬技艺 · 技能':'布拉姆 · 强化与分解'}</h3><div class="growth-summary">等级 ${p.level} / 30 · ${p.skillPoints} 技能点 · ${p.gold} 金币</div><div class="growth-list"></div>`;
    P.querySelector('.close').onclick=()=>this.closePanels();
    const list=P.querySelector('.growth-list');
    if(this.growthMode==='skills') {
      for(const s of p.skills.filter(s=>canUpgradeSlot(s.slot))){
        const rank=p.rank(s), next=rank+1, req=requiredLevel(s,next);
        const row=h('article','growth-skill',`<div class="growth-heading"><span class="growth-icon">${s.icon}</span><b>${s.key} · ${s.name}</b><span>${rank} / 5 阶</span></div><ol>${s.rankDescriptions.map((text,i)=>`<li class="${rank>i?'learned':''}">${i+1} 阶 · ${text}<small> 等级 ${requiredLevel(s,i+1)}</small></li>`).join('')}</ol>`);
        row.appendChild(button(rank===5?'已满阶':p.level<req?`需要等级 ${req}`:rank?'强化 · 1 技能点':'学习 · 1 技能点',()=>p.learnSkill(s.id),rank>=5||!p.skillPoints||p.level<req));list.appendChild(row);
      }
      if(this.respecAllowed && g.level.id==='camp')P.appendChild(button(`向罗兰洗点 · ${50+p.level*10} 金币`,()=>{if(p.resetSkills())this.toast('已退还所有已分配技能点');else this._poor();}));
    } else {
      P.querySelector('.growth-summary').textContent+=` · 铁屑 ${p.materials.iron??0} · 魂晶 ${p.materials.soul??0} · 星辉 ${p.materials.star??0}`;
      const all=[...Object.values(p.equip).filter(Boolean).map(it=>({it,equipped:true})),...p.bag.map((it,i)=>({it,i})).filter(x=>x.it)];
      for(const {it,i,equipped} of all){
        const cost=enhanceCost(it), row=h('article','forge-row',`<span class="forge-icon">${this.icon(it)}</span><b style="color:${RARITY[it.rarity].color}">${it.name} ${'★'.repeat(it.stars??0)}${equipped?'（已装备）':''}</b><p>${cost?`${cost.gold} 金币 · `+Object.entries(cost.materials).map(([k,n])=>MATERIALS[k].name+' ×'+n).join('、'):'已达三星上限'}</p>`);
        row.appendChild(button(cost?'强化装备':'已满星',()=>{if(p.enhanceItem(it)){this.toast('强化成功');this.game.audio.play('levelup');}else this.toast('金币或材料不足');},!cost));
        if(!equipped)row.appendChild(button('分解装备',()=>{if(it.rarity!=='legendary'||confirm(`分解传奇「${it.name}」？此操作无法撤销。`))p.salvageItem(i);}));
        row.querySelector('.forge-icon').onmouseenter=()=>this.showTip(it,null,'equipped');row.querySelector('.forge-icon').onmouseleave=()=>this.hideTip();list.appendChild(row);
      }
    }
  }

  touchItem(it,label,action) {
    const T=this.el.tip;this._tipAnchor=null;this._tipEl=null;
    T.innerHTML=`<div class="box r-${it.rarity}">${this._itemHtml(it,'',this.game.player.equip[it.slot]===it?null:this.game.player.equip[it.slot])}<button class="touch-item-action">${label}</button><button class="touch-item-close">关闭详情</button></div>`;
    T.classList.remove('hidden');T.querySelector('.touch-item-action').onclick=()=>{this.hideTip();action();};T.querySelector('.touch-item-close').onclick=()=>this.hideTip();
  }

  // ================================================================== tooltips
  _itemHtml(it, title = '', cmp = null) {
    const R = RARITY[it.rarity], b = BASES[it.base], pl = this.game.player;
    const recommendation=pl.equip[it.slot]===it||title?null:pl.compareGear(it);
    it={...it,...enhancedStats(it)}; if(cmp)cmp={...cmp,...enhancedStats(cmp)};
    const delta = (a, c) => { if (c == null || a === c) return ''; const d = a - c; return `<em class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 10) / 10)}</em>`; };
    const lines = [];
    if (it.dmg) lines.push(`<div class="big">${it.dmg[0]} – ${it.dmg[1]} <small>武器伤害</small>${cmp?.dmg ? delta((it.dmg[0] + it.dmg[1]) / 2, (cmp.dmg[0] + cmp.dmg[1]) / 2) : ''}</div>`);
    if (it.armor) lines.push(`<div class="big">${it.armor} <small>护甲</small>${cmp ? delta(it.armor, cmp.armor ?? 0) : ''}</div>`);
    for (const a of it.affixes) lines.push(`<div class="af">◆ ${affixText(a)}</div>`);
    if (it.power) lines.push(`<div class="pw">${it.power}</div>`);
    if(recommendation)lines.push(this.gearComparisonHtml(recommendation));
    const who = b.cls ? b.cls.map((c) => CLASSES[c].name).join(' / ') : '所有职业';
    return `${title ? `<div class="tt">${title}</div>` : ''}<div class="hd"><div><div class="nm" style="color:${R.color}">${it.name} ${'★'.repeat(it.stars??0)}</div>
      <div class="ty">${it.apex?'✦ 远古圣遗 · ':R.name}${b.name}</div></div><img src="${this.game.gear.icon(it)}"></div>
      <div class="body">${lines.join('')}</div>
      <div class="req ${canEquip(pl.cls, it) ? '' : 'bad'}">${SLOT_NAMES[it.slot]} · 物品等级 ${it.ilvl} · 适用：${who}</div>`;
  }

  showTip(it, compare, mode) {
    const T = this.el.tip;
    const hov = document.querySelectorAll(':hover'); this._tipAnchor = hov[hov.length - 1] ?? null;
    const cmp = compare && compare !== it ? compare : null;
    let html = `<div class="box r-${it.rarity}">${this._itemHtml(it, '', cmp)}`;
    if (mode === 'buy') html += `<div class="act">左键购买 · <b>${it.price}</b> 金币</div>`;
    else if (mode === 'sell') html += `<div class="act">左键出售 · <b>${salePrice(it)}</b> 金币</div>`;
    else if (mode === 'bag') html += `<div class="act">左键装备 · 右键丢弃</div>`;
    else if (mode === 'equipped') html += `<div class="act">左键卸下 · 右键丢弃</div>`;
    else if (mode === 'ground') html += `<div class="act">点击拾取</div>`;
    html += '</div>';
    if (cmp) html += `<div class="box cmp r-${cmp.rarity}">${this._itemHtml(cmp, '当前装备')}</div>`;
    T.innerHTML = html;
    T.classList.remove('hidden');
  }

  hideTip() { this.el.tip.classList.add('hidden'); this._tipAnchor = null; }

  _moveTip(e) {
    const T = this.el.tip;
    if (T.classList.contains('hidden')) return;
    const w = T.offsetWidth, hh = T.offsetHeight;
    let x = e.clientX + 18, y = e.clientY + 12;
    if (x + w > innerWidth - 8) x = e.clientX - w - 18;
    if (y + hh > innerHeight - 8) y = innerHeight - hh - 8;
    T.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** Floating label above an item lying on the ground. */
  groundLabel(it) {
    const d = h('button', 'glabel r-' + it.rarity, `<span class="loot-art">${this.icon(it)}</span><span class="loot-copy"><b>${it.name}</b><small>${SLOT_NAMES[it.slot]} · Lv.${it.ilvl}</small></span>`);d.type='button';d.setAttribute('aria-label','拾取 '+it.name);
    d.style.color = it.apex?'#b8f5ff':RARITY[it.rarity].color;
    if(it.apex)d.classList.add('apex-item');
    d.onmouseenter = () => {if(!this.game.touchMode)this.showTip(it, this.game.player.equip[it.slot], 'ground');};
    d.onmouseleave = () => {if(!this.game.touchMode)this.hideTip();};
    this.el.lootGrid.appendChild(d);
    return d;
  }

  // ================================================================== quest / toasts / story
  setQuest(title, desc) {
    this.el.quest.querySelector('.title').textContent = title;
    this.el.quest.querySelector('.desc').innerHTML = desc;
    this.game.audio.play('quest');
    this.game.save?.();
  }

  toast(text) {
    const d = h('div', null);
    d.textContent = text;
    this.el.toast.appendChild(d);
    setTimeout(() => d.remove(), 3300);
  }

  prompt(text) {
    if (text) { this.el.prompt.textContent = text; this.el.prompt.classList.remove('hidden'); }
    else this.el.prompt.classList.add('hidden');
  }

  banner(big, small = '') {
    const b = this.el.banner;
    b.querySelector('.big').textContent = big; b.querySelector('.small').textContent = small;
    b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.add('hidden'), 4500);
  }

  fade(on) { this.el.fade.classList.toggle('on', on); return new Promise((r) => setTimeout(r, 850)); }

  hurtFlash() { const e = this.el.hurt; e.style.transition = 'none'; e.style.opacity = 1; requestAnimationFrame(() => { e.style.transition = 'opacity .5s'; e.style.opacity = 0; }); }

  /** Full-screen narration. lines: strings; a leading '!' marks an emphasised line. */
  story(lines) {
    return new Promise((resolve) => {
      const s = this.el.story, box = s.querySelector('.lines');
      box.innerHTML = '';
      s.classList.remove('hidden');
      lines.forEach((l, i) => {
        const p = h('p');
        if (l[0] === '!') { p.className = 'em'; l = l.slice(1); }
        p.textContent = l; p.style.animationDelay = i * 1.5 + 's';
        box.appendChild(p);
      });
      const shown = performance.now();
      const done = () => { if (performance.now() - shown < 700) return; s.removeEventListener('click', done); window.removeEventListener('keydown', key); s.classList.add('hidden'); resolve(); };
      const key = (e) => { if (e.code === 'Space' || e.code === 'Enter') done(); };
      s.addEventListener('click', done); window.addEventListener('keydown', key);
    });
  }

  /** Dialogue sequence: [[speaker, text], ...]. Resolves when the last line is dismissed. */
  say(lines) {
    const g = this.game;
    g.cinematic = true;
    g.player.stop();
    this.prompt(null);
    this.closePanels();
    return new Promise((resolve) => {
      let i = -1;
      const d = this.el.dialogue, sp = d.querySelector('.speaker'), tx = d.querySelector('.text');
      d.classList.remove('hidden');
      const next = () => {
        i++;
        if (i >= lines.length) { d.classList.add('hidden'); this.advanceFn = null; g.cinematic = false; g.input.swallow(); resolve(); return; }
        const [who, text] = lines[i];
        d.querySelector('.next').textContent=g.touchMode?`轻触继续  ${i+1} / ${lines.length}  ▸`:'点击 / 空格 继续 ▸';
        sp.textContent = who; sp.style.color = who === '烬语者' ? '#ffb070' : who.includes('莫尔丹') ? '#d08aff' : '';
        tx.textContent = '';
        let n = 0;
        clearInterval(this.typing);
        this.typing = setInterval(() => { n += 2; tx.textContent = text.slice(0, n); if (n % 6 === 0) g.audio.play('ui', null, 0.25); if (n >= text.length) { clearInterval(this.typing); this.typing = null; } }, 28);
        this.advanceFn = () => { if (this.typing) { clearInterval(this.typing); this.typing = null; tx.textContent = text; } else next(); };
      };
      next();
    });
  }

  advance() { this.advanceFn?.(); }
  get inDialogue() { return !!this.advanceFn; }

  /** Floating combat text. */
  number(pos, text, cls = '') {
    const el = h('div', 'dn ' + cls);
    el.textContent = text;
    this.el.dmg.appendChild(el);
    this.numbers.push({ el, p: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.8, (pos.y ?? 0) + 2.6, pos.z + (Math.random() - 0.5) * 0.8), t: 0, vx: (Math.random() - 0.5) * 30 });
    if (this.numbers.length > 50) this.numbers.shift().el.remove();
  }

  setTarget(e) { this.target = e; this.targetT = 4; }

  update(dt) {
    const g = this.game, pl = g.player, el = this.el;
    // a tooltip whose element vanished (item picked up, panel rebuilt) must not linger
    if (this._tipAnchor && (!this._tipAnchor.isConnected || this._tipAnchor.offsetParent === null) && !el.tip.classList.contains('hidden')) this.hideTip();
    el.hp.style.height = (pl.hp / pl.maxHp) * 100 + '%';
    el.mp.style.height = (pl.mp / pl.maxMp) * 100 + '%';
    const hpTxt = Math.ceil(pl.hp) + ' / ' + pl.maxHp;
    const shTxt = pl.shield > 0 ? Math.round(pl.shield) : 0;
    if (this._hpTxt !== hpTxt + shTxt) { this._hpTxt = hpTxt + shTxt; el.hpt.innerHTML = `<span>${hpTxt}</span>${shTxt ? `<small>护盾 ${shTxt}</small>` : ''}`; }
    el.shield.style.opacity = pl.shield > 0 ? Math.min(1, 0.35 + pl.shield / pl.maxHp) : 0;
    el.mpt.innerHTML = `<span>${Math.floor(pl.mp)} / ${pl.maxMp}</span>`;
    el.xp.style.width = pl.xpProgress() * 100 + '%';
    el.lvl.textContent = '等级 ' + pl.level;
    el.plvl.textContent = pl.level;
    if (this._gold !== pl.gold) { if (this._gold != null && pl.gold > this._gold) { el.gold.classList.remove('bump'); void el.gold.offsetWidth; el.gold.classList.add('bump'); } this._gold = pl.gold; el.gold.textContent = pl.gold; }
    this.updateSkillProgress();
    for (const id in this.skillEls) {
      const e = this.skillEls[id];
      if (e.s) {
        const cd = pl.cds[id] ?? 0, full = pl.skillCooldown(e.s);
        const on = cd > 0 && e.s.cd > 0.6;
        e.cd.style.setProperty('--p', on ? Math.min(1, cd / full) : 0);
        e.cdn.textContent = on ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
        e.root.classList.toggle('nomana', pl.mp < e.s.cost);
        const un = pl.unlocked(e.s);
        if (e.root.classList.contains('locked') === un) e.root.classList.toggle('locked', !un);
      } else { e.cnt.textContent = pl.potions[id];e.cdn.textContent=pl.potionCd>0?Math.ceil(pl.potionCd):''; e.root.classList.toggle('empty', pl.potions[id] <= 0);e.root.classList.toggle('cooling',pl.potionCd>0); }
    }
    const boss = g.enemies.find((e) => e.T.boss && e.alive && !e.asleep)??g.enemies.find(e=>e.type==='butcher'&&e.alive&&e.pos.distanceTo(pl.pos)<24);
    let t = boss ?? this.target;
    if (!boss) { this.targetT -= dt; if (!t || !t.alive || this.targetT <= 0) t = this.target = null; }
    document.body.classList.toggle('boss-fight',!!t?.T.boss);
    const ailments=[pl.chillUntil>g.time?`寒蚀 ${pl.chillStacks}`:'',pl.plagueStacks?`疫蚀 ${pl.plagueStacks}`:'',pl.woundUntil>g.time?`重创 ${Math.ceil(pl.woundUntil-g.time)}秒`:'',pl.saltExposureUntil>g.time?`盐蚀 ${pl.saltExposure}`:'',pl.drenchedUntil>g.time?`浸潮 ${pl.drenched} · 回复 -${12*pl.drenched}%`:''].filter(Boolean);
    this.el.ailment.textContent=ailments.length?`${ailments.join(' · ')} · 治疗 −${Math.round((1-recoveryFactor(pl))*100)}%`:'';this.el.ailment.hidden=!ailments.length;
    if (t) {
      this.el.bossDetails.hidden=!(t.T.boss||t.type==='butcher');
      this.el.bossDetails.querySelector('.boss-phase').textContent=['stag','ironking','saltqueen','angler','winterabbess'].includes(t.type)?`第 ${t.phase??1} 阶段 · ${Math.ceil(t.hp/t.maxHp*100)}%`:t.type==='frostgiant'?'精英 · 霜足震地':t.type==='hookcaptain'?'精英 · 沉钩锁链':t.type==='saltpriest'?'精英 · 封尸仪式':t.type==='blackknight'?'精英 · 黑铁盾势':t.type==='butcher'?'精英 · 缝合躯体':'守钟者';
      this.el.bossDetails.querySelector('.boss-intent').textContent=t.intent??(t.type==='boss'?'亡灵 · 弱圣光 / 抗暗影':t.type==='butcher'?'厚皮 · 物理与毒素抗性':'');
      const poise=this.el.bossDetails.querySelector('.poise-track');poise.hidden=!['stag','blackknight','ironking','saltpriest','saltqueen','winterabbess'].includes(t.type);poise.querySelector('i').style.width=((t.stag?.poise??t.iron?.poise??t.salt?.poise??t.winter?.poise??0)*100)+'%';
      el.target.classList.remove('hidden');
      el.target.classList.toggle('boss', !!t.T.boss||t.type==='butcher');
      el.target.classList.toggle('elite',t.type==='butcher');
      el.target.querySelector('.name').textContent = t.name;
      el.target.querySelector('i').style.width = Math.max(0, (t.hp / t.maxHp) * 100) + '%';
    } else el.target.classList.add('hidden');
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.t += dt;
      if (n.t > 0.9) { n.el.remove(); this.numbers.splice(i, 1); continue; }
      const s = g.gfx.project(n.p, _o);
      const k = n.t / 0.9;
      n.el.style.transform = `translate(${s.x + n.vx * k}px, ${s.y - 60 * (1 - (1 - k) ** 2)}px) translate(-50%,-50%) scale(${k < 0.12 ? 0.6 + k * 5 : 1.2 - k * 0.3})`;
      n.el.style.opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    }
    this.updateGearOffer(dt);
    this.minimap.update(dt);
    const portal=[...g.level.portals?.values()??[]].filter(p=>p.root.position.distanceTo(pl.pos)<11).sort((a,b)=>a.root.position.distanceToSquared(pl.pos)-b.root.position.distanceToSquared(pl.pos))[0];
    const caption=this.el.portalCaption;caption.hidden=!portal||g.cinematic||this.panelOpen;
    if(portal&&!caption.hidden){const s=g.gfx.project(_p.copy(portal.root.position).setY(5.3),_o);caption.hidden=!s.visible;caption.textContent=TRANSITIONS[portal.trigger.id]+(portal.active?' · 穿门前往':' · 尚未开启');caption.style.transform=`translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;}

    this._lootAt=(this._lootAt??0)-dt;
    if(this._lootAt<=0){
      this._lootAt=.15;const items=g.loot.filter(l=>l.label&&l.pos.distanceTo(pl.pos)<22).sort((a,b)=>['legendary','rare','magic','common'].indexOf(a.item.rarity)-['legendary','rare','magic','common'].indexOf(b.item.rarity)||a.pos.distanceToSquared(pl.pos)-b.pos.distanceToSquared(pl.pos));
      const limit=g.touchMode?3:6,shown=new Set((this.lootExpanded?items:items.slice(0,limit)).map(l=>l.label));
      for(const l of g.loot)if(l.label)l.label.hidden=!shown.has(l.label);
      items.filter(l=>shown.has(l.label)).forEach((l,i)=>{const at=this.el.lootGrid.children[i];if(at!==l.label)this.el.lootGrid.insertBefore(l.label,at??null);});
      this.el.lootTray.hidden=!items.length||g.cinematic||this.panelOpen||!pl.alive;
      this.el.lootTray.querySelector('header span').textContent=items.length;
      const toggle=this.el.lootTray.querySelector('header button');toggle.hidden=items.length<=limit;toggle.textContent=this.lootExpanded?'收起':`查看全部 +${Math.max(0,items.length-limit)}`;toggle.setAttribute('aria-expanded',!!this.lootExpanded);
    }
  }
}
const _o = {}, _p = new THREE.Vector3();
