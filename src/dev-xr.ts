// Development-only WebXR API/input tests. This is a generic simulator, not a
// Samsung hardware model or a measurement of Galaxy XR performance.
import {XRDevice, generic} from 'iwer';
import type {XRDeviceConfig} from 'iwer';
import {XREnvironmentBlendMode, XRInteractionMode} from 'iwer/lib/session/XRSession.js';

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
 device.primaryInputMode='hand';device.installRuntime({forceInstall:true});
 (window as any).__xrEmulator=device;
 document.body.dataset.emulated='true';
}
