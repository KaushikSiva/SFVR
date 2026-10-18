import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Merge static details by material; small bevels stay actual geometry. */
export class Parts {
 private batches=new Map<T.Material,T.BufferGeometry[]>();
 add(geometry:T.BufferGeometry,material:T.Material,position:T.Vector3,rotation=new T.Euler()){
  geometry.applyMatrix4(new T.Matrix4().compose(position,new T.Quaternion().setFromEuler(rotation),new T.Vector3(1,1,1)));
  if(geometry.index){const original=geometry;geometry=original.toNonIndexed();original.dispose()}
  const batch=this.batches.get(material)??[];batch.push(geometry);this.batches.set(material,batch);
 }
 box(m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,r=.01,rotation=new T.Euler()){
  this.add(r?new RoundedBoxGeometry(w,h,d,1,r):new T.BoxGeometry(w,h,d),m,new T.Vector3(x,y,z),rotation);
 }
 cylinder(m:T.Material,x:number,y:number,z:number,r:number,length:number,rotation=new T.Euler(),segments=16){
  this.add(new T.CylinderGeometry(r,r,length,segments),m,new T.Vector3(x,y,z),rotation);
 }
 finish(parent:T.Group,shadows=true){
  for(const [material,parts]of this.batches){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=shadows;parent.add(mesh)}
  this.batches.clear();
 }
}
