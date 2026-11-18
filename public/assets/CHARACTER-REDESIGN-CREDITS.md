# Character replacement credits — 2026-11-17

These complete character meshes replace the previous snowman, Winter Abbess and Salt Queen costumes in 烬语者. Source authors do not endorse this game.

## Salt Queen — `mx/salt_sovereign.glb`

**Kalestra the Sorceress**, by **Alena (@aed)**.
Original: https://sketchfab.com/3d-models/kalestra-the-sorceress-87637fba3f7c41d2bf23df2987185102
License: **Creative Commons Attribution 4.0 International (CC BY 4.0)**, https://creativecommons.org/licenses/by/4.0/
Downloaded licensed copy: https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-080/87637fba3f7c41d2bf23df2987185102.glb

Modifications for this game: removed display ground, text and floating magic decorations; retained the complete character, authored face, clothing and PBR textures; fitted a new deform skeleton and Idle/Walk/Cast/Strike/Hit/Death actions; bound the folio to the right hand; added a small crown; normalized scale and feet; compressed embedded textures to WebP. The original model is static; the game animations are new adaptations.

## Winter Abbess — `mx/winter_abbess.glb`

**Old Lady**, by **Čestmír Dammer (CDmir)** with **TinyWorlds**.
Original: https://opengameart.org/content/old-lady
Download: https://opengameart.org/sites/default/files/oldlady-v2.blend
License: **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/

Modifications: retained the complete aged face/body, original deform rig and packed diffuse/normal textures; converted materials to PBR and dark woven robes; added a fitted head veil, ivory face frame and shoulder wimple bound to the actual head joint; replaced the source sitting action with game actions; normalized feet and scale; compressed embedded textures. No Mixamo character is hidden beneath this model.

## Snow beast — `mx/snowbeast.glb`

**Giant Mutant**, by **Eldritch Grim**.
Original: https://opengameart.org/content/giant-mutant
Download: https://opengameart.org/sites/default/files/giant_mutant.zip
License: **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/

Modifications: retained the complete body and native skeleton/Idle/Giant Run/Punch/Jump Slam/Death actions; rebuilt damaged source normals; added an original baked short-fur normal texture and small skull-bound eyes; applied a cold fur material; normalized the actual idle pose and removed horizontal root motion so gameplay collision controls movement. The source silhouette is retained without aggressive decimation. Jump Slam is trimmed and timed to the existing warning/impact. Fur normal generation is original code in tools/build-snowbeast-fur.py.

## Loading and processing

Each GLB embeds its own textures and actions. Menus do not request these three models. Salt Queen loads in the salt tomb; snow beasts in the mountain pass; Winter Abbess in the monastery. Shared geometry/textures are released by the existing map resource owner, not by character costumes. Existing save keys, difficulty, loot and progression are unchanged by these replacements.

Processing: tools/prepare-redesign-models.mjs, tools/normalize-yeti.mjs, tools/build-boss-models.py, tools/pack-boss-redesign.mjs. Original downloads are in the local raw/character-redesign directory, excluded from the deployed runtime.

2026-11-18 revision: added segmented hair/veil/robe skin joints, rebuilt knee/ankle gait and asymmetrical casts, narrowed the Queen's side hair silhouette, recolored her base-color maps to aged salt/ivory, replaced the Abbess's white shoulder bib with dark curved drapery, and added original forged crown/reliquary meshes. Runtime damped secondary motion responds to turns and displacement; it is constrained to small angles and does not change collision or attack footprints. Source authors and licenses remain as credited above.

修正女王原 GLB 身体/头发使用 BLEND 导致的透明排序错误，改为保留镂空边缘的 alpha mask，并保持深度写入；浏览器近景验证面部不再被后方发片盖住。
