"""Render ortografici delle mesh reali, senza OpenGL o servizi esterni."""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageChops
import reportlab

ROOT=Path(__file__).resolve().parents[1]
SCENES=json.loads((ROOT/'tmp/pdfs/thermoform-figures.json').read_text())
OUT=ROOT/'tmp/pdfs/thermoform-images';OUT.mkdir(parents=True,exist_ok=True)
FONT=ImageFont.truetype(str(Path(reportlab.__file__).parent/'fonts/VeraBd.ttf'),32)
NUMBERS={'front':'01','back':'02','female':'03','male':'04','connector':'05','cap':'06','lock':'07'}

def render(name,scene):
 W,H=1400,1000
 eye=np.array(scene['eye'],dtype=float);eye/=np.linalg.norm(eye)
 right=np.cross(np.array([0.,0.,1.]),eye);right/=np.linalg.norm(right)
 up=np.cross(eye,right)
 basis=np.array([right,up,eye])
 items=[]
 for item in scene['items']:
  v=np.array(item['positions']).reshape(-1,3)
  items.append((item,v,np.array(item['indices']).reshape(-1,3),v@basis.T))
 allxy=np.concatenate([v[:,:2] for _,_,_,v in items]);mn=allxy.min(axis=0);mx=allxy.max(axis=0)
 scale=min((W-280)/max(mx[0]-mn[0],1),(H-180)/max(mx[1]-mn[1],1))
 center=(mn+mx)/2
 def project(v):
  q=np.array(v)@basis.T
  return np.array([(q[...,0]-center[0])*scale+W/2,H/2-(q[...,1]-center[1])*scale,q[...,2]]).T
 image=np.full((H,W,3),248,dtype=np.uint8);depth=np.full((H,W),-np.inf)
 light=np.array([-.45,-.55,.85]);light/=np.linalg.norm(light)
 for item,v,faces,q in items:
  xy=np.column_stack([(q[:,0]-center[0])*scale+W/2,H/2-(q[:,1]-center[1])*scale])
  base=np.array([int(item['color'][i:i+2],16) for i in (1,3,5)])
  for ids in faces:
   a,b,c=xy[ids];va,vb,vc=v[ids]
   normal=np.cross(vb-va,vc-va);norm=np.linalg.norm(normal)
   if norm<1e-10:continue
   normal/=norm
   shade=.60+.40*max(0,np.dot(normal,light))
   color=np.minimum(255,base*shade+np.array([8,8,8])).astype(np.uint8)
   lo=np.maximum(0,np.floor(np.minimum(np.minimum(a,b),c)).astype(int));hi=np.minimum([W-1,H-1],np.ceil(np.maximum(np.maximum(a,b),c)).astype(int))
   if np.any(hi<lo):continue
   den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
   if abs(den)<1e-9:continue
   xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5)
   u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
   w=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
   z=u*q[ids[0],2]+w*q[ids[1],2]+(1-u-w)*q[ids[2],2]
   view=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
   mask=(u>=-1e-6)&(w>=-1e-6)&(u+w<=1.000001)&(z>view)
   view[mask]=z[mask];image[lo[1]:hi[1]+1,lo[0]:hi[0]+1][mask]=color
 out=Image.fromarray(image);draw=ImageDraw.Draw(out)
 for start,end in scene.get('arrows',[]):
  a=project(start)[:2];b=project(end)[:2];d=b-a;length=np.linalg.norm(d)
  if length<1:continue
  d/=length;n=np.array([-d[1],d[0]])
  draw.line([tuple(a),tuple(b)],fill='#db3b0a',width=9)
  draw.polygon([tuple(b),tuple(b-d*28+n*13),tuple(b-d*28-n*13)],fill='#db3b0a')
 if name=='exploded':
  for item,v,_,_ in items:
   point=project(v.mean(axis=0));cy=int(point[1]);x=75
   draw.rounded_rectangle([x-35,cy-27,x+35,cy+27],radius=12,fill='#22272b')
   draw.text((x,cy),NUMBERS[item['id']],font=FONT,anchor='mm',fill='white')
   draw.line([(x+40,cy),(max(x+70,int(point[0]-160)),cy)],fill='#66747c',width=3)
 bbox=ImageChops.difference(out,Image.new('RGB',out.size,(248,248,248))).getbbox()
 if bbox:
  x0,y0,x1,y1=bbox;out=out.crop((max(0,x0-40),max(0,y0-40),min(W,x1+40),min(H,y1+40)))
 width=1200;height=round(out.height*width/out.width)
 out.resize((width,height),Image.Resampling.LANCZOS).save(OUT/(name+'.png'))
 print(name,flush=True)

for name,scene in SCENES.items():render(name,scene)
