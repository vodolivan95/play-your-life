# Логотип YOUR LIFE для тёмной темы («стиль Apple»).
# Корона, горы и дорога из присланного логотипа — в круглом окне со свечением;
# корона и звёзды — цельные, с тёплым свечением; «YOUR LIFE» и «Твоя жизнь. Твоя игра.»
# набраны шрифтом Inter Display. Запуск: python3 scripts/build-logo-dark.py
# (нужны Pillow, numpy, scipy и шрифт Inter Display в /usr/share/fonts/opentype/inter).
from PIL import Image, ImageFilter, ImageDraw, ImageFont
import numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent / 'public' / 'brand'
OUT_DIR = ROOT / 'your-life-e00d2571783f'
SRC = ROOT / 'your-life-source.jpg'
src=Image.open(SRC).convert('RGB')
S=2  # supersample
im=np.asarray(src.resize((1280*S,1280*S),Image.LANCZOS)).astype(np.float32)
H=W=1280*S
cx,cy,R=640*S,560*S,316*S
yy,xx=np.mgrid[0:H,0:W]
dist=np.sqrt((xx-cx)**2+(yy-cy)**2)
# circle window with soft rim + bottom fade
circle=np.clip((R-dist)/(3*S),0,1)
fade=np.clip((800*S-yy)/(90*S),0,1)
win=circle*fade
# crown + stars: solid silhouettes (white glints stay opaque), soft 1px edge
from scipy import ndimage as ndi
r,g,b=im[...,0],im[...,1],im[...,2]
star3=(xx>810*S)&(xx<905*S)&(yy>430*S)&(yy<525*S)
warm=((r-b)>45)&(r>140)&((yy<470*S)|star3)
sil=ndi.binary_closing(warm,structure=np.ones((5*S,5*S)))
sil=ndi.binary_fill_holes(sil)
# include bright glints touching the silhouette (crown highlights), not the white background
bright=(im.min(axis=2)>200)
near=ndi.binary_dilation(sil,iterations=3*S)
glint=bright&near&~ndi.binary_dilation(~ndi.binary_dilation(sil,iterations=6*S),iterations=1)
sil=ndi.binary_fill_holes(sil|glint)
lab,n=ndi.label(sil); sizes=ndi.sum(sil,lab,range(1,n+1))
keep=np.isin(lab,[i+1 for i,v in enumerate(sizes) if v>400*S*S])
keep=ndi.binary_erosion(keep,iterations=3*S)
ga=np.asarray(Image.fromarray((keep*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9*S))).astype(np.float32)/255
# clean white fringe on the edge: pull edge colours towards inner gold
inner=np.asarray(Image.fromarray(im.astype(np.uint8)).filter(ImageFilter.MinFilter(5))).astype(np.float32)
edge=((ga>0.02)&(ga<0.98))[...,None]
gold_rgb=np.where(edge,np.minimum(im,inner+40),im)
alpha=np.maximum(win,ga)
mix=np.clip(ga-win,0,1)[...,None]
rgb=im*(1-mix)+gold_rgb*mix
crownmask=keep
# slight contrast/saturation boost on illustration
lum=rgb.mean(axis=2,keepdims=True)
rgb=np.clip(lum+(rgb-lum)*1.12,0,255)
ill=Image.fromarray(np.dstack([rgb,alpha*255]).astype(np.uint8),'RGBA')
# crop illustration bounds
bbox=ill.getbbox(); ill=ill.crop(bbox)
# canvas
OUT=2048
canvas=Image.new('RGBA',(OUT,OUT),(0,0,0,0))
iw=int(OUT*0.62); ih=int(ill.height*iw/ill.width)
ill=ill.resize((iw,ih),Image.LANCZOS)
top=int(OUT*0.035)
# soft glow behind window
glow=Image.new('RGBA',(OUT,OUT),(0,0,0,0)); gd=ImageDraw.Draw(glow)
gcx=OUT//2; gcy=top+int(ih*0.58); gr=int(iw*0.40)
gd.ellipse((gcx-gr,gcy-gr,gcx+gr,gcy+gr),fill=(60,150,255,110))
glow=glow.filter(ImageFilter.GaussianBlur(OUT*0.04))
canvas=Image.alpha_composite(canvas,glow)
cm=Image.fromarray((crownmask*255).astype(np.uint8)).crop(bbox).resize((iw,ih),Image.LANCZOS)
wg=Image.new('RGBA',(OUT,OUT),(255,190,60,0)); tmp=Image.new('L',(OUT,OUT),0); tmp.paste(cm,((OUT-iw)//2,top))
wg.putalpha(tmp.filter(ImageFilter.GaussianBlur(OUT*0.018)).point(lambda v:int(v*0.45)))
canvas=Image.alpha_composite(canvas,wg)
canvas.alpha_composite(ill,((OUT-iw)//2,top))
# wordmark
font=ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-Black.otf',int(OUT*0.165))
text='YOUR LIFE'
tracking=-int(OUT*0.004)
# measure
widths=[font.getlength(ch) for ch in text]
total=sum(widths)+tracking*(len(text)-1)
tx=(OUT-total)/2; ty=top+ih+int(OUT*0.005)
mask=Image.new('L',(OUT,OUT),0); md=ImageDraw.Draw(mask)
x=tx
for ch,wd in zip(text,widths):
  md.text((x,ty),ch,font=font,fill=255); x+=wd+tracking
mb=mask.getbbox()
# gradient fill
grad=np.zeros((OUT,OUT,4),np.float32)
t=np.clip((np.arange(OUT)-mb[1])/(mb[3]-mb[1]),0,1)[:,None]
topc=np.array([255,255,255]); botc=np.array([208,226,255])
col=topc*(1-t[...,None])+botc*t[...,None]
grad[...,:3]=np.broadcast_to(col,(OUT,OUT,3))
grad[...,3]=np.asarray(mask)
word=Image.fromarray(grad.astype(np.uint8),'RGBA')
# shadow + subtle blue rim light
sh=Image.new('RGBA',(OUT,OUT),(2,6,20,0)); sh.putalpha(mask.filter(ImageFilter.GaussianBlur(OUT*0.012)).point(lambda v:int(v*0.65)))
sh=sh.transform(sh.size,Image.AFFINE,(1,0,0,0,1,-int(OUT*0.008)))
rim=Image.new('RGBA',(OUT,OUT),(70,150,255,0)); rim.putalpha(mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(OUT*0.006)).point(lambda v:int(v*0.55)))
canvas=Image.alpha_composite(canvas,sh); canvas=Image.alpha_composite(canvas,rim); canvas=Image.alpha_composite(canvas,word)
# tagline
f2=ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf',int(OUT*0.052))
tag='Твоя жизнь. Твоя игра.'
tw=f2.getlength(tag); y2=mb[3]+int(OUT*0.045)
d=ImageDraw.Draw(canvas); d.text(((OUT-tw)/2,y2),tag,font=f2,fill=(196,212,240,255))
# small gold divider star between? keep minimal: thin line
bbox=canvas.getbbox()
# fit content to square with padding
content=canvas.crop(bbox); pad=int(OUT*0.03)
side=max(content.width,content.height)+2*pad
final=Image.new('RGBA',(side,side),(0,0,0,0)); final.alpha_composite(content,((side-content.width)//2,(side-content.height)//2))
for size in (96, 256):
  final.resize((size, size), Image.LANCZOS).save(OUT_DIR / f'logo-{size}-dark.png', optimize=True)
print('Логотип для тёмной темы: logo-96-dark.png, logo-256-dark.png')
