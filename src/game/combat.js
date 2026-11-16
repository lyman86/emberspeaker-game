/** Readable, avoidable boss attacks remain relevant as gear improves. Armour and
 * overlevelling still help; ordinary monsters retain their authored damage. */
export function incomingDamage(damage,p,attack){
 if(!attack?.kind)return damage*(1-p.dr);
 const {fraction,armour}={heavy:{fraction:.35,armour:.65},hazard:{fraction:.085,armour:.8},projectile:{fraction:.085,armour:1}}[attack.kind];
 const level=Math.max(.35,Math.min(1,((attack.level??p.level)+3)/(p.level+3)));
 const erosion=attack.erosion&&p.saltExposureUntil>p.game.time?1+.18*(p.saltExposure??0):1;
 return Math.max(damage,p.maxHp*fraction*level*(attack.scale??1))*(1-p.dr*armour)*erosion;
}
export const bossAttack=(e,kind='heavy')=>e.T.boss?{kind,level:e.level}:undefined;
export const damageGrowth=raw=>raw<=8?raw:8+6*Math.log1p((raw-8)/6);
export const POTION_COOLDOWN=10;

export const recoveryFactor=p=>Math.min(p.plagueUntil>p.game.time?1-.12*(p.plagueStacks??0):1,p.woundUntil>p.game.time?.65:1,p.saltExposureUntil>p.game.time?1-.18*(p.saltExposure??0):1);
