export const MAX_LEVEL = 30;
// First episode ends around level six; later levels remain spaced for future episodes.
export const XP_TABLE = [0, 70, 190, 390, 700, 1150, 1800, 2700, 3900, 5500, ...Array.from({length:20}, (_,i)=>9000 + i*3000 + i*i*350)];
export const MATERIALS = {
  frost:{name:'寒誓霜晶',price:28,desc:'第六集特产 · 可出售'},
  barnacle:{name:'沉潮藤壶',price:24,desc:'第五集特产 · 可出售'},
  salt:{name:'灰盐晶砂',price:22,desc:'第四集特产 · 可出售'},
  insignia:{name:'铁冠徽片',price:18,desc:'第三集特产 · 可出售'},
  iron: {name:'铁屑',price:3}, soul:{name:'魂晶',price:15}, star:{name:'星辉碎片',price:60},
  bone:{name:'墓土骨粉',price:6}, venom:{name:'腐沼毒囊',price:12},
};
export const earnedPoints = level => Math.max(0, Math.min(30, level)-1) + Math.floor(Math.min(30,level)/10);
export const UPGRADE_SLOTS = [2,3,4,6];
export const HOTBAR_ORDER = [0,1,2,3,4,6,5];
export const canUpgradeSlot = slot => UPGRADE_SLOTS.includes(slot);
export const freeRank = slot => canUpgradeSlot(slot)?0:1;
export const requiredLevel = (skill,rank) => skill.unlock + 3*(rank-1);
export function spentPoints(skills,ranks) { return skills.filter(s=>canUpgradeSlot(s.slot)).reduce((n,s)=>n+Math.max(0,(ranks[s.id]??freeRank(s.slot))-freeRank(s.slot)),0); }
export function enhanceCost(item) {
  const star=item.stars??0, level=item.ilvl;
  return [{gold:40+level*8,materials:{iron:4}}, {gold:100+level*16,materials:{iron:8,soul:2}}, {gold:250+level*30,materials:{soul:5,star:1}}][star]??null;
}
export const salePrice = item => Math.max(1, Math.round(item.price*0.3*(1+0.25*(item.stars??0))));
export function enhancedStats(item) {
  const n=item.stars??0;
  return {dmg:item.dmg?.map(v=>Math.round(v*(1+0.15*n))),armor:item.armor?Math.round(item.armor*(1+0.15*n)):0,
    affixes:item.affixes.map(a=>({...a,v:Math.round(a.v*(1+0.1*n)*10)/10}))};
}
export function enhance(item,wallet) {
  const c=enhanceCost(item);
  if(!c || wallet.gold<c.gold || Object.entries(c.materials).some(([k,v])=>(wallet.materials[k]??0)<v)) return false;
  wallet.gold-=c.gold;
  for(const [k,v] of Object.entries(c.materials)) wallet.materials[k]-=v;
  item.stars=(item.stars??0)+1; return true;
}
export function salvageMaterials(item) {
  return {common:{iron:2},magic:{iron:4},rare:{soul:2},legendary:{star:1}}[item.rarity];
}
