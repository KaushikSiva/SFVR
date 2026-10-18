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
  // Wait for the newly spawned drone's first motion update before aiming.
  await page.waitForFunction(()=>window.__sfStrike.game.targets[0]?.age>.12&&window.__sfStrike.game.reloadLeft===0);
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
 assert.equal((await state()).shots,0,'starting a round must not also fire');
 const pose=async(side,id)=>page.evaluate(({side,id})=>{window.__xrEmulator.hands[side].poseId=id;},{side,id});
 const readyTarget=async()=>page.waitForFunction(()=>window.__sfStrike.game.targets.length>0);
 for(const side of ['right','left']){
  await readyTarget();await aim(side);const before=await state();
  await pose(side,'twoFinger');
  await page.waitForFunction(s=>window.__sfStrike.snapshot().handTriggers.some(h=>h.side===s&&h.state==='firing'),side);
  await page.waitForTimeout(320);let current=await state();
  assert.ok(current.hits>before.hits,side+' two-finger pose must hit a drone');
  assert.ok(current.shots>=before.shots+2,'holding two fingers must repeat fire');
  results[side+'TwoFinger']=current;
  await pose(side,'default');await page.waitForTimeout(80);const stopped=(await state()).shots;
  await page.waitForTimeout(250);assert.equal((await state()).shots,stopped,'folding fingers must stop firing');
 }
 // Either hand also supports native pinch-to-fire and release-to-stop.
 for(const side of ['right','left']){
  await readyTarget();await aim(side);const before=await state();
  await page.evaluate(s=>window.__xrEmulator.hands[s].updatePinchValue(1),side);
  await page.waitForTimeout(380);const current=await state();
  assert.ok(current.hits>before.hits,side+' pinch must hit a drone: '+JSON.stringify({before,current}));
  assert.ok(current.shots>=before.shots+2,'holding a pinch must repeat fire');
  await page.evaluate(s=>window.__xrEmulator.hands[s].updatePinchValue(0),side);
  await page.waitForTimeout(80);const stopped=(await state()).shots;
  await page.waitForTimeout(250);assert.equal((await state()).shots,stopped,'releasing pinch must stop firing');
  results[side+'Pinch']=current;
 }
 // An interrupted two-finger burst cannot restart just because a hand reappears.
 await readyTarget();await aim();await pose('right','twoFinger');
 await page.waitForFunction(()=>window.__sfStrike.snapshot().handTriggers.some(h=>h.side==='right'&&h.state==='firing'));
 await page.evaluate(()=>window.__xrEmulator.hands.right.connected=false);await page.waitForTimeout(90);
 const stopped=(await state()).shots;
 await page.evaluate(()=>window.__xrEmulator.hands.right.connected=true);
 await page.waitForTimeout(300);assert.equal((await state()).shots,stopped,'tracking recovery must require gesture release');
 await pose('right','default');await page.waitForTimeout(90);
 await pose('right','twoFinger');await page.waitForFunction(()=>window.__sfStrike.snapshot().handTriggers.some(h=>h.side==='right'&&h.state==='firing'));
 await page.keyboard.press('Escape');const pausedShots=(await state()).shots;
 assert.equal((await state()).phase,'paused');await page.keyboard.press('Escape');
 await page.waitForTimeout(300);assert.equal((await state()).shots,pausedShots,'resume must require gesture release');
 await pose('right','default');await page.waitForTimeout(100);
 // Preserve the earlier single-index curl option.
 await readyTarget();await aim();const beforeCurl=await state();await pose('right','point');
 await page.waitForFunction(()=>window.__sfStrike.snapshot().handTriggers.some(h=>h.side==='right'&&h.state==='ready'));
 await pose('right','trigger');await page.waitForFunction(()=>window.__sfStrike.snapshot().handTriggers.some(h=>h.side==='right'&&h.state==='fired'));
 assert.equal((await state()).shots,beforeCurl.shots+1);await page.waitForTimeout(250);
 assert.equal((await state()).shots,beforeCurl.shots+1,'single-index curl stays one shot');
 await pose('right','default');
 results.triggerChecks=['both hands hit with two-finger bursts','both hands hit with pinch bursts','release stops either burst','tracking recovery requires gesture release','resume requires gesture release','single-index curl still works'];
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
