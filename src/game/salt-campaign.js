import { IronCampaign } from './iron-campaign.js';
import { CHAPTERS } from './runs.js';

export class SaltCampaign extends IronCampaign {
 get fourth(){const f=this.flags.ep4??={};f.mirrors??=[];f.seals??=[];return f;}
 skipSpawn(s){const f=this.fourth;return (s.tag==='saltpriest'&&f.priest)||(s.tag==='saltqueen'&&f.bossDead)||f.seals.includes(s.tag)||super.skipSpawn(s);}
 async onTalk(id){
  const g=this.g,f=this.fourth;
  if(id==='salt_merchant'){
   if(!f.merchant){await g.ui.say([['萨米尔','盐不是雪。被它裹住的亡者，连名字都会忘记。两边的导流碑还能转，清掉守军，去引两道光。'],['萨米尔','荒原西北的避风护符能削弱盐后的沙暴。拿不拿，由你。']]);f.merchant=true;g.save();}
   g.ui.openShop('saltmerchant');return;
  }
  if(['salt_vera','tomb_vera'].includes(id))return g.ui.say([['薇拉',g.level.id==='saltflat'?'第四站没有新钟。我们要找的是铸钟图纸：有人想把当年的真相也埋进盐里。':'祭司依靠共鸣盐晶维持盐壳。先拆晶，再打断他的封尸仪式；女王的沙暴中，青色圆环才是安全区。']]);
  if(id==='salt_inscription'){
   await g.ui.say([['铸钟石刻','以七音铸锁，以人声为舌。王之归途不在钟内，而在献祭者的血中。'],['薇拉','守夜人的印记……它竟和第三集运单上的一样。把图纸带走，我们需要知道是谁批准了献祭。']]);
   if(!f.inscription){f.inscription=true;g.player.gainXp(350);g.save();}return;
  }
  await super.onTalk(id);
  if(g.run?.mode==='chapter'&&g.run.chapter===1&&this.stage==='done')g.finishRun();
 }
 async onTrigger(id,t){
  const g=this.g,u=g.ui,f=this.fourth;
  if(g.run?.mode==='boss'&&!g.bossReady&&['boss_intro','stag_intro','king_intro','queen_intro'].includes(id))return;
  if(g.run?.mode==='chapter'){
   const road={north_road:2,iron_road:3,salt_road:4}[id];
   if(road&&road!==g.run.chapter)return u.prompt('本次为独立关卡挑战 · 可在菜单返回模式选择');
   if(['forest_return','pass_return','salt_return'].includes(id))return u.prompt('本次为关卡挑战 · 从菜单返回标题');
  }
  if(id==='salt_road'){
   if(!this.third.done)return u.prompt('西行盐道 · 先让铁律之钟沉寂');
   if(!f.started){await u.say([['薇拉','运单记着灰盐荒原的神殿。那里没有第四口钟，只有最初的铸钟图纸。'],['烬语者','那么这一次，我们追的是铸钟人的秘密。']]);f.started=true;}
   await g.loadLevel('saltflat');this.quest();g.save(true);return;
  }
  if(id==='salt_return'||id==='salt_camp'){
   if(id==='salt_camp'&&!f.done)return u.prompt('先从中央石台取走铸钟图纸');
   await g.loadLevel('camp');this.quest();return;
  }
  if(id==='salt_intro'){if(!f.intro){f.intro=true;u.banner('第四集 · 盐沙古墓','双碑引光 · 破晶封尸 · 荒盐女王');u.toast('清理东西两座导流碑附近的守军，再靠近引光');g.save();}return;}
  if(id==='mirror_west'||id==='mirror_east'){
   const side=id==='mirror_west'?'west':'east';if(f.mirrors.includes(side))return u.prompt('光路已经导通');
   if(g.enemies.some(e=>e.alive&&e.pos.distanceTo(g.player.pos)<10))return u.prompt('先清理导流碑附近的守军，再靠近引光');
   f.mirrors.push(side);this.lightMirror(side);g.player.gainXp(300);g.audio.play('raise');
   if(f.mirrors.length===2){g.level.openGate('sun_gate');u.banner('日轮石门已开启','沿北方遗址进入沙埋神殿');}
   else u.toast('第一道光路已导通 · 前往另一座导流碑');this.quest();g.save();return;
  }
  if(id==='sun_gate_hint'){if(f.mirrors.length<2)u.prompt(`日轮石门 · 引光 ${f.mirrors.length}/2`);return;}
  if(id==='shelter_altar'){
   if(f.shelter)return u.prompt('避风护符已取得');
   if(!f.seals.includes('oasis_seal'))return u.prompt('先摧毁附近的共鸣盐晶，解除护符封印');
   f.shelter=true;g.player.gainXp(400);u.banner('获得避风护符','盐之女王沙暴伤害降低 25%');g.fx.pillar(g.player.pos,'holy',40,7);g.save();return;
  }
  if(id==='tomb_entry'){if(f.mirrors.length<2)return u.prompt('先导通东西两座引光碑');await g.loadLevel('salttomb');this.quest();return;}
  if(id==='tomb_return'){await g.loadLevel('saltflat');this.quest();return;}
  if(id==='tomb_intro'){if(!f.tomb){f.tomb=true;u.banner('沙埋神殿','壁刻中的人声 · 盐壳中的亡者');u.toast('圣光克制盐尸 · 火焰克制蓝皮盐魔 · 控制打断封尸');g.save();}return;}
  if(id==='tomb_gate_hint'){if(!f.priest)u.prompt('击败封尸祭司，解除王陵的封印');return;}
  if(id==='priest_intro'||id==='queen_intro'){
   const queen=id==='queen_intro',e=g.enemies.find(e=>e.type===(queen?'saltqueen':'saltpriest')&&e.alive);
   if(!e?.asleep||this._saltIntro)return;this._saltIntro=true;
   try{
    await u.say(queen?[
     ['盐之女王','此处没有钟声。只有永不腐烂的寂静。你为何要翻动我的墓？'],
     ['薇拉','我们要带走铸钟图纸。被献祭的人，不该连证据都没有。'],
     ['盐之女王','那就让荒原替我裁决。看清最后一圈宁静——沙暴不会等你。']
    ]:[['封尸祭司','盐壳不裂，亡者不醒。你们也可以永远留在这里。'],['薇拉','两侧盐晶在保护他。摧毁它们，再用控制打断仪式。']]);
    if(!e.alive||g.level.id!=='salttomb')return;e.asleep=false;g.audio.setMood(queen?'salt_boss':'salt_tomb');u.banner(e.name,queen?'盐晶王冠 · 青环避风 · 破晶反击':'共鸣护壳 · 先破晶再打断');
   }finally{this._saltIntro=false;}return;
  }
  if(id==='salt_blueprint'){
   if(f.done)return u.prompt('铸钟图纸已带走');if(!f.bossDead)return u.prompt('先击败盐之女王');if(this._readingPlan)return;this._readingPlan=true;
   try{
    await u.say([['铸钟图纸','七口钟不是诅咒。它们是封印。图纸的边角写着七百个名字，每个名字旁都盖着守夜人的旧印。'],['薇拉','第一份图纸……我们找到了。有人把活人的声音铸进了钟里。'],['烬语者','下一张运单写着雾岛港。是谁把最后一批钟舌运上了船？'],['薇拉','第五站，沉钩之港。先把证据带回去，问问罗兰。']]);
    f.done=true;f.blueprint=true;g.player.gainXp(1400);u.banner('第四集 · 盐沙古墓 完','获得古代铸钟图纸 · 下一站：沉钩之港');this.quest();g.save(true);
    if(g.run?.mode==='chapter')g.finishRun();
   }finally{this._readingPlan=false;}return;
  }
  await super.onTrigger(id,t);
  if(g.run?.mode==='chapter'&&((g.run.chapter===2&&this.second.done)||(g.run.chapter===3&&this.third.done)))g.finishRun();
 }
 lightMirror(side){
  const g=this.g,p=g.level.center(side==='west'?8:34,36),to=g.level.center(21,26);
  g.fx.bolt(p.clone().setY(3.2),to.clone().setY(3.2),{color:[1.2,2.8,3.2],width:.06});
  g.fx.ring(p,{color:[.6,2.2,2.7],r0:1,r1:4,dur:1});
 }
 async onKill(e){
  const g=this.g,f=this.fourth;
  if(g.run?.mode==='boss'&&e.type===CHAPTERS[g.run.chapter-1].boss){g.finishRun();return;}
  if(e.T?.episode===4&&e.tag==='summon')return;
  if(e.T?.episode===4&&e.type==='saltseal'){
   if(e.tag&&!f.seals.includes(e.tag))f.seals.push(e.tag);uToast(g,'盐晶已碎 · 附近护壳削弱');this.quest();g.save();return;
  }
  if(e.tag==='saltpriest'){if(f.priest)return;f.priest=true;g.level.openGate('tomb_seal');g.ui.banner('封尸仪式已断','王陵石门开启 · 盐之女王在北方');this.quest();g.save();return;}
  if(e.tag==='saltqueen'){
   if(f.bossDead)return;f.bossDead=true;
   for(const a of g.enemies)if(a.alive&&a.tag==='summon')a.takeDamage(999999,{quiet:true});
   g.audio.setMood('salt_tomb');g.ui.toast('盐之后冠已碎 · 靠近中央石台取走铸钟图纸');this.quest();g.save();return;
  }
  return super.onKill(e);
 }
 onLevel(id){
  super.onLevel(id);const f=this.fourth,g=this.g;
  if(id==='saltflat'&&f.mirrors.length===2)g.level.openGate('sun_gate');
  if(id==='salttomb'&&f.priest)g.level.openGate('tomb_seal');
  if(this.third.done||['saltflat','salttomb'].includes(id)||g.run?.mode==='boss')this.quest();
 }
 guidance(){
  if(this.g.run?.mode==='boss')return null;
  const f=this.fourth,id=this.g.level.id,at=(x,z,label)=>({x:x*4+2,z:z*4+2,label});
  if(id==='camp'&&this.third.done)return at(1,24,'西行盐道 · 第四集');
  if(id==='fortress'&&this.third.done)return at(32,5,'西行盐道 · 第四集');
  if(id==='saltflat'){
   if(!f.mirrors.includes('west'))return at(9,36,'西导流碑 · 清理守军并引光');
   if(!f.mirrors.includes('east'))return at(33,36,'东导流碑 · 清理守军并引光');
   return at(21,4,'沙埋神殿 · 进入');
  }
  if(id==='salttomb')return !f.priest?at(21,27,'封尸祭司 · 破晶解除封印'):!f.bossDead?at(21,17,'盐之女王 · 王陵深处'):!f.done?at(21,5,'铸钟图纸 · 取走证据'):at(9,5,'余烬归途 · 返回营地');
  return super.guidance();
 }
 quest(){
  const g=this.g,f=this.fourth,id=g.level.id;
  if(g.run?.mode==='boss'){const c=CHAPTERS[g.run.chapter-1];return g.ui.setQuest('Boss 挑战 · '+c.title,`击败<b>${c.bossName}</b>。可先分配技能点；倒下后可重新挑战，故事存档独立保留。`);}
  if(id==='saltflat')return g.ui.setQuest('盐沙古墓 · 双碑引光',f.mirrors.length<2?`清理东西导流碑的守军，再靠近引光。（${f.mirrors.length}/2）<br>可选：荒原西北侧的<b>避风护符</b>可削弱最终沙暴。`:'日轮石门已开。沿北方遗址进入<b>沙埋神殿</b>，寻找铸钟图纸。');
  if(id==='salttomb')return g.ui.setQuest(f.done?'第四集 完 · 铸钟之罪':'盐沙古墓 · 铸钟图纸',!f.priest?'击败<b>封尸祭司</b>。两侧共鸣盐晶会保护他，先破晶；控制可以打断封尸仪式。':!f.bossDead?'击败<b>盐之女王</b>。破坏召唤盐晶，沙暴时进入<b>青色安全区</b>，利用破晶后的收招窗口。':!f.done?'靠近中央石台，取走<b>古代铸钟图纸</b>。本集没有新钟，无需反鸣。':'图纸已取得。返回营地补给，从<b>南行海路</b>前往<b>沉钩之港</b>。');
  if(this.third.done&&['camp','fortress'].includes(id))return g.ui.setQuest(f.done?'铸钟之罪 · 线索已得':'西行 · 盐沙古墓',f.done?'可从<b>西行盐道</b>重返古墓刷装备，或在营地强化。下一站：沉钩之港。':'<b>西行盐道</b>已开放。前往灰盐荒原，寻找古代铸钟图纸；建议等级 13。');
  return super.quest();
 }
}
function uToast(g,text){g.ui.toast(text);g.audio.play('shatter');}
