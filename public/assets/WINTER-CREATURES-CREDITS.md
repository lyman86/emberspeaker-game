# Winter creature assets

Author: Quaternius — Cute Animated Monsters Pack (August 2020).
Source: https://quaternius.com/packs/cutemonsters.html
Author-published glTF directory: https://drive.google.com/drive/folders/1mbSG9TxThs-t7yr4KEQjnSeG3MuZvM5o
License: Creative Commons CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/
Verified from the author's pack page on 2026-11-16; personal and commercial use allowed.

- `mx/snowyeti.glb`: author's `Yeti.gltf`, Drive file `1VWy3rziYAJ-bvEIEQTIxyvSMAn23eQvP`.
- `mx/icegiant.glb`: author's `Cyclops.gltf`, Drive file `1L_8RP2pSbcmKieWMXd_pbQd3n8lFq0zY`.

Repacked by `tools/pack-winter-creatures.py`, without changing geometry, textures, skin or native animation data. The unlit material flag is removed so the game lights can shade the surfaces. Runtime adaptation sets scale, frost/fur surface materials and gameplay clip aliases, and adds authored torso/arms/legs/claws around the native facial rig. The Yeti uses shaggy rounded anatomy; the giant uses faceted ice plates and shoulder crystals. No external animation or texture requests are needed. Only chapter-six maps request these two models; the menu and other chapters do not preload them.
