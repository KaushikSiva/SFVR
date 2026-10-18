/** Flat park navigation in world X/Z coordinates, with body clearance. */
export type Point={x:number;z:number};
export const HOME:Readonly<Point>={x:0,z:6.5};
export const PARK_BOUNDS={minX:-11.4,maxX:11.4,minZ:-4.2,maxZ:10};
export const BODY_RADIUS=.35;
const obstacles=[
 ...[-4.8,4.8].map(x=>({x,z:-.6,halfX:.72,halfZ:.62})),
 ...[-7,7].map(x=>({x,z:-3.1,halfX:1.1,halfZ:.45})),
 {x:-9.2,z:-.4,halfX:.3,halfZ:.3},
];
export function canStand(p:Point){
 return Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=PARK_BOUNDS.minX&&p.x<=PARK_BOUNDS.maxX&&p.z>=PARK_BOUNDS.minZ&&p.z<=PARK_BOUNDS.maxZ&&!obstacles.some(o=>Math.abs(p.x-o.x)<o.halfX+BODY_RADIUS&&Math.abs(p.z-o.z)<o.halfZ+BODY_RADIUS);
}
/** Substeps prevent tunnelling; separated axes allow sliding along an obstacle. */
export function moveInPark(from:Point,delta:Point):Point{
 let p={...from};const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.08));
 for(let i=0;i<steps;i++){
  const x={x:p.x+delta.x/steps,z:p.z};if(canStand(x))p=x;
  const z={x:p.x,z:p.z+delta.z/steps};if(canStand(z))p=z;
 }
 return p;
}
export function travelDelta(strafe:number,forward:number,yaw:number,seconds:number,speed=2.3):Point{
 const length=Math.max(1,Math.hypot(strafe,forward)),dt=Math.max(0,Math.min(seconds,.1));
 return {x:(strafe*Math.cos(yaw)-forward*Math.sin(yaw))/length*dt*speed,z:(-strafe*Math.sin(yaw)-forward*Math.cos(yaw))/length*dt*speed};
}
export function stickAxis(value:number){return Number.isFinite(value)&&Math.abs(value)>.18?Math.sign(value)*Math.min(1,(Math.min(Math.abs(value),1)-.18)/.82):0;}
export function stickAxes(axes:readonly number[]):[number,number]{return axes.length>=4?[stickAxis(axes[2]),stickAxis(axes[3])]:axes.length===2?[stickAxis(axes[0]),stickAxis(axes[1])]:[0,0];}
