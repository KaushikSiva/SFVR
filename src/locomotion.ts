import * as T from 'three';
import {canStand,HOME,moveInPark,stickAxes,travelDelta} from './navigation';

type Destination={point:T.Vector3;valid:boolean};
export class Locomotion {
 private active?:T.XRTargetRaySpace;
 private destination?:Destination;
 private raycaster=new T.Raycaster();
 private rotation=new T.Matrix4();
 private head=new T.Vector3();
 private forward=new T.Vector3();
 private up=new T.Vector3(0,1,0);
 private floor=new T.Plane(this.up,0);
 private turnArmed=true;
 private blinkLeft=0;
 private marker:T.Group;
 private blink:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
 constructor(private rig:T.Group,private camera:T.PerspectiveCamera,private renderer:T.WebGLRenderer,scene:T.Scene,private controllers:T.XRTargetRaySpace[],private hud:T.Mesh,private enabled:()=>boolean,private hitsDrone:(ray:T.Ray)=>boolean){
  this.marker=new T.Group();this.marker.name='Teleport destination';this.marker.visible=false;
  const material=new T.MeshBasicMaterial({color:'#ffad72',transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide});
  const ring=new T.Mesh(new T.RingGeometry(.28,.36,48),material);ring.rotation.x=-Math.PI/2;
  const dot=new T.Mesh(new T.CircleGeometry(.07,24),material);dot.rotation.x=-Math.PI/2;dot.position.y=.004;
  this.marker.add(ring,dot);scene.add(this.marker);
  this.blink=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthTest:false,depthWrite:false}));
  this.blink.position.z=-.12;this.blink.renderOrder=2000;this.blink.visible=false;camera.add(this.blink);
 }
 private headPosition(){this.camera.getWorldPosition(this.head);return this.head;}
 private ray(controller:T.Object3D){
  controller.updateWorldMatrix(true,false);this.rotation.extractRotation(controller.matrixWorld);
  this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  this.raycaster.ray.direction.set(0,0,-1).applyMatrix4(this.rotation).normalize();
  return this.raycaster.ray;
 }
 private homeHit(controller:T.Object3D){
  this.ray(controller);this.hud.updateWorldMatrix(true,false);
  const hit=this.raycaster.intersectObject(this.hud,false)[0];
  return hit?.uv&&hit.uv.x>=.82&&hit.uv.y>=.06&&hit.uv.y<=.29?hit:undefined;
 }
 private floorTarget(controller:T.Object3D):Destination|undefined{
  const ray=this.ray(controller);if(ray.direction.y>-.15||this.hitsDrone(ray))return;
  const point=ray.intersectPlane(this.floor,new T.Vector3());if(!point)return;
  const head=this.headPosition(),distance=Math.hypot(point.x-head.x,point.z-head.z);
  return {point,valid:distance>=.45&&distance<=10&&canStand(point)};
 }
 pointerTarget(controller:T.Object3D){
  const home=this.homeHit(controller);if(home)return {distance:home.distance,floor:false};
  const ground=this.enabled()?this.floorTarget(controller):undefined;
  return ground?{distance:this.raycaster.ray.origin.distanceTo(ground.point),floor:true}:undefined;
 }
 /** Returns true when a selection belongs to navigation, so it cannot fire. */
 selectStart(controller:T.XRTargetRaySpace){
  if(!controller.visible)return false;
  if(this.homeHit(controller)){this.cancel();this.goHome();return true;}
  if(!this.enabled())return false;
  const destination=this.floorTarget(controller);
  if(destination){if(!this.active){this.active=controller;this.destination=destination;}return true;}
  return this.active===controller;
 }
 selectEnd(controller:T.XRTargetRaySpace){
  if(this.active!==controller)return false;
  // Re-evaluate on release: aiming outside the park or losing tracking cancels.
  const destination=controller.visible&&this.enabled()?this.floorTarget(controller):undefined;
  this.cancel();if(destination?.valid)this.teleport(destination.point);
  return true;
 }
 cancel(controller?:T.XRTargetRaySpace){if(controller&&controller!==this.active)return;this.active=undefined;this.destination=undefined;this.marker.visible=false;}
 private teleport(point:{x:number;z:number}){
  const head=this.headPosition();this.rig.position.x+=point.x-head.x;this.rig.position.z+=point.z-head.z;
  this.rig.updateMatrixWorld(true);if(this.renderer.xr.isPresenting)this.blinkLeft=.14;
 }
 goHome(){
  this.cancel();
  if(this.renderer.xr.isPresenting){this.rig.rotation.y=0;this.rig.updateMatrixWorld(true);this.teleport(HOME);}
  else{this.rig.position.set(HOME.x,0,HOME.z);this.rig.rotation.set(0,0,0);this.camera.position.set(0,1.7,0);this.camera.rotation.set(.08,0,0);this.rig.updateMatrixWorld(true);}
 }
 reset(){this.cancel();this.turnArmed=true;this.blinkLeft=0;this.blink.visible=false;}
 private move(strafe:number,forward:number,dt:number){
  if(!strafe&&!forward)return;
  this.camera.getWorldDirection(this.forward);const yaw=Math.atan2(-this.forward.x,-this.forward.z);
  const head=this.headPosition(),destination=moveInPark(head,travelDelta(strafe,forward,yaw,dt));
  this.rig.position.x+=destination.x-head.x;this.rig.position.z+=destination.z-head.z;this.rig.updateMatrixWorld(true);
 }
 private turn(sign:number){
  // Rotate around the tracked viewer, not the room's origin.
  const before=this.headPosition().clone();this.rig.rotateY(-sign*Math.PI/4);this.rig.updateMatrixWorld(true);
  const after=this.headPosition();this.rig.position.x+=before.x-after.x;this.rig.position.z+=before.z-after.z;this.rig.updateMatrixWorld(true);this.blinkLeft=.1;
 }
 update(dt:number,keys:Set<string>){
  if(!this.enabled()){this.cancel();this.turnArmed=true;}
  else if(this.renderer.xr.isPresenting){
   if(this.active&&!this.active.visible)this.cancel();
   let strafe=0,forward=0,turn=0;
   for(const source of this.renderer.xr.getSession()?.inputSources??[]){
    if(source.hand||source.gamepad?.mapping!=='xr-standard')continue;
    const [x,y]=stickAxes(source.gamepad.axes);
    if(source.handedness==='left'){strafe=x;forward=-y;}
    if(source.handedness==='right')turn=x;
   }
   if(!this.active){this.move(strafe,forward,dt);if(Math.abs(turn)<.25)this.turnArmed=true;else if(Math.abs(turn)>.65&&this.turnArmed){this.turn(Math.sign(turn));this.turnArmed=false;}}
  }else{
   const right=keys.has('KeyD')||keys.has('ArrowRight'),left=keys.has('KeyA')||keys.has('ArrowLeft');
   const forward=keys.has('KeyW')||keys.has('ArrowUp'),back=keys.has('KeyS')||keys.has('ArrowDown');
   this.move(Number(right)-Number(left),Number(forward)-Number(back),dt);
  }
  this.marker.visible=false;
  this.blinkLeft=Math.max(0,this.blinkLeft-dt);this.blink.visible=this.blinkLeft>0;this.blink.material.opacity=Math.min(1,this.blinkLeft/.08);
 }
 /** Update the marker after movement, from the tracked target ray. */
 updateMarker(){
  if(!this.enabled()||!this.renderer.xr.isPresenting)return;
  let destination:Destination|undefined;
  if(this.active){destination=this.floorTarget(this.active);this.destination=destination;}
  else for(const controller of this.controllers){if(controller.visible&&!this.homeHit(controller)){destination=this.floorTarget(controller);if(destination)break;}}
  if(!destination)return;
  this.marker.visible=true;this.marker.position.copy(destination.point);this.marker.position.y=.025;
  const material=(this.marker.children[0] as T.Mesh).material as T.MeshBasicMaterial;
  material.color.set(destination.valid?'#ffad72':'#ea6961');this.marker.scale.setScalar(this.active?1.12:1);
 }
 get aiming(){return !!this.active;}
 get valid(){return !!this.destination?.valid;}
 get target(){return this.destination?{x:this.destination.point.x,z:this.destination.point.z,valid:this.destination.valid}:null;}
}
