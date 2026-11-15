/**
 * Realistic Mixamo characters and how each one maps the game's animation names onto the shared clip library.
 *
 * A clip spec is either 'clipName' or [clipName, from, to, release]:
 *   from / to  — fraction of the source clip to keep (trims slow wind-ups and recoveries)
 *   release    — fraction of the trimmed clip where the spell / blow lands (used to sync gameplay timing)
 * All clips live in public/assets/mx/anims.glb; characters are public/assets/mx/<file>.glb.
 */
export const MX_ANIM_REF_HIPS = 0.998; // hips height of the rig the library was exported on (Mixamo Y Bot)
export const MX_WORLD_SCALE = 1.45; // the dungeon kit is built oversized (4 m walls), so real-sized people are scaled up to match

const ZOMBIE = {
  Idle: 'z_idle', Idle_B: 'z_idle', Idle_Combat: 'z_idle', Walking_A: 'z_walk', Running_A: 'z_run', Running_B: 'z_run',
  Walking_Backwards: 'walk_back', Hit_A: ['z_hit', 0, 0.55], Hit_B: ['z_hit', 0, 0.55], Death_A: 'z_death', Death_B: 'z_death',
  Skeletons_Awaken_Floor: ['z_standup', 0.05, 0.9], Spawn_Ground: ['z_standup', 0.25, 0.9], Skeletons_Inactive_Floor_Pose: ['z_standup', 0, 0.02],
  Taunt: 'z_scream',
};

export const PROFILES = {
  // ---- playable classes
  pc_mage: {
    file: 'player',
    map: {
      Idle: 'idle', Running_A: 'run', Hit_A: ['hit', 0, 0.6], Death_A: 'death',
      cast_bolt: ['cast1h', 0.28, 0.6, 0.53], cast_ball: ['cast2h', 0.4, 0.78, 0.58], cast_nova: ['area', 0.3, 0.7, 0.5], cast_meteor: ['raise', 0.45, 0.95, 0.54],
    },
  },
  pc_warrior: {
    file: 'warrior_pc',
    map: {
      Idle: 'ax_idle', Running_A: 'run', Hit_A: ['ax_hit', 0, 0.6], Death_A: 'death',
      atk_cleave: ['ax_horiz', 0.15, 0.7, 0.4], atk_slam: ['ax_down', 0.15, 0.75, 0.5], atk_cry: ['ax_cry', 0.05, 0.85, 0.25],
      atk_spin: ['ax_spin', 0.05, 0.7, 0.11], atk_leap: ['ax_leap', 0.15, 0.75, 0.58],
    },
  },
  pc_ranger: {
    file: 'ranger_pc', builtinGear: [3],
    map: {
      Idle: 'bow_idle', Running_A: 'bow_run', Hit_A: ['bow_hit', 0, 0.6], Death_A: 'bow_death',
      bow_shot: ['bow_fire', 0.45, 0.85, 0.38], bow_power: ['bow_draw', 0.3, 1, 0.95], bow_roll: ['bow_dive', 0.05, 0.85],
    },
  },
  pc_paladin: {
    file: 'paladin_pc', scale: 1.08, builtinGear: [0, 2, 3],
    map: {
      Idle: 'idle_shield', Running_A: 'ss_run', Hit_A: ['ss_hit', 0, 0.7], Death_A: 'ss_death',
      atk_slash: ['ss_slash', 0.2, 0.6, 0.5], atk_cast: ['ss_cast', 0.1, 0.75, 0.77], atk_powerup: ['ss_powerup', 0.05, 0.85, 0.3], atk_bash: ['ss_kick', 0.15, 0.7],
    },
  },
  pc_necro: {
    file: 'necro_pc', scale: 0.95,
    map: {
      Idle: 'magic_idle', Running_A: 'run', Hit_A: ['hit', 0, 0.6], Death_A: 'death',
      cast_bolt: ['cast1h', 0.28, 0.6, 0.53], cast_ball: ['cast2h', 0.4, 0.78, 0.58], cast_nova: ['area', 0.3, 0.7, 0.5], cast_meteor: ['summon', 0.15, 0.7, 0.6],
    },
  },
  elin: { file: 'arissa', map: { Idle: 'idle_plain', talk: 'talk' } },
  skeleton: { file: 'minion', scale: 0.92, map: { ...{ Idle: 'z_idle', Running_A: 'z_run', Hit_A: ['z_hit', 0, 0.55], Death_A: 'z_death', Spawn_Ground: ['z_standup', 0.25, 0.9] }, attack: ['z_swipe', 0.1, 0.75, 0.46] } },
  roland: { file: 'roland', scale: 1.15, map: { Idle: 'idle_shield', talk: 'talk' } },
  bram: { file: 'bram', map: { Idle: 'idle_plain', talk: 'talk' } },
  vera: { file: 'vera', map: { Idle: 'idle_plain', talk: 'talk' } },
  minion: { file: 'minion', map: { ...ZOMBIE, attack: ['z_swipe', 0.1, 0.75, 0.46] } },
  warrior: { file: 'warrior', map: { ...ZOMBIE, attack: ['z_punch', 0.15, 0.75, 0.58] } },
  rogue: { file: 'rogue', map: { ...ZOMBIE, attack: ['throw', 0.1, 0.7, 0.42] } },
  mage: { file: 'mage', map: { ...ZOMBIE, Idle: 'magic_idle', Running_A: 'run', Running_B: 'run', attack: ['cast1h', 0.28, 0.6, 0.53] } },
  elite: {
    file: 'elite',
    map: { Idle: 'm_idle', Walking_A: 'm_walk', Running_A: 'm_run', Running_B: 'm_run', Hit_A: ['hit', 0, 0.5], Hit_B: ['hit', 0, 0.5], Death_A: 'm_death', Death_B: 'm_death', Taunt: 'm_roar', attack: ['m_swipe', 0.2, 0.8, 0.63] },
  },
  boss: {
    file: 'boss',
    map: {
      Idle: 'magic_idle', Idle_B: 'magic_idle', Walking_A: 'm_walk', Walking_Backwards: 'walk_back', Hit_A: ['hit', 0, 0.5], Death_A: 'fall_back', Death_B: 'fall_back',
      Spellcast_Shoot: ['cast2h', 0.4, 0.78, 0.58], Spellcast_Raise: ['area', 0.3, 0.7, 0.5], Spellcast_Long: ['blast', 0.3, 0.85, 0.55], Spellcast_Summon: ['summon', 0.15, 0.85, 0.5], attack: ['cast1h', 0.28, 0.6, 0.53],
    },
  },
};

// ponytail: locally available rigs stand in for the six planned Mixamo downloads; replace file names when those assets are imported.
PROFILES.stag={file:'warrior_pc',map:{...ZOMBIE,Idle:'ax_idle',Running_A:'ax_run',attack:['ax_combo',0.1,0.9,0.4],leap:'ax_leap',Spellcast_Raise:'ax_cry'}};

// Human armies share already loaded rigs; each role has its own readable attack timing.
const SOLDIER={Idle:'idle_shield',Idle_B:'idle_shield',Running_A:'ss_run',Running_B:'ss_run',Walking_A:'ss_run',Walking_Backwards:'walk_back',Hit_A:'ss_hit',Hit_B:'ss_hit',Death_A:'ss_death',Death_B:'ss_death',Taunt:'ss_powerup',attack:['ss_slash',.15,.8,.48]};
PROFILES.rebel={file:'bram',map:SOLDIER};
PROFILES.raider={file:'bram',map:{...SOLDIER,Idle:'ax_idle',Running_A:'ax_run',attack:['ax_horiz',.1,.85,.5]}};
PROFILES.berserker={file:'warrior_pc',map:{...SOLDIER,Idle:'ax_idle',Running_A:'ax_run',attack:['ax_combo',.1,.8,.45]}};
PROFILES.arbalist={file:'ranger_pc',builtinGear:[3],map:{...SOLDIER,Idle:'bow_idle',Running_A:'bow_run',attack:['bow_draw',.3,1,.95]}};
PROFILES.assassin={file:'arissa',map:{...SOLDIER,Idle:'idle_plain',Running_A:'run',attack:['ss_power',.1,.8,.45]}};
PROFILES.captain={file:'roland',map:SOLDIER};
PROFILES.blackknight={file:'paladin_pc',builtinGear:[0,2,3],map:SOLDIER};
PROFILES.ironking={file:'paladin_pc',builtinGear:[0,2,3],map:{...SOLDIER,attack:['ss_power',.1,.85,.5]}};

PROFILES.saltqueen={file:'vera',scale:1.15,map:{Idle:'magic_idle',Idle_B:'magic_idle',Running_A:'run',Walking_A:'m_walk',Hit_A:'hit',Death_A:'fall_back',Death_B:'fall_back',attack:['cast2h',.25,.85,.5],Spellcast_Raise:'area',Spellcast_Summon:'summon'}};
