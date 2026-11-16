/**
 * Items: base types, random affixes, rarities, legendaries, shop stock and drops.
 * Rarity tiers: common (shop), magic (shop + drops), rare (drops), legendary (drops from elites/bosses only).
 */
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
let uid = 1;

export const SLOTS = ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'amulet', 'ring'];
export const SLOT_NAMES = { weapon: '武器', offhand: '副手', helm: '头盔', chest: '胸甲', gloves: '手套', boots: '靴子', amulet: '护身符', ring: '戒指' };

export const RARITY = {
  common: { name: '普通', color: '#d8d2c4', affixes: [0, 0], mult: 1 },
  magic: { name: '魔法', color: '#6f9bff', affixes: [1, 2], mult: 1.15 },
  rare: { name: '稀有', color: '#ffe066', affixes: [3, 4], mult: 1.3 },
  legendary: { name: '传奇', color: '#ff8a1e', affixes: [4, 4], mult: 1.5 },
};

/** Base types. cls limits who may equip (weapons/offhands); armour is shared. */
export const BASES = {
  staff: { slot: 'weapon', name: '法杖', cls: ['mage', 'necro'], dmg: 11, icon: 'staff', twoHand: true },
  wand: { slot: 'weapon', name: '魔杖', cls: ['mage', 'necro'], dmg: 8, icon: 'wand' },
  scythe: { slot: 'weapon', name: '骨镰', cls: ['necro'], dmg: 10, icon: 'scythe', twoHand: true },
  axe: { slot: 'weapon', name: '战斧', cls: ['warrior'], dmg: 10, icon: 'axe' },
  mace: { slot: 'weapon', name: '钉锤', cls: ['warrior', 'paladin'], dmg: 10, icon: 'mace' },
  sword: { slot: 'weapon', name: '长剑', cls: ['warrior', 'paladin'], dmg: 9.5, icon: 'sword' },
  bow: { slot: 'weapon', name: '长弓', cls: ['ranger'], dmg: 10, icon: 'bow', twoHand: true },
  crossbow: { slot: 'weapon', name: '反曲弓', cls: ['ranger'], dmg: 11, icon: 'crossbow', twoHand: true },
  shield: { slot: 'offhand', name: '盾牌', cls: ['warrior', 'paladin'], armor: 14, icon: 'shield' },
  orb: { slot: 'offhand', name: '法球', cls: ['mage'], icon: 'orb', fixed: { int: 4 } },
  quiver: { slot: 'offhand', name: '箭袋', cls: ['ranger'], icon: 'quiver', fixed: { dex: 4 } },
  relic: { slot: 'offhand', name: '圣物匣', cls: ['necro'], icon: 'relic', fixed: { int: 4 } },
  helm: { slot: 'helm', name: '头盔', armor: 8, icon: 'helm' },
  hood: { slot: 'helm', name: '兜帽', armor: 5, icon: 'hood', fixed: { int: 2 } },
  chest: { slot: 'chest', name: '胸甲', armor: 16, icon: 'chest' },
  robe: { slot: 'chest', name: '长袍', armor: 10, icon: 'robe', fixed: { int: 3 } },
  leather: { slot: 'chest', name: '皮甲', armor: 12, icon: 'leather', fixed: { dex: 3 } },
  gloves: { slot: 'gloves', name: '手套', armor: 5, icon: 'gloves' },
  boots: { slot: 'boots', name: '靴子', armor: 5, icon: 'boots', fixed: { move: 3 } },
  amulet: { slot: 'amulet', name: '护身符', icon: 'amulet' },
  ring: { slot: 'ring', name: '戒指', icon: 'ring' },
};

/** Material tiers by item level — just flavour names on top of the base. */
const TIERS = [
  [1, '破旧的'], [3, '铁制'], [5, '精钢'], [7, '秘银'], [10, '黑铁'], [13, '王庭精钢'], [15, '盐晶锻造'],
];
const tierName = (lvl) => TIERS.filter(([l]) => lvl >= l).pop()[1];

/** Affixes: k = stat key, r = roll range at ilvl 1 (scaled by level), slots that may roll it. */
export const AFFIXES = {
  str: { name: '力量', r: [2, 5], scale: 0.8 },
  dex: { name: '敏捷', r: [2, 5], scale: 0.8 },
  int: { name: '智力', r: [2, 5], scale: 0.8 },
  vit: { name: '体能', r: [2, 5], scale: 0.8 },
  hp: { name: '生命上限', r: [10, 22], scale: 4 },
  res: { name: '能量上限', r: [5, 12], scale: 1 },
  armor: { name: '护甲', r: [6, 14], scale: 2.5 },
  crit: { name: '暴击几率', r: [1.5, 4], pct: true, scale: 0.15 },
  critDmg: { name: '暴击伤害', r: [8, 18], pct: true, scale: 1.2 },
  atkSpd: { name: '攻击速度', r: [4, 9], pct: true, scale: 0.3, slots: ['weapon', 'gloves', 'ring', 'amulet'] },
  move: { name: '移动速度', r: [4, 8], pct: true, scale: 0.2, slots: ['boots', 'amulet'] },
  dmgPct: { name: '伤害', r: [5, 12], pct: true, scale: 0.8, slots: ['weapon', 'amulet', 'ring', 'offhand', 'gloves'] },
  regen: { name: '每秒回复生命', r: [1, 2.5], scale: 0.4 },
  resRegen: { name: '每秒回复能量', r: [0.5, 1.5], scale: 0.15, slots: ['helm', 'amulet', 'ring', 'offhand'] },
  lifeHit: { name: '击中回复生命', r: [2, 5], scale: 0.8, slots: ['weapon', 'gloves', 'ring'] },
  cdr: { name: '冷却缩减', r: [3, 7], pct: true, scale: 0.2, slots: ['helm', 'amulet', 'ring', 'offhand'] },
  gold: { name: '金币获取', r: [8, 20], pct: true, scale: 1, slots: ['amulet', 'ring', 'helm'] },
};

/**
 * Legendaries: fixed name, base, guaranteed stats and a special power (flag checked by skills/player).
 * They only drop in the field (elites, bosses, rare chance from normal monsters at higher levels).
 */
export const LEGENDARIES = [
  {id:'tideboots',name:'踏潮者的旧靴',base:'boots',flag:'tideboots',episode:5,power:'潮浪、裂流与葬海钟域伤害降低 25%。'},
  {id:'hookgrasp',name:'断锚者之握',base:'gloves',flag:'hookgrasp',episode:5,power:'对处于破灯或收潮破绽中的港口敌人额外造成 15% 伤害。'},
  {id:'tideeye',name:'沉灯之眼',base:'ring',flag:'tideeye',episode:5,power:'打断引潮或钩链后回复 20 点职业资源（冷却 8 秒）。'},
  {id:'saltmantle',name:'避风者的盐纱',base:'robe',flag:'saltmantle',episode:4,power:'盐沙风暴造成的伤害降低 35%，可与避风护符叠加。'},
  {id:'sunseal',name:'碎日指环',base:'ring',flag:'sunseal',episode:4,power:'对共鸣盐晶伤害提高 80%；对减速或冻结目标伤害提高 20%。'},
  {id:'desertgrip',name:'拾荒者的晶握',base:'gloves',flag:'desertgrip',episode:4,power:'击碎共鸣盐晶时回复 8% 最大生命与 15 点职业资源。'},

  {id:'siegebreaker',name:'破阵者之握',base:'gloves',flag:'siegebreaker',episode:3,power:'对战旗和重弩伤害提高 60%；控制破盾后，5 秒内造成的伤害提高 15%。'},
  {id:'ironmarch',name:'铁行军靴',base:'boots',flag:'ironmarch',episode:3,power:'击杀铁冠敌人后，4 秒内移动速度提高 18%，受到的伤害降低 10%。'},
  {id:'ironseal',name:'废王印玺',base:'ring',flag:'ironseal',episode:3,power:'持续攻击同一目标，每第三次主动命中追加本次伤害的 60%（冷却 2 秒）。'},
  {id:'thorncrown',name:'荆冠',base:'helm',flag:'thorncrown',episode:2,power:'受到近战伤害时向周围射出荆棘，造成毒素伤害（冷却 3 秒）。'},
  {id:'plagueband',name:'疫歌女巫的镶带',base:'ring',flag:'plagueband',episode:2,power:'对中毒或减速敌人的伤害提高 20%。'},
  {id:'hookchain',name:'屠夫的钩链',base:'gloves',flag:'hookchain',episode:2,power:'击中有 15% 几率将敌人拉近并眩晕 1 秒（冷却 3 秒）。'},
  { id: 'emberheart', name: '余烬之心', base: 'orb', cls: 'mage', flag: 'emberheart', power: '火球术与陨石术的爆炸范围扩大 40%，伤害提高 25%。' },
  { id: 'stormcoil', name: '风暴盘索', base: 'wand', cls: 'mage', flag: 'stormcoil', power: '闪电链额外弹射 3 次，且不再衰减。' },
  { id: 'butcher', name: '屠夫的战斧', base: 'axe', cls: 'warrior', flag: 'butcher', power: '旋风斩持续时间翻倍，每次命中回复 2 点怒气。' },
  { id: 'warlordhelm', name: '督军之盔', base: 'helm', cls: 'warrior', flag: 'warlord', power: '战吼同时治疗 25% 生命，并使效果持续 12 秒。' },
  { id: 'windforce', name: '风之力', base: 'bow', cls: 'ranger', flag: 'windforce', power: '速射有 25% 几率同时射出 3 支箭。' },
  { id: 'hawkquiver', name: '鹰眼箭袋', base: 'quiver', cls: 'ranger', flag: 'hawk', power: '多重射击额外射出 4 支箭，箭雨范围扩大 30%。' },
  { id: 'dawnbringer', name: '破晓者', base: 'sword', cls: 'paladin', flag: 'dawn', power: '正义打击召下一道圣光，对目标周围造成额外伤害。' },
  { id: 'aegis', name: '永誓圣盾', base: 'shield', cls: 'paladin', flag: 'aegis', power: '圣光护盾吸收量翻倍，护盾存在时受到的伤害降低 20%。' },
  { id: 'deathsbreath', name: '亡者之息', base: 'relic', cls: 'necro', flag: 'deathsbreath', power: '召唤骷髅一次召唤 3 具，最多同时存在 6 具。' },
  { id: 'boneweaver', name: '织骨者', base: 'scythe', cls: 'necro', flag: 'boneweaver', power: '白骨长矛命中时在目标处引爆一具尸体般的骨爆。' },
  { id: 'silentbell', name: '缄默钟舌', base: 'amulet', flag: 'silentbell', power: '每 8 秒，下一次受到的伤害被完全抵消。', boss: true },
  { id: 'gravewalker', name: '掘墓者之靴', base: 'boots', flag: 'gravewalker', power: '击杀敌人后 3 秒内移动速度提高 30%。' },
  { id: 'bloodring', name: '血契之戒', base: 'ring', flag: 'bloodring', power: '命中暴击时回复 2% 最大生命（每 1.2 秒最多一次）。' },
];

function rollAffixes(it, n) {
  const pool = Object.entries(AFFIXES).filter(([, a]) => !a.slots || a.slots.includes(it.slot));
  const used = new Set();
  while (it.affixes.length < n && used.size < pool.length) {
    const [k, a] = pick(pool);
    if (used.has(k)) continue;
    used.add(k);
    const lvlMul = 1 + (it.ilvl - 1) * a.scale / Math.max(1, a.r[1]);
    let v = rnd(a.r[0], a.r[1]) * lvlMul * RARITY[it.rarity].mult;
    v = a.pct || v < 3 ? Math.round(v * 10) / 10 : Math.round(v);
    it.affixes.push({ k, v });
  }
}

export function makeItem(baseKey, { ilvl = 1, rarity = 'common', legendary = null } = {}) {
  const b = BASES[baseKey];
  const it = { uid: uid++, base: baseKey, slot: b.slot, ilvl, rarity, affixes: [], icon: b.icon };
  if (b.dmg) { const avg = b.dmg * (1 + (ilvl - 1) * 0.16) * RARITY[rarity].mult; it.dmg = [Math.round(avg * 0.75), Math.round(avg * 1.25)]; }
  if (b.armor) it.armor = Math.round(b.armor * (1 + (ilvl - 1) * 0.18) * RARITY[rarity].mult);
  if (b.fixed) for (const [k, v] of Object.entries(b.fixed)) it.affixes.push({ k, v: Math.round(v * (1 + (ilvl - 1) * 0.15)) });
  const [a0, a1] = RARITY[rarity].affixes;
  rollAffixes(it, it.affixes.length + ri(a0, a1));
  if (legendary) { it.legendary = legendary.id; it.flag = legendary.flag; it.power = legendary.power; it.name = legendary.name; }
  else it.name = (rarity === 'common' ? tierName(ilvl) : rarity === 'magic' ? pick(['锋锐的', '坚韧的', '幽光', '迅捷的', '炽热的', '寒霜']) : pick(['暮色', '亡誓', '血棘', '灰冠', '霜魂', '铁誓', '夜鸦', '骸王'])) + b.name;
  it.price = Math.round((12 + ilvl * 9) * { common: 1, magic: 2.2, rare: 4.5, legendary: 9 }[rarity] * (b.dmg ? 1.4 : 1));
  return it;
}

/** Bases usable by a class (weapons/offhands filtered, armour always). */
export function basesFor(cls) {
  return Object.entries(BASES).filter(([, b]) => !b.cls || b.cls.includes(cls)).map(([k]) => k);
}

export function canEquip(cls, it) {
  const b = BASES[it.base];
  return !b.cls || b.cls.includes(cls);
}

/** Random drop. quality: 0 normal monster, 1 elite, 2 boss. */
export function rollDrop(cls, ilvl, quality = 0, episode = 1) {
  const r = Math.random() * 100;
  const leg = quality === 2 ? 100 : quality === 1 ? 35 : ilvl >= 4 ? 1.2 : 0.4;
  if (Math.random() * 100 < leg) {
    const pool = LEGENDARIES.filter((l) => (!l.episode || l.episode<=episode) && (!l.cls || l.cls === cls || Math.random() < 0.25) && (quality === 2 || !l.boss));
    const chapter=pool.filter(l=>(l.episode??1)===episode);
    const L=pick(quality===2&&chapter.length?chapter:pool);
    return makeItem(L.base, { ilvl: ilvl + 1, rarity: 'legendary', legendary: L });
  }
  const rarity = quality >= 1 ? (r < 60 ? 'rare' : 'magic') : r < 50 ? 'common' : r < 85 ? 'magic' : 'rare';
  const own = Math.random() < 0.7;
  const bases = own ? basesFor(cls) : Object.keys(BASES);
  return makeItem(pick(bases), { ilvl, rarity });
}

/** Shop stock: commons and a few magic items around the player's level for the player's class. */
export function shopStock(cls, lvl) {
  const out = [];
  const bases = basesFor(cls);
  const weapons = bases.filter((b) => BASES[b].slot === 'weapon');
  const offs = bases.filter((b) => BASES[b].slot === 'offhand');
  for (const b of weapons) out.push(makeItem(b, { ilvl: lvl, rarity: 'common' }));
  for (const b of offs) out.push(makeItem(b, { ilvl: lvl, rarity: 'common' }));
  for (const b of ['helm', 'hood', 'chest', 'robe', 'leather', 'gloves', 'boots']) out.push(makeItem(b, { ilvl: lvl, rarity: 'common' }));
  for (let i = 0; i < 4; i++) out.push(makeItem(pick([...weapons, 'amulet', 'ring', 'boots', 'gloves', 'helm']), { ilvl: lvl, rarity: 'magic' }));
  return out;
}

export function affixText(a) {
  const A = AFFIXES[a.k];
  if (!A) return '';
  return A.pct ? `+${a.v}% ${A.name}` : `+${a.v} ${A.name}`;
}

/** Restore uid counter after loading a save. */
export function syncUid(items) { for (const it of items) if (it && it.uid >= uid) uid = it.uid + 1; }

// ---------------------------------------------------------------- icons (inline SVG)
const ICONS = {
  staff: '<path d="M27 5 L13 35" stroke="#8a6a44" stroke-width="3"/><circle cx="27" cy="6" r="4.5" fill="C"/>',
  wand: '<path d="M26 10 L14 32" stroke="#7a5a3a" stroke-width="3"/><path d="M26 6 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z" fill="C"/>',
  scythe: '<path d="M25 6 L15 35" stroke="#7d7466" stroke-width="3"/><path d="M25 6 Q14 4 7 12 Q17 9 24 11" fill="C"/>',
  axe: '<path d="M22 6 L17 35" stroke="#6b4f33" stroke-width="3"/><path d="M21 7 Q32 8 33 18 Q26 15 20 16z" fill="C"/>',
  mace: '<path d="M20 14 L20 36" stroke="#6b4f33" stroke-width="3"/><circle cx="20" cy="10" r="6" fill="C"/><path d="M20 2v3M13 10h-3M30 10h-3M14 4l2 2M26 4l-2 2" stroke="C" stroke-width="2"/>',
  sword: '<path d="M20 4 L20 28" stroke="C" stroke-width="4"/><path d="M13 28h14" stroke="#b49a5a" stroke-width="3"/><path d="M20 29v7" stroke="#6b4f33" stroke-width="3"/>',
  bow: '<path d="M12 5 Q32 20 12 35" fill="none" stroke="C" stroke-width="3"/><path d="M12 5 L12 35" stroke="#ddd" stroke-width="1"/>',
  crossbow: '<path d="M8 14 Q20 6 32 14" fill="none" stroke="C" stroke-width="3"/><path d="M20 8 L20 36" stroke="#6b4f33" stroke-width="4"/>',
  shield: '<path d="M20 5 L33 10 Q33 26 20 35 Q7 26 7 10z" fill="C" stroke="#222" stroke-width="1.5"/><path d="M20 9v22M11 15h18" stroke="#00000055" stroke-width="2"/>',
  orb: '<circle cx="20" cy="18" r="10" fill="C"/><circle cx="16" cy="14" r="3" fill="#fff8"/><path d="M12 32h16l-3-5H15z" fill="#8a6a44"/>',
  quiver: '<rect x="14" y="10" width="12" height="25" rx="3" fill="#6b4f33"/><path d="M17 10 L15 3M20 10V2M23 10l2-7" stroke="C" stroke-width="2"/>',
  relic: '<rect x="11" y="11" width="18" height="20" rx="2" fill="#4a463e"/><circle cx="20" cy="20" r="5" fill="C"/><path d="M16 6h8l2 5H14z" fill="#7d7466"/>',
  helm: '<path d="M8 24 Q8 6 20 6 Q32 6 32 24 L28 30 H12z" fill="C"/><path d="M14 18h12" stroke="#111" stroke-width="3"/>',
  hood: '<path d="M7 34 Q6 6 20 5 Q34 6 33 34 L26 30 Q20 18 14 30z" fill="C"/>',
  chest: '<path d="M10 8 L16 6 Q20 10 24 6 L30 8 L33 18 L28 20 L28 34 H12 V20 L7 18z" fill="C"/>',
  robe: '<path d="M14 6 Q20 10 26 6 L31 14 L29 35 H11 L9 14z" fill="C"/><path d="M20 10v25" stroke="#0004" stroke-width="2"/>',
  leather: '<path d="M11 8 L16 6 Q20 9 24 6 L29 8 L31 20 L27 21 L27 34 H13 V21 L9 20z" fill="C"/><path d="M15 16h10M15 22h10M15 28h10" stroke="#0005" stroke-width="1.5"/>',
  gloves: '<path d="M12 34 V18 Q12 13 15 13 V7 Q17 5 19 7 V12 Q21 5 23 7 V13 Q25 8 27 10 V20 Q30 18 31 21 L26 30 L24 34z" fill="C"/>',
  boots: '<path d="M13 5 H23 V24 L33 28 V34 H11 Q10 24 13 20z" fill="C"/>',
  amulet: '<path d="M10 5 Q20 22 30 5" fill="none" stroke="#c9a96b" stroke-width="2"/><path d="M20 18 L26 26 L20 35 L14 26z" fill="C"/>',
  ring: '<circle cx="20" cy="23" r="9" fill="none" stroke="#c9a96b" stroke-width="4"/><path d="M20 8 L25 13 L20 17 L15 13z" fill="C"/>',
  hp: '<path d="M16 6h8v8l6 10a8 8 0 0 1-7 12h-6a8 8 0 0 1-7-12l6-10z" fill="#3a0d0a" stroke="#c9b48a" stroke-width="1.5"/><path d="M12 25h16a6 6 0 0 1-5 9h-6a6 6 0 0 1-5-9z" fill="#d0261c"/>',
  mp: '<path d="M16 6h8v8l6 10a8 8 0 0 1-7 12h-6a8 8 0 0 1-7-12l6-10z" fill="#0a163a" stroke="#c9b48a" stroke-width="1.5"/><path d="M12 25h16a6 6 0 0 1-5 9h-6a6 6 0 0 1-5-9z" fill="#2a62e0"/>',
};
const ICON_COL = { common: '#b8b2a6', magic: '#7aa8ff', rare: '#ffd75a', legendary: '#ff9a3a' };
export function itemIcon(it) {
  const c = ICON_COL[it.rarity] ?? '#ccc';
  return `<svg viewBox="0 0 40 40">${(ICONS[it.icon] ?? '').replaceAll('"C"', `"${c}"`)}</svg>`;
}
export function potionIcon(k) { return `<svg viewBox="0 0 40 40">${ICONS[k]}</svg>`; }
