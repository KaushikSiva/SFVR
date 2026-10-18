import * as THREE from 'three';
import {Game} from './game';
import {Sound} from './audio';
import {buildLevel} from './level';
import {makeBlaster,makeDrone} from './drone';
import {Locomotion} from './locomotion';
import {HandTrigger,measureTrigger} from './hand-trigger';
import type {Target} from './game';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('scene');
const game=new Game(),sound=new Sound();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let highScore=0;try{highScore=Math.max(0,Number(localStorage.getItem('sf-strike-best-v1'))||0)}catch{}
$('menu-best').textContent=String(highScore).padStart(5,'0');
let toastTimer=0;
function toast(message:string){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').hidden=true,5000)}
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('emulate-xr')){
 const {installTestRuntime}=await import('./dev-xr');installTestRuntime();
}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(.65);renderer.xr.setFoveation(1);
const scene=new THREE.Scene(),rig=new THREE.Group();rig.position.set(0,0,6.5);scene.add(rig);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.06,600);camera.position.set(0,1.7,0);camera.rotation.x=.08;rig.add(camera);
function fitViewport(){const portrait=innerWidth<innerHeight;camera.aspect=innerWidth/innerHeight;camera.fov=portrait?90:68;game.laneWidth=portrait?4:15;camera.updateProjectionMatrix();}
fitViewport();
const weapon=makeBlaster();weapon.scale.setScalar(.72);weapon.position.set(.25,-.23,-.48);weapon.rotation.y=-.05;camera.add(weapon);scene.add(rig);
let ready=false,desktopHeld=false,last=0,clock=0,recoil=0,hitUntil=0,damageUntil=0;
let pointer=new THREE.Vector2(0,0),keys=new Set<string>();
const drones=new Map<number,THREE.Group>(),effects:{object:THREE.Object3D;velocity?:THREE.Vector3;life:number;max:number}[]=[];
const raycaster=new THREE.Raycaster(),aimRay=new THREE.Ray(),matrix=new THREE.Matrix4();
const tempV=new THREE.Vector3(),tempQ=new THREE.Quaternion();
const colors={scout:'#ff7b3d',heavy:'#b4a0ff',bonus:'#ffcf4d'};
const particleGeometry=new THREE.BoxGeometry(.055,.055,.055);
const preview=[makeDrone('scout'),makeDrone('scout'),makeDrone('heavy')];
preview.forEach((d,i)=>{d.position.set(4+i*2.4,3.2+i*.7,-5-i*3);scene.add(d)});

// Give the browser a paint before generating the reused architectural geometry.
await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const level=buildLevel(scene,renderer,message=>$('loading-text').textContent=message);
void level.ready.then(()=>{renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;ready=true;$('loading').hidden=true;$<HTMLButtonElement>('play').disabled=false;checkXR();});
// Text HUD is rendered inside the XR scene; DOM overlays are not assumed to exist.
const hudCanvas=document.createElement('canvas');hudCanvas.width=1024;hudCanvas.height=256;
const hudContext=hudCanvas.getContext('2d')!;
const hudTexture=new THREE.CanvasTexture(hudCanvas);hudTexture.colorSpace=THREE.SRGBColorSpace;
const xrHud=new THREE.Mesh(new THREE.PlaneGeometry(.98,.245),new THREE.MeshBasicMaterial({map:hudTexture,transparent:true,depthTest:false,depthWrite:false}));
xrHud.name='XR status and movement';xrHud.position.set(0,-.39,-1.45);xrHud.renderOrder=1000;xrHud.visible=false;camera.add(xrHud);
let hudLast='',hudTime=0,domUpdateAt=0;
function drawXRHUD(){
 const message=locomotion.aiming?'RELEASE PINCH TO MOVE':game.phase==='ready'?'POINT + PINCH TO START':game.phase==='over'?'ROUND OVER · SELECT TO PLAY AGAIN':game.phase==='paused'?'PAUSED · SELECT TO RESUME':`SCORE ${String(game.score).padStart(5,'0')}    ${game.remaining}s    SHIELDS ${game.shields}`;
 const detail=locomotion.aiming?(locomotion.valid?'CLEAR DESTINATION':'CHOOSE CLEAR GROUND INSIDE THE PARK'):game.phase==='playing'?(game.reloadLeft>0?'RELOADING…':`AMMO ${game.ammo}/12    ${game.combo>1?'COMBO ×'+game.combo:([...handTriggers.values()].some(t=>t.state==='firing')?'TWO-FINGER BURST':'2 FINGERS OR PINCH TO FIRE')}`):'SFVR / ALAMO SQUARE';
 const text=message+detail;if(text===hudLast&&clock-hudTime<1)return;hudLast=text;hudTime=clock;hudContext.clearRect(0,0,1024,256);hudContext.fillStyle='rgba(11,25,35,0.86)';hudContext.fillRect(0,0,1024,256);hudContext.fillStyle='#ff7b3d';hudContext.fillRect(0,0,1024,4);hudContext.textAlign='center';hudContext.font='bold 37px monospace';hudContext.fillStyle='#fff3dc';hudContext.fillText(message,512,106);hudContext.font='25px monospace';hudContext.fillStyle='#ffa46c';hudContext.fillText(detail,512,167);hudContext.font='22px monospace';hudContext.fillStyle='#dedbd0';hudContext.fillText('AIM LOW + PINCH TO TELEPORT',420,222);hudContext.fillStyle='#ff7b3d';hudContext.fillRect(840,183,170,57);hudContext.font='bold 24px monospace';hudContext.fillStyle='#14212a';hudContext.fillText('HOME',925,221);hudTexture.needsUpdate=true;
}
const controllers=[renderer.xr.getController(0),renderer.xr.getController(1)];
const controllerHeld=new Set<THREE.XRTargetRaySpace>();
const inputSources=new Map<THREE.XRTargetRaySpace,XRInputSource>();
const handTriggers=new Map(controllers.map(c=>[c,new HandTrigger()]));
const handSelecting=new Set<THREE.XRTargetRaySpace>();
const handBlockedUntil=new Map<THREE.XRTargetRaySpace,number>();
function resetHandTriggers(){for(const trigger of handTriggers.values())trigger.reset();}

const locomotion=new Locomotion(rig,camera,renderer,scene,controllers,xrHud,()=>game.phase==='playing',ray=>game.targets.some(t=>ray.intersectsSphere(new THREE.Sphere(new THREE.Vector3(t.x,t.y,t.z),t.kind==='heavy'?.95:.85))));
for(const controller of controllers){
 rig.add(controller);const gun=makeBlaster();gun.scale.setScalar(.6);gun.position.set(0,-.025,-.04);controller.add(gun);controller.userData.gun=gun;
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-12)]),new THREE.LineBasicMaterial({color:'#ff9858',transparent:true,opacity:.28}));controller.add(line);controller.userData.line=line;
 const cursor=new THREE.Mesh(new THREE.RingGeometry(.045,.06,24),new THREE.MeshBasicMaterial({color:'#ffb469',transparent:true,opacity:.85,depthWrite:false}));cursor.position.z=-12;controller.add(cursor);controller.userData.cursor=cursor;
 controller.addEventListener('connected',event=>{inputSources.set(controller,event.data);handTriggers.get(controller)!.reset();});
 controller.addEventListener('selectstart',event=>{
  sound.unlock();const hand=!!event.data.hand||event.data.profiles.some(profile=>profile.includes('hand'));
  if(hand){handSelecting.add(controller);handTriggers.get(controller)!.release();}
  if(locomotion.selectStart(controller)){controllerHeld.clear();resetHandTriggers();drawXRHUD();return;}
  if(game.phase==='ready'||game.phase==='over'){start();return;}
  if(game.phase==='paused'){resume();return;}
  // Navigation and round controls consume the selection before shooting.
  if(hand||event.data.gamepad?.mapping==='xr-standard'){controllerHeld.add(controller);fireFromController(controller);}
 });
 controller.addEventListener('selectend',()=>{
  controllerHeld.delete(controller);handSelecting.delete(controller);handBlockedUntil.set(controller,performance.now()+150);
  handTriggers.get(controller)!.reset();locomotion.selectEnd(controller);drawXRHUD();
 });
 controller.addEventListener('disconnected',()=>{
  controllerHeld.delete(controller);handSelecting.delete(controller);handBlockedUntil.delete(controller);
  inputSources.delete(controller);handTriggers.get(controller)!.reset();locomotion.cancel(controller);
 });
}
function fireFromController(controller:THREE.Object3D){
 if(!controller.visible)return;
 controller.updateWorldMatrix(true,false);matrix.identity().extractRotation(controller.matrixWorld);aimRay.origin.setFromMatrixPosition(controller.matrixWorld);aimRay.direction.set(0,0,-1).applyMatrix4(matrix).normalize();fire(aimRay,controller.userData.gun);
}
async function checkXR(){
 let supported=false;try{supported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr')}catch{}
 const button=$<HTMLButtonElement>('xr');button.disabled=!ready;button.dataset.supported=String(supported);
 if(supported){button.classList.replace('secondary','primary');$('play').classList.replace('primary','secondary');$('play').textContent='PLAY IN WINDOW';button.parentElement!.prepend(button);}
 button.innerHTML=supported?'ENTER GALAXY XR <span>◉</span>':'GALAXY XR SETUP <span>◉</span>';
 if(document.body.dataset.emulated==='true')$('xr-note').textContent='GENERIC XR INPUT TEST · not a physical headset';
 else if(supported)$('xr-note').textContent='Extend index + middle or pinch to fire · aim low + pinch to move';
 else if(matchMedia('(pointer:coarse)').matches)$('xr-note').textContent='Tap a drone to fire · tap ammo to reload';
}
$('xr').onclick=async()=>{
 if($('xr').dataset.supported!=='true'){$<HTMLDialogElement>('help-dialog').showModal();return;}
 try{sound.unlock();const session=await navigator.xr!.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['hand-tracking']});
  session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible')pause();});
  await renderer.xr.setSession(session);
 }catch(error){toast('XR could not start. Check headset permissions and use a secure URL.');console.warn('XR session failed',error)}
};
renderer.xr.addEventListener('sessionstart',()=>{resetHandTriggers();handSelecting.clear();handBlockedUntil.clear();locomotion.reset();document.body.classList.add('xr');weapon.visible=false;xrHud.visible=true;game.laneWidth=15;rig.position.set(0,0,6.5);rig.rotation.set(0,0,0);renderer.shadowMap.enabled=true;desktopHeld=false;keys.clear();if(game.phase==='playing')game.pause();drawXRHUD();});
renderer.xr.addEventListener('sessionend',()=>{resetHandTriggers();handSelecting.clear();handBlockedUntil.clear();locomotion.reset();document.body.classList.remove('xr');weapon.visible=true;xrHud.visible=false;renderer.shadowMap.enabled=true;renderer.shadowMap.needsUpdate=true;controllerHeld.clear();camera.position.set(0,1.7,0);camera.rotation.set(.08,0,0);rig.position.set(0,0,6.5);rig.rotation.set(0,0,0);fitViewport();if(game.phase==='playing')pause();syncUI();checkXR();});

function start(){if(!ready)return;resetHandTriggers();locomotion.reset();sound.unlock();sound.tone('start');clearDrones();clearEffects();game.start();recoil=0;keys.clear();desktopHeld=false;controllerHeld.clear();locomotion.goHome();if(!renderer.xr.isPresenting)camera.rotation.x=.08;syncUI();processEvents();}
function pause(){resetHandTriggers();locomotion.cancel();game.pause();desktopHeld=false;controllerHeld.clear();keys.clear();syncUI()}
function resume(){resetHandTriggers();game.resume();last=performance.now();syncUI()}
function back(){resetHandTriggers();locomotion.reset();game.phase='ready';clearDrones();clearEffects();desktopHeld=false;controllerHeld.clear();keys.clear();locomotion.goHome();syncUI()}
function syncUI(){
 const playing=game.phase==='playing'||game.phase==='paused';document.body.classList.toggle('playing',playing);
 $('menu').hidden=game.phase!=='ready';$('hud').hidden=!playing;$('pause').hidden=game.phase!=='paused';$('result').hidden=game.phase!=='over';$('footer').hidden=game.phase!=='ready';
 preview.forEach(d=>d.visible=game.phase==='ready');weapon.visible=game.phase==='playing'&&!renderer.xr.isPresenting;
 if(game.phase==='over'){$('result-eyebrow').textContent=game.shields>0?'SKYLINE SECURED':'DEFENSES BREACHED';$('rank').textContent=game.rank;$('final-score').textContent=String(game.score).padStart(5,'0');$('final-kills').textContent=String(game.kills);$('final-accuracy').textContent=game.accuracy+'%';highScore=Math.max(highScore,game.score);try{localStorage.setItem('sf-strike-best-v1',String(highScore))}catch{}$('final-best').textContent=String(highScore);$('menu-best').textContent=String(highScore).padStart(5,'0');desktopHeld=false;controllerHeld.clear();}
 drawXRHUD();
}
$('play').onclick=start;$('again').onclick=start;$('resume').onclick=resume;$('quit').onclick=back;$('back').onclick=back;
$('reload').onclick=()=>game.reload();$('sound').onclick=()=>{sound.enabled=!sound.enabled;$('sound').innerHTML=(sound.enabled?'SOUND ON':'SOUND OFF')+' <i>▥</i>';$('sound').setAttribute('aria-pressed',String(!sound.enabled));$('sound').setAttribute('aria-label',sound.enabled?'Mute sound':'Unmute sound');};
$('help').onclick=()=>{pause();$<HTMLDialogElement>('help-dialog').showModal()};$('close-help').onclick=()=>$<HTMLDialogElement>('help-dialog').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});window.addEventListener('blur',()=>{if(!renderer.xr.isPresenting)pause()});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||$<HTMLDialogElement>('help-dialog').open)return;if(e.code==='Escape'){if(game.phase==='playing')pause();else if(game.phase==='paused')resume();}if(e.code==='KeyR')game.reload();if(e.code==='KeyH'){locomotion.goHome();drawXRHUD();}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code)}});
window.addEventListener('keyup',e=>keys.delete(e.code));
function updatePointer(e:PointerEvent){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);$('reticle').style.left=e.clientX+'px';$('reticle').style.top=e.clientY+'px';$('hit-marker').style.left=e.clientX+'px';$('hit-marker').style.top=e.clientY+'px';}
canvas.addEventListener('pointermove',updatePointer);
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||game.phase!=='playing'||renderer.xr.isPresenting)return;updatePointer(e);sound.unlock();desktopHeld=true;canvas.setPointerCapture(e.pointerId);shootDesktop()});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>desktopHeld=false);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function shootDesktop(){camera.updateWorldMatrix(true,false);raycaster.setFromCamera(pointer,camera);fire(raycaster.ray,weapon)}
function fire(ray:THREE.Ray,source:THREE.Object3D=weapon){
 if(!game.fire())return;recoil=.07;sound.tone('shot');let found:Target|undefined,min=Infinity;let impact=ray.at(45,new THREE.Vector3());
 for(const t of game.targets){const at=ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(t.x,t.y,t.z),t.kind==='heavy'?.95:.85),tempV);if(at){const distance=at.distanceTo(ray.origin);if(distance<min){found=t;min=distance;impact=at.clone()}}}
 source.userData.kickUntil=clock+.09;source.userData.flashUntil=clock+.055;source.userData.flash.visible=true;
 const origin=(source.userData.muzzle as THREE.Object3D).getWorldPosition(new THREE.Vector3());
 const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,impact]),new THREE.LineBasicMaterial({color:'#ffe6aa',transparent:true,opacity:.9}));scene.add(beam);effects.push({object:beam,life:.065,max:.065});
 if(found){game.hit(found.id);hitUntil=clock+.13;$('hit-marker').style.opacity='1';}
 processEvents();
}
function spark(t:Target,n:number){const mat=new THREE.MeshBasicMaterial({color:colors[t.kind],transparent:true});for(let i=0;i<n;i++){const mesh=new THREE.Mesh(particleGeometry,mat.clone());mesh.position.set(t.x,t.y,t.z);mesh.scale.setScalar(.7+Math.random()*1.6);scene.add(mesh);effects.push({object:mesh,velocity:new THREE.Vector3((Math.random()-.5)*4,(Math.random()-.2)*4,(Math.random()-.5)*4),life:.35+Math.random()*.3,max:.7})}}
function removeDrone(id:number){const obj=drones.get(id);if(!obj)return;scene.remove(obj);obj.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();}});(obj.userData.accent as THREE.Material).dispose();drones.delete(id)}
function clearDrones(){for(const id of [...drones.keys()])removeDrone(id)}
function clearEffects(){for(const e of effects){scene.remove(e.object);if(e.object instanceof THREE.Mesh||e.object instanceof THREE.Line){if(e.object.geometry!==particleGeometry)e.object.geometry.dispose();(e.object.material as THREE.Material).dispose()}}effects.length=0;}
function processEvents(){for(const event of game.drain()){
 if(event.type==='spawn'&&event.target){const d=makeDrone(event.target.kind);d.position.set(event.target.x,event.target.y,event.target.z);drones.set(event.target.id,d);scene.add(d)}
 if(event.type==='hit'&&event.target){sound.tone('hit');spark(event.target,reduced?2:5)}
 if(event.type==='kill'&&event.target){sound.tone('kill');spark(event.target,reduced?4:15);removeDrone(event.target.id);$('combo').textContent=(game.combo>1?game.combo+'× COMBO  ·  ':'')+'+'+event.points;}
 if(event.type==='expire'&&event.target)removeDrone(event.target.id);
 if(event.type==='damage'&&event.target){sound.tone('damage');removeDrone(event.target.id);damageUntil=clock+.4;$('damage-flash').style.opacity=reduced?'0':'.8';toast('Shield lost · shoot the red-charging drones before they breach.')}
 if(event.type==='reload')sound.tone('reload');if(event.type==='over')syncUI();
}}
function updateHandTriggers(now:number,xrFrame?:XRFrame){
 const space=renderer.xr.getReferenceSpace();
 for(const controller of controllers){
  const source=inputSources.get(controller),trigger=handTriggers.get(controller)!;
  if(!xrFrame?.getJointPose||!space||!source?.hand||!controller.visible){trigger.reset();continue;}
  const blocked=game.phase!=='playing'||xrFrame.session.visibilityState!=='visible'||handSelecting.has(controller)||now<(handBlockedUntil.get(controller)??0)||locomotion.aiming||!!locomotion.pointerTarget(controller);
  const sample=blocked?null:measureTrigger(name=>{
   const joint=source.hand!.get(name);if(!joint)return null;
   return xrFrame.getJointPose!(joint,space)?.transform.position??null;
  });
  if(trigger.update(sample,now,blocked))fireFromController(controller);
 }
}
function frame(now:number,xrFrame?:XRFrame){const dt=last?Math.min((now-last)/1000,.1):0;last=now;clock+=dt;
 locomotion.update(dt,keys);
 updateHandTriggers(now,xrFrame);
 if(game.phase==='playing'){
  game.step(dt);processEvents();
  if(!renderer.xr.isPresenting){if(desktopHeld)shootDesktop();}
  else for(const controller of controllerHeld){
   // End a held burst on tracking loss or when its ray enters navigation.
   if(!controller.visible||locomotion.aiming||locomotion.pointerTarget(controller)){controllerHeld.delete(controller);continue;}
   fireFromController(controller);
  }
 }
 for(const t of game.targets){const d=drones.get(t.id);if(!d)continue;d.position.set(t.x,t.y,t.z);d.rotation.z=Math.sin(t.age*1.2+t.phase)*.12;for(const rotor of d.userData.rotors as THREE.Mesh[])rotor.rotation.y+=dt*45;const accent=d.userData.accent as THREE.MeshStandardMaterial;accent.emissiveIntensity=t.age>7?1.2+Math.sin(clock*14)*.7:.8;}
 for(let i=0;i<preview.length;i++){preview[i].position.y=3.2+i*.7+(reduced?0:Math.sin(clock*.8+i)*.35);preview[i].rotation.z=Math.sin(clock+i)*.08;for(const rotor of preview[i].userData.rotors as THREE.Mesh[])rotor.rotation.y+=dt*20;}
 for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.life<=0){scene.remove(e.object);const obj=e.object as THREE.Mesh;if(obj.geometry!==particleGeometry)obj.geometry.dispose();(obj.material as THREE.Material).dispose();effects.splice(i,1);continue;}if(e.velocity){e.object.position.addScaledVector(e.velocity,dt);e.velocity.y-=dt*3;e.object.rotation.x+=dt*4;}(e.object as THREE.Mesh).material instanceof THREE.Material&&((e.object as THREE.Mesh).material as THREE.Material).opacity&&( ((e.object as THREE.Mesh).material as THREE.Material).opacity=Math.min(1,e.life/e.max));}
 for(const gun of [weapon,...controllers.map(c=>c.userData.gun as THREE.Group)]){gun.userData.flash.visible=clock<gun.userData.flashUntil;if(gun!==weapon)gun.position.z=-.04+Math.max(0,(gun.userData.kickUntil??0)-clock)*.3;}
 recoil=Math.max(0,recoil-dt*.6);weapon.position.z=-.48+recoil;weapon.rotation.x=pointer.y*.2-recoil*1.1;weapon.rotation.y=THREE.MathUtils.damp(weapon.rotation.y,-pointer.x*.3,12,dt);
 if(renderer.xr.isPresenting)for(const controller of controllers){
  if(!controller.visible)continue;controller.updateWorldMatrix(true,false);matrix.identity().extractRotation(controller.matrixWorld);aimRay.origin.setFromMatrixPosition(controller.matrixWorld);aimRay.direction.set(0,0,-1).applyMatrix4(matrix).normalize();let distance=14,aimed=false;
  for(const t of game.targets){const p=aimRay.intersectSphere(new THREE.Sphere(new THREE.Vector3(t.x,t.y,t.z),t.kind==='heavy'?.95:.85),tempV);if(p){const d=p.distanceTo(aimRay.origin);if(d<distance){distance=d;aimed=true}}}
  const navigation=locomotion.pointerTarget(controller);if(navigation){distance=navigation.distance;aimed=true;}
  (controller.userData.line as THREE.Line).scale.z=distance/12;
  const cursor=controller.userData.cursor as THREE.Mesh;cursor.visible=!navigation?.floor;cursor.position.z=-distance;cursor.scale.setScalar(distance/12);(cursor.material as THREE.MeshBasicMaterial).color.set(['ready','firing'].includes(handTriggers.get(controller)!.state)?'#9cf0cb':aimed?'#fff5d8':'#ffb469');
 }
 if(clock>hitUntil)$('hit-marker').style.opacity='0';if(clock>damageUntil)$('damage-flash').style.opacity='0';
 if(!renderer.xr.isPresenting&&now-domUpdateAt>70){domUpdateAt=now;
 $('score').textContent=String(game.score).padStart(5,'0');$('wave').textContent=String(game.wave).padStart(2,'0');$('time').innerHTML=game.remaining+'<span>s</span>';$('time-bar').style.width=((60-game.elapsed)/60*100)+'%';
 $('ammo').textContent=game.reloadLeft>0?'··':String(game.ammo).padStart(2,'0');$('ammo-label').textContent=game.reloadLeft>0?'RELOADING…':'/ 12  RELOAD [R]';$('reload').classList.toggle('reloading',game.reloadLeft>0);
 [...$('shields').children].forEach((e,i)=>e.classList.toggle('lost',i>=game.shields));if(game.combo===0)$('combo').textContent='';}
 locomotion.updateMarker();
 if(renderer.xr.isPresenting)drawXRHUD();
 renderer.render(scene,camera);
}
renderer.setAnimationLoop(frame);
window.addEventListener('resize',()=>{if(renderer.xr.isPresenting)return;fitViewport();renderer.setSize(innerWidth,innerHeight)});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();toast('Graphics connection lost. Reload the page to restart.');});
function snapshot(){return {ready,phase:game.phase,score:game.score,shots:game.shots,hits:game.hits,shields:game.shields,ammo:game.ammo,reloading:game.reloadLeft,elapsed:game.elapsed,remaining:game.remaining,xr:renderer.xr.isPresenting,handTriggers:controllers.map(c=>({side:inputSources.get(c)?.handedness,state:handTriggers.get(c)!.state})),navigation:{position:{x:camera.getWorldPosition(new THREE.Vector3()).x,z:camera.getWorldPosition(new THREE.Vector3()).z},yaw:rig.rotation.y,teleporting:locomotion.aiming,target:locomotion.target},triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,targets:game.targets.map(t=>{const p=new THREE.Vector3(t.x,t.y,t.z).project(camera);return {id:t.id,hp:t.hp,x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,visible:p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1}})}}
if(import.meta.env.DEV)(window as any).__sfStrike={snapshot,renderer,game,scene};
syncUI();
