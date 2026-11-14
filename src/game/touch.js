import * as THREE from 'three';

export const stickDirection=(x,y)=>{const length=Math.hypot(x,y),strength=Math.min(1,length);return length<0.12?null:{x:(x+y)/Math.SQRT2/length,z:(y-x)/Math.SQRT2/length,strength};};

/** Touch input shares player movement, casting and the existing interaction queue. */
export class TouchControls {
  constructor(game) {
    this.g=game;this.stick=null;this.target=null;this.attack=false;this.secondary=false;
    const el=this.el=document.createElement('div');el.id='touch-controls';el.hidden=true;
    el.innerHTML=`<div id="move-stick" role="group" aria-label="移动摇杆"><i></i><span>移动</span></div>
      <button class="touch-action touch-attack" aria-label="普通攻击">攻击</button><button class="touch-action touch-secondary" aria-label="基础技能">副攻</button><button class="touch-action touch-dodge" aria-label="位移技能">闪避</button>
      <button class="touch-interact" aria-label="附近交互"><svg viewBox="0 0 32 32"><path d="M10 18V8a2 2 0 0 1 4 0v8-11a2 2 0 0 1 4 0v11-8a2 2 0 0 1 4 0v10-5a2 2 0 0 1 4 0v8c0 6-4 9-9 9-4 0-6-2-8-5l-4-6c-2-3 1-5 3-3l4 4"/></svg><span class="interact-caption">交互</span></button><div class="touch-potions"><button aria-label="使用生命药水"><svg viewBox="0 0 32 32"><path d="M12 3h8v7l6 10c5 10-25 10-20 0l6-10z"/><path d="M11 20h10M16 15v10"/></svg><b></b></button><button aria-label="使用资源药水"><svg viewBox="0 0 32 32"><path d="M12 3h8v7l6 10c5 10-25 10-20 0l6-10z"/><path d="m18 14-5 7h5l-3 6"/></svg><b></b></button></div><div class="touch-lock"></div>`;
    document.body.appendChild(el);
    const rotate=document.createElement('section');rotate.id='rotate-device';rotate.setAttribute('aria-label','请横屏游玩');rotate.setAttribute('role','dialog');rotate.setAttribute('aria-modal','true');
    rotate.innerHTML='<div class="rotate-phone" aria-hidden="true">↻</div><h2>横屏，踏入余烬</h2><p>请将手机横过来游玩</p><small>旋转期间战斗自动暂停</small><button>进入全屏</button>';
    document.body.appendChild(rotate);
    const full=rotate.querySelector('button');full.hidden=!document.documentElement.requestFullscreen;
    full.onclick=async()=>{try{await document.documentElement.requestFullscreen();await screen.orientation?.lock?.('landscape');}catch{}rotate.querySelector('p').textContent='如未自动旋转，请手动横置手机';};

    const joy=el.querySelector('#move-stick'),thumb=joy.querySelector('i');let pointer=null;
    const release=()=>{pointer=null;this.stick=null;thumb.style.transform='translate(-50%,-50%)';};
    this.releaseStick=release;
    const move=e=>{if(e.pointerId!==pointer)return;const r=joy.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.34),y=(e.clientY-r.top-r.height/2)/(r.height*.34),l=Math.max(1,Math.hypot(x,y));this.stick=stickDirection(x/l,y/l);thumb.style.transform=`translate(calc(-50% + ${x/l*32}px),calc(-50% + ${y/l*32}px))`;};
    joy.addEventListener('pointerdown',e=>{e.preventDefault();pointer=e.pointerId;joy.setPointerCapture(pointer);move(e);});
    joy.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(type,release);
    const held=(selector,key,slot)=>{const b=el.querySelector(selector);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this[key]=true;this.cast(slot);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>this[key]=false);};
    held('.touch-attack','attack',0);held('.touch-secondary','secondary',1);
    el.querySelector('.touch-dodge').onclick=()=>this.cast(5);
    el.querySelector('.touch-interact').onclick=()=>this.interact();
    this.potions=[...el.querySelectorAll('.touch-potions button')];this.potions.forEach((b,i)=>b.onclick=()=>{if(this.active())game.player.usePotion(i?'mp':'hp');});
    // Suppress compatibility mouse events: a tap must never become a held desktop attack.
    let tap=null;
    game.canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&!game.touchMode)return;e.preventDefault();tap={id:e.pointerId,x:e.clientX,y:e.clientY};game.canvas.setPointerCapture(e.pointerId);});
    game.canvas.addEventListener('pointerup',e=>{if(!tap||e.pointerId!==tap.id)return;e.preventDefault();if(Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<16)this.tap(e.clientX,e.clientY);tap=null;});
    game.canvas.addEventListener('pointercancel',()=>tap=null);
    window.addEventListener('blur',()=>{release();this.attack=this.secondary=false;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){release();this.attack=this.secondary=false;game.save(true);}});
    this.minimap=document.createElement('canvas');this.minimap.id='touch-minimap';this.minimap.width=200;this.minimap.height=156;this.minimap.setAttribute('aria-label','区域地图与当前位置');game.ui.el.hud.appendChild(this.minimap);
    this.vitals=document.createElement('div');this.vitals.className='touch-vitals';this.vitals.innerHTML='<div class="touch-hp"><i></i><b></b></div><div class="touch-mp"><i></i><b></b></div>';game.ui.el.hud.appendChild(this.vitals);
  }
  skin(){
    const p=this.g.player;
    for(const [selector,slot,label]of [['.touch-attack',0,'普攻'],['.touch-secondary',1,p.skills[1].name],['.touch-dodge',5,p.skills[5].name]]){
      const b=this.el.querySelector(selector);b.innerHTML=`<span class="action-art">${p.skills[slot].icon}</span><span class="action-cooldown"></span><small class="action-label">${label}</small>`;
    }
  }
  drawMap(){
    const g=this.g,lv=g.level,ctx=this.minimap.getContext('2d'),s=Math.min(184/lv.w,140/lv.h),ox=(200-lv.w*s)/2,oz=(156-lv.h*s)/2;
    ctx.clearRect(0,0,200,156);ctx.fillStyle='#091715e8';ctx.fillRect(0,0,200,156);ctx.fillStyle='#34514b';
    for(let z=0;z<lv.h;z++)for(let x=0;x<lv.w;x++)if(lv.isFloor(x,z))ctx.fillRect(ox+x*s,oz+z*s,s+.2,s+.2);
    const dot=(p,color,r)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(ox+p.x/4*s,oz+p.z/4*s,r,0,Math.PI*2);ctx.fill();};
    const t=g.story.guidance();if(t)dot(t,'#e0bd73',3);
    for(const e of g.enemies)if(e.alive&&e.pos.distanceTo(g.player.pos)<22)dot(e.pos,'#e77c68',e.T.boss?3.5:1.8);
    dot(g.player.pos,'#b7fff0',3.3);ctx.strokeStyle='#b29459';ctx.lineWidth=2;ctx.strokeRect(1,1,198,154);
  }
  reset(){this.releaseStick?.();this.stick=null;this.attack=this.secondary=false;if(this.g.player)this.g.player.manualMove=null;this.el.hidden=true;this.el.querySelector('#move-stick i').style.transform='translate(-50%,-50%)';}
  active(){const g=this.g;return innerWidth>innerHeight&&g.started&&g.player?.alive&&!g.cinematic&&!g.paused&&!g.ui.panelOpen;}
  enemy() {
    const g=this.g,p=g.player,valid=e=>e.alive&&e.pos.distanceTo(p.pos)<28&&g.level.clear(p.pos.x,p.pos.z,e.pos.x,e.pos.z,.1);
    if(this.target&&valid(this.target))return this.target;
    this.target=g.enemies.filter(valid).sort((a,b)=>a.pos.distanceToSquared(p.pos)-b.pos.distanceToSquared(p.pos))[0]??null;
    return this.target;
  }
  aim(slot) {
    const p=this.g.player,e=slot===5?null:this.enemy();
    if(e)return {point:e.pos.clone().setY(0),enemy:e};
    const d=this.stick??{x:Math.sin(p.facing),z:Math.cos(p.facing)};
    return {point:p.pos.clone().add(new THREE.Vector3(d.x*10,0,d.z*10)),enemy:null};
  }
  cast(slot) {
    if(!this.active())return;
    const {point,enemy}=this.aim(slot);this.g.player.castSlot(slot,point,enemy);
    if(enemy)this.g.ui.setTarget(enemy);
  }
  tap(x,y) {
    const g=this.g;if(!this.active())return;
    g.input.px={x,y};g.input.mouse.set(x/innerWidth*2-1,-y/innerHeight*2+1);g.input.update();
    const hit=g._pickHover();
    if(hit?.kind){g.player.interactTarget=hit;g.player.queued=null;g.player.moveTo(hit.pos.x,hit.pos.z);}
    else if(hit){this.target=hit;this.cast(0);}
    else {g.player.interactTarget=null;g.player.queued=null;g.player.moveTo(g.input.ground.x,g.input.ground.z);}
  }
  nearby() {
    const g=this.g;return [...g.npcs,...g.chests.filter(c=>!c.open),...g.loot.filter(l=>l.kind==='item')].filter(o=>o.pos&&o.pos.distanceTo(g.player.pos)<12).sort((a,b)=>a.pos.distanceToSquared(g.player.pos)-b.pos.distanceToSquared(g.player.pos))[0];
  }
  interact() {
    if(!this.active())return;const o=this.nearby();if(!o)return this.g.ui.toast('靠近人物、宝箱或装备后点击交互');
    this.g.player.interactTarget=o;this.g.player.queued=null;this.g.player.moveTo(o.pos.x,o.pos.z);
  }
  update() {
    const g=this.g,p=g.player,active=this.active();this.el.hidden=!active;
    p.manualMove=active?this.stick:null;
    const bars=this.vitals.children;for(const [i,value,max]of [[0,p.hp,p.maxHp],[1,p.mp,p.maxMp]]){bars[i].querySelector('i').style.width=Math.max(0,value/max*100)+'%';bars[i].querySelector('b').textContent=`${Math.ceil(value)} / ${max}`;}
    if(!active){this.attack=this.secondary=false;this.stick=null;this.el.querySelector('#move-stick i').style.transform='translate(-50%,-50%)';return;}
    if(this.stick){p.stop();p.queued=null;p.interactTarget=null;}
    if(this.attack)this.cast(0);if(this.secondary)this.cast(1);
    for(const [selector,slot]of [['.touch-attack',0],['.touch-secondary',1],['.touch-dodge',5]]){const b=this.el.querySelector(selector),s=p.skills[slot],cd=p.cds[s.id]??0;b.querySelector('.action-cooldown').textContent=cd>.5?Math.ceil(cd):'';b.classList.toggle('cooling',cd>.5);}
    if(g.time>(this.mapAt??-1)){this.mapAt=g.time+.35;this.drawMap();}
    const o=this.nearby();const interact=this.el.querySelector('.touch-interact');interact.querySelector('.interact-caption').textContent=o?(o.kind==='npc'?'交谈':o.kind==='chest'?'开启':'拾取'):'交互';interact.setAttribute('aria-label',o?(o.kind==='npc'?'交谈 · ':o.kind==='chest'?'开启 · ':'拾取 · ')+o.name:'附近交互');interact.classList.toggle('nearby',!!o);
    this.potions[0].querySelector('b').textContent=p.potions.hp;this.potions[1].querySelector('b').textContent=p.potions.mp;
    this.el.querySelector('.touch-lock').textContent=this.target?.alive?'锁定：'+this.target.name:'自动锁敌';
  }
}
