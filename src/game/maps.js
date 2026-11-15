/**
 * Level definitions. Maps are carved on a grid (1 cell = 4 world units). North is -z (top of screen is north-west).
 * To add a new level: write a function returning carve(...) output and register it in LEVELS.
 */
function carve(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill('#'));
  const d = {
    w, h, g,
    spawns: [], torches: [], props: [], npcs: [], triggers: [], chests: [], gates: [], solids: [], start: { x: 1, z: 1 },
    room(x0, z0, x1, z1, ch = '.') { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z][x] = ch; return d; },
    /** solid decoration occupying a whole cell */
    block(x, z, prop, opts = {}) { d.solids.push([x, z]); d.props.push({ x, z, prop, ...opts }); return d; },
    /** non-blocking decoration; ox/oz offsets in world units from the cell centre */
    deco(x, z, prop, opts = {}) { d.props.push({ x, z, prop, ...opts }); return d; },
    torch(x, z, side = 'N', color = 0xff8a3c) { d.torches.push({ x, z, side, color }); return d; },
    spawn(type, x, z, opts = {}) { d.spawns.push({ type, x, z, ...opts }); return d; },
    npc(id, x, z, opts = {}) { d.npcs.push({ id, x, z, ...opts }); return d; },
    trigger(id, x, z, opts = {}) { d.triggers.push({ id, x, z, r: 3, ...opts }); return d; },
    chest(x, z, opts = {}) { d.chests.push({ x, z, ...opts }); return d; },
    gate(id, x, z) { d.gates.push({ id, x, z }); return d; },
  };
  return d;
}

// ------------------------------------------------------------------ 霜暮营地
function camp() {
  const d = carve(25, 30);
  // camp courtyard
  d.room(5, 19, 19, 26, ',');
  d.room(7, 27, 17, 27, ',');
  // passage and gate to the graveyard
  d.room(11, 16, 13, 18, ',');
  d.gate('graveyard', 12, 17);
  d.g[17][11] = '#'; d.g[17][13] = '#';
  // graveyard
  d.room(4, 5, 20, 15, ';');
  d.room(6, 4, 18, 4, ';');
  d.room(11, 14, 13, 15, ',');
  // crypt porch
  d.room(11, 2, 13, 3, '.');
  d.start = { x: 12, z: 25 };
  d.room(18,16,20,18,',').room(18,18,18,19,',');
  d.trigger('north_road',19,16,{r:3,label:'北行驿道 · 第二集'});
  d.room(1,23,4,25,',');d.trigger('salt_road',1,24,{r:3,label:'西行盐道 · 第四集'});
  d.room(20,20,23,22,',');d.trigger('iron_road',23,21,{r:3,label:'东行山道 · 第三集'});

  d.torch(7, 19).torch(17, 19).torch(5, 23, 'W').torch(11, 18, 'W').torch(11, 2, 'W', 0x58d0a8).torch(13, 2, 'N', 0x58d0a8).torch(11, 2, 'N', 0x58d0a8);
  d.block(5, 19, 'crates_stacked').block(19, 19, 'barrel_large').block(5, 26, 'keg').block(19, 26, 'crates_stacked', { rot: 1.2 });
  d.block(6, 21, 'table_long_decorated_A').deco(6, 22, 'barrel_small_stack', { ox: -0.8 }).deco(18, 20, 'box_large', { ox: 0.6, oz: -0.8, rot: 0.4 });
  d.deco(17, 23, 'bed_floor', { rot: 0.3 }).deco(18, 24, 'bed_floor', { rot: -0.5, ox: 0.5 }).deco(9, 19, 'banner_shield_red', { oz: -2.0 }).deco(15, 19, 'banner_shield_red', { oz: -2.0 });
  d.deco(16, 21, 'sword_shield', { ox: 1, oy: 0.9, rot: 0.3 });
  d.props.push({ x: 12, z: 22, prop: '@campfire' });
  d.solids.push([12, 22]);

  d.npc('roland', 12, 20, { model: 'roland', name: '守夜人队长 · 罗兰', face: Math.PI * 0.1 });
  d.npc('bram', 7, 22, { model: 'bram', name: '铁匠 · 布拉姆', face: Math.PI * 0.5 });
  d.npc('vera', 17, 25, { model: 'vera', name: '兜帽旅人', face: -Math.PI * 0.6 });
  d.npc('elin', 16, 21, { model: 'elin', name: '药剂师 · 艾琳', face: -Math.PI * 0.3 });
  d.deco(16, 20, 'cabinet', { oz: -1.4, ox: 0.6 }).deco(15, 21, 'lamp', { ox: 0.6, oz: -0.8 }).deco(8, 24, 'lantern', { ox: -1 }).deco(17, 26, 'lantern', { ox: 1, oz: 1 });
  d.deco(10, 25, 'log', { rot: 0.5, oy: 0.2, ox: -1 }).deco(19, 22, 'boulder', { rot: 1 }).deco(5, 24, 'boulder', { rot: 2.2, ox: -0.8 });

  // graveyard dressing: headstones and dead trees (procedural, solid)
  const stones = [[6, 6], [9, 7], [15, 6], [18, 8], [7, 10], [10, 12], [14, 10], [17, 13], [5, 13], [12, 8], [19, 11], [8, 14], [16, 14]];
  for (const [x, z] of stones) d.block(x, z, '@grave');
  for (const [x, z] of [[4, 5], [20, 5], [4, 15], [20, 15], [13, 13], [7, 8]]) d.block(x, z, '@tree');
  d.deco(11, 6, 'rubble_half', { rot: 0.4 }).deco(16, 11, 'column', { ox: 1 }).deco(6, 12, 'column', { oz: 1.2, rot: 1 });
  d.deco(18, 10, 'log', { rot: 2.1, oy: 0.2 }).deco(9, 13, 'boulder', { rot: 0.7, ox: 1 }).deco(14, 5, 'stump', { ox: 1 }).deco(5, 9, 'boulder', { rot: 3.1 });
  d.block(8, 4, 'statue', { rot: Math.PI, oz: 0.4 }).block(16, 4, 'statue', { rot: Math.PI, oz: 0.4 });

  for (const [x, z] of [[9, 10], [15, 9], [12, 6], [8, 6], [16, 7]]) d.spawn('minion', x, z, { dormant: true, tag: 'graveyard' });

  d.trigger('graveyard_enter', 12, 15, { r: 4 });
  d.trigger('crypt_door', 12, 2, { r: 2.6, label: '进入墓穴' });
  d.props.push({ x: 12, z: 2, prop: '@cryptdoor' });
  return {
    id: 'camp', name: '霜暮营地', sub: '守夜人最后的篝火', floor: 'dirt', audio: 'camp', def: d,
    mood: { bg: 0x070a12, fog: 0.014, hemi: [0x6a80b8, 0x241c16, 1.05], key: [0x9ab2ea, 1.9], exposure: 1.3, playerLight: 22 },
  };
}

// ------------------------------------------------------------------ 缄默墓穴
function crypt() {
  const d = carve(33, 54);
  d.room(13, 48, 19, 51);                 // entry
  d.room(15, 44, 17, 47);
  d.room(10, 36, 22, 43);                 // hall of the sleepers
  d.room(15, 33, 17, 35);
  d.room(4, 31, 28, 32);                  // cross passage
  d.room(3, 25, 8, 30);                   // west ossuary
  d.room(24, 25, 29, 30);                 // east archive
  d.room(15, 27, 17, 30);
  d.room(11, 19, 21, 26);                 // guard hall
  d.room(15, 17, 17, 18);
  d.g[16][16] = '.';                      // gate cell
  d.gate('altar', 16, 16);
  d.room(15, 13, 17, 15);
  d.room(10, 2, 22, 12, ':');             // altar of the silent bell
  d.start = { x: 16, z: 50 };

  // light
  d.torch(14, 48).torch(13, 49, 'W').torch(15, 45, 'W');
  d.torch(11, 36).torch(14, 36).torch(21, 36).torch(10, 39, 'W').torch(10, 42, 'W');
  d.torch(10, 31).torch(12, 31).torch(20, 31).torch(22, 31).torch(15, 28, 'W');
  d.torch(4, 25).torch(7, 25).torch(25, 25, 'N', 0x6ab0ff).torch(28, 25, 'N', 0x6ab0ff);
  d.torch(12, 19).torch(20, 19).torch(11, 22, 'W').torch(11, 25, 'W');
  d.torch(11, 2, 'N', 0xcdb8ff).torch(14, 2, 'N', 0xcdb8ff).torch(18, 2, 'N', 0xcdb8ff).torch(21, 2, 'N', 0xcdb8ff).torch(10, 5, 'W', 0xcdb8ff).torch(10, 9, 'W', 0xcdb8ff);
  d.torch(15, 14, 'W', 0xcdb8ff).torch(15, 17, 'W');

  // structure and dressing
  for (const [x, z] of [[12, 38], [20, 38], [12, 41], [20, 41]]) d.block(x, z, 'pillar');
  for (const [x, z] of [[13, 21], [19, 21], [13, 24], [19, 24]]) d.block(x, z, 'pillar_decorated');
  for (const [x, z] of [[12, 5], [20, 5], [12, 10], [20, 10]]) d.block(x, z, 'pillar');
  d.block(13, 51, 'crates_stacked').block(19, 48, 'barrel_large').deco(18, 51, 'rubble_half', { rot: 2.2, s: 0.5 });
  d.block(10, 43, 'barrel_small_stack').block(22, 36, 'crates_stacked', { rot: 0.8 }).deco(21, 43, 'rubble_half', { rot: 3.4, s: 0.6 });
  d.block(3, 30, 'keg').block(8, 25, 'barrel_large').deco(5, 28, 'coin_stack_small').deco(6, 26, 'candle_triple', { ox: 1 });
  d.block(29, 30, 'crates_stacked').block(24, 30, 'trunk_large_A').deco(27, 28, 'candle_triple').deco(26, 26, 'candle_triple', { ox: -1 });
  d.block(28, 26, 'table_long_decorated_A', { rot: Math.PI / 2 });
  d.deco(13, 19, 'banner_patternA_red', { oz: -2.0 }).deco(19, 19, 'banner_patternA_red', { oz: -2.0 }).deco(16, 19, 'sword_shield', { oz: -1.6, oy: 2.4 });
  d.deco(14, 2, 'banner_patternA_red', { oz: -2.0, ox: 2 }).deco(18, 2, 'banner_patternA_red', { oz: -2.0, ox: -2 });
  d.block(10, 2, 'statue', { rot: Math.PI * 0.75, ox: 0.6, oz: 0.6 }).block(22, 2, 'statue', { rot: -Math.PI * 0.75, ox: -0.6, oz: 0.6 });
  d.deco(15, 2, 'lamp', { oz: -1 }).deco(17, 2, 'lamp', { oz: -1 }).deco(24, 25, 'cabinet', { oz: -1.2 }).deco(3, 25, 'cabinet', { oz: -1.2, ox: 0.4 });
  d.deco(14, 30, 'rubble_half', { rot: 1.1 }).deco(22, 40, 'boulder', { rot: 2, ox: -0.5 }).deco(11, 50, 'lamp', { oz: -1 });
  d.props.push({ x: 16, z: 3, prop: '@bell' });
  d.solids.push([16, 3]);

  // inhabitants
  for (const [x, z] of [[16, 46]]) d.spawn('minion', x, z, { dormant: true });
  for (const [x, z] of [[13, 40], [19, 39], [16, 38], [14, 37], [18, 42]]) d.spawn('minion', x, z, { dormant: true });
  d.spawn('warrior', 16, 40, { dormant: true }).spawn('warrior', 11, 37, { dormant: true });
  d.spawn('rogue', 21, 37);
  d.spawn('minion', 9, 31, { dormant: true }).spawn('minion', 23, 32, { dormant: true }).spawn('rogue', 5, 31).spawn('rogue', 27, 32);
  d.spawn('minion', 5, 27, { dormant: true }).spawn('minion', 6, 29, { dormant: true }).spawn('warrior', 4, 28, { dormant: true }).spawn('mage', 7, 26);
  d.spawn('mage', 26, 27).spawn('warrior', 25, 29, { dormant: true }).spawn('minion', 28, 28, { dormant: true }).spawn('rogue', 25, 26);
  d.spawn('elite', 16, 21, { tag: 'elite' }).spawn('warrior', 13, 23).spawn('warrior', 19, 23).spawn('rogue', 12, 20).spawn('rogue', 20, 20).spawn('mage', 16, 19);
  d.spawn('boss', 16, 5, { tag: 'boss', asleep: true });

  d.chest(4, 26, { gold: 60, potions: ['hp', 'mp'] });
  d.chest(21, 26, { gold: 45, potions: ['hp'] });
  d.chest(11, 12, { gold: 120, potions: ['hp', 'mp'], golden: true, rot: Math.PI / 2 });
  d.npc('journal', 27, 26, { prop: '@journal', name: '守墓人的日记' });

  d.trigger('crypt_enter', 16, 47, { r: 4 });
  d.trigger('hall1', 16, 43, { r: 4 });
  d.trigger('gate_altar', 16, 17, { r: 3.2, label: '祭坛铁门' });
  d.trigger('boss_intro', 16, 11, { bounds:[10,2,22,12] });
  return {
    id: 'crypt', name: '缄默墓穴', sub: '钟声自地底而来', floor: 'tile', audio: 'crypt', def: d,
    mood: { bg: 0x030305, fog: 0.02, hemi: [0x56608a, 0x1d1612, 0.95], key: [0x8a9ad0, 1.1], exposure: 1.4, playerLight: 40 },
  };
}

function forest() {
  const d=carve(39,66);
  // Road, ruined coaching inn, then three connected but separate ritual groves.
  d.room(17,54,21,63,',').room(14,48,24,53,';').room(17,42,21,47,',');
  d.room(16,29,22,41,';').room(5,32,15,37,';').room(23,32,33,37,';');
  d.room(18,25,20,28,',').room(8,5,30,24,';');
  // The village streets use earth; the church and mill have their own stone courtyards.
  d.room(18,5,20,24,',').room(10,17,28,20,',').room(10,16,14,19,'.').room(23,7,28,11,'.');
  d.g[26][18]='#';d.g[26][20]='#';d.gate('plague_fog',19,26);
  d.room(17,2,21,4,',');d.gate('roots',19,3);for(const x of [17,18,20,21])d.g[3][x]='#';
  d.start={x:19,z:61};
  d.trigger('forest_return',19,63,{r:2.5,label:'返回霜暮营地'});
  d.trigger('forest_intro',19,57,{r:5});d.trigger('fog_gate',19,28,{r:4});
  d.trigger('village_intro',19,24,{bounds:[8,17,30,24]});
  d.trigger('mill_intro',24,12,{bounds:[22,7,29,13]});
  d.trigger('root_gate',19,4,{r:3,label:'树根门 · 腐沼祭坛'});
  d.npc('messenger',21,48,{model:'warrior',name:'垂死的信使'});
  d.npc('harold',12,18,{model:'roland',name:'猎人 · 哈罗德'});
  d.npc('forest_vera',18,60,{model:'vera',name:'拾钟人 · 薇拉'});
  for(const [i,x,z] of [[0,7,34],[1,19,36],[2,31,34]]){
    d.spawn('totem',x,z,{tag:'totem_'+i,level:7});
    d.spawn('witch',x,z-2,{level:7});
    for(let j=0;j<3;j++)d.spawn('goblin',x+(j%2)*2-1,z+2+Math.floor(j/2),{level:6});
    d.deco(x,z,'@ritual');
  }
  // Small patrols teach the poison left by villagers before the denser grove fights.
  for(const [x,z]of [[18,55],[20,54],[17,52],[22,51],[18,49],[20,47],[19,45],[18,43],[20,42]])d.spawn('villager',x,z,{level:6});
  for(const [x,z]of [[15,22],[24,21],[27,18],[17,15],[21,13],[15,10],[22,8]])d.spawn('villager',x,z,{level:8});
  d.spawn('werewolf',28,14,{level:8}).spawn('werewolf',12,8,{level:8});
  d.spawn('witch',29,19,{level:8});
  d.spawn('butcher',25,9,{tag:'butcher',level:9});
  d.deco(22,49,'@wagon',{rot:0.5}).deco(15,51,'@ruin').deco(24,52,'@ruin');
  // Broken houses frame the main street; the surviving church is a warm refuge.
  for(const [x,z]of [[10,22],[28,22],[10,11],[29,6]])d.block(x,z,'@house').deco(x+1,z+1,'crates_stacked');
  d.block(10,17,'@church');d.block(28,9,'@mill');d.block(22,19,'@well');
  d.deco(12,17,'lantern').deco(13,18,'table_long_decorated_A');
  d.deco(26,10,'@butchery').deco(26,8,'@butchery',{rot:1.2});
  for(const [x,z]of [[14,51],[24,51],[5,32],[33,32],[8,23],[30,7],[21,44],[16,55],[9,36],[29,36],[16,31],[22,31],[16,39],[22,39],[5,37],[9,37],[29,37],[33,37]])d.block(x,z,'@tree');
  for(const [x,z]of [[17,58],[21,54],[10,32],[28,32],[12,17],[25,11]])d.torch(x,z,'N',0xa1b675);
  d.deco(16,37,'log',{rot:0.5,s:0.8}).deco(24,35,'log',{rot:-0.8,s:0.7}).deco(20,40,'stump',{s:0.7});
  d.deco(18,59,'@sign',{text:'黑泽村',rot:0.15}).deco(19,29,'@sign',{text:'三处疫歌图腾'});
  d.chest(14,48,{gold:130,potions:['hp','mp']}).chest(28,18,{gold:200,potions:['hp'],golden:true});
  return {id:'forest',name:'灰须林 · 黑泽村',sub:'第二集 · 腐林疫歌',floor:'dirt',audio:'forest',def:d,
    mood:{bg:0x101a1c,fog:0.009,hemi:[0x91a6a5,0x25271b,1.25],key:[0xb2c5c5,1.8],exposure:1.3,playerLight:25}};
}
function swamp() {
  const d=carve(35,56);
  // Stone causeways wind around black water; combat islands give room to dodge.
  d.room(15,47,19,53,'.').room(16,39,18,46,'.').room(8,33,26,38,'~');
  d.room(8,25,11,32,'.').room(10,23,24,26,'~').room(22,16,25,22,'.');
  d.room(7,2,28,15,':');d.start={x:17,z:51};
  d.trigger('swamp_return',17,53,{r:2.5,label:'返回黑泽村'});
  d.trigger('swamp_intro',17,46,{r:5});
  d.trigger('marsh_island',17,38,{bounds:[8,33,26,38]});
  d.trigger('stag_intro',23,15,{bounds:[7,2,28,15]});d.trigger('plague_bell',17,4,{r:3,label:'疫病之钟 · 反鸣'});
  d.trigger('swamp_camp',8,4,{r:2.5,label:'返回霜暮营地'});
  d.trigger('iron_road',26,4,{r:3,label:'东行山道 · 铁冠叛旗'});
  d.spawn('werewolf',10,30,{level:9}).spawn('werewolf',10,27,{level:9}).spawn('werewolf',23,20,{level:9});
  d.spawn('witch',18,24,{level:9}).spawn('witch',24,34,{level:9});
  for(const [x,z]of [[12,35],[13,36],[14,34],[21,36],[22,35],[23,36],[12,24],[14,25]])d.spawn('goblin',x,z,{level:8});
  d.spawn('stag',17,8,{tag:'stag',level:10,asleep:true});
  d.props.push({x:17,z:2,prop:'@tree',s:4},{x:17,z:3,prop:'@bell'});d.solids.push([17,2],[17,3]);
  for(const [x,z]of [[8,34],[26,37],[10,25],[24,25],[8,13],[27,12]])d.deco(x,z,'@roots');
  for(const [x,z]of [[15,46],[19,40],[8,33],[11,26],[23,20],[9,12],[26,5]])d.torch(x,z,'N',0x93b5a0);
  d.deco(16,49,'@sign',{text:'腐沼祭坛'});
  d.chest(24,24,{gold:250,potions:['hp','mp'],golden:true});
  return {id:'swamp',name:'腐沼祭坛',sub:'雾中石径 · 古树下的第二口钟',floor:'dirt',audio:'swamp',def:d,
    mood:{bg:0x101c19,fog:0.013,hemi:[0x8caca0,0x152419,1.15],key:[0xc4ceab,1.7],exposure:1.3,playerLight:30}};
}
// Chapter three replaces the plague's open groves with fortified lanes and a flanking route.
function pass() {
  const d=carve(43,66);
  d.room(17,54,25,63,',').room(18,43,24,53,',').room(7,38,36,45,',');
  d.room(20,28,22,37,'.').room(9,22,12,37,',').room(8,31,15,38,',');
  d.room(9,12,33,27,',').room(13,10,29,11,',').room(19,2,23,11,'.');
  d.start={x:21,z:61};d.gate('camp_gate',21,30);d.g[30][20]='#';d.g[30][22]='#';
  d.gate('fortress_gate',21,3);for(const x of [19,20,22,23])d.g[3][x]='#';
  d.trigger('pass_return',21,63,{r:3,label:'返回霜暮营地'});
  d.trigger('pass_intro',21,55,{r:5});
  d.trigger('side_winch',11,35,{r:3,label:'旧军械道 · 解除关隘绞盘'});
  d.trigger('rebel_camp',21,26,{bounds:[9,12,33,27]});
  d.trigger('fortress_entry',21,4,{r:3,label:'军令铁门 · 进入铁冠要塞'});
  d.npc('aida',19,58,{model:'elin',name:'军需官 · 艾达',face:.7});
  d.npc('iron_orders',30,15,{name:'叛军征调记录'});
  for(const [x,z]of [[20,50],[22,48],[19,43],[23,40],[20,36],[22,36],[20,32],[22,32],[11,38],[10,32],[14,25],[26,25],[17,19],[25,19]])d.spawn('rebel',x,z,{level:10});
  for(const [x,z]of [[18,46],[24,43],[13,39],[30,40],[11,28],[15,21],[28,21]])d.spawn('raider',x,z,{level:10});
  for(const [x,z]of [[24,49],[8,41],[34,40],[13,23],[29,23],[24,14]])d.spawn('arbalist',x,z,{level:11});
  d.spawn('assassin',11,25,{level:11}).spawn('assassin',30,19,{level:11});
  d.spawn('berserker',15,15,{level:11}).spawn('berserker',27,15,{level:11});
  d.spawn('captain',21,16,{level:11,tag:'orders'});
  d.spawn('warbanner',21,34,{level:10,tag:'pass_standard'});
  d.spawn('ballista',33,42,{level:10,tag:'pass_ballista',face:Math.PI});
  for(const [x,z]of [[17,57],[25,57],[8,39],[35,39],[9,23],[32,13]])d.deco(x,z,'@iron_brazier');
  for(const [x,z]of [[18,50],[24,50],[18,45],[24,45],[9,24],[12,24]])d.deco(x,z,'@barricade',{rot:x===9?Math.PI/2:0});
  for(const [x,z]of [[10,13],[32,13],[10,26],[32,26]])d.block(x,z,'@war_tent');
  for(const [x,z]of [[14,13],[28,13],[18,9],[24,9],[19,31],[23,31]])d.deco(x,z,'@iron_banner');
  d.deco(23,59,'@iron_banner').deco(18,60,'@iron_brazier');
  d.deco(20,60,'@sign',{text:'石脊关 · 旧军械道'}).deco(18,22,'@war_table');
  d.chest(8,35,{gold:240,potions:['hp','mp'],golden:true});
  d.chest(31,17,{gold:180,potions:['hp','mp']});
  return {id:'pass',name:'石脊关 · 叛军营地',sub:'第三集 · 铁冠叛旗',episode:3,floor:'dirt',audio:'iron',def:d,
    mood:{bg:0x171b23,fog:.008,hemi:[0x9ba9c5,0x2a211d,1.25],key:[0xe8bd88,1.9],exposure:1.3,playerLight:26}};
}
function fortress() {
  const d=carve(43,62);
  d.room(18,52,24,58,'.').room(9,38,33,51,'.').room(7,39,12,48,',').room(30,39,35,48,',');
  d.room(19,33,23,37,'.').room(12,23,30,32,':').room(20,20,22,22,'.');
  d.room(8,3,34,19,':');d.start={x:21,z:56};
  d.gate('keep_seal',21,21);d.g[21][20]='#';d.g[21][22]='#';
  d.trigger('fortress_return',21,58,{r:3,label:'返回叛军营地'});
  d.trigger('fortress_intro',21,51,{r:5});
  d.trigger('knight_intro',21,31,{bounds:[12,23,30,32]});
  d.trigger('keep_gate',21,22,{r:3,label:'黑铁纹章 · 王庭大门'});
  d.trigger('king_intro',21,18,{bounds:[8,3,34,19]});
  d.trigger('iron_bell',21,5,{r:3,label:'铁律之钟 · 反鸣'});
  d.trigger('salt_road',32,5,{r:3,label:'西行盐道 · 盐沙古墓'});
  d.trigger('iron_camp',10,5,{r:3,label:'余烬归途 · 返回营地'});
  d.npc('iron_vera',19,54,{model:'vera',name:'拾钟人 · 薇拉'});
  for(const [x,z]of [[18,49],[24,49],[15,44],[27,44],[19,37],[23,37],[16,28],[26,28]])d.spawn('rebel',x,z,{level:12});
  for(const [x,z]of [[10,45],[32,45],[19,42],[23,41],[15,25],[27,25]])d.spawn('raider',x,z,{level:12});
  for(const [x,z]of [[11,41],[31,40],[15,39],[27,39],[18,24],[24,24]])d.spawn('arbalist',x,z,{level:12});
  d.spawn('assassin',10,40,{level:12}).spawn('assassin',32,49,{level:12});
  d.spawn('berserker',17,46,{level:12}).spawn('berserker',25,46,{level:12});
  d.spawn('warbanner',21,43,{level:12,tag:'fortress_standard'});
  d.spawn('blackknight',21,26,{level:12,tag:'blackknight',asleep:true});
  d.spawn('ironking',21,10,{level:13,tag:'ironking',asleep:true});
  d.deco(21,3,'@iron_throne');d.deco(21,4,'@bell');d.solids.push([21,3],[21,4]);
  for(const [x,z]of [[10,4],[32,4],[9,16],[33,16],[12,24],[30,24]])d.block(x,z,'statue',{s:1.1});
  for(const [x,z]of [[9,39],[33,39],[13,23],[29,23],[10,6],[32,6]])d.deco(x,z,'@iron_brazier');
  for(const [x,z]of [[13,38],[29,38],[18,33],[24,33],[14,3],[28,3]])d.deco(x,z,'@iron_banner');
  d.deco(21,35,'@sign',{text:'黑铁校场 · 王座钟楼'});
  d.chest(8,47,{gold:280,potions:['hp','mp'],golden:true});
  d.chest(34,41,{gold:220,potions:['hp','mp']});
  return {id:'fortress',name:'铁冠要塞 · 王座钟楼',sub:'铁律之钟 · 第三口反鸣',episode:3,floor:'tile',audio:'fortress',def:d,
    mood:{bg:0x11131c,fog:.009,hemi:[0x8398c0,0x30201b,1.1],key:[0xe4c59e,1.7],exposure:1.35,playerLight:35}};
}
// Chapter four: two optional flanks feed an ancient light mechanism, then a sealed burial complex.
function saltflat(){
 const d=carve(43,66);
 d.room(17,53,25,63,',').room(18,43,24,52,',').room(7,32,35,42,',');
 d.room(20,26,22,31,'.').room(8,10,34,25,',').room(19,2,23,9,'.');
 d.gate('sun_gate',21,28);d.g[28][20]='#';d.g[28][22]='#';d.start={x:21,z:61};
 d.trigger('salt_return',21,63,{r:3,label:'返回霜暮营地'}).trigger('salt_intro',21,55,{r:5});
 d.trigger('mirror_west',9,36,{r:3,label:'西导流碑 · 引光'}).trigger('mirror_east',33,36,{r:3,label:'东导流碑 · 引光'});
 d.trigger('shelter_altar',9,15,{r:3,label:'拾取避风护符 · 可选'});
 d.trigger('sun_gate_hint',21,30,{r:3,label:'日轮石门 · 两道引光'});
 d.trigger('tomb_entry',21,4,{r:3,label:'进入沙埋神殿'});
 d.npc('salt_merchant',19,58,{model:'bram',name:'盐路商人 · 萨米尔'});
 d.npc('salt_vera',23,58,{model:'vera',name:'拾钟人 · 薇拉'});
 for(const [x,z]of [[20,51],[22,49],[19,46],[23,44],[18,40],[24,40],[15,38],[28,38],[11,33],[31,33],[16,23],[26,23],[14,17],[28,17]])d.spawn('saltdead',x,z,{level:13});
 for(const [x,z]of [[8,34],[10,38],[32,38],[34,34],[18,18],[24,18]])d.spawn('tombguard',x,z,{level:14});
 for(const [x,z]of [[11,35],[31,35],[24,47],[13,21],[29,21]])d.spawn('sandweaver',x,z,{level:14});
 d.spawn('saltfiend',18,34,{level:14}).spawn('saltfiend',25,34,{level:14}).spawn('saltfiend',21,14,{level:14});
 d.spawn('saltseal',12,13,{tag:'oasis_seal',level:14});
 for(const [x,z]of [[8,36],[34,36],[21,26]])d.deco(x,z,'@salt_obelisk');
 for(const [x,z]of [[17,57],[25,57],[7,32],[35,42],[8,11],[34,11]])d.block(x,z,'@salt_crystal');
 for(const [x,z]of [[17,44],[25,44],[13,32],[29,32],[15,11],[27,11]])d.deco(x,z,'@salt_ruin',{rot:x%2?.35:-.3});
 d.deco(9,14,'@salt_archive').deco(20,58,'@salt_brazier').deco(22,7,'@salt_brazier');
 d.chest(8,40,{gold:260,potions:['hp','mp']}).chest(32,12,{gold:330,potions:['hp','mp'],golden:true});
 return {id:'saltflat',name:'灰盐荒原 · 日轮遗址',sub:'第四集 · 盐沙古墓',episode:4,floor:'dirt',audio:'salt',def:d,
 mood:{bg:0x34332c,fog:.006,hemi:[0xe2d8b5,0x4a4238,1.45],key:[0xffdda0,2.1],exposure:1.12,playerLight:18}};
}
function salttomb(){
 const d=carve(43,63);
 d.room(18,53,24,59,'.').room(9,39,33,52,'.').room(19,35,23,38,'.');
 d.room(10,23,32,34,':').room(20,20,22,22,'.').room(7,3,35,19,':');
 d.gate('tomb_seal',21,21);d.g[21][20]='#';d.g[21][22]='#';d.start={x:21,z:57};
 d.trigger('tomb_return',21,59,{r:3,label:'返回灰盐荒原'}).trigger('tomb_intro',21,53,{r:4});
 d.trigger('priest_intro',21,33,{bounds:[10,23,32,34]});
 d.trigger('tomb_gate_hint',21,22,{r:3,label:'封尸之门 · 需要祭司的印记'});
 d.trigger('queen_intro',21,18,{bounds:[7,3,35,19]});
 d.trigger('salt_blueprint',21,5,{r:3,label:'古代铸钟图纸 · 阅读'});
 d.trigger('salt_camp',9,5,{r:3,label:'余烬归途 · 返回营地'});
 d.npc('tomb_vera',19,55,{model:'vera',name:'拾钟人 · 薇拉'});
 d.npc('salt_inscription',31,44,{name:'铸钟人的石刻'});
 for(const [x,z]of [[18,50],[24,50],[13,47],[29,47],[19,43],[23,43],[20,36],[22,36],[14,32],[28,32],[12,25],[30,25]])d.spawn('saltdead',x,z,{level:14});
 for(const [x,z]of [[15,49],[27,49],[13,41],[29,41],[17,28],[25,28]])d.spawn('tombguard',x,z,{level:15});
 for(const [x,z]of [[10,45],[32,45],[16,40],[26,40],[13,24],[29,24]])d.spawn('sandweaver',x,z,{level:15});
 d.spawn('saltfiend',16,45,{level:15}).spawn('saltfiend',26,45,{level:15});
 d.spawn('saltseal',12,29,{tag:'tomb_west',level:15}).spawn('saltseal',30,29,{tag:'tomb_east',level:15});
 d.spawn('saltpriest',21,27,{tag:'saltpriest',level:15,asleep:true});
 d.spawn('saltqueen',21,10,{tag:'saltqueen',level:16,asleep:true});
 d.deco(21,4,'@salt_archive');
 for(const [x,z]of [[10,4],[32,4],[9,16],[33,16],[11,24],[31,24]])d.block(x,z,'@salt_obelisk');
 for(const [x,z]of [[9,39],[33,39],[11,51],[31,51],[14,23],[28,23]])d.deco(x,z,'@salt_brazier');
 for(const [x,z]of [[10,49],[32,49],[17,35],[25,35],[8,8],[34,8]])d.deco(x,z,'@salt_crystal');
 d.chest(10,41,{gold:320,potions:['hp','mp'],golden:true}).chest(31,50,{gold:250,potions:['hp','mp']});
 return {id:'salttomb',name:'沙埋神殿 · 盐后陵寝',sub:'铸钟者留下的第一份罪证',episode:4,floor:'tile',audio:'salt_tomb',def:d,
 mood:{bg:0x111e24,fog:.009,hemi:[0x9fc1c3,0x3c352a,1.2],key:[0xc7edf0,1.55],exposure:1.25,playerLight:32}};
}
export const LEVELS = { camp, crypt, forest, swamp, pass, fortress, saltflat, salttomb };
