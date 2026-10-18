import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
const results={target:'Samsung Galaxy XR / Chrome',validation:'Generic stereo WebXR runtime; not physical Samsung hardware'};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:5186')+'/?emulate-xr=1');
 await page.waitForFunction(()=>window.__sfStrike?.snapshot().ready);
 await page.locator('#xr').click();
 await page.waitForFunction(()=>window.__sfStrike.snapshot().xr);
 await page.waitForTimeout(250);
 const state=()=>page.evaluate(()=>window.__sfStrike.snapshot());
 const pinch=async(side='right')=>{
  await page.evaluate(s=>window.__xrEmulator.hands[s].updatePinchValue(1),side);
  await page.waitForTimeout(90);
  await page.evaluate(s=>window.__xrEmulator.hands[s].updatePinchValue(0),side);
  await page.waitForTimeout(180);
 };
 const aim=async(side='right')=>{
  // Read the target position, then orient the emulated input device. Scoring
  // still goes through WebXR joint poses and the production ray intersection.
  await page.evaluate(s=>{
   const t=window.__sfStrike.game.targets[0],h=window.__xrEmulator.hands[s];
   const dx=t.x-h.position.x,dy=t.y-h.position.y,dz=t.z-(h.position.z+6.5);
   const n=Math.hypot(dx,dy,dz),q=[dy/n,-dx/n,0,1-dz/n],m=Math.hypot(...q);
   h.quaternion.set(...q.map(v=>v/m));
  },side);
  await page.waitForTimeout(80);
 };
 results.inputs=await page.evaluate(()=>[...window.__sfStrike.renderer.xr.getSession().inputSources].map(s=>({hand:!!s.hand,side:s.handedness,mode:s.targetRayMode})));
 assert.equal(results.inputs.length,2);assert.ok(results.inputs.every(s=>s.hand));
 await pinch();assert.equal((await state()).phase,'playing');
 // Pinching at a drone now selects only; it must not shoot.
 await aim();await pinch();assert.equal((await state()).shots,0,'pinch must not fire');
 const pose=async(side,id)=>page.evaluate(({side,id})=>{window.__xrEmulator.hands[side].poseId=id;},{side,id});
 const trigger=async(side='right')=>{
  await pose(side,'point');
  await page.waitForFunction(s=>window.__sfStrike.snapshot().handTriggers.some(h=>h.side===s&&h.state==='ready'),side);
  await aim(side);await pose(side,'trigger');
  await page.waitForFunction(s=>window.__sfStrike.snapshot().handTriggers.some(h=>h.side===s&&h.state==='fired'),side);
 };
 await trigger();assert.ok((await state()).score>=100,'right-hand index curl must score');
 results.rightHand=await state();
 await page.waitForTimeout(450);assert.equal((await state()).shots,1,'holding a curl must not repeat fire');
 await page.waitForFunction(()=>window.__sfStrike.game.targets.length>0);
 await trigger('left');assert.ok((await state()).hits>=2,'left-hand index curl must score');
 results.leftHand=await state();
 // A hand reappearing curled must not discharge a previously armed trigger.
 await pose('right','point');await page.waitForTimeout(150);
 await page.evaluate(()=>window.__xrEmulator.hands.right.connected=false);await page.waitForTimeout(90);
 await pose('right','trigger');await page.evaluate(()=>window.__xrEmulator.hands.right.connected=true);
 await page.waitForTimeout(220);assert.equal((await state()).shots,2,'tracking recovery must not fire');
 // Navigation, menu selection and pause also clear the trigger latch.
 await pose('left','point');await page.waitForTimeout(150);await page.keyboard.press('Escape');
 assert.equal((await state()).phase,'paused');await pose('left','trigger');await pinch();
 assert.equal((await state()).phase,'playing');assert.equal((await state()).shots,2,'resuming with a curl must not fire');
 results.triggerChecks=['pinch does not fire','right and left index curls score','held curl fires once','tracking recovery requires extension','resume requires extension'];
 await page.screenshot({path:'docs/screenshots/xr-stereo.png'});
 // Let the real clock and drones breach; restart using only a pinch.
 await page.waitForFunction(()=>window.__sfStrike.snapshot().phase==='over',null,{timeout:40000}).catch(async error=>{throw new Error(error.message+' State: '+JSON.stringify(await state()));});
 assert.equal((await state()).shields,0);await pinch();
 assert.equal((await state()).phase,'playing');assert.equal((await state()).score,0);
 results.replay='pinch restarted after three breaches';
 await page.evaluate(()=>window.__xrEmulator.primaryInputMode='controller');await page.waitForTimeout(180);
 await page.evaluate(()=>{
  const t=window.__sfStrike.game.targets[0],c=window.__xrEmulator.controllers.right;
  const dx=t.x-c.position.x,dy=t.y-c.position.y,dz=t.z-(c.position.z+6.5);
  const n=Math.hypot(dx,dy,dz),q=[dy/n,-dx/n,0,1-dz/n],m=Math.hypot(...q);c.quaternion.set(...q.map(v=>v/m));
 });
 await page.waitForTimeout(80);await page.evaluate(()=>window.__xrEmulator.controllers.right.updateButtonValue('trigger',1));
 await page.waitForTimeout(200);await page.evaluate(()=>window.__xrEmulator.controllers.right.updateButtonValue('trigger',0));
 assert.ok((await state()).hits>=1,'controller trigger must still hit drones');
 results.controller='physical-controller input path retains trigger firing';
 await page.evaluate(()=>window.__sfStrike.renderer.xr.getSession().end());
 await page.waitForFunction(()=>!window.__sfStrike.snapshot().xr);
 assert.equal((await state()).phase,'paused');
 await page.locator('#resume').click();assert.equal((await state()).phase,'playing');
 results.exit='XR exit pauses; desktop resume works';results.errors=errors;
 assert.deepEqual(errors,[]);
 await fs.writeFile('docs/xr-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
}finally{await browser.close()}
