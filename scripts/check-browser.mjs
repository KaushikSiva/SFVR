import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.TEST_URL||'http://127.0.0.1:5186';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];const results={};
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url);await p.waitForFunction(()=>window.__sfStrike?.snapshot().ready,{},{timeout:60000});await p.screenshot({path:'docs/screenshots/title.png'});
 await p.locator('#play').click();await p.waitForTimeout(300);
 let state=await p.evaluate(()=>window.__sfStrike.snapshot());const target=state.targets[0];await p.mouse.click(target.x,target.y);await p.waitForTimeout(100);state=await p.evaluate(()=>window.__sfStrike.snapshot());assert.ok(state.score>0,'real mouse hit must score');assert.equal(state.hits,1);results.firstHit=state.score;
 await p.keyboard.press('Escape');const frozen=await p.evaluate(()=>window.__sfStrike.snapshot().elapsed);await p.waitForTimeout(450);assert.equal(await p.evaluate(()=>window.__sfStrike.snapshot().elapsed),frozen);await p.locator('#resume').click();
 await p.keyboard.press('r');assert.ok(await p.evaluate(()=>window.__sfStrike.snapshot().reloading>0));await p.waitForTimeout(1400);assert.equal(await p.evaluate(()=>window.__sfStrike.snapshot().ammo),12);
 // Play the real browser loop for an entire round using only pointer inputs.
 const deadline=Date.now()+90000;let captured=false;
 while(Date.now()<deadline){state=await p.evaluate(()=>window.__sfStrike.snapshot());if(state.phase==='over')break;
  const t=state.targets.find(t=>t.visible);if(t&&!state.reloading)await p.mouse.click(t.x,t.y);
  if(state.elapsed>12&&!captured){await p.screenshot({path:'docs/screenshots/playing.png'});captured=true;}
  await p.waitForTimeout(180);
 }
 assert.equal(state.phase,'over');assert.equal(state.remaining,0,'automated play should survive all 60 seconds');assert.ok(state.score>2000);assert.ok(state.shields>0);results.fullRound=state;await p.screenshot({path:'docs/screenshots/result.png'});
 await p.locator('#again').click();state=await p.evaluate(()=>window.__sfStrike.snapshot());assert.equal(state.score,0);assert.equal(state.shots,0);assert.equal(state.shields,3);await p.close();
 const m=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});m.on('pageerror',e=>errors.push(e.message));await m.goto(url);await m.waitForFunction(()=>window.__sfStrike?.snapshot().ready);await m.screenshot({path:'docs/screenshots/mobile.png'});assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await m.locator('#play').tap();await m.waitForTimeout(250);const mt=await m.evaluate(()=>window.__sfStrike.snapshot().targets[0]);await m.touchscreen.tap(mt.x,mt.y);await m.waitForTimeout(200);assert.ok(await m.evaluate(()=>window.__sfStrike.snapshot().score>0));results.mobile='touch hit passed; no overflow';await m.close();
 assert.deepEqual(errors,[]);results.errors=errors;await fs.writeFile('docs/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
