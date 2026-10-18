import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const url=process.env.TEST_URL||'http://127.0.0.1:5186';
const results={validation:'Generic WebXR input regression, not physical hardware'},errors=[];
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+'/?emulate-xr=1');await p.waitForFunction(()=>window.__sfStrike?.snapshot().ready);await p.locator('#xr').click();await p.waitForFunction(()=>window.__sfStrike.snapshot().xr);
 const state=()=>p.evaluate(()=>window.__sfStrike.snapshot());
 const pinch=async(value,side='right')=>{await p.evaluate(({value,side})=>window.__xrEmulator.hands[side].updatePinchValue(value),{value,side});await p.waitForTimeout(130)};
 const aim=async(point,side='right')=>{
  await p.evaluate(({point,side})=>{const a=window.__sfStrike,c=a.scene.getObjectByProperty('type','PerspectiveCamera'),h=window.__xrEmulator.hands[side];const target=c.position.clone().set(...point);c.parent.worldToLocal(target);const dx=target.x-h.position.x,dy=target.y-h.position.y,dz=target.z-h.position.z,n=Math.hypot(dx,dy,dz),q=[dy/n,-dx/n,0,1-dz/n],m=Math.hypot(...q);h.quaternion.set(...q.map(v=>v/m));},{point,side});await p.waitForTimeout(90);
 };
 await pinch(1);await pinch(0);assert.equal((await state()).phase,'playing');
 // A room-scale offset must not become an extra offset after teleporting.
 await p.evaluate(()=>window.__xrEmulator.position.set(.7,1.6,.4));await p.waitForTimeout(100);
 await aim([2,0,3]);const shots=(await state()).shots;await pinch(1);
 let s=await state();assert.ok(s.navigation.teleporting);assert.ok(s.navigation.target.valid);assert.equal(s.shots,shots);await p.screenshot({path:'docs/screenshots/teleport.png'});
 await pinch(0);s=await state();assert.ok(Math.abs(s.navigation.position.x-2)<.04);assert.ok(Math.abs(s.navigation.position.z-3)<.04);assert.equal(s.shots,shots);results.handTeleport='release lands tracked viewer at destination without firing';
 await aim([4.8,0,-.6]);await pinch(1);assert.equal((await state()).navigation.target.valid,false);await pinch(0);assert.deepEqual((await state()).navigation.position,s.navigation.position);results.blockedDestination='planter rejected';
 await aim([1,0,2]);await pinch(1);await aim([0,8,-6]);await pinch(0);assert.deepEqual((await state()).navigation.position,s.navigation.position);results.cancel='moving the ray off the floor cancels teleport';
 await aim([1,0,2]);await pinch(1);await p.evaluate(()=>window.__xrEmulator.hands.right.connected=false);await p.waitForTimeout(180);assert.equal((await state()).navigation.teleporting,false);assert.deepEqual((await state()).navigation.position,s.navigation.position);await p.evaluate(()=>{window.__xrEmulator.hands.right.updatePinchValue(0);window.__xrEmulator.hands.right.connected=true});await p.waitForTimeout(180);results.trackingLoss='disconnect cancels the armed teleport without moving';
 await aim([1,0,2]);await pinch(1);await p.keyboard.press('Escape');await pinch(0);assert.equal((await state()).navigation.teleporting,false);assert.deepEqual((await state()).navigation.position,s.navigation.position);await p.keyboard.press('Escape');results.pause='pause cancels teleport';
 // HOME is a real ray-selected HUD button, not a test hook.
 const home=await p.evaluate(()=>{const hud=window.__sfStrike.scene.getObjectByName('XR status and movement');return hud.localToWorld(hud.position.clone().set(.395, -.075,0)).toArray()});
 await aim(home);await pinch(1);await pinch(0);s=await state();assert.ok(Math.abs(s.navigation.position.x)<.04);assert.ok(Math.abs(s.navigation.position.z-6.5)<.04);results.home='HUD HOME returns the tracked viewer to the start';
 // Two-finger fire must not activate on a navigation target either.
 const beforeTwoFinger=(await state()).shots;await aim([2,0,3]);
 await p.evaluate(()=>window.__xrEmulator.hands.right.poseId='twoFinger');await p.waitForTimeout(350);
 assert.equal((await state()).shots,beforeTwoFinger);assert.equal((await state()).navigation.teleporting,false);
 const homeAfterReset=await p.evaluate(()=>{const hud=window.__sfStrike.scene.getObjectByName('XR status and movement');return hud.localToWorld(hud.position.clone().set(.395,-.075,0)).toArray()});
 await aim(homeAfterReset);await p.waitForTimeout(220);assert.equal((await state()).shots,beforeTwoFinger);
 await p.evaluate(()=>window.__xrEmulator.hands.right.poseId='default');await p.waitForTimeout(90);
 results.gestureNavigation='two-finger pose on ground or HOME never fires or teleports';
 // Swap to generic standard controllers to verify sticks and snap-turn latching.
 await p.evaluate(()=>window.__xrEmulator.primaryInputMode='controller');await p.waitForTimeout(200);
 await p.evaluate(()=>window.__xrEmulator.controllers.left.updateAxis('thumbstick','y-axis',-1));await p.waitForTimeout(450);await p.evaluate(()=>window.__xrEmulator.controllers.left.updateAxis('thumbstick','y-axis',0));
 s=await state();assert.ok(s.navigation.position.z<6.1);const before=s.navigation.position;
 await p.evaluate(()=>window.__xrEmulator.controllers.right.updateAxis('thumbstick','x-axis',1));await p.waitForTimeout(450);s=await state();assert.ok(Math.abs(s.navigation.yaw+Math.PI/4)<.01);assert.ok(Math.hypot(s.navigation.position.x-before.x,s.navigation.position.z-before.z)<.04);await p.waitForTimeout(250);assert.equal((await state()).navigation.yaw,s.navigation.yaw);
 await p.evaluate(()=>window.__xrEmulator.controllers.right.updateAxis('thumbstick','x-axis',0));await p.waitForTimeout(100);await p.evaluate(()=>window.__xrEmulator.controllers.right.updateAxis('thumbstick','x-axis',1));await p.waitForTimeout(150);assert.ok(Math.abs((await state()).navigation.yaw+Math.PI/2)<.01);results.controller='left-stick movement; one 45° turn per right-stick deflection, around the viewer';
 await p.evaluate(()=>window.__sfStrike.renderer.xr.getSession().end());await p.waitForFunction(()=>!window.__sfStrike.snapshot().xr);assert.equal((await state()).phase,'paused');await p.locator('#resume').click();
 await p.keyboard.down('w');await p.waitForTimeout(450);await p.keyboard.up('w');s=await state();assert.ok(s.navigation.position.z<6.1);await p.keyboard.press('h');s=await state();assert.deepEqual(s.navigation.position,{x:0,z:6.5});await p.keyboard.press('Escape');await p.keyboard.down('d');await p.waitForTimeout(300);await p.keyboard.up('d');assert.deepEqual((await state()).navigation.position,s.navigation.position);results.desktop='W moves forward; H resets; pause stops movement';
 assert.deepEqual(errors,[]);results.errors=errors;await fs.writeFile('docs/locomotion-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
