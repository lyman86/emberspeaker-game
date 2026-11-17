"""Bake an original short-fur normal map for the downloaded snow-beast skin."""
from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
import math,random
root=Path(__file__).resolve().parents[1]
rng=random.Random(1864);w,h=1000,800
height=Image.new('L',(w,h),104);draw=ImageDraw.Draw(height)
for i in range(42000):
 x=rng.uniform(-12,w+12);y=rng.uniform(-18,h+18);length=rng.uniform(5,17);bend=math.sin(x/80+y/110)*2+rng.uniform(-2,2);light=rng.randrange(125,225)
 points=[(x+bend*t*t,y+length*t) for t in [0,.25,.5,.75,1]]
 draw.line([(a+1,b) for a,b in points],fill=55,width=2);draw.line(points,fill=light,width=1)
height=height.filter(ImageFilter.GaussianBlur(.55));p=height.load();normal=Image.new('RGB',(w,h));out=normal.load()
for y in range(h):
 for x in range(w):
  dx=(p[(x+1)%w,y]-p[(x-1)%w,y])/90;dy=(p[x,(y+1)%h]-p[x,(y-1)%h])/90;l=math.sqrt(dx*dx+dy*dy+1)
  out[x,y]=(round(127.5*(1-dx/l)),round(127.5*(1+dy/l)),round(127.5*(1+1/l)))
normal.save(root/'raw/character-redesign/snowbeast-fur-normal.png')
