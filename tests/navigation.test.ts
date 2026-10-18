import test from 'node:test';
import assert from 'node:assert/strict';
import {canStand,HOME,moveInPark,stickAxes,travelDelta} from '../src/navigation.ts';

test('navigation accepts park floor and excludes props, edges and invalid coordinates',()=>{
 assert.ok(canStand(HOME));assert.ok(canStand({x:2,z:3}));
 for(const p of [{x:4.8,z:-.6},{x:-4.8,z:-.6},{x:7,z:-3.1},{x:-9.2,z:-.4},{x:12,z:0},{x:0,z:-5},{x:0,z:11},{x:NaN,z:0}])assert.equal(canStand(p),false,JSON.stringify(p));
});
test('movement cannot tunnel through a planter, bench or park boundary',()=>{
 const planter=moveInPark({x:4.8,z:2},{x:0,z:-5});assert.ok(planter.z>=.37);assert.ok(canStand(planter));
 const bench=moveInPark({x:7,z:-1},{x:0,z:-5});assert.ok(bench.z>=-2.3);assert.ok(canStand(bench));
 const edge=moveInPark(HOME,{x:100,z:0});assert.ok(edge.x<=11.4);assert.ok(canStand(edge));
});
test('moving diagonally slides around obstacles without increasing speed',()=>{
 const straight=travelDelta(0,1,0,.1),diagonal=travelDelta(1,1,0,.1);
 assert.ok(Math.abs(Math.hypot(straight.x,straight.z)-Math.hypot(diagonal.x,diagonal.z))<1e-8);
 const slide=moveInPark({x:4.8,z:.5},{x:.6,z:-.6});assert.ok(slide.x>5.3);assert.ok(slide.z>.37);assert.ok(canStand(slide));
});
test('travel follows the view heading and clamps long frames',()=>{
 const p=travelDelta(0,1,Math.PI/2,.1);assert.ok(p.x<0);assert.ok(Math.abs(p.z)<1e-8);
 assert.deepEqual(travelDelta(0,1,0,5),travelDelta(0,1,0,.1));
 const still=travelDelta(0,0,0,.1);assert.equal(Math.hypot(still.x,still.z),0);
});
test('XR stick deadzone rejects drift and selects standard thumbstick axes',()=>{
 assert.deepEqual(stickAxes([0,0,.05,-.15]),[0,0]);assert.deepEqual(stickAxes([.9,.8,1,-1]),[1,-1]);
 assert.deepEqual(stickAxes([1,-1]),[1,-1]);assert.deepEqual(stickAxes([]),[0,0]);
});
