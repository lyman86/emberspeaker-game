"""Original deterministic maritime ambience/effects, using only standard-library DSP; no third-party recordings."""
import math,random,wave,array
from pathlib import Path
random.seed(5721)
out=Path(__file__).resolve().parents[1]/'public/audio/episode5';out.mkdir(exist_ok=True)
sr=22050
for name,seconds in [('sea',24),('surge',2.4),('chain',1.3),('lure',2.1),('plank',.3)]:
 samples=array.array('h');lp=[0.,0.];slow=[0.,0.]
 for i in range(int(sr*seconds)):
  t=i/sr;k=t/seconds;fade=min(1,t/.025,(seconds-t)/.04)
  for channel in range(2):
   n=random.uniform(-1,1);lp[channel]+=(n-lp[channel])*.11;slow[channel]+=(lp[channel]-slow[channel])*.012
   if name=='sea':
    swell=(.5-.5*math.cos(t*math.tau/6+channel*.04))**2
    v=lp[channel]*(.10+.23*swell)+slow[channel]*(.6+.5*swell)
    v+=math.sin(t*math.tau*(47+channel*.1))*.008*(.5+.5*math.sin(t*math.tau/12))
   elif name=='surge':v=(lp[channel]*.7+slow[channel]*1.6)*math.sin(math.pi*k)**.7+math.sin(math.tau*(64*t-9*t*t))*.16*math.exp(-k*5)
   elif name=='chain':v=sum(math.sin(math.tau*f*t)*math.exp(-t*d) for f,d in [(740,8),(1113,9),(1647,13),(79,6)])*.09+lp[channel]*math.exp(-t*12)*.18
   elif name=='lure':v=sum(math.sin(math.tau*f*t)*math.exp(-t*d) for f,d in [(174,1.7),(263,2.2),(507,3.4),(719,4.1)])*.065
   else:v=lp[channel]*math.exp(-t*30)*.55+math.sin(math.tau*(160*t-130*t*t))*math.exp(-t*18)*.10
   samples.append(int(max(-.95,min(.95,v*fade))*32767))
 with wave.open(str(out/(name+'.wav')),'wb') as wav:wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(sr);wav.writeframes(samples.tobytes())
 print(name,(out/(name+'.wav')).stat().st_size)
