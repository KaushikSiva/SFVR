import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {prepareDaylight} from './scene/daylight';
import {addParkDetails} from './park-details';
import {buildVictorians} from './scene/victorians';
import {buildNeighborhood} from './scene/neighborhood';
import {lawnElevation,streetElevation} from './scene/siteAlignment';
export function buildLevel(scene:T.Scene,renderer:T.WebGLRenderer,onProgress:(s:string)=>void){
 scene.background=new T.Color('#a7c4d5');scene.fog=new T.Fog('#b9cbd2',85,310);
 const hemi=new T.HemisphereLight('#c3d8ed','#52533c',.25);scene.add(hemi);
 const sun=new T.DirectionalLight('#fff0d3',2.3);sun.position.set(-25,42,28);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:120});sun.shadow.normalBias=.018;sun.shadow.bias=-.00008;sun.shadow.radius=2;sun.target.position.set(0,0,-15);scene.add(sun,sun.target);
 const lightingReady=new HDRLoader().loadAsync(import.meta.env.BASE_URL+'assets/daylight.hdr').then(texture=>{const daylight=prepareDaylight(texture,renderer);texture.mapping=T.EquirectangularReflectionMapping;scene.background=texture;scene.backgroundRotation.y=daylight.rotation;scene.backgroundIntensity=.8;scene.environment=daylight.environment;scene.environmentRotation.y=daylight.rotation;scene.environmentIntensity=.75;hemi.intensity=.12;sun.color.copy(daylight.color);sun.intensity=Math.min(3,daylight.intensity);sun.position.copy(daylight.direction).multiplyScalar(60).add(sun.target.position);});
 const root=new T.Group();root.rotation.x=-Math.PI/2;scene.add(root);
 onProgress('Building the Painted Ladies');const houses=buildVictorians();root.add(houses);const neighborhood=buildNeighborhood();root.add(neighborhood);
 houses.traverse(o=>{if(o instanceof T.Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m instanceof T.MeshPhysicalMaterial){m.transmission=0;m.color.set('#364b5d');m.roughness=.12;m.metalness=.45;m.envMapIntensity=1.6;}}});
 const loader=new T.TextureLoader();const tex=(name:string,n:number,srgb=true)=>{const t=loader.load(import.meta.env.BASE_URL+'assets/'+name+'.jpg');if(srgb)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(n,n);t.anisotropy=4;return t};
 const ground=new T.PlaneGeometry(110,110,60,60);ground.translate(0,-38,0);const pos=ground.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,lawnElevation(pos.getX(i),pos.getY(i)));ground.computeVertexNormals();
 const grass=new T.Mesh(ground,new T.MeshStandardMaterial({map:tex('grass-color',24),normalMap:tex('grass-normal',24,false),normalScale:new T.Vector2(.6,.6),roughnessMap:tex('grass-rough',24,false),color:'#9eaf80',roughness:1}));grass.receiveShadow=true;root.add(grass);
 const path=new T.Mesh(new T.PlaneGeometry(24,11),new T.MeshStandardMaterial({map:tex('concrete-color',7),normalMap:tex('concrete-normal',7,false),normalScale:new T.Vector2(.5,.5),roughnessMap:tex('concrete-rough',7,false),color:'#c1bbb0',roughness:.94}));path.position.set(0,-.65,0);path.receiveShadow=true;root.add(path);
 const road=new T.PlaneGeometry(100,9,50,1);const rpos=road.attributes.position;for(let i=0;i<rpos.count;i++)rpos.setZ(i,streetElevation(rpos.getX(i))-.08);road.computeVertexNormals();const asphalt=new T.Mesh(road,new T.MeshStandardMaterial({map:tex('asphalt-color',22),normalMap:tex('asphalt-normal',22,false),normalScale:new T.Vector2(.35,.35),roughnessMap:tex('asphalt-rough',22,false),color:'#717570',roughness:1}));asphalt.position.y=18.2;asphalt.receiveShadow=true;root.add(asphalt);
 const material=new T.MeshStandardMaterial({color:'#d1cdc0',roughness:.9});
 const curbs=new T.InstancedMesh(new T.BoxGeometry(1.01,.2,.18),material,200),transform=new T.Matrix4();let curbIndex=0;
 for(const y of [4.8,-6.15,13.6,22.8])for(let x=-25;x<25;x++){const h=y>10?streetElevation(x+.5):0;curbs.setMatrixAt(curbIndex++,transform.makeTranslation(x+.5,y,h+.06));}
 curbs.castShadow=curbs.receiveShadow=true;root.add(curbs);
 const wood=new T.MeshStandardMaterial({color:'#71513b',roughness:.9}),iron=new T.MeshStandardMaterial({color:'#313b35',metalness:.6,roughness:.5});
 for(const bx of [-7,7]){for(let k=0;k<4;k++){const slat=new T.Mesh(new T.BoxGeometry(2.1,.1,.07),wood);slat.position.set(bx,2.8+k*.14,.48);slat.castShadow=true;root.add(slat)}for(const dx of [-.8,.8]){const leg=new T.Mesh(new T.BoxGeometry(.07,.5,.45),iron);leg.position.set(bx+dx,3,.24);root.add(leg)}for(let k=0;k<3;k++){const slat=new T.Mesh(new T.BoxGeometry(2.1,.07,.1),wood);slat.position.set(bx,3.34,.72+k*.15);slat.castShadow=true;root.add(slat)}}
 // Painted launch markings make the bounded arena legible from the first frame.
 const stripe=new T.MeshBasicMaterial({color:'#d5bd86',transparent:true,opacity:.7});for(const x of [-4.5,4.5]){const m=new T.Mesh(new T.PlaneGeometry(.06,8),stripe);m.position.set(x,-.8,.012);root.add(m)}
 addParkDetails(root);
 const gltf=new GLTFLoader();const ready=Promise.allSettled([lightingReady,
  gltf.loadAsync(import.meta.env.BASE_URL+'assets/park-tree.glb').then(({scene:tree})=>{for(const [x,z,s]of [[-14,-5,.78],[15,-7,.82]]){const t=tree.clone(true);t.scale.setScalar(s);t.position.set(x,lawnElevation(x,-z),z);t.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(t)}}),
  gltf.loadAsync(import.meta.env.BASE_URL+'assets/parked-hatchback.glb').then(({scene:car})=>{car.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshPhysicalMaterial&&m.transmission>0){m.transmission=0;m.color.set('#465058');m.roughness=.25;}}});const bounds=new T.Box3().setFromObject(car),c=bounds.getCenter(new T.Vector3());for(const [x,z,a]of [[-9,-15,Math.PI/2],[11,-21,-Math.PI/2]]){const inner=car.clone(true);inner.position.set(-c.x,-bounds.min.y,-c.z);const pivot=new T.Group();pivot.add(inner);pivot.rotation.y=a;pivot.position.set(x,streetElevation(x)-.08,z);const grade=(streetElevation(x+1.7)-streetElevation(x-1.7))/3.4;pivot.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(-grade,1,0).normalize()));scene.add(pivot)}})
 ]).then(result=>{onProgress(result.some(r=>r.status==='rejected')?'Ready · some scenery unavailable':'Ready');return result});
 return {ready,sun,root,triangles:()=>renderer.info.render.triangles};
}
