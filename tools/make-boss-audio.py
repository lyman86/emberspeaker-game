"""Original layered warning/release sounds: crystal resonances, metal, choir and snow.
Deterministic standard-library DSP; no third-party samples or runtime synthesis cost.
"""
import array,json,math,random,wave
from pathlib import Path
root=Path(__file__).resolve().parents[1];sr=22050
sets={4:[('blades_draw','blades_release',780),('fault_charge','fault_break',98),('storm_rise','storm_roar',58),('crown_chime','crown_seal',440),('prism_tune','prism_fire',1190)],6:[('scythe_draw','scythe_cut',215),('lances_form','lances_launch',1331),('requiem_breath','requiem_bell',146.83),('procession_steps','procession_march',110),('whiteout_hush','whiteout_burst',48)]}
p=root/'public/audio/manifest.json';manifest=json.loads(p.read_text())
for ep,skills in sets.items():
 out=root/f'public/audio/episode{ep}';out.mkdir(exist_ok=True)
 for skill,pair in enumerate(skills):
  for stage,name in enumerate(pair[:2]):
   rng=random.Random(ep*100+skill*2+stage);dur=(1.35 if stage==0 else 2.1);samples=array.array('h');lp=[0.,0.];slow=[0.,0.];base=pair[2]
   for i in range(int(sr*dur)):
    t=i/sr;k=t/dur;envelope=(math.sin(k*math.pi*.5)**1.3 if stage==0 else math.exp(-t*2.7));fade=min(1,t/.018,(dur-t)/.16)
    for ch in range(2):
     n=rng.uniform(-1,1);lp[ch]+=(n-lp[ch])*.17;slow[ch]+=(lp[ch]-slow[ch])*.023
     f=base*(.72+.28*k if stage==0 else 1+.02*math.sin(9*t));tone=sum(math.sin(math.tau*f*r*t+ch*.025)*math.exp(-t*d) for r,d in [(1,.2),(1.503,1),(2.71,2.8)])*.055
     noise=lp[ch]*.08+slow[ch]*(1.6 if skill in [2,4] else .25)
     if ep==6 and skill==2:tone=sum(math.sin(math.tau*f*t+.014*math.sin(t*5)) for f in [146.83,220,293.66,349.23])*.04
     if ep==6 and skill==3:noise+=math.sin(math.tau*63*t)*math.exp(-(t%.24)*30)*.16
     if stage:noise+=lp[ch]*math.exp(-t*22)*.35;tone+=math.sin(math.tau*(62*t-10*t*t))*math.exp(-t*8)*.18
     v=(tone+noise)*envelope*fade;samples.append(round(math.tanh(v*1.5)*.85*32767))
   file=f'episode{ep}/{name}.wav'
   with wave.open(str(root/'public/audio'/file),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(samples.tobytes())
   manifest['sfx'][('sq_' if ep==4 else 'wa_')+name]={'files':[file],'gain':.8,'wet':.26 if ep==4 else .4,'pitch':.015}
p.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
