import { Episode1 } from './story.js';

/** Episode state lives inside the existing story save so version-two saves migrate without changing keys. */
export class Campaign extends Episode1 {
  get second() { return this.flags.ep2??=( {totems:[],stage:'road'} ); }
  async onTalk(id) {
    const g=this.g,ui=g.ui,f=this.second;
    if(id==='messenger') {
      await ui.say([['垂死的信使','黑泽村……女巫在唱歌……三座图腾不毁，雾就不会散。'],['烬语者','我会让她们的歌停下来。']]);
      if(!f.messenger){f.messenger=true;g.player.gainXp(80);}this.quest();g.save();return;
    }
    if(id==='forest_vera')return ui.say([['薇拉','沿驿道找到翻倒的马车，再摧毁林中三座疫歌图腾。教堂的灯还亮着，那里也许有幸存者。']]);
    if(id==='harold') {
      if(!f.hunter){await ui.say([['哈罗德','我躲在教堂里听了七夜的歌。屠夫把村民拖进磨坊，缝成了怪物。'],['哈罗德','他身上的鹿角信物能打开北面的树根门。药水和材料，我这里还能匀一些。']]);f.hunter=true;g.player.gainXp(120);}
      ui.openShop('hunter');this.quest();g.save();return;
    }
    if(id==='roland' && this.stage==='done') {
      await ui.say([['罗兰','缄默之钟只是七时之钟的第一口。北方的第二口已醒，薇拉会与你同行。'],['罗兰',`若想重新磨练技艺，我可以帮你洗点：${50+g.player.level*10} 金币。`]]);
      ui.openGrowth('skills',true);return;
    }
    await super.onTalk(id);
  }
  async onTrigger(id,t) {
    const g=this.g,ui=g.ui,f=this.second;
    if(id==='silent_bell') {
      if(!this.flags.bossDead || this.flags.counter1)return;
      await this.counterRing('缄默之钟',1);this.flags.counter1=true;this.flags.tongues=1;ui.setQuest('归途','通过余烬之门返回营地，向罗兰复命。');g.save();return;
    }
    if(id==='portal' && !this.flags.counter1 && this.stage!=='done')return ui.prompt('先靠近缄默之钟，用钟舌完成反鸣');
    if(id==='north_road') {
      if(this.stage!=='done')return ui.prompt('北行驿道 · 先完成缄默之钟的任务并向罗兰复命');
      this.flags.counter1=true;this.flags.tongues=Math.max(1,this.flags.tongues??0);
      if(!f.started){f.started=true;await ui.say([['薇拉','听见了吗？北方的疫病之钟响了。带上缄默钥舌，我们去黑泽村。']]);}
      await g.loadLevel('forest');this.quest();g.save(true);return;
    }
    if(id==='forest_return'||id==='swamp_camp') {
      if(id==='swamp_camp'&&!f.done)return;
      await g.loadLevel('camp');this.quest();return;
    }
    if(id==='forest_intro'){
      if(!f.road){f.road=true;ui.banner('灰须林驿道','失落驿站 → 三座图腾 → 黑泽村');await ui.say([['薇拉','驿道上的苔藓都变黑了。那些村民死后会留下毒雾，别停在尸体旁。'],['薇拉','先找到翻倒的马车。沿驿道向北，到村口找找活人的踪迹。']]);this.quest();g.save();}return;
    }
    if(id==='village_intro'){
      if(!f.village){f.village=true;ui.banner('黑泽村','教堂避难所 · 向西寻找猎人哈罗德');ui.toast('暖色灯火处是教堂补给点');g.save();}return;
    }
    if(id==='mill_intro'){
      if(!f.butcher){g.audio.setMood('mill');if(!f.mill){f.mill=true;ui.banner('磨坊屠场','精英 · 缝合屠夫');g.audio.play('e_butcher',g.level.center(25,9));ui.toast('屠夫冲撞前会蓄力 · 横向离开红色路径');}}return;
    }
    if(id==='swamp_intro'){
      if(!f.marsh){f.marsh=true;ui.banner('腐沼石径','循石而行 · 小心雾中的伏击');await ui.say([['薇拉','沼水里全是疫病。沿石径走——狼人会扑过来，女巫却躲在它们身后。']]);g.save();}return;
    }
    if(id==='marsh_island'){if(!f.island){f.island=true;ui.toast('地精先行冲锋 · 优先打断女巫的疫歌召唤');}return;}
    if(id==='fog_gate'){if(f.totems.length<3)ui.prompt(`疫歌毒雾：摧毁图腾 ${f.totems.length}/3`);return;}
    if(id==='root_gate') {
      if(!f.butcher)return ui.prompt('树根门紧锁 · 需要磨坊屠夫的鹿角信物');
      await g.loadLevel('swamp');this.quest();return;
    }
    if(id==='swamp_return'){await g.loadLevel('forest');this.quest();return;}
    if(id==='stag_intro') {
      const boss=g.enemies.find(e=>e.type==='stag'&&e.alive);if(!boss||!boss.asleep||this._stagIntro)return;
      this._stagIntro=true;
      try {
      if(!f.bossTalk){await ui.say([['薇拉','荆冠鹿王……古树的守护者，已经被钟声撕成了另一种东西。'],['烬语者','让余烬替你安眠。']]);f.bossTalk=true;}
      boss.asleep=false;g.audio.setMood('plague_boss');ui.banner('荆冠鹿王','疫病之钟的守钟者');
      }finally{this._stagIntro=false;}return;
    }
    if(id==='plague_bell') {
      if(!f.bossDead||f.done)return ui.prompt(f.done?'疫病之钟已沉寂':'先击败荆冠鹿王');
      await this.counterRing('疫病之钟',2);f.done=true;f.stage='done';this.flags.tongues=2;
      await ui.say([['薇拉','两枚钟舌的铭文拼起来了……第三口，铁律之钟，在铁冠要塞。'],['薇拉','是谁在替灰冠之王敲钟？带着两枚钥舌去铁冠要塞，那里也许有答案。']]);
      ui.banner('第二集 · 腐林疫歌 完','下一集：铁冠叛旗');this.quest();g.save(true);return;
    }
    await super.onTrigger(id,t);
  }
  async counterRing(name,count) {
    const g=this.g,ui=g.ui,p=g.player.pos.clone();
    g.cinematic=true;
    try {
      g.audio.play('bell',p,1);g.gfx.addShake(1.3);g.fx.pillar(p,'holy',160,18);
      g.fx.ground(p,{tex:'magic1',color:[3,2.2,0.8],r0:1,r1:25,dur:2,spin:1});
      if(g.level.bellGlow)g.level.bellGlow.visible=false;g.level.bellSwing=0;
      g.level.emitters=g.level.emitters.filter(e=>e.kind!=='bellmist');
      await ui.say([['烬语者',`以${count===1?'缄默钥舌':count===2?'两枚钟舌':'三枚钟舌'}奏反鸣。亡者归土，余烬归火。`],['薇拉',`${name}，从此沉寂。七口钟中的这一口，不会再惊扰亡者。`]]);
    } finally {g.cinematic=false;}
    ui.toast('反鸣完成 · '+name);
  }
  onLevel(id) {
    super.onLevel(id);
    const g=this.g,f=this.second;
    // A freshly loaded living encounter replays its intro, repairing old prematurely saved talk flags.
    if(id==='crypt'&&!this.flags.bossDead)this.flags.bossTalk=false;
    if(id==='swamp'&&!f.bossDead)f.bossTalk=false;
    if(this.stage==='done' && !this.flags.counter1){this.flags.counter1=true;this.flags.tongues=1;}
    if(id==='crypt' && this.flags.bossDead)g.level.def.triggers.push({id:'silent_bell',x:16,z:4,r:4,label:'缄默之钟 · 反鸣'});
    if(id==='forest'){
      if(f.totems.length===3)g.level.openGate('plague_fog');
      if(f.butcher)g.level.openGate('roots');
    }
    if((id==='swamp'&&f.done)||(id==='crypt'&&this.flags.counter1)){
      g.level.bellSwing=0;if(g.level.bellGlow)g.level.bellGlow.visible=false;g.level.emitters=g.level.emitters.filter(e=>e.kind!=='bellmist');
    }
    if(this.stage==='done'||['forest','swamp'].includes(id))this.quest();
  }
  async onKill(e) {
    const g=this.g,f=this.second;
    if(e.tag?.startsWith('totem_')) {
      if(!f.totems.includes(e.tag))f.totems.push(e.tag);
      g.ui.toast(`疫歌图腾已摧毁 ${f.totems.length}/3`);
      if(f.totems.length===3){g.level.openGate('plague_fog');g.audio.play('e_roots');g.ui.banner('疫歌已断','毒雾消散 · 进入黑泽村');g.ui.toast('村口的毒雾消散了');}this.quest();g.save();return;
    }
    if(e.tag==='butcher'){f.butcher=true;g.level.openGate('roots');g.audio.setMood('forest');g.audio.play('e_roots');g.ui.banner('磨坊重归寂静','获得鹿角信物 · 北面的树根门已开放');g.ui.toast('获得：鹿角信物');g.player.gainXp(200);this.quest();g.save();return;}
    if(e.tag==='stag'){
      f.bossDead=true;for(const o of g.enemies)if(o.alive&&o.tag==='summon')o.takeDamage(99999);
      g.ui.toast('获得：疫病钥舌 · 靠近古树大钟完成反鸣');this.quest();g.audio.setMood('swamp');g.save();return;
    }
    await super.onKill(e);
    if(e.tag==='boss'){g.level.def.triggers.push({id:'silent_bell',x:16,z:4,r:4,label:'缄默之钟 · 反鸣'});g.ui.setQuest('反鸣仪式','靠近祭坛的大钟，用<b>缄默钥舌</b>完成反鸣，再返回营地。');g.save();}
  }
  async _ending() {
    await super._ending();
    this.quest();
    this.g.ui.banner('北行驿道已开放','跟随金色路标 · 第二集《腐林疫歌》');
    this.g.ui.toast('画面中的金色箭头会引导你前往当前任务目标');
  }
  guidance() {
    const g=this.g,f=this.second,id=g.level.id;
    const at=(x,z,label)=>({x:x*4+2,z:z*4+2,label});
    if(id==='crypt'&&this.flags.bossDead)return this.flags.counter1?at(16,9,'余烬之门 · 返回营地'):at(16,4,'缄默之钟 · 完成反鸣');
    if(id==='camp'){
      if(this.stage==='epilogue')return at(12,20,'向罗兰复命');
      if(this.stage==='done')return at(19,16,'北行驿道 · 第二集');
    }
    if(id==='forest'){
      if(!f.messenger)return at(21,48,'翻倒马车 · 寻找信使');
      if(f.totems.length<3){const targets=[[7,34],[19,36],[31,34]].map(([x,z],i)=>({...at(x,z,'疫歌图腾 · '+(i+1)),i})).filter(t=>!f.totems.includes('totem_'+t.i));return targets.sort((a,b)=>Math.hypot(a.x-g.player.pos.x,a.z-g.player.pos.z)-Math.hypot(b.x-g.player.pos.x,b.z-g.player.pos.z))[0];}
      if(!f.hunter)return at(12,18,'教堂避难所 · 猎人哈罗德');
      if(!f.butcher)return at(25,9,'磨坊屠场 · 缝合屠夫');
      return at(19,4,'树根门 · 前往腐沼');
    }
    if(id==='swamp')return f.done?at(8,4,'归途 · 返回营地'):f.bossDead?at(17,4,'疫病之钟 · 完成反鸣'):at(23,15,'古树祭坛 · 荆冠鹿王');
    return null;
  }
  quest() {
    const g=this.g,f=this.second;
    if(g.level.id==='swamp'&&!f.done)return g.ui.setQuest('疫病之钟',f.bossDead?'靠近古树下的<b>疫病之钟</b>，用两枚钟舌敲出反鸣。':'击败<b>荆冠鹿王</b>。留意地面预警，保存位移穿越钟波。');
    if(g.level.id==='camp'&&f.started&&!f.done)return g.ui.setQuest('北行 · 腐林疫歌','从营地东北侧的<b>北行驿道</b>继续旅程。可先在营地补给、强化装备。');
    if(!f.started)return g.ui.setQuest('北方的钟声','营地东北侧的<b>北行驿道</b>已开放。可继续探索或找布拉姆强化装备。');
    g.ui.setQuest(f.done?'第二集 完 · 铁冠叛旗':'腐林疫歌',f.done?'疫病之钟已沉寂。下一站：<b>铁冠要塞</b>。可从祭坛西侧返回营地。':!f.messenger?'沿灰须林驿道北上，在翻倒的马车旁寻找<b>信使</b>。':f.totems.length<3?`摧毁三座<b>疫歌图腾</b>，驱散村口毒雾。（${f.totems.length}/3）`:!f.hunter?'进入黑泽村，向教堂旁的<b>猎人哈罗德</b>询问情况。':!f.butcher?'前往村庄东北侧磨坊，击败<b>缝合屠夫</b>，取得鹿角信物。':!f.bossDead?'穿过北面的树根门，在腐沼祭坛击败<b>荆冠鹿王</b>。':'靠近古树下的<b>疫病之钟</b>，用两枚钟舌敲出反鸣。');
  }
}
