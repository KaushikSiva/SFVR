export type Phase='ready'|'playing'|'paused'|'over';
export type Target={id:number;kind:'scout'|'heavy'|'bonus';hp:number;age:number;lane:number;phase:number;x:number;y:number;z:number};
export type Event={type:'spawn'|'hit'|'kill'|'damage'|'expire'|'reload'|'loaded'|'over';target?:Target;points?:number};
export class Game {
 laneWidth=15;
 phase:Phase='ready';elapsed=0;score=0;shields=3;shots=0;hits=0;kills=0;combo=0;ammo=12;reloadLeft=0;cooldown=0;spawnIn=.5;targets:Target[]=[];
 private nextId=1;private seed=1;private lastKill=-99;events:Event[]=[];
 constructor(private initialSeed=12345){}
 random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
 start(){this.phase='playing';this.elapsed=this.score=this.shots=this.hits=this.kills=this.combo=this.reloadLeft=this.cooldown=0;this.shields=3;this.ammo=12;this.spawnIn=1.8;this.targets=[];this.events=[];this.nextId=1;this.seed=this.initialSeed;this.lastKill=-99;this.spawn('scout',0);}
 spawn(kind?:Target['kind'],lane?:number){const r=this.random();const t:Target={id:this.nextId++,kind:kind??(this.elapsed>18&&r<.22?'heavy':r>.88?'bonus':'scout'),hp:1,age:0,lane:lane??(this.random()-.5)*this.laneWidth,phase:this.random()*Math.PI*2,x:0,y:2.8+this.random()*2.5,z:-9};t.hp=t.kind==='heavy'?2:1;t.x=t.lane;t.z=-8-this.random()*6;this.targets.push(t);this.events.push({type:'spawn',target:{...t}});return t;}
 pause(){if(this.phase==='playing')this.phase='paused';}
 resume(){if(this.phase==='paused')this.phase='playing';}
 reload(){if(this.phase==='playing'&&this.reloadLeft===0&&this.ammo<12){this.reloadLeft=1.15;this.events.push({type:'reload'});}}
 fire(){if(this.phase!=='playing'||this.reloadLeft>0||this.cooldown>0)return false;this.shots++;this.ammo--;this.cooldown=.15;if(this.ammo===0)this.reload();return true;}
 hit(id:number){if(this.phase!=='playing')return false;const t=this.targets.find(t=>t.id===id);if(!t)return false;this.hits++;t.hp--;this.events.push({type:'hit',target:{...t}});if(t.hp<=0){this.combo=this.elapsed-this.lastKill<=3?Math.min(this.combo+1,5):1;this.lastKill=this.elapsed;const points=(t.kind==='bonus'?250:t.kind==='heavy'?180:100)*this.combo;this.score+=points;this.kills++;this.targets=this.targets.filter(x=>x.id!==id);this.events.push({type:'kill',target:{...t},points});}return true;}
 step(dt:number){if(this.phase!=='playing')return;dt=Math.max(0,Math.min(dt,.1));this.elapsed=Math.min(60,this.elapsed+dt);this.cooldown=Math.max(0,this.cooldown-dt);if(this.reloadLeft>0){this.reloadLeft=Math.max(0,this.reloadLeft-dt);if(!this.reloadLeft){this.ammo=12;this.events.push({type:'loaded'});}}if(this.elapsed-this.lastKill>3)this.combo=0;
  for(const t of [...this.targets]){t.age+=dt;t.x=t.lane+Math.sin(t.age*1.1+t.phase)*1.1;t.y+=(Math.sin(t.age*1.7+t.phase)*.12)*dt;t.z+=dt*(t.kind==='heavy'?.5:.65);if(t.age>10){this.targets=this.targets.filter(x=>x.id!==t.id);if(t.kind==='bonus')this.events.push({type:'expire',target:{...t}});if(t.kind!=='bonus'){this.shields--;this.combo=0;this.events.push({type:'damage',target:{...t}});if(this.shields===0){this.end();break;}}}}
  if(this.elapsed>=60){this.end();return;}if(this.phase!=='playing')return;this.spawnIn-=dt;if(this.spawnIn<=0){if(this.targets.length<7)this.spawn();this.spawnIn=Math.max(.8,2.6-this.elapsed*.025);}
 }
 end(){if(this.phase==='over')return;this.phase='over';this.events.push({type:'over'});}
 drain(){const e=this.events;this.events=[];return e;}
 get remaining(){return Math.ceil(60-this.elapsed);}
 get accuracy(){return this.shots?Math.round(this.hits/this.shots*100):0;}
 get wave(){return Math.min(4,1+Math.floor(this.elapsed/15));}
 get rank(){return this.score>=10000?'SKYLINE LEGEND':this.score>=5000?'PARK GUARDIAN':this.score>=2000?'SHARP SHOOTER':'ROOKIE PILOT';}
}
