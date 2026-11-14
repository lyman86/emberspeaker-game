# 第二集素材与声音来源

2026-11-13。第二集声音均随游戏本地托管，不运行时请求境外素材站。

## 新声音

`public/audio/episode2/` 中的 10 个文件共约 0.8 MB，AAC/M4A、单声道、22.05 kHz、64 kbps。素材来自项目已下载的 `raw/pixabay/px_sfx.json`，本次重新剪辑、变调、滤波、混音和编码；不是把一代的同一声音原样绑定到所有怪物。

Pixabay 的 [Content License](https://pixabay.com/service/license-summary/) 允许免费使用与改作，不要求署名，禁止将未经创作加工的素材独立分发或转售。这些文件用于游戏场景及战斗的组成部分。缓存内的 `page` 字段是以下来源记录的依据，在线页面也重新核对了森林、夜间虫鸣、女巫与咆哮素材。

| 文件（均在 `public/audio/episode2/`） | 内容与处理 | 原始来源 |
| --- | --- | --- |
| `forest_bed.m4a` | 28 秒森林风声、树叶与稀疏虫鸣，叠加并交叉淡化循环 | [Windy Night Forest Ambience · Alex_Jauk](https://pixabay.com/sound-effects/nature-windy-night-forest-ambience-211715/)、[Night Ambience · brunoboselli / freesound_community](https://pixabay.com/sound-effects/nature-night-ambience-29548/) |
| `swamp_bed.m4a` | 28 秒低通虫鸣、湿润滴水，区别于一代墓穴混响 | [Night Ambience](https://pixabay.com/sound-effects/nature-night-ambience-29548/)、[Droplets in a Cave](https://pixabay.com/sound-effects/nature-droplets-in-a-cave-482871/) |
| `mill_bed.m4a` | 24 秒室外风声漏入空磨坊，低频水声与原创合成木轴吱响 | [Windy Night Forest Ambience](https://pixabay.com/sound-effects/nature-windy-night-forest-ambience-211715/)、[Droplets in a Cave](https://pixabay.com/sound-effects/nature-droplets-in-a-cave-482871/)，木轴音为原创合成 |
| `villager_groan.m4a` | 2.5 秒低沉疫民呻吟，裁切、降调、低通 | [Zombie Moans](https://pixabay.com/sound-effects/horror-zombie-moans-29924/) |
| `goblin_chitter.m4a` | 1 秒尖促地精嘶鸣，升调、高通，避免与疫民混同 | [Zombie Sound 2](https://pixabay.com/sound-effects/horror-zombie-sound-2-357976/) |
| `wolf_snarl.m4a` | 1.8 秒狼人短吼，裁切、适度升调 | [Deep Sea Monster Roar · DRAGON-STUDIO](https://pixabay.com/sound-effects/horror-deep-sea-monster-roar-329857/) |
| `witch_chant.m4a` | 5 秒女巫咒语，轻微升调与去低频，可用于召唤预警 | [Dark Witch Incantation Voice Line – Arcane Spell SFX · AlesiaDavina](https://pixabay.com/sound-effects/horror-dark-witch-incantation-voice-line-arcane-spell-sfx-553616/) |
| `butcher_roar.m4a` | 3.2 秒屠夫低吼，深降调叠加骨折声 | [Deep Sea Monster Roar](https://pixabay.com/sound-effects/horror-deep-sea-monster-roar-329857/)、[Bone Break](https://pixabay.com/sound-effects/film-special-effects-bone-break-191978/) |
| `poison_cast.m4a` | 1.2 秒毒法施放，裁切、降调、低通 | [Dark Magic 6](https://pixabay.com/sound-effects/film-special-effects-dark-magic-6-378652/) |
| `root_crack.m4a` | 1.9 秒树根破土，降调、削减尖锐高频 | [Bone Break](https://pixabay.com/sound-effects/film-special-effects-bone-break-191978/) |

声音已保留攻击瞬态与短淡入淡出，单次效果峰值低于 0 dBFS；环境声采用首尾交叉淡化及短边缘渐变。场景淡入淡出由现有音频系统负责。

## 现有图像与模型

- [Poly Haven](https://polyhaven.com/license) 的资产采用 CC0。项目已经包含 `brown_mud_rocks_01`、`dry_decay_leaves`、`forest_leaves_02`、`mossy_rock`、`weathered_brown_planks` 等纹理，可直接服务第二集泥地、枯叶、湿石与磨坊木板，避免重复增加下载。
- [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) 为 CC0。项目已有粒子纹理与 `public/assets/fx/LICENSE-Kenney-CC0.txt`，用于毒雾、孢子、咒术与根刺反馈；本次无需重复下载整包。
- [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) 说明角色与动画可免费用于游戏，但下载依赖 Adobe ID。沿用用户先前同意的已有模型，通过骨骼附件与造型区分怪物。

## 下载核查说明

本次已查看用户给出的四个站点。Pixabay 新沼泽素材页面与 Kenney 音效包可检索，但本机直接下载请求返回 403 或 HTML，不将这些响应当作有效音频。改用项目合法缓存的尚未接入游戏的录音制作新音效；没有新增账户登录或未确认来源的资源。
