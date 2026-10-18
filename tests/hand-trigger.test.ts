import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HandTrigger,measureTrigger,type TriggerSample} from '../src/hand-trigger';
import {pointHandPose} from 'iwer/lib/device/configs/hand/point.js';
import {pinchHandPose} from 'iwer/lib/device/configs/hand/pinch.js';
import {relaxedHandPose} from 'iwer/lib/device/configs/hand/relaxed.js';

const open:TriggerSample={index:.98,middle:.55,ring:.55,thumbGap:1};
const closed:TriggerSample={...open,index:.58};
const twoFingers:TriggerSample={...open,middle:.98};
const arm=(t:HandTrigger,start=0)=>{for(let ms=start;ms<=start+80;ms+=20)assert.equal(t.update(open,ms),false);};
test('a deliberate curl fires once; extending rearms',()=>{
 const t=new HandTrigger();arm(t);assert.equal(t.state,'ready');
 assert.equal(t.update(closed,100),false);assert.equal(t.update(closed,130),true);
 for(let ms=150;ms<450;ms+=20)assert.equal(t.update(closed,ms),false);
 arm(t,450);assert.equal(t.update(closed,550),false);assert.equal(t.update(closed,580),true);
});
test('joint classifier leaves pinch to select events; open palm and fist do not fire',()=>{
 for(const sample of [{...closed,thumbGap:.1},{...closed,middle:.98,ring:.98},closed]){
  const t=new HandTrigger();for(let ms=0;ms<400;ms+=20)assert.equal(t.update(sample,ms),false);
 }
 const t=new HandTrigger();arm(t);t.update({...closed,thumbGap:.1},100);
 assert.equal(t.update(closed,120),false);assert.equal(t.update(closed,160),false);
});
test('two extended fingers hold fire after a short dwell and stop when folded',()=>{
 const t=new HandTrigger();
 for(let ms=0;ms<120;ms+=20)assert.equal(t.update(twoFingers,ms),false);
 assert.equal(t.update(twoFingers,120),true);assert.equal(t.state,'firing');
 for(let ms=140;ms<400;ms+=20)assert.equal(t.update(twoFingers,ms),true);
 assert.equal(t.update(closed,400),false);assert.notEqual(t.state,'firing');
});
test('two-finger hysteresis tolerates slight bending but rejects open palms and pinches',()=>{
 const t=new HandTrigger();t.update(twoFingers,0);t.update(twoFingers,80);t.update(twoFingers,140);
 assert.equal(t.update({...twoFingers,index:.86,middle:.87},160),true);
 assert.equal(t.update({...twoFingers,ring:.98},180),false);
 for(let ms=200;ms<400;ms+=20)assert.equal(t.update({...twoFingers,thumbGap:.1},ms),false);
});
test('interrupted two-finger bursts require release before restarting',()=>{
 for(const interrupt of [(t:HandTrigger)=>t.update(null,160),(t:HandTrigger)=>t.update(twoFingers,160,true),(t:HandTrigger)=>t.reset(),(t:HandTrigger)=>t.update(twoFingers,400)]){
  const t=new HandTrigger();t.update(twoFingers,0);t.update(twoFingers,80);assert.equal(t.update(twoFingers,140),true);interrupt(t);
  for(let ms=420;ms<650;ms+=20)assert.equal(t.update(twoFingers,ms),false);
  t.update(closed,660);t.update(twoFingers,680);t.update(twoFingers,760);assert.equal(t.update(twoFingers,820),true);
 }
});
test('a deliberate pinch releases a two-finger burst so either gesture can be used next',()=>{
 const t=new HandTrigger();t.update(twoFingers,0);t.update(twoFingers,80);assert.equal(t.update(twoFingers,140),true);
 t.release();t.update(null,160,true);t.update(twoFingers,180);t.update(twoFingers,260);assert.equal(t.update(twoFingers,320),true);
});
test('tracking loss, navigation, pause and a frame gap require fresh extension',()=>{
 for(const reset of [(t:HandTrigger)=>t.update(null,100),(t:HandTrigger)=>t.update(open,100,true),(t:HandTrigger)=>t.reset(),(t:HandTrigger)=>t.update(closed,300)]){
  const t=new HandTrigger();arm(t);reset(t);
  assert.equal(t.update(closed,320),false);assert.equal(t.update(closed,360),false);
  arm(t,380);assert.equal(t.update(closed,480),false);assert.equal(t.update(closed,520),true);
 }
});
test('brief finger jitter cannot arm or fire',()=>{
 const t=new HandTrigger();t.update(open,0);t.update(closed,20);t.update(closed,60);assert.notEqual(t.state,'ready');
 arm(t,80);assert.equal(t.update(closed,180),false);assert.equal(t.update({...open,index:.8},200),false);
 assert.equal(t.update(closed,220),false);assert.equal(t.update(closed,240),false);assert.equal(t.update(closed,260),true);
});
test('hand measurement is invariant to size, mirroring and world transforms',()=>{
 const sample=(pose:typeof pointHandPose,scale=1,mirror=1)=>measureTrigger(name=>{
  const m=pose.jointTransforms[name].offsetMatrix;
  // Rotate about Y, translate and scale. Right-hand mirroring keeps ratios.
  return {x:4+m[14]*scale,y:2+m[13]*scale,z:8-m[12]*scale*mirror};
 });
 const measured=sample(pointHandPose)!;
 assert.ok(measured.index>.9&&measured.middle<.85&&measured.ring<.85&&measured.thumbGap>.38);
 for(const scale of [.65,1.3])for(const mirror of [-1,1]){
  const transformed=sample(pointHandPose,scale,mirror)!;
  for(const key of Object.keys(measured) as (keyof TriggerSample)[])assert.ok(Math.abs(measured[key]-transformed[key])<1e-10);
 }
 assert.ok(sample(pinchHandPose)!.thumbGap<.38);
 assert.ok(sample(relaxedHandPose)!.middle>.85);
 assert.equal(measureTrigger(()=>null),null);
 assert.equal(measureTrigger(()=>({x:0,y:0,z:0})),null);
});
