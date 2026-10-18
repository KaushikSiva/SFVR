import * as T from 'three';
import {Parts} from './geometry';
import type {Target} from './game';

const hull=new T.MeshStandardMaterial({color:'#283238',metalness:.7,roughness:.3});
const trim=new T.MeshStandardMaterial({color:'#88928e',metalness:.85,roughness:.24});
const dark=new T.MeshStandardMaterial({color:'#151b1d',metalness:.16,roughness:.76});
const rubber=new T.MeshStandardMaterial({color:'#1c2222',metalness:.05,roughness:.92});
const glass=new T.MeshStandardMaterial({color:'#10282c',metalness:.65,roughness:.08});

export function makeDrone(kind:Target['kind']){
 const group=new T.Group(),parts=new Parts();group.name=kind+' interceptor';
 const color=kind==='bonus'?'#e4b347':kind==='heavy'?'#9b8bcd':'#e96a2c';
 const accent=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.8,metalness:.35,roughness:.32});
 parts.box(hull,0,0,0,.65,.22,.58,.085);
 parts.box(dark,0,.1,-.03,.46,.10,.43,.04);
 parts.box(trim,0,.16,-.035,.24,.035,.3,.009);
 // Protective cage, motor pods and four independent propellers.
 const rotors:T.Mesh[]=[];
 for(const x of [-.67,.67])for(const z of [-.43,.43]){
  const center=new T.Vector3(x/2,0,z/2),length=Math.hypot(x,z);
  parts.box(trim,center.x,0,center.z,.085,.065,length,.012,new T.Euler(0,Math.atan2(x,z),0));
  parts.cylinder(hull,x,.015,z,.105,.16);
  parts.cylinder(trim,x,.11,z,.053,.035);
  parts.add(new T.TorusGeometry(.28,.018,5,24),hull,new T.Vector3(x,.07,z),new T.Euler(Math.PI/2,0,0));
  const bladeGeometry=new T.BoxGeometry(.49,.009,.049);const blade=new T.Mesh(bladeGeometry,dark);blade.position.set(x,.14,z);rotors.push(blade);group.add(blade);
  parts.cylinder(accent,x,-.085,z,.035,.012);
  parts.box(dark,x*.75,-.14,z*.75,.025,.22,.025,.004,new T.Euler(0,0,x>0?-.25:.25));
 }
 // Gimballed optical assembly and inset lens rings.
 parts.add(new T.SphereGeometry(.135,16,10),dark,new T.Vector3(0,-.075,.28));
 parts.cylinder(trim,0,-.075,.38,.10,.065,new T.Euler(Math.PI/2,0,0));
 parts.cylinder(glass,0,-.075,.416,.075,.009,new T.Euler(Math.PI/2,0,0));
 parts.add(new T.TorusGeometry(.082,.008,5,20),accent,new T.Vector3(0,-.075,.423));
 for(const side of [-1,1]){
  parts.box(accent,side*.225,.035,.289,.105,.034,.012,.004);
  for(let i=0;i<5;i++)parts.box(dark,side*.25,.12,-.15+i*.06,.035,.012,.025,.003);
 }
 if(kind==='heavy'){
  parts.box(trim,0,.21,.02,.54,.08,.34,.025);
  for(const x of [-.25,.25])parts.box(trim,x,.035,.25,.09,.18,.16,.015);
 }
 parts.finish(group,false);
 group.userData.rotors=rotors;group.userData.accent=accent;group.userData.baseColor=accent.color.clone();
 return group;
}

export function makeBlaster(){
 const group=new T.Group(),parts=new Parts();group.name='SFVR-01 induction blaster';
 const amber=new T.MeshStandardMaterial({color:'#b36a2d',emissive:'#e5762b',emissiveIntensity:.45,metalness:.55,roughness:.3});
 // Slim chamfered receiver, hollow muzzle and textured rubber grip.
 parts.box(hull,0,.018,-.16,.076,.088,.285,.014);
 parts.box(trim,0,.062,-.15,.082,.022,.215,.006);
 parts.box(dark,0,-.098,-.055,.057,.166,.075,.013,new T.Euler(-.2,0,0));
 parts.box(rubber,0,-.1,-.047,.061,.11,.049,.009,new T.Euler(-.2,0,0));
 for(let i=0;i<6;i++)parts.box(hull,0,-.055-i*.018,-.01-i*.003,.062,.006,.009,.002);
 parts.cylinder(hull,0,.018,-.326,.028,.07,new T.Euler(Math.PI/2,0,0),24);
 parts.cylinder(dark,0,.018,-.363,.021,.004,new T.Euler(Math.PI/2,0,0),24);
 parts.add(new T.TorusGeometry(.023,.0035,6,24),amber,new T.Vector3(0,.018,-.367));
 parts.cylinder(glass,0,.018,-.365,.014,.005,new T.Euler(Math.PI/2,0,0));
 // Barrel cooling grooves, fasteners, rails and a genuine open sight.
 for(const side of [-1,1]){
  parts.box(dark,side*.039,.025,-.19,.004,.044,.13,.002);
  for(let i=0;i<6;i++)parts.box(trim,side*.043,.025,-.24+i*.019,.009,.038,.005,.002,new T.Euler(.2,0,0));
  for(const z of [-.075,-.285])parts.cylinder(trim,side*.041,.012,z,.004,.005,new T.Euler(0,0,Math.PI/2),8);
  parts.box(amber,side*.039,.055,-.11,.004,.007,.07,.002);
 }
 for(let i=0;i<8;i++)parts.box(dark,0,.078,-.27+i*.025,.053,.008,.013,.002);
 parts.box(dark,0,.099,-.078,.066,.009,.018,.003);
 for(const x of [-.028,.028])parts.box(dark,x,.114,-.078,.009,.04,.02,.003);
 parts.box(dark,0,.137,-.078,.066,.007,.02,.003);
 parts.box(amber,0,.094,-.277,.005,.024,.005,.001);
 // Trigger guard (open center) and trigger.
 parts.box(hull,0,-.083,-.13,.018,.014,.09,.005);
 parts.box(hull,0,-.049,-.173,.018,.07,.013,.005);
 parts.box(trim,0,-.045,-.114,.009,.045,.012,.003,new T.Euler(-.3,0,0));
 parts.finish(group,false);
 const muzzle=new T.Object3D();muzzle.position.set(0,.018,-.37);group.add(muzzle);
 const flash=new T.Mesh(new T.SphereGeometry(.025,8,6),new T.MeshBasicMaterial({color:'#ffd8a0',transparent:true,opacity:.9,depthWrite:false}));flash.scale.set(.55,.55,2.6);flash.position.z=-.02;flash.visible=false;muzzle.add(flash);
 group.userData.muzzle=muzzle;group.userData.flash=flash;group.userData.flashUntil=0;
 return group;
}
