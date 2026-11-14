/**
 * 第一集《午夜钟声》的剧情脚本。
 * 以后新增剧集：照此写一个新的类（onStart / onTalk / onTrigger / onKill / onLevel），
 * 在 main.js 里把 game.story 换成新的剧集即可；地图在 maps.js 里添加。
 */
const ME = '烬语者';
const ROLAND = '罗兰';
const BRAM = '布拉姆';
const VERA = '兜帽旅人';
const MORDAN = '莫尔丹';

export class Episode1 {
  constructor(game) {
    this.g = game;
    this.stage = 'intro';
    this.flags = {};
  }

  async onStart() {
    const g = this.g;
    g.audio.setMood('none');
    g.audio.play('bell');
    setTimeout(() => g.audio.play('bell'), 2600);
    await g.ui.story([
      '灰烬纪元 · 第三百一十二年。',
      '霜暮镇的教堂里，悬着一口没有钟舌的钟。',
      '人们叫它「缄默之钟」——它沉默一日，墓中的亡者便安眠一日。',
      '七天前的午夜，它响了。',
      '!而你，是最后一个还听得懂火焰低语的人。',
    ]);
    g.audio.setMood('camp');
    await g.ui.fade(false);
    g.ui.banner('霜暮营地', '第一集 · 午夜钟声');
    this.stage = 'talk_roland';
    g.ui.setQuest('午夜钟声', '与守夜人队长 <b>罗兰</b> 交谈。');
    g.markNpc('roland', true);
  }

  // ------------------------------------------------------------ conversations
  async onTalk(id) {
    const g = this.g, ui = g.ui, pl = g.player;
    if (id === 'roland') {
      if (this.stage === 'talk_roland') {
        await ui.say([
          [ROLAND, `站住。……${g.player.C.weaponWord}上还带着余烬。你就是信里说的那位烬语者？`],
          [ME, '火告诉我，这里有东西醒了。'],
          [ROLAND, '何止是醒了。七个晚上，缄默之钟每到午夜就自己响起来——一口没有钟舌的钟。'],
          [ROLAND, '老人说，它是七时之钟的第一口。七口钟与灰冠之王的封印有关。'],
          [ROLAND, '钟一响，墓园里的土就开始翻动。我带来的二十个守夜人，现在只剩篝火边这几个。'],
          [ME, '钟在哪里？'],
          [ROLAND, '在墓穴最深处的祭坛上。看守它的人叫莫尔丹，是个老守墓人。第一夜之后，他就再没上来过。'],
          [ROLAND, '先去找布拉姆领些药剂。墓园的铁门，我会让人为你打开。'],
        ]);
        this.stage = 'prepare';
        g.markNpc('roland', false); g.markNpc('bram', true);
        ui.setQuest('备战', '向铁匠 <b>布拉姆</b> 领取补给。<br>（营地西侧的长桌旁）');
      } else if (this.stage === 'epilogue') {
        await this._ending();
      } else if (this.stage === 'done') {
        await ui.say([[ROLAND, '北行的路不好走。等你准备好了，我们在灰冠城的界碑见。']]);
      } else {
        await ui.say([[ROLAND, pl.level < 2 ? '墓园就在北边的铁门后面。别让它们围住你。' : '愿余烬为你照路，法师。']]);
      }
    } else if (id === 'bram') {
      if (this.stage === 'prepare') {
        await ui.say([
          [BRAM, `哈，活的${g.player.C.name}！我还以为烬语者早就死绝了。`],
          [BRAM, '拿着。红的止血，蓝的醒神。别问是拿什么熬的。'],
          [ME, '……闻起来像烧焦的靴子。'],
          [BRAM, '那就对了。还有一句忠告：那些行尸不怕疼，只怕站不起来。先冻住，再烧。'],
        ]);
        pl.potions.hp += 3; pl.potions.mp += 2;
        g.audio.play('pickup');
        ui.toast('获得：生命药水 ×3、法力药水 ×2');
        this.stage = 'graveyard';
        g.markNpc('bram', false);
        g.level.openGate('graveyard');
        ui.setQuest('踏入墓园', '穿过北面的铁门，清理墓园，<br>找到<b>墓穴入口</b>。<br><small>（布拉姆和艾琳可以买卖装备与药剂）</small>');
        ui.toast('墓园的铁门打开了');
        g.save();
      } else if (this.stage === 'talk_roland') {
        await ui.say([[BRAM, '先去见罗兰队长。他点头了，我的铺子才对你开张。']]);
      } else {
        if (!this.flags.bramShop) { this.flags.bramShop = true; await ui.say([[BRAM, '看看吧。都是好铁打的。真正的好东西？那得去墓里那些死人身上扒。']]); }
        ui.openShop('smith');
      }
    } else if (id === 'vera') {
      if (this.stage === 'done') {
        await ui.say([['薇拉', '收拾好行囊，烬语者。灰冠城的钟，可不止一口。']]);
      } else if (!this.flags.vera) {
        this.flags.vera = true;
        await ui.say([
          [VERA, '你闻到了吗？不是腐土的味道。是铜锈。'],
          [ME, '你是谁？'],
          [VERA, '一个路过的人。只是提醒你——钟不会自己响。'],
          [VERA, '有人拿走了不该拿的东西，又放回了不该放的东西。到了祭坛，看仔细些。'],
        ]);
      } else {
        await ui.say([[VERA, '去吧。我在这儿烤火，顺便替你数数钟声。']]);
      }
    } else if (id === 'elin') {
      if (!this.flags.elin) {
        this.flags.elin = true;
        await ui.say([
          ['艾琳', '别靠太近，我刚熬好一锅。……你是新来的？'],
          ['艾琳', '红的止血，另一种能让你缓过劲来。拿金币来换，墓园里那些东西身上总能摸到几枚。'],
        ]);
      }
      ui.openShop('apothecary');
    } else if (id === 'journal') {
      await ui.say([
        ['守墓人的日记', '「第一夜。钟响了。我检查过，钟腔里空无一物。可它确实响了。」'],
        ['守墓人的日记', '「第三夜。我听清了，那不是钟声，是有人在钟里说话。他说北方的灰冠之下，还有六口这样的钟。」'],
        ['守墓人的日记', '「第五夜。他给了我一截新的钟舌。骨头做的。我把祭坛的钥匙交给了哈肯——他死了三十年，比活人可靠。」'],
        ['守墓人的日记', '「第六夜。我不再觉得冷了。」'],
        [ME, '……骨头做的钟舌。钥匙在一个叫哈肯的亡者身上。'],
      ]);
      if (!this.flags.journal) { this.flags.journal = true; g.player.gainXp(40); ui.toast('线索：祭坛的钥匙在骨卫队长哈肯身上'); }
    }
  }

  // ------------------------------------------------------------ world triggers
  async onTrigger(id, t) {
    const g = this.g, ui = g.ui;
    if (id === 'graveyard_enter' && !this.flags.gy) {
      this.flags.gy = true;
      ui.toast('泥土在脚下翻动……');
      g.audio.play('bell', null, 0.5);
    } else if (id === 'crypt_door') {
      if (this.stage === 'epilogue') return ui.prompt('先回去向罗兰复命');
      if (this.stage !== 'graveyard' && this.stage !== 'crypt' && this.stage !== 'done') return;
      if (this.stage === 'graveyard') this.stage = 'crypt';
      await g.loadLevel('crypt');
    } else if (id === 'crypt_enter' && !this.flags.ce) {
      this.flags.ce = true;
      g.checkpoint = g.level.center(16, 50);
      await ui.say([[ME, '铜锈的味道……比上面浓得多。钟声是从更深的地方传来的。']]);
      ui.setQuest('缄默墓穴', '深入墓穴，找到<b>祭坛</b>与缄默之钟。');
    } else if (id === 'gate_altar') {
      const gate = g.level.gates.altar;
      if (gate.open) return;
      if (this.flags.key) {
        g.level.openGate('altar');
        ui.toast('祭坛的铁门缓缓沉入地下');
        g.checkpoint = g.level.center(16, 18);
        ui.setQuest('缄默之钟', '进入祭坛大厅。');
      } else {
        ui.prompt('铁门紧锁——需要祭坛钥匙');
        if (!this.flags.gateSeen) { this.flags.gateSeen = true; ui.setQuest('紧锁的铁门', '祭坛的铁门需要钥匙。<br>在墓穴中找到持有钥匙的<b>骨卫队长</b>。'); }
      }
    } else if (id === 'boss_intro') {
      const boss = g.enemies.find((e) => e.T.boss && e.alive);
      if (!boss || !boss.asleep || this._bossIntro) return;
      this._bossIntro=true;
      try {
      if (!this.flags.bossTalk) {
        g.audio.play('bell');
        g.gfx.addShake(0.5);
        await ui.say([
          [MORDAN, '嘘——。你听。它在唱歌。'],
          [ME, '莫尔丹。把那截骨头从钟里取出来。'],
          [MORDAN, '取出来？我守了这口哑钟四十年，四十年里没有一个亡者对我说过一句话。'],
          [MORDAN, '现在它们都在回答我。每一个。'],
          [ME, '回答你的不是它们。'],
          [MORDAN, '……那就让你也留下来，亲耳听个明白。'],
        ]);
        this.flags.bossTalk=true;
        ui.setQuest('缄默守墓人', '击败 <b>莫尔丹</b>。');
      }
      boss.asleep = false;
      g.audio.play('roar', boss.pos);
      g.audio.setMood('boss');
      boss.bossT=1.2;boss.state='chase';
      ui.banner('莫尔丹', '缄默守墓人');
      } finally {this._bossIntro=false;}
    } else if (id === 'portal') {
      if (this.stage !== 'done') this.stage = 'epilogue';
      await g.loadLevel('camp');
    }
  }

  onTriggerLeave() { this.g.ui.prompt(null); }

  // ------------------------------------------------------------ kills
  async onKill(e) {
    const g = this.g, ui = g.ui;
    if (e.tag === 'graveyard' && !g.enemies.some((o) => o.alive && o.tag === 'graveyard')) {
      ui.toast('墓园暂时安静了');
      ui.setQuest('踏入墓园', '从墓园北端的拱门<b>进入墓穴</b>。');
    }
    if (e.tag === 'elite') {
      this.flags.key = true;
      g.audio.play('pickup');
      ui.toast('获得：祭坛钥匙');
      ui.setQuest('缄默之钟', '用钥匙打开北面的<b>祭坛铁门</b>。');
    }
    if (e.tag === 'boss') {
      this.flags.bossDead = true;
      g.audio.setMood('crypt');
      for (const o of g.enemies) if (o.alive && o.tag === 'summon') o.takeDamage(9999);
      g.slowMo(2.2, 0.25);
      g.fx.explode(e.pos, 9, 'dark', 2.5);
      g.audio.play('meteorhit', e.pos, 0.8);
      const lv = g.level;
      lv.bellSwing = 0;
      if (lv.bellGlow) lv.bellGlow.visible = false;
      lv.emitters = lv.emitters.filter((m) => m.kind !== 'bellmist');
      await g.wait(2.6);
      await ui.say([
        [MORDAN, '……安静了。怎么……这么安静……'],
        [MORDAN, '他说过……七口钟一齐响的那天……灰冠之王就会……睁开眼睛……'],
        [ME, '他是谁？'],
        [MORDAN, '……北边。跟着铜锈走……'],
        [ME, '（钟腔里落下一截发黑的骨片，上面刻着不属于任何教会的纹章。）'],
      ]);
      g.audio.play('pickup');
      ui.toast('获得：缄默钥舌');
      const p = lv.center(16, 9);
      lv.emitters.push({ kind: 'portal', x: p.x, y: 0.2, z: p.z, color: null, acc: 0 });
      lv.def.triggers.push({ id: 'portal', x: 16, z: 9, r: 2.2, label: '返回营地' });
      g.fx.pillar(p, 'holy', 100, 9);
      g.torchAt(p.x, 3, p.z, 0xffc070, 160);
      ui.setQuest('归途', '穿过余烬之门，<b>返回营地</b>向罗兰复命。');
    }
  }

  onLevel(id) {
    const g = this.g;
    if (id === 'crypt' && this.flags.bossDead) {
      const lv = g.level;
      lv.bellSwing = 0; if (lv.bellGlow) lv.bellGlow.visible = false;
      lv.emitters = lv.emitters.filter((m) => m.kind !== 'bellmist');
      const p = lv.center(16, 9);
      lv.emitters.push({ kind: 'portal', x: p.x, y: 0.2, z: p.z, color: null, acc: 0 });
      lv.def.triggers.push({ id: 'portal', x: 16, z: 9, r: 2.2, label: '返回营地' });
      g.torchAt(p.x, 3, p.z, 0xffc070, 160);
    }
    if (id === 'crypt' && this.flags.key) g.level.openGate('altar');
    if (id === 'camp' && this.stage === 'epilogue') {
      g.level.openGate('graveyard');
      g.ui.setQuest('归途', '向 <b>罗兰</b> 复命。');
      g.markNpc('roland', true);
    }
    if (id === 'camp' && this.stage !== 'intro' && this.stage !== 'talk_roland' && this.stage !== 'prepare') g.level.openGate('graveyard');
  }

  async _ending() {
    const g = this.g, ui = g.ui;
    g.markNpc('roland', false);
    await ui.say([
      [ROLAND, '钟停了。整整一个时辰，墓园里没有一块土在动。……你做到了。'],
      [ME, '莫尔丹只是敲钟的人。有人给了他这个。'],
      [ROLAND, '骨头做的钟舌？这纹章……我没见过。'],
      ['薇拉', '我见过。'],
      [ROLAND, '你——你不是那个烤火的旅人吗？'],
      ['薇拉', '拾钟人，薇拉。我追这枚纹章追了两年。它属于灰冠城，属于一个本该死了三百年的王。'],
      ['薇拉', '这样的钟一共七口。霜暮只是第一口，也是最小的一口。'],
      [ME, '莫尔丹说，七口钟一齐响的那天，他会睁开眼睛。'],
      ['薇拉', '所以我们得赶在那之前。烬语者，北边的路，愿意同行吗？'],
      [ME, '……火说，可以。'],
    ]);
    await ui.fade(true);
    g.audio.setMood('none');
    g.audio.play('bell');
    await ui.story(['远处，北方的地平线上，', '传来了第二声钟响。', '!第一集 · 午夜钟声　完', '北行驿道已开放 —— 第二集《腐林疫歌》']);
    this.stage = 'done';
    g.audio.setMood('camp');
    ui.setQuest('北方的钟声', '前往营地东北侧的<b>北行驿道</b>，进入第二集《腐林疫歌》。');
    await ui.fade(false);
    g.save(true);
  }
}
