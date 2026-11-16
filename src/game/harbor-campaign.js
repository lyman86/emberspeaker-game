import {SaltCampaign} from './salt-campaign.js';
export class HarborCampaign extends SaltCampaign{
 get fifth(){const f=this.flags.ep5??={};f.beacons??=[];f.chains??=[];return f;}
 skipSpawn(s){const f=this.fifth;return(s.tag==='hookcaptain'&&f.captain)||(s.tag==='angler'&&f.bossDead)||(s.tag==='harbor_ward'&&f.wardGuard)||f.chains.includes(s.tag)||super.skipSpawn(s);}
 async onTalk(id){
  const g=this.g,f=this.fifth;
  if(id==='harbor_merchant'){
   if(!f.merchant){await g.ui.say([['莫娅','钟声一响，海就忘了退。两座引航灯灭了，船长把最后一条船拴在了死人身上。'],['薇拉','先点亮两侧航灯。钩链落下前别站在原地；那只深海怪物的灯囊，才是真正的破绽。']]);f.merchant=true;g.save();}g.ui.openShop('harbormerchant');return;
  }
  if(id==='harbor_vera')return g.ui.say([['薇拉','运单不是从这里起运，而是在这里改了名字。点亮引航灯，进入船坞；奥尔古吞下的，是潮汐之钟的钟舌。']]);
  if(id==='wreck_log'){
   await g.ui.say([['浸水运单','货物：钟舌一枚。签收：守夜人北境教区。收货人一栏被刮去，只留下“寒脊修道院”。'],['薇拉','这枚印章和铸钟图纸上的一样。有人在替死去的王收集钟舌。']]);if(!f.log){f.log=true;g.player.gainXp(180);g.save();}return;
  }
  return super.onTalk(id);
 }
 async onTrigger(id,t){
  const g=this.g,u=g.ui,f=this.fifth;
  if(g.run?.mode==='boss'&&!g.bossReady&&id==='angler_intro')return;
  if(g.run?.mode==='chapter'&&id==='harbor_road'&&g.run.chapter!==5)return u.prompt('本次为独立关卡挑战 · 从菜单选择第五集');
  if(g.run?.mode==='chapter'&&['harbor_return','harbor_camp'].includes(id))return u.prompt('本次为第五集挑战 · 从菜单返回标题');
  if(id==='harbor_road'){
   if(!this.fourth.done)return u.prompt('南行海路 · 先从盐墓带回铸钟图纸');
   if(!f.started){await u.say([['薇拉','第四口钟在雾岛港。图纸上的运单指向同一个船坞。'],['烬语者','我们从海上找回下一枚钟舌。']]);f.started=true;}await g.loadLevel('harbor');this.quest();g.save(true);return;
  }
  if(id==='harbor_return'||id==='harbor_camp'){if(id==='harbor_camp'&&!f.done)return u.prompt('先让潮汐之钟沉寂');await g.loadLevel('camp');this.quest();return;}
  if(id==='harbor_intro'){if(!f.intro){f.intro=true;u.banner('第五集 · 沉钩之港','雾中航灯 · 沉船钟链 · 深渊铃鱼');u.toast('圣光压制溺亡者 · 火焰灼穿藤壶壳 · 雷电克制湿润巨兽');g.save();}return;}
  if(id==='beacon_west'||id==='beacon_east'){
   if(f.beacons.includes(id))return u.prompt('引航灯已经点亮');if(g.enemies.some(e=>e.alive&&e.pos.distanceTo(g.player.pos)<9))return u.prompt('清理航灯附近的敌人');
   f.beacons.push(id);g.player.gainXp(180);g.audio.play('h_lure',g.player.pos,.55);g.fx.pillar(g.player.pos,'holy',12,3);
   if(f.beacons.length===2){g.level.openGate('dock_chain');u.banner('船坞锁链已松开','穿过中央栈桥 · 钩手船长在北方');}else u.toast('第一座航灯已亮 · 另一座在港口对岸');this.quest();g.save();return;
  }
  if(id==='tide_ward'){if(f.ward)return u.prompt('旧领航符已取得');if(!f.wardGuard)return u.prompt('先击败旧灯旁的藤壶守卫');f.ward=true;g.player.gainXp(240);u.banner('获得旧领航符','潮浪和洪流伤害降低 20%');g.save();return;}
  if(id==='wreck_entry'){if(!f.captain)return u.prompt('沉船航道 · 需要钩手船长的船坞钥匙');await g.loadLevel('wreck');this.quest();return;}
  if(id==='wreck_return'){await g.loadLevel('harbor');this.quest();return;}
  if(id==='wreck_intro'){if(!f.wreck){f.wreck=true;u.banner('沉船墓场','两侧钟链 · 中央潮门 · 潮汐王座');g.save();}return;}
  if(id==='captain_intro'||id==='angler_intro'){
   const angler=id==='angler_intro',e=g.enemies.find(e=>e.type===(angler?'angler':'hookcaptain')&&e.alive);if(!e?.asleep||this._harborIntro)return;this._harborIntro=true;
   try{await u.say(angler?[
    ['潮汐之钟','一声沉重的钟鸣从巨兽喉中传出。海水里，所有锚链同时绷紧。'],['薇拉','它把钟舌当成了诱饵。引潮时集中攻击发光的灯囊，或者用控制让它失衡。'],['烬语者','让海退去。']
   ]:[['钩手船长','海带走了我的船员。我不过是给他们留了一张回家的船票。'],['薇拉','你拴住的不是归途，是让他们永远不能安息的锁链。']]);
   if(!e.alive||!['harbor','wreck'].includes(g.level.id))return;e.asleep=false;g.audio.setMood(angler?'harbor_boss':'harbor');u.banner(e.name,angler?'侧身避咬 · 位移穿浪 · 破灯反击':'沉钩锁线 · 控制失衡');}finally{this._harborIntro=false;}return;
  }
  if(id==='tide_bell'){
   if(f.done)return u.prompt('潮汐之钟已经沉寂');if(!f.bossDead)return u.prompt('先击败深渊铃鱼，取回潮汐钟舌');if(this._tideRinging)return;this._tideRinging=true;
   try{await this.counterRing('潮汐之钟',4);f.done=true;this.flags.tongues=4;g.player.gainXp(600);
    await u.say([['薇拉','海在退……钟舌上的名字没有消失，它们只是终于不再呼救。'],['烬语者','运单上的下一站是寒脊修道院。'],['薇拉','第一代拾钟人的遗书也在那里。罗兰说过，那扇门本不该再打开。']]);u.banner('第五集 · 沉钩之港 完','第四次反鸣 · 下一站：寒脊哀歌');this.quest();g.save(true);if(g.run?.mode==='chapter')g.finishRun();
   }finally{this._tideRinging=false;}return;
  }
  return super.onTrigger(id,t);
 }
 async onKill(e){
  const g=this.g,f=this.fifth;if(g.run?.mode==='boss'&&e.type==='angler'){g.finishRun();return;}if(e.tag==='summon')return super.onKill(e);
  if(e.tag==='harbor_ward'){f.wardGuard=true;g.ui.toast('旧灯守卫已倒 · 可领取旁边的领航符');g.save();return;}
  if(e.tag==='hookcaptain'){if(f.captain)return;f.captain=true;g.ui.banner('获得船坞钥匙','北方航道开启 · 前往沉船墓场');this.quest();g.save();return;}
  if(['chain_west','chain_east'].includes(e.tag)){if(!f.chains.includes(e.tag)){f.chains.push(e.tag);g.audio.play('h_chain',e.pos,.8);g.player.gainXp(160);if(f.chains.length===2){g.level.openGate('tide_chain');g.ui.banner('牵钟锁链已断','潮门开启 · 深渊铃鱼正在苏醒');}this.quest();g.save();}return;}
  if(e.tag==='angler'){if(f.bossDead)return;f.bossDead=true;for(const a of g.enemies)if(a.alive&&a.tag==='summon')a.takeDamage(999999,{quiet:true});g.audio.setMood('wreck');g.ui.toast('取回潮汐钟舌 · 靠近北方大钟完成反鸣');this.quest();g.save();return;}
  return super.onKill(e);
 }
 onLevel(id){super.onLevel(id);const g=this.g,f=this.fifth;if(id==='harbor'&&f.beacons.length===2)g.level.openGate('dock_chain');if(id==='wreck'&&f.chains.length===2)g.level.openGate('tide_chain');if(['harbor','wreck'].includes(id)||this.fourth.done)this.quest();}
 guidance(){const f=this.fifth,id=this.g.level.id,at=(x,z,label)=>({x:x*4+2,z:z*4+2,label});if(id==='camp'&&this.fourth.done)return at(12,28,'南行海路 · 第五集');if(id==='harbor')return f.beacons.length<2?at(f.beacons.includes('beacon_west')?35:7,f.beacons.includes('beacon_west')?32:33,'点亮引航灯'):!f.captain?at(21,16,'钩手船长'):at(21,4,'沉船墓场');if(id==='wreck')return f.chains.length<2?at(f.chains.includes('chain_west')?31:11,29,'沉船钟链'):!f.bossDead?at(21,10,'深渊铃鱼'):at(21,5,'潮汐反鸣');return super.guidance();}
 quest(){
  const g=this.g,f=this.fifth;if(g.run?.mode==='boss')return super.quest();
  if(g.level.id==='harbor')return g.ui.setQuest('沉钩之港 · 雾中航灯',f.beacons.length<2?`清理两侧航灯守军并点亮航灯（${f.beacons.length}/2）。<br>港口东南的旧领航符可减轻潮汐伤害。`:!f.captain?'中央船坞已经开放，击败<b>钩手船长</b>，取得北行航道钥匙。':'沿北方航道前往<b>沉船墓场</b>，找到潮汐之钟。');
  if(g.level.id==='wreck')return g.ui.setQuest(f.done?'第五集 完 · 海潮退去':'沉钩之港 · 潮汐之钟',f.chains.length<2?`破坏两侧的<b>沉船钟链</b>（${f.chains.length}/2），解除中央潮门。`:!f.bossDead?'击败<b>深渊铃鱼 · 奥尔古</b>。侧身避咬、青色缺口避浪；引灯时控制或集中攻击打断。':!f.done?'靠近北方大钟，用<b>第四枚钟舌</b>完成反鸣。':'可返回营地补给，或重返港口挑战。下一站：寒脊哀歌。');
  if(this.fourth.done&&g.level.id==='camp')return g.ui.setQuest(f.done?'潮汐之钟已沉寂':'南行 · 沉钩之港',f.done?'可从南行海路重返港口刷装备、练习破灯与潮浪。下一站：寒脊哀歌。':'<b>南行海路</b>已开放。前往雾岛港口追查铸钟图纸上的运单；建议等级 16。');return super.quest();
 }
}
