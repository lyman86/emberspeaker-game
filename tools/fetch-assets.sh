#!/usr/bin/env bash
# 下载并整理游戏使用的 CC0 开源素材（KayKit by Kay Lousberg）。
# 用法: bash tools/fetch-assets.sh [已克隆素材所在目录]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$(mktemp -d)}"
OUT="$ROOT/public/assets"
mkdir -p "$OUT/chars" "$OUT/props" "$OUT/weapons"
get() { # repo dirname
  if [ ! -d "$SRC/$2" ]; then
    echo "下载 $1 ..."
    curl -fsSL "https://codeload.github.com/KayKit-Game-Assets/$1/tar.gz/refs/heads/main" | tar -xz -C "$SRC"
    mv "$SRC/$1-main" "$SRC/$2"
  fi
}
get KayKit-Character-Pack-Adventures-1.0 adv
get KayKit-Character-Pack-Skeletons-1.0 skel
get KayKit-Dungeon-Remastered-1.0 dung
A="$SRC/adv/addons/kaykit_character_pack_adventures"
S="$SRC/skel/addons/kaykit_character_pack_skeletons"
D="$SRC/dung/addons/kaykit_dungeon_remastered/Assets/gltf"
for c in Mage Knight Barbarian Rogue_Hooded; do cp "$A/Characters/gltf/$c.glb" "$OUT/chars/"; done
for c in Skeleton_Minion Skeleton_Warrior Skeleton_Rogue Skeleton_Mage; do cp "$S/Characters/gltf/$c.glb" "$OUT/chars/"; done
for w in Skeleton_Blade Skeleton_Axe Skeleton_Staff Skeleton_Crossbow Skeleton_Shield_Large_A Skeleton_Arrow; do cp "$S/Assets/gltf/$w.gltf" "$S/Assets/gltf/$w.bin" "$OUT/weapons/"; done
cp "$S/Assets/gltf/skeleton_texture.png" "$OUT/weapons/"
for p in floor_tile_large floor_tile_large_rocks floor_dirt_large floor_dirt_large_rocky floor_tile_big_grate wall wall_cracked wall_broken wall_arched wall_gated pillar pillar_decorated torch_mounted torch_lit barrel_large barrel_small_stack crates_stacked box_large keg banner_patternA_red banner_shield_red rubble_large rubble_half table_long_decorated_A candle_triple column coin_stack_small sword_shield bed_floor trunk_large_A key; do
  cp "$D/$p.gltf.glb" "$OUT/props/$p.glb"
done
cp "$D/chest.glb" "$D/chest_gold.glb" "$OUT/props/"
cp "$A/LICENSE.txt" "$OUT/LICENSE-KayKit-CC0.txt"
echo "素材就绪: $(find "$OUT" -type f | wc -l) 个文件, $(du -sh "$OUT" | cut -f1)"
