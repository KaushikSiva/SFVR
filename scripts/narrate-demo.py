"""Generate the requested ElevenLabs stock-voice narration and word timing.
The API key is read from the ignored project .env; it is never emitted.
"""
from pathlib import Path
import base64,json,os,urllib.request,urllib.error
root=Path(__file__).resolve().parents[1]
key=os.environ.get('ELEVENLABS_API_KEY')
for env in [root/'.env']:
    if key:break
    if env.is_file():
        for line in env.read_text().splitlines():
            if line.startswith('ELEVENLABS_API_KEY='):key=line.split('=',1)[1].strip()
if not key:raise SystemExit('Configure ELEVENLABS_API_KEY in the ignored .env file.')
voice='nPczCjzI2devNBz1zQrb' # Brian: stock ElevenLabs voice, not a cloned person.
text=(root/'docs/demo/narration.txt').read_text().strip()
payload={'text':text,'model_id':'eleven_multilingual_v2','voice_settings':{'stability':.48,'similarity_boost':.75,'style':.15,'use_speaker_boost':True,'speed':1.04}}
req=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128',data=json.dumps(payload).encode(),headers={'xi-api-key':key,'Content-Type':'application/json'})
try:
    with urllib.request.urlopen(req,timeout=120) as response:data=json.load(response)
except urllib.error.HTTPError as error:
    print('ElevenLabs generation failed:',error.code,error.read().decode()[:500]);raise SystemExit(1)
(root/'docs/demo/narration.mp3').write_bytes(base64.b64decode(data['audio_base64']))
(root/'docs/demo/alignment.json').write_text(json.dumps(data.get('normalized_alignment') or data['alignment']))
(root/'docs/demo/voice.json').write_text(json.dumps({'provider':'ElevenLabs','voice':'Brian','voice_id':voice,'model':payload['model_id'],'settings':payload['voice_settings'],'purpose':'Requested product-demo narration'},indent=2)+'\n')
print('ElevenLabs narration and timing saved.')
