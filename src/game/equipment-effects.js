/** Bounded late-game bonuses share the existing combat pipeline; echoes cannot trigger further procs. */
export function equipmentDamage(g,e,amount){const s=g.player.stats??{},exposed=Math.max(e.stag?.exposed??0,e.iron?.exposed??0,e.salt?.exposed??0,e.harbor?.exposed??0,e.winter?.exposed??0)>0;return Math.round(amount*(1+(e.T.tough||e.T.boss?Math.min(20,s.eliteDmg??0):0)/100)*(1+(exposed?Math.min(20,s.exposedDmg??0):0)/100)*((e.apexMarkedUntil??0)>g.time?1.1:1));}
export function equipmentOnHit(g,e,amount,opts){
 const p=g.player,flag='apex'+p.cls;if(opts.quiet||opts.ally||!e.alive||!p.has(flag)||(p._apexAt??0)>g.time)return;
 p._apexAt=g.time+8;const extra=Math.max(1,Math.round(Math.min(amount*.18,e.maxHp*.015))),pal={warrior:'steel',ranger:'arrow',mage:'fire',paladin:'holy',necro:'bone'}[p.cls];
 e.takeDamage(extra,{from:p.pos,quiet:true});g.fx.spark(e.pos,pal,12);g.ui.number(e.pos,extra+' 余响','crit');
 if(p.cls==='warrior'){if(p.shield<p.maxHp*.06){p._apexShield=p.maxHp*.06-p.shield;p.shield=p.maxHp*.06;p._apexShieldUntil=g.time+6;p.showShield?.(true);}}
 if(p.cls==='ranger')e.apexMarkedUntil=g.time+3;
 if(p.cls==='mage'||p.cls==='necro')p.gainRes(8);
 if(p.cls==='paladin')p.heal(p.maxHp*.03);
}
