# Логотип YOUR LIFE на прозрачном фоне для интерфейса (светлая и тёмная тема).
# Белый фон вокруг рисунка становится прозрачным, мягкое свечение облаков сохраняется.
# В тёмном варианте надписи YOUR LIFE и «Твоя жизнь. Твоя игра.» осветлены.
# Запуск: python3 scripts/build-logo-transparent.py (нужны Pillow и numpy).
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
from pathlib import Path
from collections import deque
ROOT = Path(__file__).resolve().parent.parent / 'public' / 'brand'
OUT = ROOT / 'your-life-e00d2571783f'
R = 312  # радиус круга неба: внутри фон не вырезается
im=np.asarray(Image.open(ROOT / 'your-life-source.jpg').convert('RGB')).astype(np.float32)
h,w,_=im.shape
prot=Image.new('L',(w,h),0); d=ImageDraw.Draw(prot)
d.ellipse((640-R,560-R,640+R,560+R),fill=255)
d.polygon([(300,600),(980,600),(1040,840),(260,840)],fill=255)
prot=np.asarray(prot.filter(ImageFilter.GaussianBlur(10))).astype(np.float32)/255
light=(im.min(axis=2)>205)
reach=np.zeros((h,w),bool); q=deque()
for x in range(w):
  for y in (0,h-1):
    if light[y,x]: reach[y,x]=True; q.append((y,x))
for y in range(h):
  for x in (0,w-1):
    if light[y,x] and not reach[y,x]: reach[y,x]=True; q.append((y,x))
blocked=prot>0.85
while q:
  y,x=q.popleft()
  for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
    ny,nx=y+dy,x+dx
    if 0<=ny<h and 0<=nx<w and light[ny,nx] and not reach[ny,nx] and not blocked[ny,nx]:
      reach[ny,nx]=True; q.append((ny,nx))
m=Image.fromarray((reach*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3))
m=np.asarray(m).astype(np.float32)/255*(1-prot)
a=np.clip((255-im).max(axis=2)/255*1.6,0,1)
alpha=m*a+(1-m)
rgb=np.clip((im-255*(1-alpha[...,None]))/np.maximum(alpha,1e-3)[...,None],0,255)
rgb=np.where(m[...,None]>0.001,rgb,im)
out=np.dstack([rgb,alpha*255]).astype(np.uint8)
clear = Image.fromarray(out, 'RGBA')
dd=out.astype(np.float32)
r,g,b=dd[...,0],dd[...,1],dd[...,2]
L=(np.maximum(np.maximum(r,g),b)+np.minimum(np.minimum(r,g),b))/2/255
yy=np.arange(h)[:,None].repeat(w,1)
sel=(yy>790)&(L<0.62)&(b>=r)&(dd[...,3]>20)
t=sel&(yy>1085); k=sel&(yy<=1085)
for c,tg in ((0,110),(1,170),(2,255)):
  dd[...,c][k]=dd[...,c][k]*0.45+tg*0.55
for c,tg in ((0,236),(1,242),(2,255)):
  dd[...,c][t]=dd[...,c][t]*0.15+tg*0.85
dark = Image.fromarray(np.clip(dd, 0, 255).astype(np.uint8), 'RGBA')
for name, src in (('clear', clear), ('dark', dark)):
  for size in (96, 256):
    src.resize((size, size), Image.LANCZOS).save(OUT / f'logo-{size}-{name}.png', optimize=True)
print('Логотип на прозрачном фоне: logo-96/256-clear.png и -dark.png')
