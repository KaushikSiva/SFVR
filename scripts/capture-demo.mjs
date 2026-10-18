// Record actual browser gameplay. Pointer automation is used only to play the round.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url).pathname;
const base=process.env.TEST_URL||'http://127.0.0.1:5186';
await fs.mkdir(root+'.local/demo',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:root+'.local/demo',size:{width:1920,height:1080}}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const t0=Date.now();await page.goto(base);await page.waitForFunction(()=>window.__sfStrike?.snapshot().ready,{},{timeout:60000});
await page.waitForTimeout(1200);const menu=(Date.now()-t0)/1000;
await page.screenshot({path:root+'docs/screenshots/title.png'});
await page.waitForTimeout(6000);await page.locator('#play').click();const gameplay=(Date.now()-t0)/1000;
let captured=false,resultAt=0,phase='playing';
while(Date.now()-t0<110000){
 const state=await page.evaluate(()=>window.__sfStrike.snapshot());phase=state.phase;
 if(phase==='over'){resultAt=(Date.now()-t0)/1000;await page.screenshot({path:root+'docs/screenshots/result.png'});break}
 if(state.elapsed>4&&!captured){await page.screenshot({path:root+'docs/screenshots/playing.png'});captured=true;}
 // Keep targets on screen long enough for viewers to follow each shot.
 if(state.elapsed>4&& !state.reloading){const t=state.targets.find(t=>t.visible);if(t){await page.mouse.move(t.x,t.y,{steps:14});await page.waitForTimeout(100);await page.mouse.click(t.x,t.y);}}
 if(state.elapsed>17&&state.elapsed<19)await page.keyboard.down('KeyD');else await page.keyboard.up('KeyD');
 if(state.elapsed>35&&state.elapsed<37)await page.keyboard.down('KeyA');else await page.keyboard.up('KeyA');
 await page.waitForTimeout(400);
}
const state=await page.evaluate(()=>window.__sfStrike.snapshot());
await page.waitForTimeout(4500);const video=page.video();await page.close();await context.close();await video.saveAs(root+'.local/demo/browser-gameplay.webm');await browser.close();
await fs.writeFile(root+'.local/demo/capture.json',JSON.stringify({menu,gameplay,resultAt,state,errors,phase},null,2));
console.log(JSON.stringify({menu,gameplay,resultAt,score:state.score,remaining:state.remaining,errors}));
