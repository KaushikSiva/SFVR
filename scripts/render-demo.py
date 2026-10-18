"""Render a 60-second SFVR demo from real browser footage and ElevenLabs narration.
Run capture-demo.mjs first. Requires ffmpeg on PATH; generated intermediates stay in .local.
"""
from pathlib import Path
import json,subprocess,textwrap
root=Path(__file__).resolve().parents[1]
local=root/'.local/demo';out=root/'docs/demo'
a=json.loads((out/'alignment.json').read_text())
words=[];word='';start=0;end=0
for char,s,e in zip(a['characters'],a['character_start_times_seconds'],a['character_end_times_seconds']):
    if char.isspace():
        if word:words.append((word,start,end));word=''
    else:
        if not word:start=s
        word+=char;end=e
if word:words.append((word,start,end))
# Keep the spoken initials together and spell the project name naturally in captions.
i=0
while i<len(words)-3:
    if [x[0].rstrip(',.') for x in words[i:i+4]]==['S','F','V','R']:
        words[i:i+4]=[('SFVR'+('' if words[i+3][0]=='R' else words[i+3][0][-1]),words[i][1],words[i+3][2])]
    i+=1
chunks=[];current=[]
for w in words:
    current.append(w)
    if w[0].endswith(('.', '?', '!')) or len(' '.join(x[0] for x in current))>66 or w[2]-current[0][1]>3.1:
        chunks.append(current);current=[]
if current:chunks.append(current)
def stamp(t,ass=False):
    h=int(t//3600);m=int(t%3600//60);s=t%60
    return f'{h}:{m:02}:{s:05.2f}' if ass else f'{h:02}:{m:02}:{s:06.3f}'.replace('.',',')
lines=[];events=[]
for n,c in enumerate(chunks):
    end=min(c[-1][2]+.12,chunks[n+1][0][1] if n+1<len(chunks) else 60)
    text=' '.join(x[0] for x in c);wrapped=textwrap.wrap(text,46)
    lines.append(f'{n+1}\n{stamp(c[0][1])} --> {stamp(end)}\n'+ '\n'.join(wrapped)+'\n')
    events.append(f'Dialogue: 2,{stamp(c[0][1],True)},{stamp(end,True)},Caption,,0,0,0,,'+r'\N'.join(wrapped))
(out/'sfvr-demo.srt').write_text('\n'.join(lines))
header='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,32,&H00F5F4F0,&H00FFFFFF,&H00121B23,&H90121B23,0,0,0,0,100,100,0,0,3,10,0,2,300,300,110,1
Style: Brand,Arial,21,&H00F5F4F0,&H00FFFFFF,&H80121B23,&H80121B23,-1,0,0,0,100,100,2,0,3,9,0,9,65,65,33,1
Style: Source,Arial,16,&H00D4D9DD,&H00FFFFFF,&H80121B23,&H80121B23,0,0,0,0,100,100,1,0,3,5,0,1,65,65,72,1
Style: Title,Arial,112,&H00F5F4F0,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,2,0,1,0,0,5,60,60,0,1
Style: Sub,Arial,27,&H003D7BFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,60,60,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
events += [
 r'Dialogue: 1,0:00:00.00,0:00:57.00,Brand,,0,0,0,,SAMSUNG GALAXY XR GAME',
 r'Dialogue: 1,0:00:06.00,0:00:57.00,Source,,0,0,0,,ACTUAL DESKTOP GAMEPLAY  /  XR BUILD',
 r'Dialogue: 1,0:00:57.00,0:01:00.00,Title,,0,0,0,,{\pos(960,385)\fad(180,0)}SFVR',
 r'Dialogue: 1,0:00:57.00,0:01:00.00,Sub,,0,0,0,,{\pos(960,490)\fad(180,0)}BUILT FOR SAMSUNG GALAXY XR',
 r'Dialogue: 1,0:00:57.00,0:01:00.00,Caption,,0,0,0,,{\pos(960,625)\fad(180,0)\bord0}github.com/KaushikSiva/SFVR',
]
(local/'captions.ass').write_text(header+'\n'.join(events)+'\n')
c=json.loads((local/'capture.json').read_text())
# Six seconds of the actual title, 51 seconds of play, then a branded end card.
# No time acceleration or synthetic gameplay is used.
start=c['menu'];game=c['gameplay']
filters=f"[0:v]split=2[m][g];[m]trim=start={start}:duration=6,setpts=PTS-STARTPTS[m0];[g]trim=start={game}:duration=51,setpts=PTS-STARTPTS[g0];[m0][g0]concat=n=2:v=1:a=0,tpad=stop_mode=clone:stop_duration=3,fps=30,drawbox=x=0:y=0:w=iw:h=ih:color=0x0c1823@0.94:t=fill:enable='gte(t,57)',ass=.local/demo/captions.ass[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=60[a]"
subprocess.run(['ffmpeg','-y','-hide_banner','-i',str(local/'browser-gameplay.webm'),'-i',str(out/'narration.mp3'),'-filter_complex',filters,'-map','[v]','-map','[a]','-t','60','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-metadata','title=SFVR — Built for Samsung Galaxy XR','-metadata','comment=Actual browser gameplay. ElevenLabs Brian narration. Desktop footage, not an in-headset recording.',str(out/'sfvr-demo.mp4')],cwd=root,check=True)
