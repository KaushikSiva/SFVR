import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let server,watcher,stopping=false;
const stop=()=>{if(stopping)return;stopping=true;watcher?.kill();server?.kill();process.exit(0)};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const ready=async()=>{try{const r=await fetch('http://127.0.0.1:5186',{signal:AbortSignal.timeout(1500)});return r.ok&&(await r.text()).includes('SFVR')}catch{return false}};
if(!await ready()){
 console.log('Starting SFVR…');
 server=spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'--host','0.0.0.0','--port','5186','--strictPort'],{cwd:root,stdio:'inherit'});
 server.on('error',e=>{console.error(e.message);stop()});
 let started=false;
 for(let i=0;i<30;i++){if(await ready()){started=true;break}await new Promise(resolve=>setTimeout(resolve,500))}
 if(!started){console.error('Could not start the game on port 5186. Check the server output above.');stop()}
}
console.log('Computer: http://127.0.0.1:5186 · Galaxy XR: http://localhost:5186');
const launch=spawn(process.execPath,[resolve(root,'scripts/galaxy-xr.mjs')],{cwd:root,stdio:'inherit'});
await new Promise(resolve=>launch.once('exit',resolve));
watcher=spawn(process.execPath,[resolve(root,'scripts/watch-headset.mjs')],{cwd:root,stdio:'inherit'});
watcher.on('exit',stop);
