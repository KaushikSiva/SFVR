export class Sound {
 private ctx:AudioContext|null=null;enabled=true;
 unlock(){if(!this.ctx)this.ctx=new AudioContext();void this.ctx.resume();}
 tone(kind:'shot'|'hit'|'kill'|'damage'|'reload'|'start'){
  if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);
  const settings={shot:[430,110,.07,.045],hit:[780,1150,.09,.07],kill:[520,1450,.21,.09],damage:[140,55,.35,.13],reload:[250,350,.12,.04],start:[330,660,.3,.08]}[kind];
  o.type=kind==='shot'?'triangle':kind==='damage'?'sawtooth':'sine';o.frequency.setValueAtTime(settings[0],t);o.frequency.exponentialRampToValueAtTime(settings[1],t+settings[2]);g.gain.setValueAtTime(settings[3],t);g.gain.exponentialRampToValueAtTime(.001,t+settings[2]);o.start(t);o.stop(t+settings[2]+.01);
 }
}
