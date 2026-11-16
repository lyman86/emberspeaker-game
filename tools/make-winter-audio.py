"""Original deterministic frost ambience, fractured ice and wordless choir; standard-library DSP only."""
import array,json,math,random,wave
from pathlib import Path
random.seed(6116)
root=Path(__file__).resolve().parents[1];out=root/'public/audio/episode6';out.mkdir(exist_ok=True);sr=22050
for name,seconds in [('wind',18),('ice',1.4),('crack',1.6),('chant',3.4)]:
 samples=array.array('h');lp=[0.,0.];slow=[0.,0.]
 for i in range(int(sr*seconds)):
  t=i/sr;k=t/seconds;fade=min(1,t/.04,(seconds-t)/.15)
  for c in range(2):
   n=random.uniform(-1,1);lp[c]+=(n-lp[c])*.12;slow[c]+=(lp[c]-slow[c])*.014
   if name=='wind':
    v=(lp[c]*.2+slow[c]*1.3)*(.45+.35*math.sin(t*.7+c*.07)**2)+math.sin(math.tau*(183*t+.5*math.sin(t*.4)))*.012
   elif name=='ice':v=sum(math.sin(math.tau*f*t)*math.exp(-t*d) for f,d in [(631,3),(947,4),(1411,7),(2249,8)])*.06+lp[c]*math.exp(-t*13)*.15
   elif name=='crack':v=lp[c]*math.exp(-t*5)*.35+math.sin(math.tau*(83*t-21*t*t))*math.exp(-t*5)*.2+sum(math.sin(math.tau*f*t)*math.exp(-t*6) for f in [1709,2207,2971])*.035
   else:v=sum(math.sin(math.tau*(f*t+.001*math.sin(t*5+c*.05)))*(.6+.4*math.sin(t*.8)) for f in [146.83,220,293.66,349.23,440])*.036*math.sin(math.pi*k)**.7+slow[c]*.05
   samples.append(int(max(-.9,min(.9,v*fade))*32767))
 with wave.open(str(out/(name+'.wav')),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(samples.tobytes())
p=root/'public/audio/manifest.json';m=json.loads(p.read_text())
for name in ['wind','ice','crack','chant']:m['sfx']['w_'+name]={'files':['episode6/'+name+'.wav'],'gain':.65,'wet':.3,'pitch':.03}
m['amb']['amb_blizzard']={'file':'episode6/wind.wav','gain':.4}
p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
