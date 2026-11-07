import numpy as np, re, os, subprocess, sys
from scipy import signal
from scipy.io import wavfile
SR=22050; rng=np.random.default_rng(11)
OUT=sys.argv[1]; os.makedirs(OUT,exist_ok=True)

def T(d): return np.arange(int(SR*d))/SR
def noise(d): return rng.standard_normal(int(SR*d))
def ad(d,a,tau):
    x=T(d); return np.minimum(1,x/max(a,1e-4))*np.exp(-np.maximum(0,x-a)/tau)
def _b(x,f,kind,o=2):
    f=np.atleast_1d(f)/(SR/2); f=np.clip(f,1e-4,0.99)
    b,a=signal.butter(o,f if len(f)>1 else f[0],kind); return signal.lfilter(b,a,x)
def lp(x,f,o=2): return _b(x,f,'low',o)
def hp(x,f,o=2): return _b(x,f,'high',o)
def bp(x,lo,hi,o=2): return _b(x,[lo,hi],'band',o)
def osc(f,d,shape='sin'):
    f=np.full(int(SR*d),f,float) if np.isscalar(f) else np.asarray(f,float)
    ph=np.cumsum(f)/SR
    if shape=='sin': return np.sin(2*np.pi*ph)
    if shape=='saw': return 2*(ph%1)-1
    if shape=='sq': return np.sign(np.sin(2*np.pi*ph))
    if shape=='tri': return 2*np.abs(2*(ph%1)-1)-1
def sweep(f0,f1,d,exp=True):
    x=np.linspace(0,1,int(SR*d)); return f0*(f1/f0)**x if exp else f0+(f1-f0)*x
def buf(d): return np.zeros(int(SR*d))
def put(b,x,at=0.0,g=1.0):
    i=int(at*SR); n=min(len(x),len(b)-i)
    if n>0: b[i:i+n]+=x[:n]*g
    return b
def rev(x,rt=0.25,wet=0.25):
    n=int(SR*rt); ir=rng.standard_normal(n)*np.exp(-np.arange(n)/(SR*rt/4)); ir[0]=0
    w=signal.fftconvolve(x,ir)[:len(x)+n]; w/=np.max(np.abs(w))+1e-9
    out=np.zeros(len(w)); out[:len(x)]+=x/(np.max(np.abs(x))+1e-9); out+=w*wet; return out
def norm(x,p=0.85): return x/(np.max(np.abs(x))+1e-9)*p
def loopify(x,f=0.5):
    n=int(SR*f); out=x[:-n].copy(); w=np.linspace(0,1,n); out[:n]=x[:n]*w+x[-n:]*(1-w); return out
def formant(src,fs): return sum(bp(src,f*0.85,f*1.15)*g for f,g in fs)
def vowel_voice(f0,d,fs,vib=5,vd=0.02):
    f=f0*(1+vd*np.sin(2*np.pi*vib*T(d))); return formant(osc(f,d,'saw'),fs)

S={}
def snd(n):
    def deco(fn): S[n]=fn; return fn
    return deco

# ---------- weapons ----------
@snd('gunshot_pistol')
def _():
    d=.7; n=noise(d)
    x=hp(n,900)*ad(d,.001,.03)+osc(sweep(180,45,d),d)*ad(d,.001,.09)*1.1+lp(n,2500)*ad(d,.002,.18)*.4
    return rev(x,.35,.3)
@snd('gunshot_sniper')
def _():
    d=1.8; n=noise(d)
    x=hp(n,600)*ad(d,.001,.05)+osc(sweep(120,30,d),d)*ad(d,.001,.25)*1.4+lp(n,1500)*ad(d,.003,.5)*.6
    return rev(x,.9,.45)
@snd('knife_slash')
def _():
    d=.35; n=noise(d); f=sweep(1200,5000,d,False)
    x=sum(bp(n,f[i]*.8,f[i]*1.2) for i in [0]) if False else bp(n,1500,6000)*np.sin(np.pi*np.linspace(0,1,len(n)))**2
    return x
@snd('flesh_hit')
def _():
    d=.3; n=noise(d); return lp(n,900)*ad(d,.002,.05)+osc(sweep(120,60,d),d)*ad(d,.001,.07)
@snd('reload_click')
def _():
    b=buf(.45)
    for at,f in [(0.02,3200),(0.2,2400)]:
        c=bp(noise(.06),f*.7,f*1.3)*ad(.06,.0005,.008)+osc(f,.06)*ad(.06,.0005,.01)*.5; put(b,c,at)
    return b
@snd('punch_impact')
def _():
    d=.35; return osc(sweep(110,45,d),d)*ad(d,.001,.08)*1.2+lp(noise(d),1200)*ad(d,.001,.04)*.7
@snd('body_fall')
def _():
    d=.7; n=noise(d); return osc(sweep(90,35,d),d)*ad(d,.002,.15)+lp(n,700)*ad(d,.005,.12)*.8+hp(n,3000)*ad(d,.08,.1)*.1

# ---------- damage / player feedback ----------
@snd('hurt_grunt')
def _():
    d=.35; v=vowel_voice(130,d,[(650,1),(1100,.6),(2500,.2)],vib=7,vd=.04)
    f=sweep(1,.7,d,False); return v*ad(d,.01,.12)+noise(d)*.05*ad(d,.01,.1)
@snd('death_rattle')
def _():
    d=1.2; n=noise(d); am=.6+.4*np.sin(2*np.pi*9*T(d))
    return (bp(n,300,1200)*am*ad(d,.1,.5)+vowel_voice(95,d,[(500,1),(900,.5)],vib=4,vd=.08)*ad(d,.05,.6)*.7)
def ping(freqs,d,tau,at=None):
    b=buf(d)
    for i,f in enumerate(freqs):
        s=(osc(f,.5)+osc(2*f,.5)*.3)*ad(.5,.002,tau); put(b,s,(at[i] if at else i*.07))
    return b
@snd('pickup_coin')
def _(): return ping([988,1319],.6,.12,[0,.07])
@snd('pickup_item')
def _(): return ping([523,784],.4,.08,[0,.05])
@snd('inventory_full')
def _():
    b=buf(.4)
    for a in [0,.15]: put(b,osc(150,.12,'sq')*ad(.12,.002,.06),a,.5)
    return lp(b,1500)
@snd('money_deposit')
def _():
    b=buf(.9)
    for i in range(6): put(b,ping([1568+rng.integers(0,500)],.2,.05,[0])[:int(.2*SR)],i*.07,.5)
    return b
@snd('money_withdraw')
def _():
    b=buf(.8)
    for i in range(4): put(b,ping([1200+i*100],.2,.05,[0])[:int(.2*SR)],i*.09,.6)
    return b+hp(noise(.8),4000)*ad(.8,.02,.1)*.05
@snd('purchase_ok')
def _(): return ping([523,659,784,1047],.9,.2,[0,.08,.16,.24])
@snd('purchase_fail')
def _():
    d=.5; return osc(sweep(300,120,d),d,'sq')*ad(d,.005,.2)*.5+osc(sweep(150,60,d),d,'saw')*ad(d,.005,.2)*.4

# ---------- vehicles ----------
def engine(d,f0,wob=0.0):
    f=f0*(1+wob*np.sin(2*np.pi*11*T(d)))
    x=osc(f,d,'saw')+.6*osc(2*f,d,'saw')+.3*osc(3.01*f,d,'sq'); return lp(x,900)+lp(noise(d),500)*.4
@snd('car_engine_start')
def _():
    b=buf(2.6)
    for i in range(5): put(b,lp(osc(55+i*2,.2,'saw')*ad(.2,.01,.12)+noise(.2)*.2,600),i*.2,.8)
    d=1.5; e=engine(d,sweep(35,48,d,False)); put(b,e*np.minimum(1,T(d)/.2)*.9,1.0)
    return b
@snd('car_engine_stop')
def _():
    d=1.1; f=sweep(48,15,d); return engine(d,f)*np.exp(-T(d)/.5)
@snd('car_horn')
def _():
    d=.7; x=osc(420,d,'sq')+osc(520,d,'sq'); return lp(x,3000)*np.minimum(1,T(d)/.01)*np.minimum(1,(d-T(d))/.04)
@snd('car_crash_light')
def _():
    d=1.0; n=noise(d); x=hp(n,500)*ad(d,.001,.09)+osc(sweep(150,60,d),d)*ad(d,.001,.12)
    for f in [1800,2700,3900]: x+=osc(f,d)*ad(d,.001,.18)*.12
    return rev(x,.4,.2)
@snd('car_crash_heavy')
def _():
    d=1.8; n=noise(d); x=bp(n,200,5000)*ad(d,.002,.25)+osc(sweep(100,30,d),d)*ad(d,.001,.3)*1.3
    for f in [900,1700,2600,3300]: x+=osc(f,d)*ad(d,.001,.35)*.15
    return rev(x,.8,.35)
@snd('car_door_open')
def _():
    d=.4; return lp(noise(d),600)*ad(d,.002,.04)+osc(sweep(300,150,d),d)*ad(d,.002,.05)*.6+bp(noise(d),2500,4000)*ad(d,.003,.02)*.2
@snd('car_door_close')
def _():
    d=.45; return lp(noise(d),500)*ad(d,.001,.07)*1.1+osc(sweep(130,60,d),d)*ad(d,.001,.09)+bp(noise(d),1800,3500)*ad(d,.001,.015)*.3
@snd('car_skid')
def _():
    d=1.2; n=noise(d); m=bp(n,1500,3500)*(.7+.3*np.sin(2*np.pi*37*T(d))); return m*np.minimum(1,T(d)/.1)*np.minimum(1,(d-T(d))/.3)
@snd('police_siren')
def _():
    d=3.0; f=700+450*(1-np.cos(2*np.pi*T(d)/1.5))/1.0*1.0
    x=osc(f,d,'tri')+.4*osc(2*f,d,'sin'); return loopify(lp(x,5000),.25)
@snd('bike_engine')
def _():
    d=1.6; f=95*(1+.05*np.sin(2*np.pi*6*T(d))); x=osc(f,d,'saw')+osc(f*2,d,'sq')*.4
    return loopify(lp(x,1800)+hp(noise(d),3000)*.03,.2)

# ---------- footsteps ----------
def step_concrete(k):
    d=.25; n=noise(d); f=1800+k*350
    return bp(n,f*.6,f*1.8)*ad(d,.0005,.012)+osc(75+k*8,d)*ad(d,.001,.035)*.9+lp(n,700)*ad(d,.001,.02)*.4
def step_grass(k):
    d=.3; n=noise(d); return bp(n,2000+k*500,7000)*ad(d,.02,.05)*.8+lp(n,500)*ad(d,.01,.04)*.3
def step_wood(k):
    d=.3; n=noise(d); f=170+k*40
    return (osc(f,d)+.5*osc(f*1.9,d))*ad(d,.001,.04)+lp(n,1200)*ad(d,.001,.015)*.6
for i in (1,2,3): S[f'step_concrete_{i}']=(lambda i=i: step_concrete(i))
for i in (1,2): S[f'step_grass_{i}']=(lambda i=i: step_grass(i)); S[f'step_wood_{i}']=(lambda i=i: step_wood(i))

# ---------- doors & environment ----------
def thud(d=.4,f=100): return osc(sweep(f,f*.45,d),d)*ad(d,.001,.08)+lp(noise(d),700)*ad(d,.001,.05)*.6
def creak(d,f0=420,f1=240):
    f=sweep(f0,f1,d,False)*(1+.04*np.sin(2*np.pi*28*T(d)))
    return bp(osc(f,d,'saw'),300,1800)*np.sin(np.pi*np.linspace(0,1,int(SR*d)))**.7*.5
@snd('door_open_wood')
def _():
    b=buf(1.0); put(b,creak(.9)); put(b,thud(.3,160),0.0,.5); return b
@snd('door_close_wood')
def _(): return thud(.5,95)*1.2+bp(noise(.5),1500,3500)*ad(.5,.001,.012)*.3
@snd('door_open_glass')
def _():
    d=1.0; return bp(noise(d),1000,5000)*np.sin(np.pi*np.linspace(0,1,int(SR*d)))*.35+ping([1760],d,.3,[0.05])*.3
@snd('door_knock')
def _():
    b=buf(.9)
    for a in [0,.22,.44]: put(b,thud(.18,230)*1.0,a)
    return b
@snd('drawer_open')
def _():
    d=.5; b=bp(noise(d),300,1500)*np.sin(np.pi*np.linspace(0,1,int(SR*d)))*.6; put(b,thud(.15,200),.3,.3); return b
@snd('drawer_close')
def _(): d=.4; b=bp(noise(.25),300,1500)*np.sin(np.pi*np.linspace(0,1,int(SR*.25)))*.5; o=buf(d); put(o,b); put(o,thud(.15,180),.22); return o
@snd('fridge_open')
def _():
    d=.7; b=lp(noise(d),400)*ad(d,.005,.1)*.6+osc(60,d)*ad(d,.1,.3)*.2; put(b,thud(.2,110),0,.4); return b
@snd('fridge_close')
def _(): return thud(.5,85)*1.1+lp(noise(.5),300)*ad(.5,.002,.08)*.5
@snd('water_running')
def _():
    d=4; n=noise(d); x=bp(n,800,6000)*(.8+.2*lp(noise(d),30)*10); return loopify(x,.4)
@snd('toilet_flush')
def _():
    d=4.0; n=noise(d); env=np.minimum(1,T(d)/.5)*np.exp(-np.maximum(0,T(d)-1.5)/1.0)
    return (bp(n,300,3000)*env)+osc(sweep(120,60,d),d)*ad(d,.3,1.5)*.15
@snd('shower_on')
def _():
    d=4; n=noise(d); x=hp(n,2500)*.8+bp(n,800,2500)*.3; return loopify(x,.4)
@snd('stove_click')
def _():
    b=buf(.8)
    for a in [0,.12,.24]: put(b,bp(noise(.03),2500,6000)*ad(.03,.0003,.004)+osc(2800,.03)*ad(.03,.0003,.004)*.4,a)
    put(b,lp(noise(.4),600)*ad(.4,.01,.12)*.7,.36); return b
@snd('sizzle_loop')
def _():
    d=3; n=noise(d); crack=(rng.random(len(n))>.9985)*rng.standard_normal(len(n))*4
    return loopify(hp(n,3500)*.5+hp(crack,1500)*.7,.3)
@snd('tv_static')
def _(): d=3; return loopify(hp(noise(d),500)*.5+osc(15734,d)*.03,.3)
@snd('bed_creak')
def _():
    b=buf(1.0)
    for a,f in [(0,380),(.35,330),(.62,360)]:
        c=creak(.3,f,f*.7); put(b,c,a)
    return b
@snd('doorbell')
def _():
    b=buf(2.0)
    for a,f in [(0,784),(.55,622)]:
        s=(osc(f,1.4)+.4*osc(f*2.01,1.4)+.2*osc(f*3.02,1.4))*ad(1.4,.003,.45); put(b,s,a)
    return b

# ---------- UI ----------
@snd('ui_tap')
def _(): d=.08; return osc(1400,d)*ad(d,.001,.015)
@snd('ui_open')
def _(): d=.25; return osc(sweep(500,1000,d),d)*ad(d,.005,.07)*.8
@snd('ui_close')
def _(): d=.25; return osc(sweep(1000,500,d),d)*ad(d,.005,.07)*.8
@snd('ui_error')
def _(): b=buf(.3); [put(b,osc(220,.1,'sq')*ad(.1,.002,.05)*.5,a) for a in (0,.13)]; return lp(b,2000)
@snd('phone_open')
def _():   # 0.45 s, shaped like the 0.42 s slide-up: swish rises, tick when it settles
    d=.45; x=T(d); b=sum([0*x]); n=noise(d)
    b=bp(n,900,3800)*np.exp(-((x-.11)/.09)**2)*.55 + osc(sweep(420,880,d),d)*np.exp(-((x-.12)/.10)**2)*.25
    put(b,bp(noise(.04),2200,6500)*ad(.04,.0003,.008)+osc(1500,.04)*ad(.04,.0003,.01)*.4,.25,.45)
    return b
@snd('phone_close')
def _():   # tick as it lets go, then a descending swish over the 0.42 s slide-down
    d=.45; x=T(d); n=noise(d)
    b=bp(n,900,3800)*np.exp(-((x-.17)/.10)**2)*.5 + osc(sweep(880,420,d),d)*np.exp(-((x-.16)/.10)**2)*.22
    put(b,bp(noise(.04),2200,6500)*ad(.04,.0003,.008)+osc(1300,.04)*ad(.04,.0003,.01)*.4,0.0,.4)
    return b
@snd('notification_ping')
def _(): return ping([1175,1568],.8,.2,[0,.09])

# ---------- crime ----------
@snd('handcuff_click')
def _():
    b=buf(.6)
    for i,a in enumerate([0,.07,.14,.21]): put(b,(bp(noise(.04),2500,7000)*ad(.04,.0003,.006)+osc(3300,.04)*ad(.04,.0003,.008)*.4),a,.8-i*.1)
    put(b,thud(.15,300)*.4,.3); return b
@snd('jail_door_slam')
def _():
    d=2.0; x=osc(sweep(90,40,d),d)*ad(d,.001,.2)+bp(noise(d),200,4000)*ad(d,.001,.12)
    for f in [310,640,1130,1790,2430]: x+=osc(f,d)*ad(d,.001,.5)*.15
    return rev(x,.7,.3)
@snd('police_whistle')
def _():
    d=1.0; f=2900+60*np.sin(2*np.pi*34*T(d)); x=osc(f,d)+bp(noise(d),2500,3500)*.2
    return x*np.minimum(1,T(d)/.03)*np.minimum(1,(d-T(d))/.1)*(.7+.3*np.sin(2*np.pi*34*T(d)))
@snd('ransom_paid')
def _():
    b=buf(1.5); put(b,bp(noise(.08),2000,6000)*ad(.08,.001,.02),0,.8)
    put(b,ping([2093],1.2,.5,[0])*.8,.1); put(b,ping([2637],1.2,.5,[0])*.6,.1); return b

# ---------- ambience ----------
@snd('ambient_city')
def _():
    d=10; n=noise(d); x=lp(n,300,3)*.8+bp(n,500,1500)*.15*(.6+.4*lp(noise(d),.5)*8)+lp(noise(d),120)*1.2
    return loopify(x,.8)
@snd('ambient_rain')
def _():
    d=8; n=noise(d); drops=(rng.random(len(n))>.9992)*rng.standard_normal(len(n))*5
    return loopify(hp(n,1200)*.4+lp(n,8000)*0+bp(drops,2000,8000)*.8,.6)
@snd('ambient_indoor')
def _():
    d=8; return loopify(osc(60,d)*.3+osc(120,d)*.15+osc(180,d)*.05+lp(noise(d),250)*.4,.6)
def chirp(pattern):
    b=buf(1.2)
    for at,f0,f1,dd in pattern:
        s=osc(sweep(f0,f1,dd),dd)*np.sin(np.pi*np.linspace(0,1,int(SR*dd)))*(1+.3*osc(60,dd)); put(b,s,at,.7)
    return b
@snd('bird_chirp_1')
def _(): return chirp([(0,3000,4600,.09),(.14,3200,4800,.09),(.28,3500,5000,.1),(.5,2800,4200,.15)])
@snd('bird_chirp_2')
def _(): return chirp([(0,4500,3000,.12),(.2,4800,3200,.12),(.45,3400,5200,.07),(.55,3400,5200,.07),(.65,3400,5200,.07)])
@snd('crowd_murmur')
def _():
    d=10; b=buf(d)
    for i in range(7):
        f0=rng.uniform(95,230); v=vowel_voice(f0,d,[(rng.uniform(450,800),1),(rng.uniform(1000,1800),.5),(2500,.2)],vib=rng.uniform(3,6),vd=.05)
        syl=np.clip(.5+.8*lp(noise(d),rng.uniform(2.5,5))*10,0,1); b+=v*syl*.3
    return loopify(b+bp(noise(d),300,3000)*.15,.8)
@snd('traffic_rumble')
def _():
    d=10; n=noise(d); x=lp(n,140,3)*1.5+lp(n,500)*.3*(.6+.4*lp(noise(d),.4)*6); return loopify(x,.8)

# ---------- build from registry ----------
src=open('/home/claude/p/js/core/sfx.js').read()
files=re.findall(r'file:\s*"sfx/([^"]+)\.mp3"',src)
missing=[f for f in files if f not in S]
# registry file names that differ from synth keys
alias={'ambient_city':'ambient_city'}
if missing: print("MISSING synth:",missing); sys.exit(1)
for stem in files:
    x=np.nan_to_num(S[stem]())
    x=x*np.minimum(1,np.arange(len(x))/(SR*.002+1))   # de-click start
    if stem not in ('sizzle_loop','tv_static','ambient_city','ambient_rain','ambient_indoor','crowd_murmur','traffic_rumble','water_running','shower_on','police_siren','bike_engine'):
        x=x*np.minimum(1,(len(x)-np.arange(len(x)))/(SR*.01+1))
    x=norm(x,.8)
    wav=f'/tmp/synth/{stem}.wav'; wavfile.write(wav,SR,(x*32767).astype(np.int16))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wav,'-ac','1','-b:a','64k',f'{OUT}/{stem}.mp3'],check=True)
print("generated",len(files),"files")
