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
  // still goes through WebXR select events and the production ray intersection.
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
 await aim();await pinch();assert.ok((await state()).score>=100,'right-hand pinch must score');
 results.rightHand=await state();
 await page.waitForFunction(()=>window.__sfStrike.game.targets.length>0);
 await aim('left');await pinch('left');assert.ok((await state()).hits>=2,'left-hand pinch must score');
 results.leftHand=await state();
 await page.screenshot({path:'docs/screenshots/xr-stereo.png'});
 // Let the real clock and drones breach; restart using only a pinch.
 await page.waitForFunction(()=>window.__sfStrike.snapshot().phase==='over',null,{timeout:40000});
 assert.equal((await state()).shields,0);await pinch();
 assert.equal((await state()).phase,'playing');assert.equal((await state()).score,0);
 results.replay='pinch restarted after three breaches';
 await page.evaluate(()=>window.__sfStrike.renderer.xr.getSession().end());
 await page.waitForFunction(()=>!window.__sfStrike.snapshot().xr);
 assert.equal((await state()).phase,'paused');
 await page.locator('#resume').click();assert.equal((await state()).phase,'playing');
 results.exit='XR exit pauses; desktop resume works';results.errors=errors;
 assert.deepEqual(errors,[]);
 await fs.writeFile('docs/xr-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
}finally{await browser.close()}
