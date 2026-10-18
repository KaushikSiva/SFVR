type Point={x:number;y:number;z:number};
export type TriggerSample={index:number;middle:number;ring:number;thumbGap:number};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

/** Dimensionless finger reach, so the same gesture works with either hand size. */
export function measureTrigger(joint:(name:XRHandJoint)=>Point|null):TriggerSample|null{
 const wrist=joint('wrist'),palm=joint('middle-finger-phalanx-proximal');
 const thumb=joint('thumb-tip'),indexTip=joint('index-finger-tip');
 if(!wrist||!palm||!thumb||!indexTip)return null;
 const span=distance(wrist,palm);if(span<.025||span>.2)return null;
 const reach=(finger:'index'|'middle'|'ring')=>{
  const points=['phalanx-proximal','phalanx-intermediate','phalanx-distal','tip'].map(part=>joint(`${finger}-finger-${part}` as XRHandJoint));
  if(points.some(p=>!p))return NaN;
  const [a,b,c,d]=points as Point[];
  const length=distance(a,b)+distance(b,c)+distance(c,d);
  return length>.015?distance(a,d)/length:NaN;
 };
 const sample={index:reach('index'),middle:reach('middle'),ring:reach('ring'),thumbGap:distance(thumb,indexTip)/span};
 return Object.values(sample).every(Number.isFinite)?sample:null;
}

/** Two extended fingers hold fire; the earlier index-curl trigger also works.
 * Native pinch/select events are handled separately by the input router. */
export class HandTrigger {
 state:'untracked'|'blocked'|'ready'|'fired'|'firing'|'rest'='untracked';
 private armed=false;
 private openSince?:number;
 private closedSince?:number;
 private last?:number;
 private twoFingerSince?:number;
 private twoFingerNeedsRelease=false;
 reset(state:HandTrigger['state']='untracked'){
  // An interrupted burst must not restart on tracking recovery or navigation exit.
  if(this.twoFingerSince!==undefined)this.twoFingerNeedsRelease=true;
  this.twoFingerSince=undefined;
  this.armed=false;this.openSince=undefined;this.closedSince=undefined;this.last=undefined;this.state=state;
 }
 /** A deliberate pinch also releases the two-finger pose. */
 release(){this.reset('rest');this.twoFingerNeedsRelease=false;}
 update(sample:TriggerSample|null,now:number,blocked=false){
  if(!sample||blocked){this.reset(blocked?'blocked':'untracked');return false;}
  if(this.last!==undefined&&(now-this.last>120||now<this.last))this.reset();
  this.last=now;
  const extended=this.state==='firing'?.82:.90;
  if(sample.index>=extended&&sample.middle>=extended&&sample.ring<.85&&sample.thumbGap>=.38){
   this.armed=false;this.openSince=undefined;this.closedSince=undefined;
   if(this.twoFingerNeedsRelease){this.state='rest';return false;}
   this.twoFingerSince??=now;
   if(now-this.twoFingerSince>=120){this.state='firing';return true;}
   this.state='rest';return false;
  }
  this.twoFingerSince=undefined;this.twoFingerNeedsRelease=false;
  if(this.state==='firing')this.state='rest';
  // Keep the thumb away from the index and grip with the other fingers.
  if(sample.thumbGap<.38||sample.middle>.85||sample.ring>.85){this.reset('rest');return false;}
  if(sample.index>=.90){
   this.closedSince=undefined;this.openSince??=now;
   if(now-this.openSince>=60){this.armed=true;this.state='ready';}
  }else{
   this.openSince=undefined;
   if(this.armed&&sample.index<=.72){
    this.closedSince??=now;
    if(now-this.closedSince>=25){this.armed=false;this.closedSince=undefined;this.state='fired';return true;}
   }else this.closedSince=undefined;
  }
  return false;
 }
}
