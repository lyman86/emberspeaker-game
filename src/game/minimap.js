import {TRANSITIONS,portalAvailable} from './portals.js';
/** One map renderer serves desktop and touch; routes and quest arrows are intentionally absent. */
export class Minimap{
 constructor(game,hud){this.g=game;this.el=document.createElement('section');this.el.id='region-map';this.el.innerHTML='<div class="map-caption"></div><canvas width="240" height="180" aria-label="区域地图、出口与当前位置"></canvas><div class="map-legend"><span>◆ 出口</span><span>● 当前位置</span></div>';hud.appendChild(this.el);this.canvas=this.el.querySelector('canvas');this.at=0;}
 update(dt){
  this.at-=dt;if(this.at>0)return;this.at=.25;
  const g=this.g,lv=g.level;if(!lv)return;
  const ctx=this.canvas.getContext('2d'),s=Math.min(222/lv.w,162/lv.h),ox=(240-lv.w*s)/2,oz=(180-lv.h*s)/2;
  this.el.querySelector('.map-caption').textContent=lv.spec.name.split(' · ')[0];
  ctx.clearRect(0,0,240,180);ctx.fillStyle='#0a1518ec';ctx.fillRect(0,0,240,180);ctx.fillStyle='#455451';
  for(let z=0;z<lv.h;z++)for(let x=0;x<lv.w;x++)if(lv.isFloor(x,z))ctx.fillRect(ox+x*s,oz+z*s,s+.15,s+.15);
  const point=p=>[ox+p.x/4*s,oz+p.z/4*s],dot=(p,color,r)=>{const [x,z]=point(p);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,r,0,Math.PI*2);ctx.fill();};
  for(const gate of Object.values(lv.gates??{}))if(!gate.open){ctx.fillStyle='#a37553';ctx.fillRect(ox+gate.x*s,oz+gate.z*s,s,s);}
  for(const t of lv.def.triggers)if(TRANSITIONS[t.id]){const x=ox+(t.x+.5)*s,z=oz+(t.z+.5)*s;ctx.fillStyle=portalAvailable(g,t.id)?'#8de1d1':'#76756d';ctx.beginPath();ctx.moveTo(x,z-3.5);ctx.lineTo(x+3.5,z);ctx.lineTo(x,z+3.5);ctx.lineTo(x-3.5,z);ctx.closePath();ctx.fill();}
  for(const n of g.npcs??[])dot(n.pos,'#e2bc70',2);
  for(const e of g.enemies??[])if(e.alive&&e.pos.distanceTo(g.player.pos)<24)dot(e.pos,e.T.boss?'#e9a77d':'#bf6e62',e.T.boss?3:1.6);
  const [x,z]=point(g.player.pos);ctx.save();ctx.translate(x,z);ctx.rotate(-g.player.facing);ctx.fillStyle='#d3fff0';ctx.beginPath();ctx.moveTo(0,5);ctx.lineTo(-3,-3);ctx.lineTo(3,-3);ctx.closePath();ctx.fill();ctx.restore();
 }
}
