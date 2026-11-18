/** Each attack has an audible warning and one release cue at its real impact frame. */
export const BOSS_SOUNDS={
 saltqueen:{fan:['sq_blades_draw','sq_blades_release'],fault:['sq_fault_charge','sq_fault_break'],storm:['sq_storm_rise','sq_storm_roar'],crown:['sq_crown_chime','sq_crown_seal'],prism:['sq_prism_tune','sq_prism_fire']},
 winterabbess:{cleave:['wa_scythe_draw','wa_scythe_cut'],lances:['wa_lances_form','wa_lances_launch'],requiem:['wa_requiem_breath','wa_requiem_bell'],procession:['wa_procession_steps','wa_procession_march'],whiteout:['wa_whiteout_hush','wa_whiteout_burst']}
};
export const SALT_BOSS_SOUNDS=Object.values(BOSS_SOUNDS.saltqueen).flat();
export const ABBESS_SOUNDS=Object.values(BOSS_SOUNDS.winterabbess).flat();
export function bossSound(e,kind,release=false,fallback='w_ice'){
 e.game.audio.play(BOSS_SOUNDS[e.type]?.[kind]?.[release?1:0]??fallback,e.pos,release ? .8 : .62);
}
