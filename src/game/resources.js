import { PROFILES } from './models.js';
import { CLASSES } from './classes.js';
import { ENEMY_TYPES } from './enemy.js';
import { PROP_MAP } from './level.js';

// Gear uses these four shared texture sets in every chapter, including the hero showcase.
export const SHARED_MATERIALS = ['wood','headstone','leaves','slate'];
export const MENU_RESOURCES = {models:['mx:anims',...Object.values(CLASSES).map(c=>'mx:'+PROFILES[c.profile].file)],materials:[...SHARED_MATERIALS,'stoneFloor']};
const SCANS = {
  '@tree':['tree_stump_01'], '@campfire':['stone_fire_pit','wooden_stool_01','dead_tree_trunk'], '@cryptdoor':['large_castle_door'],
};
export function levelResources(spec,cls) {
  const models=new Set(['mx:anims','mx:'+PROFILES[CLASSES[cls].profile].file,'coin_stack_small']);
  for(const p of [...spec.def.spawns.map(s=>ENEMY_TYPES[s.type].model),...spec.def.npcs.map(n=>n.model)].filter(Boolean))models.add('mx:'+PROFILES[p].file);
  for(const s of spec.def.spawns){for(const profile of ({boss:['minion','warrior'],stag:['minion'],ironking:['rebel'],saltqueen:['warrior','mage'],saltpriest:['mage']})[s.type]??[])models.add('mx:'+PROFILES[profile].file);}
  if(cls==='necro')models.add('mx:'+PROFILES.skeleton.file);
  if(spec.def.spawns.some(s=>ENEMY_TYPES[s.type].proj==='arrow'))models.add('Skeleton_Arrow');
  const materials=new Set([...SHARED_MATERIALS,'stoneFloor',...(spec.episode===4?['saltWall','saltStone']:['wall','cryptWall','rockTop'])]);
  for(const row of spec.def.g)for(const ch of row) {
    const name=spec.episode===4?(ch===','?'saltSand':ch==='#'?null:'saltStone'):({',':'dirt',';':spec.id==='forest'?'forestFloor':'leaves',':':'altarFloor','~':'mossy'})[ch];
    if(name)materials.add(name);
  }
  for(const p of spec.def.props){
    if(PROP_MAP[p.prop])for(const v of [].concat(PROP_MAP[p.prop])){if(!v.m.startsWith('@'))models.add('ph:'+v.m);}
    if(!PROP_MAP[p.prop]&&!p.prop.startsWith('@'))models.add(p.prop);
    for(const n of SCANS[p.prop]??[])models.add('ph:'+n);
    const procedural=p.prop.startsWith('@')?[p.prop]:[].concat(PROP_MAP[p.prop]??[]).map(v=>v.m).filter(v=>v.startsWith('@'));
    for(const kind of procedural){
      const names=({'@grave':['headstone','mossy','dirt'],'@tree':['bark'],'@campfire':['bark'],'@cryptdoor':['cryptWall'],'@bell':['slate'],'@column':['mossy'],'@pillar':[spec.floor==='dirt'?'wall':'cryptWall'],'@pillar2':[spec.floor==='dirt'?'wall':'cryptWall']})[kind]??[];
      for(const name of names)materials.add(name);
      if(['@wagon','@ruin','@ritual','@butchery','@roots','@sign'].includes(kind))for(const name of ['wood','bark','mossy'])materials.add(name);
      if(['@house','@church','@mill','@well'].includes(kind))materials.add('wall');
    }
  }
  if(spec.def.chests.length)models.add('ph:treasure_chest');
  if(spec.def.torches.length)models.add('torch_mounted');
  if(spec.def.gates.some(t=>!['plague_fog','roots'].includes(t.id)))models.add('ph:large_iron_gate');
  if(spec.def.gates.some(t=>t.id==='roots'))materials.add('bark');
  return {models:[...models],materials:[...materials]};
}
