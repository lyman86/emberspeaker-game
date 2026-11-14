/**
 * Playable classes: model profile, resource, base attributes and growth, starting gear.
 * main = attribute that scales damage (+1% per point). vit = +6 life per point.
 */
export const CLASSES = {
  mage: {
    name: '法师', title: '烬语法师', profile: 'pc_mage', main: 'int',
    res: { name: '法力', color: 'mana', max: 100, regen: 5, start: 1 },
    base: { str: 8, dex: 10, int: 22, vit: 12 }, grow: { str: 1, dex: 1, int: 3, vit: 2 }, hp: 70, armor: 4,
    start: ['staff', 'robe'], weaponWord: '法杖',
    desc: '驾驭火焰、寒冰与雷电的远程施法者。范围伤害极高，但身板脆弱。',
    stats: { 生存: 2, 伤害: 5, 范围: 5, 机动: 4 },
  },
  warrior: {
    name: '战士', title: '烬誓战士', profile: 'pc_warrior', main: 'str',
    res: { name: '怒气', color: 'rage', max: 100, regen: -3, start: 0 },
    base: { str: 22, dex: 10, int: 6, vit: 18 }, grow: { str: 3, dex: 1, int: 0, vit: 3 }, hp: 110, armor: 14,
    start: ['mace', 'chest', 'helm'], weaponWord: '战锤',
    desc: '手持战锤冲锋陷阵。攻击积攒怒气，再用怒气释放毁灭性的技能。',
    stats: { 生存: 5, 伤害: 4, 范围: 3, 机动: 3 },
  },
  ranger: {
    name: '游侠', title: '烬羽游侠', profile: 'pc_ranger', main: 'dex',
    res: { name: '专注', color: 'focus', max: 100, regen: 12, start: 1 },
    base: { str: 9, dex: 22, int: 9, vit: 13 }, grow: { str: 1, dex: 3, int: 1, vit: 2 }, hp: 80, armor: 7,
    start: ['bow', 'leather'], weaponWord: '箭簇',
    desc: '远距离精准射杀，翻滚灵活走位。单体与多目标兼顾。',
    stats: { 生存: 3, 伤害: 4, 范围: 3, 机动: 5 },
  },
  paladin: {
    name: '圣骑士', title: '烬光圣骑士', profile: 'pc_paladin', main: 'str',
    res: { name: '法力', color: 'holy', max: 100, regen: 6, start: 1 },
    base: { str: 18, dex: 8, int: 12, vit: 18 }, grow: { str: 2, dex: 1, int: 1, vit: 3 }, hp: 105, armor: 16,
    start: ['sword', 'shield', 'chest'], weaponWord: '剑锋',
    desc: '剑盾在手，以圣光审判亡灵。拥有护盾与治疗，极难被击倒。',
    stats: { 生存: 5, 伤害: 3, 范围: 3, 机动: 3 },
  },
  necro: {
    name: '死灵法师', title: '烬骨死灵师', profile: 'pc_necro', main: 'int',
    res: { name: '精魄', color: 'essence', max: 100, regen: 6, start: 1 },
    base: { str: 8, dex: 10, int: 20, vit: 14 }, grow: { str: 1, dex: 1, int: 3, vit: 2 }, hp: 78, armor: 6,
    start: ['scythe', 'robe'], weaponWord: '骨戒',
    desc: '号令亡者为己而战，以白骨与尸体为武器。召唤物替你承受伤害。',
    stats: { 生存: 3, 伤害: 4, 范围: 4, 机动: 3 },
  },
};
export const CLASS_ORDER = ['warrior', 'ranger', 'mage', 'paladin', 'necro'];
export const RES_COLORS = {
  mana: ['#6fb6ff', '#1845c2', '#08154f'], rage: ['#ff8a5a', '#c22a10', '#4a0a04'], focus: ['#b8f07a', '#4a9a2a', '#13300a'],
  holy: ['#ffe9a0', '#c99a2a', '#4a3008'], essence: ['#a0ffd0', '#22a070', '#063020'],
};
