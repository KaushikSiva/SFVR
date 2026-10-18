// Development-only WebXR API/input tests. This is a generic simulator, not a
// Samsung hardware model or a measurement of Galaxy XR performance.
import {XRDevice, generic} from 'iwer';
import type {XRDeviceConfig} from 'iwer';
import {XREnvironmentBlendMode, XRInteractionMode} from 'iwer/lib/session/XRSession.js';
import {P_HAND_INPUT} from 'iwer/lib/private.js';
import {pointHandPose} from 'iwer/lib/device/configs/hand/point.js';

export function installTestRuntime(){
 const config:XRDeviceConfig={
  name:'Generic hand-tracked WebXR test rig',controllerConfig:generic,
  supportedSessionModes:['inline','immersive-vr'],
  supportedFeatures:['viewer','local','local-floor','hand-tracking'],
  supportedFrameRates:[60],internalNominalFrameRate:60,isSystemKeyboardSupported:false,
  environmentBlendModes:{'inline':XREnvironmentBlendMode.Opaque,'immersive-vr':XREnvironmentBlendMode.Opaque},
  interactionMode:XRInteractionMode.WorldSpace,userAgent:navigator.userAgent,
 };
 const device=new XRDevice(config,{stereoEnabled:true,fovy:Math.PI/2});
 // Use the two handed controllers; generic also defines an unhanded fallback.
 if(device.controllers.none)device.controllers.none.connected=false;
 // Synthetic curled-index fixture: reuse the bent middle finger's relative
 // joints. Tests exercise getJointPose, not a bypass of the firing logic.
 const triggerPose=structuredClone(pointHandPose);
 const joints=triggerPose.jointTransforms;
 const indexBase=joints['index-finger-phalanx-proximal'].offsetMatrix;
 const middleBase=joints['middle-finger-phalanx-proximal'].offsetMatrix;
 for(const part of ['phalanx-intermediate','phalanx-distal','tip'] as const){
  const index=joints[`index-finger-${part}`].offsetMatrix;
  const middle=joints[`middle-finger-${part}`].offsetMatrix;
  for(let i=12;i<15;i++)index[i]=indexBase[i]+middle[i]-middleBase[i];
 }
 const twoFingerPose=structuredClone(pointHandPose);
 const twoJoints=twoFingerPose.jointTransforms;
 for(const part of ['phalanx-intermediate','phalanx-distal','tip'] as const){
  const middle=twoJoints[`middle-finger-${part}`].offsetMatrix;
  const index=twoJoints[`index-finger-${part}`].offsetMatrix;
  for(let i=12;i<15;i++)middle[i]=middleBase[i]+index[i]-indexBase[i];
 }
 for(const hand of Object.values(device.hands))if(hand){
  hand[P_HAND_INPUT].poses.trigger=triggerPose;
  hand[P_HAND_INPUT].poses.twoFinger=twoFingerPose;
 }
 device.primaryInputMode='hand';device.installRuntime({forceInstall:true});
 (window as any).__xrEmulator=device;
 document.body.dataset.emulated='true';
}
