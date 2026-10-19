# Рисует векторные горы главного баннера: python3 scripts/make-home-peak.py → src/assets/home-peak.svg
import os
import random, math, json
W,H=2000,888
XR=2300
R=random.Random(7)

def rough(pts,amp=0.10,depth=4):
    for d in range(depth):
        out=[]
        for a,b in zip(pts,pts[1:]):
            out.append(a)
            mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2
            dx,dy=b[0]-a[0],b[1]-a[1]
            L=math.hypot(dx,dy)
            nx,ny=-dy/L,dx/L
            o=R.uniform(-1,1)*L*amp
            out.append((mx+nx*o,my+ny*o))
        out.append(pts[-1]); pts=out; amp*=0.62
    return pts
def P(pts): return ' '.join(f'{x:.1f},{y:.1f}' for x,y in pts)
def catmull(pts):
    d=f'M{pts[0][0]} {pts[0][1]}'
    for i in range(len(pts)-1):
        p0=pts[max(i-1,0)];p1=pts[i];p2=pts[i+1];p3=pts[min(i+2,len(pts)-1)]
        c1=(p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6)
        c2=(p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6)
        d+=f' C{c1[0]:.1f} {c1[1]:.1f},{c2[0]:.1f} {c2[1]:.1f},{p2[0]} {p2[1]}'
    return d

o=[]
def add(s): o.append(s)
add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="170 0 {W} {H}" width="{W}" height="{H}">')
add('''<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa9f5"/><stop offset=".45" stop-color="#bcd6fb"/><stop offset=".8" stop-color="#f6e4dc"/><stop offset="1" stop-color="#fbe3c6"/></linearGradient>
<radialGradient id="sun" cx="1405" cy="190" r="620" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff7d8" stop-opacity="1"/><stop offset=".18" stop-color="#ffe9b0" stop-opacity=".85"/><stop offset=".5" stop-color="#ffeec2" stop-opacity=".3"/><stop offset="1" stop-color="#ffeec2" stop-opacity="0"/></radialGradient>
<linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d0" stop-opacity=".75"/><stop offset="1" stop-color="#fff6d0" stop-opacity="0"/></linearGradient>
<linearGradient id="far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c4ee"/><stop offset="1" stop-color="#e5e4f6"/></linearGradient>
<linearGradient id="mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ea6df"/><stop offset="1" stop-color="#cfd6f0"/></linearGradient>
<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b7fcc"/><stop offset=".55" stop-color="#6f8fd6"/><stop offset="1" stop-color="#9db6e8"/></linearGradient>
<linearGradient id="lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0fb"/><stop offset=".6" stop-color="#a6bfec"/><stop offset="1" stop-color="#9cb4e6"/></linearGradient>
<linearGradient id="snowS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3eeff"/><stop offset="1" stop-color="#b8cff3"/></linearGradient>
<linearGradient id="snowL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#fff0dc"/><stop offset="1" stop-color="#ffe0bd"/></linearGradient>
<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bddcf6"/><stop offset=".5" stop-color="#7db5e8"/><stop offset="1" stop-color="#3f7fc4"/></linearGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#f4f1ff" stop-opacity=".7"/><stop offset="1" stop-color="#e9f1ff" stop-opacity=".95"/></linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f6f63"/><stop offset="1" stop-color="#1d3d4a"/></linearGradient>
<linearGradient id="rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b4f86"/><stop offset="1" stop-color="#1c2a52"/></linearGradient>
<linearGradient id="flag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5f7e"/><stop offset="1" stop-color="#ee2f4e"/></linearGradient>
<linearGradient id="star" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset="1" stop-color="#f2b020"/></linearGradient>
<filter id="blur30" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
<filter id="blur12" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>
<filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>''')
add(f'<rect width="{XR}" height="{H}" fill="url(#sky)"/><rect width="{XR}" height="{H}" fill="url(#sun)"/>')
# rays
add('<g filter="url(#blur12)">')
for ang,w,l in [(-62,70,900),(-40,40,800),(-20,60,760),(8,50,700),(30,70,800),(52,40,760),(75,60,860),(-82,50,700)]:
    a=math.radians(ang-90); x0,y0=1405,185
    ax,ay=x0+l*math.cos(a-w/4000),y0+l*math.sin(a-w/4000); bx,by=x0+l*math.cos(a+w/4000),y0+l*math.sin(a+w/4000)
    add(f'<polygon points="{x0},{y0} {ax:.0f},{ay:.0f} {bx:.0f},{by:.0f}" fill="#fff4cc" opacity=".13"/>')
add('</g>')
# clouds
def cloud(cx,cy,sx,sy,op=.8):
    add(f'<g filter="url(#blur12)" opacity="{op}"><ellipse cx="{cx}" cy="{cy}" rx="{sx}" ry="{sy}" fill="#fff"/><ellipse cx="{cx-sx*.45}" cy="{cy+sy*.2}" rx="{sx*.55}" ry="{sy*.8}" fill="#fff"/><ellipse cx="{cx+sx*.5}" cy="{cy+sy*.25}" rx="{sx*.6}" ry="{sy*.7}" fill="#fff4ea"/></g>')
cloud(1900,300,150,36,.85); cloud(1060,235,140,24,.7); cloud(1700,120,120,18,.55); cloud(640,300,160,24,.55)
# far range
far=rough([(300,740),(420,600),(480,520),(560,470),(640,455),(700,420),(790,385),(850,420),(930,455),(1010,480),(1080,520)],.07,4)
add(f'<polygon points="{P(far)} 1080,740" fill="url(#far)" opacity=".85"/>')
farR=rough([(1500,470),(1620,420),(1720,380),(1800,330),(1850,305),(1920,350),(2000,380),(2200,420),(2200,740),(1500,740)],.07,4)
add(f'<polygon points="{P(farR)}" fill="url(#far)" opacity=".8"/>')
# mid ranges
midL=rough([(380,740),(470,690),(560,640),(680,560),(800,520),(900,480),(980,520),(1060,560),(1100,640)],.07,4)
add(f'<polygon points="{P(midL)} 1100,740" fill="url(#mid)" opacity=".75"/>')
midR=rough([(1500,560),(1620,500),(1720,470),(1820,430),(1900,470),(2000,500),(2200,520),(2200,740),(1500,740)],.08,4)
add(f'<polygon points="{P(midR)}" fill="url(#mid)" opacity=".85"/>')

def mountain(name,left,right,apex,split,base,snowline_y,snow_extent):
    ridge=rough(left+right[1:],.045,5)
    poly=ridge+[(right[-1][0],base),(left[0][0],base)]
    add(f'<clipPath id="c{name}"><polygon points="{P(poly)}"/></clipPath>')
    add(f'<g clip-path="url(#c{name})">')
    # split polygon: shade face to the left of split line, lit to right
    sp=rough(split,.05,4)
    shade=[(left[0][0]-50,-50)]+[(apex[0]-6,-50)]+sp+[(sp[-1][0],base+10),(left[0][0]-50,base+10)]
    lit=[(apex[0]-6,-50),(right[-1][0]+80,-50),(right[-1][0]+80,base+10),(sp[-1][0],base+10)]+sp[::-1]
    add(f'<polygon points="{P(shade)}" fill="url(#shade)"/><polygon points="{P(lit)}" fill="url(#lit)"/>')
    # ribs: широкие мягкие складки по линии падения
    add('<g filter="url(#blur3)">')
    for i in range(26):
        ytop=apex[1]+R.uniform(30,300)
        slope=R.uniform(-1.3,1.3)
        topx=apex[0]+(ytop-apex[1])*slope*0.55
        x=topx+slope*(base-ytop)*0.55+R.uniform(-40,40)
        w=R.uniform(16,52)
        if x<apex[0]+(sp[-1][0]-apex[0])*.65: col=('#1b3585',R.uniform(.07,.2))
        else: col=('#ffffff',R.uniform(.1,.24)) if R.random()<.7 else ('#e0875f',R.uniform(.06,.14))
        add(f'<polygon points="{topx:.0f},{ytop:.0f} {x-w:.0f},{base} {x+w:.0f},{base}" fill="{col[0]}" opacity="{col[1]:.2f}"/>')
    add('</g>')
    # snow cap
    vx0=left[0][0]-60; vx1=right[-1][0]+60
    line=[(vx0,snowline_y+(apex[0]-vx0)*snow_extent),(apex[0]-120,snowline_y+120*snow_extent+30),(apex[0]-40,snowline_y+60),(apex[0],snowline_y-20),(apex[0]+40,snowline_y+70),(apex[0]+160,snowline_y+160*snow_extent+20),(vx1,snowline_y+(vx1-apex[0])*snow_extent)]
    top=rough(line,.07,4)
    cap=[(vx0,-60),(vx1,-60)]+top[::-1]
    capL=cap
    add(f'<polygon points="{P(capL)}" fill="url(#snowS)" clip-path="url(#cl{name})"/>' if False else '')
    # snow split by lit/shade
    snowShade=[(left[0][0]-60,-60),(apex[0]-6,-60)]+sp+[(sp[-1][0],base+10),(left[0][0]-60,base+10)]
    snowLit=[(apex[0]-6,-60),(right[-1][0]+60,-60),(right[-1][0]+60,base+10),(sp[-1][0],base+10)]+sp[::-1]
    add(f'<clipPath id="s{name}"><polygon points="{P(cap)}"/></clipPath>')
    add(f'<g clip-path="url(#s{name})"><polygon points="{P(snowShade)}" fill="url(#snowS)"/><polygon points="{P(snowLit)}" fill="url(#snowL)"/>')
    for i in range(30):
        x=R.uniform(left[0][0],right[-1][0]); w=R.uniform(6,22)
        c=('#6f8fd6',.22) if x<apex[0] else ('#e9a77a',.25)
        add(f'<polygon points="{apex[0]+R.uniform(-30,30):.0f},{apex[1]+30:.0f} {x-w:.0f},{snowline_y+300} {x+w:.0f},{snowline_y+300}" fill="{c[0]}" opacity="{c[1]}"/>')
    add('</g>')
    # warm rim light along the right ridge
    rim=rough(right,.045,5)
    add(f'<polyline points="{P(rim)}" fill="none" stroke="#fff4d8" stroke-width="3" opacity=".45" stroke-linejoin="round"/>')
    add('</g>')
    return poly

APEX=(1405,165)
mainL=[(760,740),(900,655),(1000,595),(1130,490),(1200,430),(1240,352),(1290,306),(1335,252),APEX]
mainR=[APEX,(1450,215),(1500,262),(1560,296),(1630,340),(1700,392),(1780,432),(1880,470),(2000,520),(2100,545),(2200,560)]
mainSplit=[(1405,160),(1385,250),(1352,330),(1305,410),(1262,490),(1225,590),(1190,740)]
mp=mountain('M',mainL,mainR,APEX,mainSplit,740,330,0.34)
SA=(1085,365)
sL=[(600,740),(720,640),(860,540),(980,445),SA]
sR=[SA,(1150,405),(1195,470),(1250,540),(1300,620),(1380,740)]
sSplit=[(1085,362),(1100,440),(1130,520),(1160,600),(1190,740)]
sp_=mountain('S',sL,sR,SA,sSplit,740,420,0.45)
# mist
add('<rect x="0" y="560" width="2300" height="190" fill="url(#mist)"/>')
add('<g filter="url(#blur30)" opacity=".8"><ellipse cx="900" cy="700" rx="420" ry="40" fill="#fff"/><ellipse cx="1600" cy="690" rx="380" ry="36" fill="#fff"/></g>')
# lake
add(f'<rect y="738" width="{XR}" height="{H-728}" fill="url(#lake)"/>')
# reflection
add('<g opacity=".34" transform="translate(0,1476) scale(1,-1)" clip-path="url(#rf)"><use href="#refl"/></g>')
for i in range(36):
    y=R.uniform(740,880); x=R.uniform(560,1750); w=R.uniform(30,150)*(0.5+(y-740)/160)
    add(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{w:.0f}" ry="{R.uniform(1.4,3.4):.1f}" fill="#fff" opacity="{R.uniform(.1,.35):.2f}"/>')
# glow on lake under peak
add('<ellipse cx="1130" cy="800" rx="150" ry="22" fill="#fff6c8" opacity=".5" filter="url(#blur12)"/>')
# hill + trees right
hill=rough([(1560,888),(1640,800),(1720,730),(1830,690),(2000,640),(2200,610)],.05,4)
add(f'<polygon points="{P(hill)} 2200,888" fill="url(#hill)"/>')
def pine(x,y,h,col,tip):
    w=h*.36
    s=''
    for k in range(4):
        yy=y-h*(k*.25); ww=w*(1-k*.2)
        s+=f'<polygon points="{x:.0f},{yy-h*.42:.0f} {x-ww:.0f},{yy:.0f} {x+ww:.0f},{yy:.0f}" fill="{col}"/>'
    s+=f'<polygon points="{x:.0f},{y-h*1.02:.0f} {x-w*.22:.0f},{y-h*.7:.0f} {x+w*.22:.0f},{y-h*.7:.0f}" fill="{tip}"/>'
    return s
trees=[]
for i in range(70):
    x=R.uniform(1620,2190); hy=0
    ytop=690+ (1830-x)*0.0
    # hill height at x
    base=700+ max(0,(1830-x))*0.18 + (0 if x>1830 else 0)
    y=R.uniform(base+10,880); h=R.uniform(60,190)*(0.6+(y-690)/260)
    trees.append((y,x,h))
trees.sort()
for y,x,h in trees:
    gold=R.random()<.28
    col=R.choice(['#27504f','#2f6256','#1e4146','#355f4c']) if not gold else R.choice(['#b88a2a','#d9a638','#a77a22'])
    add(pine(x,y,h,col,'#e6c25a' if gold else '#4d8a6e'))
# rocks foreground
rk=rough([(1480,888),(1560,850),(1640,860),(1720,820),(1790,845),(1860,800),(1940,830),(2000,810),(2100,800),(2200,790),(2200,888)],.06,4)
add(f'<polygon points="{P(rk)}" fill="url(#rock)"/>')
add(f'<polyline points="{P(rk[:-2])}" fill="none" stroke="#e6b94a" stroke-width="3" opacity=".7"/>')
rk2=rough([(520,888),(600,860),(690,870),(760,888)],.08,3)
add(f'<polygon points="{P(rk2)}" fill="url(#rock)" opacity=".85"/>')
# trail
trail=[(830,792),(1000,762),(1085,700),(1125,590),(1185,505),(1215,468),(1265,440),(1310,380),(1350,320),(1385,245),(1402,178)]
d=catmull(trail)
add(f'<path d="{d}" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-dasharray="0 34" opacity=".95"/>')
add(f'<path d="{d}" fill="none" stroke="#fff6c8" stroke-width="30" stroke-linecap="round" stroke-dasharray="0 34" opacity=".35" filter="url(#blur3)"/>')
def starpoly(cx,cy,r):
    pts=[]
    for k in range(10):
        rr=r if k%2==0 else r*.45; a=math.radians(-90+k*36)
        pts.append((cx+rr*math.cos(a),cy+rr*math.sin(a)))
    return P(pts)
stars=[(1085,700),(1125,590),(1265,440),(1350,320)]
for sx,sy in stars:
    add(f'<circle cx="{sx}" cy="{sy}" r="60" fill="#ffe27a" opacity=".5" filter="url(#glow)"/>')
    add(f'<polygon points="{starpoly(sx,sy,44)}" fill="url(#star)" stroke="#fff3b8" stroke-width="3" stroke-linejoin="round"/>')
# climber
cx,cy=1205,470
add(f'<g fill="#16224a"><circle cx="{cx}" cy="{cy-44}" r="9"/><path d="M{cx-11} {cy-32} q11 -6 22 0 l5 32 l-8 0 l-3 24 l-6 0 l-1 -22 l-5 22 l-6 0 l-2 -26 l-6 -2 z"/><rect x="{cx-18}" y="{cy-30}" width="9" height="22" rx="4"/></g>')
# flag
add(f'<rect x="1402" y="62" width="6" height="112" rx="3" fill="#1c2a52"/><path d="M1408 66 C1440 56 1470 80 1500 66 L1535 84 L1500 98 C1470 112 1440 90 1408 104 Z" fill="url(#flag)"/>')
# birds
def bird(x,y,s,op=.7):
    add(f'<path d="M{x-14*s} {y} q{7*s} {-10*s} {14*s} 0 q{7*s} {-10*s} {14*s} 0" fill="none" stroke="#5a6d9b" stroke-width="{2.6*s}" stroke-linecap="round" opacity="{op}"/>')
bird(870,135,1.6); bird(745,198,1.2,.5); bird(1925,178,1.5)
add('</svg>')
s='\n'.join(o)
# reflection source group: replace placeholder with real defs (main+S silhouettes simplified)
refl='<defs><g id="refl"><polygon points="'+P(mp)+'" fill="#7c97d6"/></g><clipPath id="rf"><rect x="0" y="738" width="2300" height="160"/></clipPath></defs>'
s=s.replace('<rect width="2000" height="888" fill="url(#sky)"/>',refl+'<rect width="2000" height="888" fill="url(#sky)"/>',1)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src','assets','home-peak.svg'),'w').write(s)
print(len(s)//1024,'KB'); print(d)
