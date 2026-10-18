import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';

const candidates=[process.env.ADB,process.env.ANDROID_HOME&&join(process.env.ANDROID_HOME,'platform-tools/adb'),join(homedir(),'Library/Android/sdk/platform-tools/adb'),'/opt/homebrew/bin/adb','adb'].filter(Boolean);
const adb=candidates.find(candidate=>{try{execFileSync(candidate,['version'],{stdio:'ignore'});return true}catch{return false}});
if(!adb){console.error('Install Android SDK Platform Tools and make adb available on PATH.');process.exit(1)}
const run=args=>execFileSync(adb,args,{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']});
let last='';
console.log('Watching Galaxy XR USB connection. Keep this terminal open; Ctrl+C stops the watcher.');
while(true){
 try{
  const devices=run(['devices','-l']).split('\n');
  const device=devices.find(line=>/\bdevice\b/.test(line)&&/model:SM_I610\b/.test(line));
  if(!device){const state=devices.some(line=>line.includes('unauthorized'))?'Accept Allow USB debugging inside the headset.':'Waiting for Galaxy XR USB connection…';if(state!==last)console.log(state);last=state;}
  else{
   const serial=device.trim().split(/\s+/)[0];
   const reverse=run(['-s',serial,'reverse','--list']);
   if(!reverse.includes('tcp:5186 tcp:5186')){
    const response=await fetch('http://127.0.0.1:5186',{signal:AbortSignal.timeout(2000)});
    if(!response.ok)throw new Error('Game server is unavailable. Run npm run dev.');
    run(['-s',serial,'reverse','tcp:5186','tcp:5186']);
    run(['-s',serial,'shell','am','start','-a','android.intent.action.VIEW','-d','http://localhost:5186','-p','com.android.chrome']);
    console.log('USB connection restored; opened http://localhost:5186 on Galaxy XR.');
   }
   if(last!=='connected')console.log('Galaxy XR connected. Localhost forwarding is active.');
   last='connected';
  }
 }catch(error){const message=error.message==='fetch failed'?'Game server is offline. Run npm run dev.':error.message.split('\n')[0];if(last!==message)console.log(message);last=message;}
 await new Promise(resolve=>setTimeout(resolve,2000));
}
