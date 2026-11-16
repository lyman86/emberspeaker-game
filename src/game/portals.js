import {createPortal} from './portal-art.js';
export const TRANSITIONS={crypt_door:'缄默墓穴',portal:'霜暮营地',north_road:'灰须林',forest_return:'霜暮营地',root_gate:'腐沼祭坛',swamp_return:'黑泽村',swamp_camp:'霜暮营地',iron_road:'石脊关',pass_return:'霜暮营地',fortress_entry:'铁冠要塞',fortress_return:'叛军营地',iron_camp:'霜暮营地',salt_road:'灰盐荒原',salt_return:'霜暮营地',tomb_entry:'沙埋神殿',tomb_return:'灰盐荒原',salt_camp:'霜暮营地',harbor_road:'雾岛港口',harbor_return:'霜暮营地',wreck_entry:'沉船墓场',wreck_return:'雾岛港口',harbor_camp:'霜暮营地'};
export function portalAvailable(g,id){
 const s=g.story;if(!s||g.run?.mode==='boss')return false;
 if(g.run?.mode==='chapter'&&['north_road','iron_road','salt_road','forest_return','pass_return','salt_return','swamp_camp','iron_camp','salt_camp','harbor_road','harbor_return','harbor_camp'].includes(id))return false;
 const f=s.flags??{},second=s.second??{},third=s.third??{},fourth=s.fourth??{},fifth=s.fifth??{};
 const locked={crypt_door:['graveyard','crypt','done'].includes(s.stage),portal:f.counter1||s.stage==='done',north_road:s.stage==='done',root_gate:second.butcher,swamp_camp:second.done,iron_road:second.done,fortress_entry:third.orders,iron_camp:third.done,salt_road:third.done,tomb_entry:fourth.mirrors?.length===2,salt_camp:fourth.done,harbor_road:fourth.done,wreck_entry:fifth.captain,harbor_camp:fifth.done};return id in locked?!!locked[id]:true;
}
export function updatePortals(lv,dt){
 const g=lv.game;lv.portals??=new Map();
 for(const t of lv.def.triggers){
  if(!TRANSITIONS[t.id])continue;
  let p=lv.portals.get(t.id);
  if(!p){p=createPortal(g,lv.center(t.x,t.z),{color:t.id.includes('salt')||t.id.includes('tomb')||['harbor_road','harbor_return','wreck_entry','wreck_return','harbor_camp'].includes(t.id)?0x83caca:0xe3a75e});p.trigger=t;lv.portals.set(t.id,p);lv.group.add(p.root);}
  p.active=portalAvailable(g,t.id);p.update(dt,p.active);
 }
}
