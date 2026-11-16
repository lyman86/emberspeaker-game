import { XP_TABLE, freeRank, earnedPoints, requiredLevel, canUpgradeSlot } from './progression.js';
import { makeItem, BASES } from './items.js';

export const CHAPTERS = [
 {id:1,title:'午夜钟声',subtitle:'墓园与缄默墓穴',start:'camp',bossMap:'crypt',boss:'boss',bossName:'缄默守墓人 · 莫尔丹',level:1,bossLevel:6,point:[16,8],color:'#8b91ba',feature:'唤醒亡者 · 夺取钥舌'},
 {id:2,title:'腐林疫歌',subtitle:'黑泽村与腐沼祭坛',start:'forest',bossMap:'swamp',boss:'stag',bossName:'荆冠鹿王',level:6,bossLevel:10,point:[17,11],color:'#83a371',feature:'断疫歌图腾 · 穿越毒沼'},
 {id:3,title:'铁冠叛旗',subtitle:'石脊关与铁冠要塞',start:'pass',bossMap:'fortress',boss:'ironking',bossName:'叛王 · 赫拉克留斯',level:10,bossLevel:13,point:[21,13],color:'#be7971',feature:'侧翼破军阵 · 控制破盾'},
 {id:4,title:'盐沙古墓',subtitle:'灰盐荒原与沙埋神殿',start:'saltflat',bossMap:'salttomb',boss:'saltqueen',bossName:'盐之女王 · 瑟芮娅',level:13,bossLevel:16,point:[21,13],color:'#e1c99b',feature:'盐晶导流 · 沙暴中的安全区'},
 {id:5,title:'沉钩之港',subtitle:'雾岛港口与沉船墓场',start:'harbor',bossMap:'wreck',boss:'angler',bossName:'深渊铃鱼 · 奥尔古',level:16,bossLevel:18,point:[21,13],color:'#83bac2',feature:'断钟链 · 破灯囊 · 位移穿潮'},
];
export const MODES = [
 {id:'story',name:'故事模式',en:'THE SEVEN BELLS',desc:'跟随钟声继续旅程，保留英雄的装备与成长。'},
 {id:'chapter',name:'关卡挑战',en:'CHAPTER EXPEDITION',desc:'自由选择一集，以对应等级和装备重新挑战完整流程。'},
 {id:'boss',name:'Boss 挑战',en:'KEEPER TRIAL',desc:'直接迎战守关者，练习走位、破招与职业搭配。'},
];
export function runSaveKey(cls,qa=false){return (qa?'emberspeaker.qa.':'emberspeaker.save.')+cls;}
export function challengeSetup(mode,chapter) {
 const c=CHAPTERS.find(c=>c.id===chapter)??CHAPTERS[0], boss=mode==='boss';
 const flags={};
 if(c.id>1)Object.assign(flags,{bossDead:true,key:true,counter1:true,tongues:Math.min(3,c.id-1),ep2:{totems:[]}});
 if(c.id>2)flags.ep2={started:true,done:true,bossDead:true,butcher:true,totems:['totem_0','totem_1','totem_2']};
 if(c.id>3)flags.ep3={done:true,bossDead:true,knight:true,orders:true,standards:[]};
 if(c.id>4)flags.ep4={done:true,blueprint:true,bossDead:true,priest:true,mirrors:['west','east'],seals:[]};
 if(boss){
  if(c.id===1)Object.assign(flags,{key:true});
  if(c.id===2)flags.ep2={started:true,messenger:true,hunter:true,butcher:true,totems:['totem_0','totem_1','totem_2']};
  if(c.id===3)flags.ep3={started:true,knight:true,orders:true,standards:[]};
  if(c.id===5)flags.ep5={started:true,captain:true,beacons:['beacon_west','beacon_east'],chains:['chain_west','chain_east']};
  if(c.id===4)flags.ep4={started:true,priest:true,mirrors:['west','east'],seals:[]};
 }
 return {mode,chapter:c.id,level:boss?c.bossLevel:c.level,map:boss?c.bossMap:c.start,stage:c.id===1?(boss?'crypt':'talk_roland'):'done',flags,point:boss?c.point:null};
}
export function prepareChallengePlayer(p,setup){
 p.level=setup.level;p.xp=XP_TABLE[p.level-1];p.gold=setup.chapter*180;p.potions={hp:bossPotions(setup),mp:bossPotions(setup)};
 p.equip={};
 const torso={mage:'robe',necro:'robe',ranger:'leather'}[p.cls]??'chest';
 for(const base of [...p.C.start,torso,'helm','gloves','boots','amulet','ring']){
  const it=makeItem(base,{ilvl:Math.max(1,p.level-1),rarity:setup.mode==='boss'?'rare':setup.chapter===1?'common':'magic'});p.equip[BASES[base].slot]=it;
 }
 p.skillRanks=Object.fromEntries(p.skills.map(s=>[s.id,freeRank(s.slot)]));
 let points=earnedPoints(p.level);
 // Teach each available active skill once; spare points remain visible above Q/W/E/R.
 for(const s of p.skills)if(canUpgradeSlot(s.slot)&&points&&p.level>=requiredLevel(s,1)){p.skillRanks[s.id]=1;points--;}
 p.recalc();p.refreshGear();p.hp=p.maxHp;p.mp=p.maxMp;
}
function bossPotions(s){return s.mode==='boss'?6:s.chapter===1?3:8;}
