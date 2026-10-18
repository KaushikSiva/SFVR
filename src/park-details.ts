import * as T from 'three';
import {Parts} from './geometry';
import {lawnElevation,streetElevation} from './scene/siteAlignment';

// Z-up, matching the original architectural root.
export function addParkDetails(parent:T.Group){
 const group=new T.Group();group.name='Park foreground · full-volume props';parent.add(group);
 const parts=new Parts();
 const stone=new T.MeshStandardMaterial({color:'#8b8c7f',roughness:.94});
 const dark=new T.MeshStandardMaterial({color:'#272d29',metalness:.7,roughness:.42});
 const trim=new T.MeshStandardMaterial({color:'#69736b',metalness:.65,roughness:.38});
 const dirt=new T.MeshStandardMaterial({color:'#302a20',roughness:1});
 const seam=new T.MeshStandardMaterial({color:'#68695f',roughness:1});
 const green=new T.MeshStandardMaterial({color:'#284c3c',roughness:.7});
 const glass=new T.MeshStandardMaterial({color:'#cbd9c1',metalness:.18,roughness:.22,emissive:'#f5d197',emissiveIntensity:.15});
 // Expansion joints and slightly proud borders keep the foreground from reading as a flat plane.
 for(let x=-12;x<=12;x+=2)parts.box(seam,x,-.65,.004,.009,11,.008,0);
 for(let y=-6.15;y<=4.85;y+=2)parts.box(seam,0,y,.004,24,.009,.008,0);
 for(const x of [-10.5,10.5]){
  parts.box(dark,x,4.3,.016,.7,.34,.025,.008);
  for(let j=0;j<11;j++)parts.box(stone,x-.3+j*.06,4.3,.032,.024,.32,.025,.003);
 }
 for(const x of [-4.8,4.8]){
  parts.box(stone,x,.6,.32,1.35,1.15,.64,.035);
  parts.box(stone,x,.6,.65,1.44,1.24,.08,.025);
  parts.box(dirt,x,.6,.699,1.21,1.01,.018,.008);
 }
 for(const x of [-7,7]){
  for(const dx of [-.8,.8])parts.box(dark,x+dx,3.34,.76,.055,.065,.69,.009);
  for(let j=0;j<4;j++)for(const dx of [-.8,.8])parts.cylinder(trim,x+dx,2.8+j*.14,.521,.011,.004,new T.Euler(Math.PI/2,0,0),8);
 }
 // Street lamps and fencing provide several distinct depth planes in stereo.
 for(const x of [-11.5,12.5]){
  const y=12.4,z=lawnElevation(x,y);
  parts.cylinder(dark,x,y,z+.13,.23,.26,new T.Euler(Math.PI/2,0,0));
  parts.cylinder(dark,x,y,z+1.9,.065,3.7,new T.Euler(Math.PI/2,0,0));
  parts.cylinder(trim,x,y,z+.45,.10,.5,new T.Euler(Math.PI/2,0,0));
  parts.box(dark,x,y,z+3.85,.44,.44,.07,.018);
  parts.box(glass,x,y,z+4.1,.32,.32,.43,.012);
  for(const dx of [-.18,.18])for(const dy of [-.18,.18])parts.box(dark,x+dx,y+dy,z+4.1,.026,.026,.5,.005);
  parts.add(new T.ConeGeometry(.36,.22,4),dark,new T.Vector3(x,y,z+4.46),new T.Euler(Math.PI/2,0,Math.PI/4));
 }
 for(const side of [-1,1]){
  const x=side*12.4;
  for(let y=-3;y<5;y+=.4)parts.cylinder(dark,x,y,.52,.015,1.04,new T.Euler(Math.PI/2,0,0),6);
  for(const z of [.23,.94])parts.box(dark,x,1,z,.042,8,.04,.006);
 }
 // A metal litter basket with a hollow lip.
 parts.cylinder(dark,-9.2,.4,.41,.28,.82,new T.Euler(Math.PI/2,0,0));
 parts.add(new T.TorusGeometry(.28,.035,6,24),trim,new T.Vector3(-9.2,.4,.82));
 parts.cylinder(dirt,-9.2,.4,.78,.245,.016,new T.Euler(Math.PI/2,0,0));
 // Street sign is geometry with readable type, not a photographic billboard.
 const signX=10.6,signY=13.4,signZ=streetElevation(signX)+2.75;
 parts.cylinder(trim,signX,signY,signZ/2,.038,signZ,new T.Euler(Math.PI/2,0,0));
 parts.box(green,signX,signY,signZ,1.7,.045,.32,.018);
 parts.finish(group);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
 const context=canvas.getContext('2d')!;context.fillStyle='#244737';context.fillRect(0,0,512,96);context.strokeStyle='#d4ddd0';context.lineWidth=3;context.strokeRect(7,7,498,82);context.fillStyle='#e6e9df';context.font='bold 49px Arial';context.textAlign='center';context.fillText('STEINER ST',256,65);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 const label=new T.Mesh(new T.PlaneGeometry(1.6,.30),new T.MeshStandardMaterial({map,roughness:.8}));label.rotation.x=Math.PI/2;label.position.set(signX,signY-.024,signZ);group.add(label);

 // Bent individual leaves and grass blades, merged into a single mesh.
 let seed=173;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 for(let i=0;i<5200;i++){
  const planter=i<1000,side=random()<.5?-1:1;
  const x=planter?side*4.8+(random()-.5)*1.05:(random()-.5)*28;
  const y=planter?.6+(random()-.5)*.85:5+random()*6.7;
  const z=planter?.71:lawnElevation(x,y)+.008;
  const h=planter?.18+random()*.58:.045+random()*.13;
  const w=planter?.009+random()*.024:.005+random()*.008;
  const a=random()*Math.PI*2,lean=(planter?.22:.06)*(random()-.5);
  const color=new T.Color().setHSL(.18+random()*.08,.22+random()*.28,.12+random()*.11);
  const base=positions.length/3;
  for(let k=0;k<=3;k++){const t=k/3;for(const s of [-1,1]){positions.push(x+Math.cos(a)*w*s*(1-t)+Math.sin(a)*lean*t*t,y+Math.sin(a)*w*s*(1-t)+Math.cos(a)*lean*t*t,z+h*t);colors.push(color.r,color.g,color.b)}if(k<3){const j=base+k*2;indices.push(j,j+1,j+2,j+1,j+3,j+2)}}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const vegetation=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.95,side:T.DoubleSide}));vegetation.receiveShadow=true;group.add(vegetation);
}
