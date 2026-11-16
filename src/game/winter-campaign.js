import {HarborCampaign} from './harbor-campaign.js';
const FIRES=['fire_outpost','fire_ravine','fire_watch'],PAGES=['testament_west','testament_east'];
export class WinterCampaign extends HarborCampaign{
 get sixth(){const f=this.flags.ep6??={};f.fires??=[];f.pages??=[];return f;}
 skipSpawn(s){const f=this.sixth;return(s.tag==='frostgiant'&&f.giant)||(s.tag==='winterabbess'&&f.bossDead)||(s.tag==='winter_ward_guard'&&f.wardGuard)||super.skipSpawn(s);}
 async onTalk(id){
  const g=this.g,f=this.sixth;
  if(id==='winter_merchant'){if(!f.merchant){await g.ui.say([['奥文','山上的风会吃掉热量。点起驿站、峡谷和瞭望台的三处薪火，循火上山。'],['薇拉','火盆旁能驱散寒蚀。冰枪有迹可循；修女长的安魂曲可以被控制或集中攻击打断。']]);f.merchant=true;g.save();}g.ui.openShop('wintermerchant');return;}
  if(id==='winter_vera')return g.ui.say([['薇拉','我们来寻找第一代拾钟人的遗书，不是下一口钟。四枚钟舌都在；这一次，听听活人留下的话。']]);
  if(id==='winter_scribe')return g.ui.say([['伊文','修女长把遗书封在唱诗厅里。先找东西两翼的残页，才能解除誓门。'],['薇拉','别追着暴雪乱跑。看清暖金色的避风圈，在落雪前站进去。']]);
  return super.onTalk(id);
 }
 async onTrigger(id,t){
  const g=this.g,u=g.ui,f=this.sixth;
  if(g.run?.mode==='boss'&&!g.bossReady&&id==='abbess_intro')return;
  if(g.run?.mode==='chapter'&&id==='winter_road'&&g.run.chapter!==6)return u.prompt('本次为独立关卡挑战 · 从菜单选择第六集');
  if(g.run?.mode==='chapter'&&['winter_return','winter_camp'].includes(id))return u.prompt('本次为第六集挑战 · 从菜单返回标题');
  if(id==='winter_road'){if(!this.fifth.done)return u.prompt('寒脊山道 · 先让潮汐之钟沉寂');if(!f.started){await u.say([['薇拉','寒脊修道院就在山口之后。运单上的印章属于那里，第一代拾钟人的遗书也在那里。'],['烬语者','带上薪火。我们去问一个活了太久的秘密。']]);f.started=true;}await g.loadLevel('frostpass');this.quest();g.save(true);return;}
  if(id==='winter_return'||id==='winter_camp'){if(id==='winter_camp'&&!f.done)return u.prompt('先取回第一代拾钟人的遗书');await g.loadLevel('camp');this.quest();return;}
  if(id==='winter_intro'){if(!f.intro){f.intro=true;u.banner('第六集 · 寒脊哀歌','接续薪火 · 两翼遗书 · 冬死修女长');u.toast('暴雪来临时靠近已点亮的火盆 · 火焰克制冰封躯壳');g.save();}return;}
  if(FIRES.includes(id)){if(f.fires.includes(id))return u.prompt('薪火尚存 · 靠近可驱散寒蚀');if(g.enemies.some(e=>e.alive&&e.pos.distanceTo(g.player.pos)<9))return u.prompt('先清理火盆附近的敌人');f.fires.push(id);g.player.chillUntil=0;g.player.gainXp(180);g.audio.play('fire',g.player.pos,.6);g.fx.pillar(g.player.pos,'fire',12,3);if(f.fires.length===3){g.level.openGate('winter_ascent');u.banner('三处薪火已接续','北方山隘开启 · 霜脚巨人守在尽头');}else u.toast(`薪火 ${f.fires.length}/3 · 火光能抵御山口暴雪`);this.quest();g.save();return;}
  if(id==='winter_ward'){if(f.ward)return u.prompt('暖誓经文已取得');if(!f.wardGuard)return u.prompt('先击败圣像旁的守经僧');f.ward=true;g.player.gainXp(240);u.banner('获得暖誓经文','寒脊的暴雪与冰霜场地伤害降低 20%');g.save();return;}
  if(id==='monastery_entry'){if(!f.giant)return u.prompt('修道院石门 · 需要击败霜脚巨人取得门钥');await g.loadLevel('monastery');this.quest();return;}
  if(id==='monastery_return'){await g.loadLevel('frostpass');this.quest();return;}
  if(id==='monastery_intro'){if(!f.monastery){f.monastery=true;u.banner('冰封修道院','东西两翼的残页 · 唱诗厅的最后誓言');g.save();}return;}
  if(PAGES.includes(id)){if(f.pages.includes(id))return u.prompt('这页遗书已经读过');if(g.enemies.some(e=>e.alive&&e.pos.distanceTo(g.player.pos)<10))return u.prompt('先清理书台附近的守卫');await u.say(id==='testament_west'?[['第一代拾钟人 · 残页','我们把七口钟叫作封印，却不敢记下铸钟者的名字。人不是燃料，王也不是永生之人。']]:[['第一代拾钟人 · 残页','熔心炉仍有当年的铸钟账册。若后来者读到这些话：去黑铁矿道，找到没有被烧掉的那一页。']]);f.pages.push(id);g.player.gainXp(250);g.audio.play('w_chant',g.player.pos,.5);if(f.pages.length===2){g.level.openGate('winter_choir');u.banner('唱诗厅誓门已解','冬死修女长仍守着最后一页');}this.quest();g.save();return;}
  if(id==='giant_intro'||id==='abbess_intro'){
   const boss=id==='abbess_intro',e=g.enemies.find(e=>e.type===(boss?'winterabbess':'frostgiant')&&e.alive);if(!e?.asleep||this._winterIntro)return;this._winterIntro=true;
   try{await u.say(boss?[
    ['伊瑟拉','那本遗书不能离开这里。让真相随我一同冻死，总好过再响一口钟。'],['薇拉','隐瞒没有让钟声停下。请把他们的名字还给我们。'],['烬语者','你的祷声会停，薪火不会。']
   ]:[['霜脚巨人','门后……没有春天。'],['薇拉','看清冰锤的落点，再走进它收招的破绽。']]);if(!e.alive||!['frostpass','monastery'].includes(g.level.id))return;e.asleep=false;g.audio.setMood(boss?'winter_boss':'winter');u.banner(e.name,boss?'侧避冰枪 · 近身避安魂 · 暖圈避暴雪':'横移避冲撞 · 收锤后反击');}finally{this._winterIntro=false;}return;
  }
  if(id==='winter_testament'){
   if(f.done)return u.prompt('第一代拾钟人的遗书已取回');if(!f.bossDead)return u.prompt('先击败冬死修女长');if(this._readingWinter)return;this._readingWinter=true;
   try{await u.say([['第一代拾钟人的遗书','七次献祭，七口钟。守夜人记下了王的罪，却删去了自己的签名。真正的铸钟账册，藏在熔心矿坑。'],['薇拉','她守着的不是王，是自己曾经相信过的誓言。'],['烬语者','我们会把名字带到熔炉前。'],['薇拉','下一站，黑铁矿道。四枚钟舌都在，这一程，我们终于听见了钟声之外的声音。']]);f.done=true;this.flags.tongues=4;g.player.gainXp(900);u.banner('第六集 · 寒脊哀歌 完','遗书已取回 · 下一站：熔心矿坑');this.quest();g.save(true);if(g.run?.mode==='chapter')g.finishRun();}finally{this._readingWinter=false;}return;
  }
  return super.onTrigger(id,t);
 }
 async onKill(e){const g=this.g,f=this.sixth;if(g.run?.mode==='boss'&&e.type==='winterabbess'){g.finishRun();return;}if(e.tag==='summon')return super.onKill(e);if(e.tag==='winter_ward_guard'){f.wardGuard=true;g.ui.toast('守经僧已倒 · 可在圣像处领取暖誓经文');g.save();return;}if(e.tag==='frostgiant'){if(f.giant)return;f.giant=true;g.ui.banner('获得修道院门钥','北方石门已开启');this.quest();g.save();return;}if(e.tag==='winterabbess'){if(f.bossDead)return;f.bossDead=true;for(const a of g.enemies)if(a.alive&&a.tag==='summon')a.takeDamage(999999,{quiet:true});g.audio.setMood('monastery');g.ui.toast('唱诗声已停 · 靠近北方书台取回遗书');this.quest();g.save();return;}return super.onKill(e);}
 onLevel(id){super.onLevel(id);const f=this.sixth;if(id==='frostpass'&&f.fires.length===3)this.g.level.openGate('winter_ascent');if(id==='monastery'&&f.pages.length===2)this.g.level.openGate('winter_choir');if(['frostpass','monastery'].includes(id)||this.fifth.done)this.quest();}
 quest(){const g=this.g,f=this.sixth;if(g.run?.mode==='boss')return super.quest();if(g.level.id==='frostpass')return g.ui.setQuest('寒脊哀歌 · 接续薪火',f.fires.length<3?`点亮三处薪火（${f.fires.length}/3）。暴雪中靠近火盆；东侧支路藏有暖誓经文。`:!f.giant?'山隘已开，击败<b>霜脚巨人</b>，取得修道院门钥。':'穿过北方石门，进入<b>冰封修道院</b>。');if(g.level.id==='monastery')return g.ui.setQuest(f.done?'第六集 完 · 薪火未熄':'寒脊哀歌 · 第一代遗书',f.pages.length<2?`阅读东西两翼残页（${f.pages.length}/2），解除唱诗厅誓门。`:!f.bossDead?'击败<b>冬死修女长 · 伊瑟拉</b>。安魂曲可打断，或靠近她避开外圈；暴雪时进入暖圈。':!f.done?'前往北方书台取回<b>第一代拾钟人的遗书</b>。':'遗书指向熔心矿坑。可返回营地整理装备，或重返寒脊探索。');if(g.level.id==='camp'&&this.fifth.done)return g.ui.setQuest(f.done?'遗书已取回 · 薪火未熄':'东南行 · 寒脊哀歌',f.done?'可重返寒脊寻找冰霜装备与稀有圣遗。下一站：熔心矿坑。':'<b>寒脊山道</b>已开放。建议等级 18，前往冰封修道院追查第一代拾钟人的遗书。');return super.quest();}
}
