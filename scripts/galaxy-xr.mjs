import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';

// Local USB launch only. Does not install an APK or publish the development server.
const candidates=[process.env.ADB,process.env.ANDROID_HOME&&join(process.env.ANDROID_HOME,'platform-tools/adb'),join(homedir(),'Library/Android/sdk/platform-tools/adb'),'/opt/homebrew/bin/adb','adb'].filter(Boolean);
let adb;
for(const candidate of candidates){try{execFileSync(candidate,['version'],{stdio:'ignore'});adb=candidate;break}catch{}}
if(!adb){console.error('Install Android SDK Platform Tools, then connect Galaxy XR by USB and enable USB debugging.');process.exit(1)}
try{
 const devices=execFileSync(adb,['devices'],{encoding:'utf8'}).split('\n').map(s=>s.trim().split(/\s+/)).filter(([,status])=>status==='device').map(([serial])=>serial);
 const serial=process.env.ANDROID_SERIAL||devices[0];
 if(!serial||!devices.includes(serial))throw new Error('No authorized headset found. Connect Galaxy XR, enable USB debugging, and accept its debugging prompt.');
 if(devices.length>1&&!process.env.ANDROID_SERIAL)throw new Error('Multiple devices connected. Set ANDROID_SERIAL to the Galaxy XR serial shown by adb devices.');
 const response=await fetch('http://127.0.0.1:5186',{signal:AbortSignal.timeout(3000)});
 if(!response.ok)throw new Error('Start npm run dev in another terminal first.');
 execFileSync(adb,['-s',serial,'reverse','tcp:5186','tcp:5186'],{stdio:'inherit'});
 execFileSync(adb,['-s',serial,'shell','am','start','-a','android.intent.action.VIEW','-d','http://localhost:5186','-p','com.android.chrome'],{stdio:'inherit'});
 console.log('Opened SFVR in headset Chrome. Select ENTER GALAXY XR, accept tracking permissions, then point and pinch to start.');
}catch(error){console.error(error.message==='fetch failed'?'Start npm run dev in another terminal first.':error.message);process.exit(1)}
