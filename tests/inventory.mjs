import assert from 'node:assert/strict';
import * as T from 'three';
import {Player} from '../src/game/player.js';
import {UI} from '../src/game/ui.js';
import {CLASSES} from '../src/game/classes.js';
import {makeItem,LEGENDARIES} from '../src/game/items.js';
import {Level} from '../src/game/level.js';
import {lootLanding} from '../src/game/loot-placement.js';
const noop=()=>{};
function hero(cls='mage'){
 const g={enemies:[],audio:{play:noop},ui:{refreshStats:noop,toast:noop},save:noop,input:{swallow:noop}},p=Object.assign(Object.create(Player.prototype),{C:CLASSES[cls],cls,level:6,equip:{},bag:Array(40).fill(null),buffs:{},game:g,pos:new T.Vector3(),alive:true,hp:100,refreshGear:noop});
 for(const base of p.C.start){const it=makeItem(base,{ilvl:1});it.affixes=[];p.equip[it.slot]=it;}p.recalc();g.player=p;return p;
}
const plain=(base,affixes=[],opts={})=>{const it=makeItem(base,{ilvl:1,...opts});it.affixes=affixes;return it;};
for(const cls of Object.keys(CLASSES)){
 const p=hero(cls),main=p.C.main,secondary=['str','dex','int'].find(k=>k!==main),good=plain('ring',[{k:main,v:20}]),irrelevant=plain('ring',[{k:secondary,v:20}]);
 assert(p.compareGear(good).upgrade,cls+' values its primary stat');assert(!p.compareGear(irrelevant).upgrade,'secondary damage stats do not falsely improve this class');
 const strong=plain(p.C.start[0],[],{ilvl:8});assert(p.compareGear(strong).upgrade);p.equip.weapon=strong;p.recalc();assert(!p.compareGear(plain(p.C.start[0])).upgrade);
 const before=JSON.stringify(p.toSave()),hp=p.hp,flags=p.flags;for(let i=0;i<10;i++)p.compareGear(good);assert.equal(JSON.stringify(p.toSave()),before);assert.equal(p.hp,hp);assert.equal(p.flags,flags,'comparison cannot mutate actual derived stats');
}
{
 const p=hero();assert.equal(p.compareGear(plain('bow')).status,'unusable');assert(!UI.prototype.gearComparisonHtml(p.compareGear(plain('bow'))).includes('NaN'));
 const starred=plain('robe',[],{ilvl:3});p.equip.chest=structuredClone(starred);p.recalc();starred.stars=3;assert(p.compareGear(starred).upgrade,'stars enter actual enhanced stat comparison');
 const legend=LEGENDARIES.find(l=>l.id==='stormcoil');p.equip.weapon=makeItem(legend.base,{ilvl:3,rarity:'legendary',legendary:legend});p.recalc();assert.equal(p.compareGear(plain('staff',[],{ilvl:30})).status,'choice','do not silently recommend losing a build power');
 const wrong=LEGENDARIES.find(l=>l.id==='warlordhelm');assert.equal(p.compareGear(makeItem(wrong.base,{ilvl:10,rarity:'legendary',legendary:wrong})).status,'choice');
}
// Pickups and purchases share addItem; failed full-bag acquisitions never queue offers.
{
 const p=hero(),ui=Object.assign(Object.create(UI.prototype),{game:p.game,gearOffers:[],el:{gearOffer:{hidden:true}},renderGearOffer(it,cmp){this.shown={it,cmp};},toast:noop,refreshStats:noop,refreshBag:noop,refreshShop:noop,_stock:[]});p.game.ui=ui;Object.defineProperty(ui,'panelOpen',{value:false,configurable:true});
 const one=plain('staff',[],{ilvl:5}),two=plain('staff',[],{ilvl:10});assert(p.addItem(one));ui.updateGearOffer();assert.equal(ui.shown.it,one);assert(!ui.el.gearOffer.hidden);
 p.moveBag(0,12);ui.resolveGearOffer(true);assert.equal(p.equip.weapon,one);assert(p.bag[12]&&p.bag[12]!==one,'old gear returns to the moved bag slot');
 assert(p.addItem(two));ui.updateGearOffer();ui.resolveGearOffer(false);assert.equal(p.equip.weapon,one);assert(p.bag.includes(two));assert.equal(ui.gearOffers.length,0);
 p.gold=100000;const bought=plain('staff',[],{ilvl:15});ui._stock=[bought];ui.hideTip=noop;UI.prototype.buy.call(ui,0);assert(p.bag.includes(bought));assert(ui.gearOffers.includes(bought));assert.equal(ui._stock.length,0);ui.updateGearOffer();
 const finalGold=p.gold;p.bag=Array(40).fill(plain('boots'));const unable=plain('staff',[],{ilvl:25});ui._stock=[unable];UI.prototype.buy.call(ui,0);assert.equal(p.gold,finalGold);assert.equal(ui._stock[0],unable);assert(!ui.gearOffers.includes(unable));
 // Stale recommendations disappear after selling or replacing their item.
 ui.updateGearOffer();assert(ui.el.gearOffer.hidden);assert.equal(ui.gearOffers.length,0);
 p.bag=Array(40).fill(null);p.addItem(two);p.addItem(bought);ui.updateGearOffer();ui.resolveGearOffer(true);ui.resolveGearOffer(true);assert.equal(p.equip.weapon,two,'a repeated click cannot equip an unseen next offer');
 ui.updateGearOffer();assert.equal(ui.shown.it,bought);
 p.game.enemies=[{alive:true,pos:new T.Vector3(1,0,0)}];ui.updateGearOffer();assert(ui.el.gearOffer.hidden,'a recommendation must not cover combat controls');p.game.enemies=[];ui.updateGearOffer();assert(!ui.el.gearOffer.hidden);
 p.unequip('weapon');assert(!ui.gearOffers.includes(p.bag.find(it=>it===two)),'manual unequipping never creates a new pickup prompt');
}
// Closed rooms/gates: a locally free landing across a barrier is still rejected.
{
 const w=9,h=7,grid=Array.from({length:h},(_,z)=>Array.from({length:w},(_,x)=>x===0||z===0||x===w-1||z===h-1||x===4?'#':'.'));
 const lv=Object.assign(Object.create(Level.prototype),{w,h,def:{g:grid},circles:[],boxes:[],solidGrid:Uint8Array.from(grid.flat(),v=>v==='#'?1:0)}),from=lv.center(2,3),at=lv.center(5,3);
 const p=lootLanding(lv,at,at,{pos:from});assert(p.x<16);assert(!lv.blocked(p.x,p.z,.75));assert(lv.findPath(from.x,from.z,p.x,p.z).length);
 const corner=new T.Vector3(4.1,0,4.1),q=lootLanding(lv,corner,new T.Vector3(3,0,3),{pos:from});assert(!lv.blocked(q.x,q.z,.75));
}
console.log('Class-aware enhanced gear comparison, legendary tradeoffs, pickup/shop/full-bag offers, stale/moved item handling, single-card acceptance, combat deferral and closed-gate loot recovery passed.');
