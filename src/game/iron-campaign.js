import {Campaign} from './campaign.js';
/** Third-chapter flags extend existing saves; completed chapter-two saves unlock the eastern road. */
export class IronCampaign extends Campaign{
 get third(){const f=this.flags.ep3??={};f.standards??=[];return f;}
 skipSpawn(s){const f=this.third;return (s.tag==='orders'&&f.orders)||(s.tag==='blackknight'&&f.knight)||(s.tag==='ironking'&&f.bossDead)||(s.tag==='pass_ballista'&&f.ballista)||f.standards.includes(s.tag);}
 async onTalk(id){
  const g=this.g,f=this.third;
  if(id==='aida'){
   if(!f.aida){await g.ui.say([['军需官艾达','第三口钟响后，守军把自己叫作王庭。他们的盾朝向同一边，弩却能封住整条山道。'],['军需官艾达','先拆红色军旗，附近士兵就失去军阵庇护。西侧旧军械道能绕开正门；东侧重弩若被摧毁，王庭的齐射也会少几支箭。'],['薇拉','夺下营地督军的军令，我们才能进铁冠要塞。']]);f.aida=true;g.save();}
   g.ui.openShop('quartermaster');return;
  }
  if(id==='iron_orders'){
   await g.ui.say([['征调记录','奉灰冠王庭之命，征集精铁、囚徒与铸钟匠。落款并非叛王，而是一枚守夜人的旧印。'],['薇拉','有人借王的名义调走了铸钟图纸……先找到铁律钥舌。']]);
   if(!f.records){f.records=true;g.player.gainXp(150);g.save();}return;
  }
  if(id==='iron_vera')return g.ui.say([['薇拉',f.knight?'黑铁纹章已在手中。叛王的血旗会护住他，先毁旗，再等他收剑。':'校场里是黑铁骑士。他举盾蓄力时可以被控制技能打断；绕背攻击也能避开正面的钢甲。']]);
  return super.onTalk(id);
 }
 async onTrigger(id,t){
  const g=this.g,u=g.ui,f=this.third;
  if(id==='iron_road'){
   if(!this.second.done)return u.prompt('东行山道 · 先让疫病之钟沉寂');
   if(!f.started){await u.say([['薇拉','两枚钥舌指向石脊关。第三口钟不再唤醒尸骨，它让活人只听从王的命令。'],['烬语者','那就先打碎他们的军阵。']]);f.started=true;}
   await g.loadLevel('pass');this.quest();g.save(true);return;
  }
  if(id==='pass_return'||id==='iron_camp'){
   if(id==='iron_camp'&&!f.done)return u.prompt('先用铁律钥舌完成反鸣');
   await g.loadLevel('camp');this.quest();return;
  }
  if(id==='pass_intro'){
   if(!f.intro){f.intro=true;u.banner('第三集 · 铁冠叛旗','破军阵 · 拆战旗 · 攻要塞');u.toast('前方军需官可补给 · 盾卒正面抵抗物理攻击，绕背更有效');g.save();}return;
  }
  if(id==='side_winch'){
   if(f.winch)return u.prompt('关隘绞盘已解除');
   if(g.enemies.some(e=>e.alive&&e.pos.distanceTo(g.player.pos)<9))return u.prompt('先清理绞盘附近的守军');
   f.winch=true;g.level.openGate('camp_gate');g.audio.play('gate');g.player.gainXp(140);u.banner('旧军械道已打通','侧翼迂回 · 正门绞盘已解除');this.quest();g.save();return;
  }
  if(id==='rebel_camp'){
   if(!f.camp){f.camp=true;u.banner('叛军营地','击败督军奥伦 · 夺取王庭军令');g.save();}return;
  }
  if(id==='fortress_entry'){
   if(!f.orders)return u.prompt('王庭铁门 · 需要督军的军令');
   await g.loadLevel('fortress');this.quest();return;
  }
  if(id==='fortress_return'){await g.loadLevel('pass');this.quest();return;}
  if(id==='fortress_intro'){
   if(!f.keep){f.keep=true;u.banner('铁冠要塞','外庭军阵 → 黑铁校场 → 王座钟楼');u.toast('拆毁外庭战旗可以削弱周围守军');g.save();}return;
  }
  if(id==='keep_gate'){if(!f.knight)u.prompt('黑铁纹章 · 先击败校场的黑铁骑士');return;}
  if(id==='knight_intro'||id==='king_intro'){
   const king=id==='king_intro',e=g.enemies.find(e=>e.type===(king?'ironking':'blackknight')&&e.alive);
   if(!e?.asleep||this._ironIntro)return;
   this._ironIntro=true;
   try{
    await u.say(king?[
     ['叛王赫拉克留斯','铁律之下，无人可以违抗。你手中的钟舌，也该归还王庭。'],
     ['薇拉','那不是你的王。他早已死去，是你在替他敲钟。'],
     ['叛王赫拉克留斯','没有钟声，他们又会向谁俯首？列阵——迎敌！']
    ]:[['黑铁骑士','校场即是审判。越过我的盾，才有资格见王。'],['薇拉','看清他的举盾，留好控制技能。']]);
    if(!e.alive||g.level.id!=='fortress')return;e.asleep=false;g.audio.setMood(king?'iron_boss':'fortress');u.banner(e.name,king?'铁律之钟的守钟者':'黑铁盾势 · 控制破盾 / 绕背反击');
   }finally{this._ironIntro=false;}return;
  }
  if(id==='iron_bell'){
   if(f.done)return u.prompt('铁律之钟已沉寂');if(!f.bossDead)return u.prompt('先击败叛王赫拉克留斯');if(this._ironRinging)return;
   this._ironRinging=true;
   try{
    await this.counterRing('铁律之钟',3);f.done=true;this.flags.tongues=3;g.player.gainXp(600);
    await u.say([['薇拉','王的名字被人刻在新钟上，可这页运单比叛乱早了十年。铸钟图纸去了灰盐荒原。'],['烬语者','我们去找最初的铸钟人。'],['薇拉','第四站，盐沙古墓。先回营地，让布拉姆看看这些黑铁。']]);
    u.banner('第三集 · 铁冠叛旗 完','三口钟已沉寂 · 下一个线索：盐沙古墓');this.quest();g.save(true);
   }finally{this._ironRinging=false;}return;
  }
  return super.onTrigger(id,t);
 }
 async onKill(e){
  const g=this.g,f=this.third,u=g.ui;
  if(e.tag==='summon')return super.onKill(e);
  if(['pass_standard','fortress_standard'].includes(e.tag)){
   if(f.standards.includes(e.tag))return;f.standards.push(e.tag);
   if(e.tag==='pass_standard')g.level.openGate('camp_gate');
   u.toast('军阵战旗已毁 · 附近士兵失去庇护');g.audio.play('gate',e.pos);this.quest();g.save();return;
  }
  if(e.tag==='pass_ballista'){
   if(f.ballista)return;f.ballista=true;u.toast('关隘重弩已毁 · 叛王齐射箭数减少');g.player.gainXp(140);g.save();return;
  }
  if(e.tag==='orders'){
   if(f.orders)return;f.orders=true;g.level.openGate('fortress_gate');u.banner('获得王庭军令','北面的铁门已开 · 进入铁冠要塞');this.quest();g.save();return;
  }
  if(e.tag==='blackknight'){
   if(f.knight)return;f.knight=true;g.level.openGate('keep_seal');g.audio.play('gate');u.banner('黑铁盾势已破','获得黑铁纹章 · 王座钟楼已开放');this.quest();g.save();return;
  }
  if(e.tag==='ironking'){
   if(f.bossDead)return;f.bossDead=true;for(const add of g.enemies)if(add.alive&&add.tag==='summon')add.takeDamage(99999,{quiet:true});
   g.audio.setMood('fortress');u.toast('获得：铁律钥舌 · 靠近钟楼大钟完成反鸣');this.quest();g.save();return;
  }
  return super.onKill(e);
 }
 onLevel(id){
  super.onLevel(id);const g=this.g,f=this.third;
  if(id==='pass'){if(f.winch||f.standards.includes('pass_standard'))g.level.openGate('camp_gate');if(f.orders)g.level.openGate('fortress_gate');}
  if(id==='fortress'){if(f.knight)g.level.openGate('keep_seal');if(f.done){g.level.bellSwing=0;if(g.level.bellGlow)g.level.bellGlow.visible=false;g.level.emitters=g.level.emitters.filter(e=>e.kind!=='bellmist');}}
  if(this.second.done||['pass','fortress'].includes(id))this.quest();
 }
 guidance(){
  const f=this.third,id=this.g.level.id,at=(x,z,label)=>({x:x*4+2,z:z*4+2,label});
  if(id==='camp'&&this.second.done)return at(23,21,'东行山道 · 第三集');
  if(id==='swamp'&&this.second.done)return at(26,4,'东行山道 · 第三集');
  if(id==='pass')return !f.aida?at(19,58,'军需官艾达 · 补给与情报'):!f.winch&&!f.standards.includes('pass_standard')?at(21,34,'拆战旗 / 西侧旧军械道'):!f.orders?at(21,16,'叛军督军 · 夺取军令'):at(21,4,'铁冠要塞 · 进入');
  if(id==='fortress')return !f.knight?at(21,26,'黑铁骑士 · 夺取纹章'):!f.bossDead?at(21,10,'王座钟楼 · 叛王'):!f.done?at(21,5,'铁律之钟 · 完成反鸣'):at(10,5,'余烬归途 · 返回营地');
  return super.guidance();
 }
 quest(){
  const g=this.g,f=this.third,id=g.level.id;
  if(id==='pass')return g.ui.setQuest('铁冠叛旗 · 破军阵',!f.orders?'拆毁<b>军阵战旗</b>或从西侧解除绞盘，击败营地督军取得<b>王庭军令</b>。可选：摧毁东侧重弩，削弱叛王齐射。':'带着<b>王庭军令</b>从北面的铁门进入铁冠要塞。');
  if(id==='fortress')return g.ui.setQuest(f.done?'第三集 完 · 灰盐的线索':'铁律之钟',!f.knight?'击败<b>黑铁骑士</b>取得纹章。控制技能能打断举盾，绕背可避开正面格挡。':!f.bossDead?'击败<b>叛王赫拉克留斯</b>。优先拆血旗，躲开突进与火线，利用收剑破绽反击。':!f.done?'靠近王座后的<b>铁律之钟</b>，用三枚钟舌完成反鸣。':'铁律之钟已沉寂。返回营地补给；铸钟图纸的线索指向<b>盐沙古墓</b>（后续章节）。');
  if(this.second.done&&['camp','swamp'].includes(id))return g.ui.setQuest(f.done?'三钟沉寂':'东行 · 铁冠叛旗',f.done?'第三集已完成。可沿<b>东行山道</b>重返铁冠要塞刷装备，或留在营地强化。':'<b>东行山道</b>已开放，沿金色路标前往石脊关，寻找第三口钟。建议等级 10，出发前补给与强化。');
  return super.quest();
 }
}
