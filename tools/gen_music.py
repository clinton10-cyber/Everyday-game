import numpy as np, subprocess, sys, os
from scipy import signal
from scipy.io import wavfile
SR=32000; rng=np.random.default_rng(5)
OUT=sys.argv[1]; os.makedirs(OUT,exist_ok=True)
def T(d): return np.arange(int(SR*d))/SR
def noise(d): return rng.standard_normal(int(SR*d))
def mtof(m): return 440*2**((m-69)/12)
def flt(x,f,kind,o=2):
    f=np.clip(np.atleast_1d(f)/(SR/2),1e-4,.99); b,a=signal.butter(o,f if len(f)>1 else f[0],kind); return signal.lfilter(b,a,x)
def lp(x,f): return flt(x,f,'low')
def hp(x,f): return flt(x,f,'high')
def bp(x,l,h): return flt(x,[l,h],'band')
def env(d,a,tau): x=T(d); return np.minimum(1,x/max(a,1e-4))*np.exp(-np.maximum(0,x-a)/tau)
def gate(d,a,rel): x=T(d); return np.minimum(1,x/a)*np.minimum(1,np.maximum(0,(d-x))/rel)

# ---- instruments (each returns an array) ----
def kick():
    d=.4; f=45+90*np.exp(-T(d)/.035); return np.sin(2*np.pi*np.cumsum(f)/SR)*env(d,.001,.12)+noise(d)*env(d,.0005,.004)*.2
def rim():
    d=.12; return bp(noise(d),1800,5500)*env(d,.0005,.015)+np.sin(2*np.pi*820*T(d))*env(d,.0005,.012)*.5
def clap():
    d=.3; n=bp(noise(d),1200,6000); e=sum(env(d,.0005,.02)*0 for _ in [0]); 
    b=np.zeros(int(SR*d))
    for a in (0,.012,.024):
        i=int(a*SR); m=len(n)-i; e=env(d,.0005,.02 if a<.024 else .09)[:m]; b[i:i+m]+=n[:m]*e
    return b
def hat(o=False):
    d=.25 if o else .06; return hp(noise(d),7000)*env(d,.0005,.12 if o else .02)
def shaker():
    d=.1; return bp(noise(d),5000,10000)*env(d,.012,.03)
def conga(hi=True):
    d=.3; f0=330 if hi else 215; f=f0*(1+.18*np.exp(-T(d)/.025)); 
    return (np.sin(2*np.pi*np.cumsum(f)/SR)+.3*np.sin(2*np.pi*np.cumsum(f*2.3)/SR))*env(d,.001,.09)+bp(noise(d),800,3000)*env(d,.0005,.01)*.5
def bass(m,d):
    f=mtof(m); t=T(d); x=np.sin(2*np.pi*f*t)+.5*np.sin(4*np.pi*f*t)+.25*(2*((f*t)%1)-1)
    return lp(x,500)*gate(d,.004,.05)*np.exp(-t/(d*1.2))
def pluck(m,d,vel=1):
    f=mtof(m); t=T(d); x=(2*((f*t)%1)-1)*.6+np.sign(np.sin(2*np.pi*f*t))*.25+np.sin(2*np.pi*2*f*t)*.3
    return lp(x,min(4200,f*7))*env(d,.002,.16)*vel
def epiano(m,d,vel=1):
    f=mtof(m); t=T(d); x=np.sin(2*np.pi*f*t)+.45*np.sin(2*np.pi*2*f*t)*np.exp(-t/.25)+.2*np.sin(2*np.pi*4.01*f*t)*np.exp(-t/.08)
    return x*env(d,.003,.55)*vel
def brass(m,d,vel=1):
    f=mtof(m); t=T(d); x=sum(2*(((f*k)*t)%1)-1 for k in (1,1.004,.996))/3
    return lp(x,2600)*gate(d,.025,.06)*vel
def logdrum(m,d=.5):
    f=mtof(m); t=T(d); fr=f*(1+.5*np.exp(-t/.03)); return np.sin(2*np.pi*np.cumsum(fr)/SR)*env(d,.002,.28)+.3*np.sin(4*np.pi*np.cumsum(fr)/SR)*env(d,.002,.1)
def pad(ms,d,vel=1):
    t=T(d); x=sum(sum(2*(((mtof(m)*k)*t)%1)-1 for k in (1,1.006))/2 for m in ms)/len(ms); return lp(x,1400)*np.minimum(1,t/.4)*np.minimum(1,(d-t)/.5)*vel

class Song:
    def __init__(s,bpm,bars,swing=.0,tail=2.5):
        s.bpm=bpm; s.bars=bars; s.step=60/bpm/4; s.swing=swing
        s.N=int(SR*bars*16*s.step); s.buf=np.zeros(s.N+int(SR*tail)); s.tail=int(SR*tail)
    def at(s,bar,st): 
        t=(bar*16+st)*s.step
        if st%2==1: t+=s.swing*s.step
        return t
    def put(s,x,t,g=1.0):
        i=int(t*SR); n=min(len(x),len(s.buf)-i)
        if n>0: s.buf[i:i+n]+=x[:n]*g
    def done(s):
        b=s.buf; main=b[:s.N].copy(); tl=b[s.N:]; main[:len(tl)]+=tl   # fold tail -> seamless loop
        return main

def hits(song,bar,sound,steps,vel=1.0,vels=None):
    for k,st in enumerate(steps): song.put(sound,song.at(bar,st),vel*(vels[k%len(vels)] if vels else 1))

def finish(x,name,peak=.8):
    x=np.tanh(x*1.15/np.max(np.abs(x)))/np.tanh(1.15); x=x/np.max(np.abs(x))*peak
    wav=f'/tmp/mus/{name}.wav'; wavfile.write(wav,SR,(x*32767).astype(np.int16))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wav,'-ac','1','-b:a','96k',f'{OUT}/{name}.mp3'],check=True)
    print(name,round(len(x)/SR,1),'s')

# chord = (bass_root_midi, [chord tones midi])
def prog_theme(): return [(45,[57,60,64,67,71]),(50,[62,65,69,72,76]),(43,[59,62,65,67,71]),(48,[60,64,67,71,74])]   # Am9 Dm9 G13 Cmaj9

def theme():
    S=Song(104,24,swing=.12); P=prog_theme()
    K,R,H,HO,C1,C2,SH=kick(),rim(),hat(),hat(True),conga(True),conga(False),shaker()
    for b in range(S.bars):
        root,ch=P[b%4]; sec=('intro' if b<4 else 'break' if 16<=b<20 else 'full')
        full= sec=='full'; mid= sec!='intro'
        if sec!='break': hits(S,b,K,[0,6,10],.95)
        hits(S,b,R,[4,12],.5)
        hits(S,b,H,range(16),.28,[1,.35,.6,.35])
        if b%2==1: hits(S,b,HO,[14],.3)
        hits(S,b,C1,[2,5,9,13],.45); hits(S,b,C2,[7,11,15],.4)
        hits(S,b,SH,range(1,16,2),.3)
        # bass: syncopated
        for st,off,dur in [(0,0,.35),(3,0,.2),(6,12,.3),(10,0,.3),(14,7,.25)]:
            S.put(bass(root+off,dur),S.at(b,st),.85)
        if mid:   # interlocking guitar
            idx=[0,2,1,3,2,4,1,3]; 
            for k,st in enumerate([0,3,6,8,11,14]): S.put(pluck(ch[idx[k%len(idx)]]+ (12 if k%3==2 else 0),.3),S.at(b,st),.34)
        if full or sec=='break':
            for st in [2,7,10]: S.put(epiano(ch[1],.5),S.at(b,st),.25); S.put(epiano(ch[3],.5),S.at(b,st),.2); S.put(epiano(ch[2],.5),S.at(b,st),.2)
        if full:
            for st in [6,14]:
                for m in (ch[1],ch[2],ch[3]): S.put(brass(m,.3),S.at(b,st),.13)
        if sec=='break': S.put(pad(ch[:4],4*S.step*4),S.at(b,0),.12)
    return S.done()

def chill():   # interior: soft, slower
    S=Song(84,20,swing=.18); P=[(48,[60,64,67,71,74]),(45,[57,60,64,67,71]),(50,[62,65,69,72,76]),(43,[59,62,65,67,71])]
    C1,C2,SH,R=conga(True),conga(False),shaker(),rim()
    for b in range(S.bars):
        root,ch=P[b%4]
        hits(S,b,C2,[0,7,10],.3); hits(S,b,C1,[3,12],.28); hits(S,b,SH,range(0,16,2),.22); hits(S,b,R,[8],.25)
        for st,off in [(0,0),(6,0),(10,7)]: S.put(bass(root+off,.5),S.at(b,st),.75)
        for st in [0,6,10]: 
            for m in ch[:4]: S.put(epiano(m,1.0),S.at(b,st),.17)
        if b>=4:
            for k,st in enumerate([2,5,8,12,14]): S.put(pluck(ch[[1,3,2,4,3][k]]+12,.35),S.at(b,st),.22)
        S.put(pad(ch[:4],16*S.step),S.at(b,0),.1)
    return S.done()

def night():   # amapiano-style
    S=Song(112,24,swing=.05); P=[(45,[57,60,64,67]),(41,[53,57,60,64]),(43,[55,59,62,65]),(40,[52,55,59,62])]
    K,SH,HO,C1,R=kick(),shaker(),hat(True),conga(True),rim()
    for b in range(S.bars):
        root,ch=P[b%4]
        hits(S,b,K,[0,4,8,12],.8); hits(S,b,SH,range(16),.3,[1,.4,.7,.4]); hits(S,b,HO,[2,6,10,14],.25)
        hits(S,b,R,[4,12],.35); hits(S,b,C1,[3,11,14],.3)
        # log drum bassline
        for st,off,d in [(0,0,.5),(3,0,.3),(6,7,.3),(8,0,.5),(11,5,.3),(14,0,.3)]:
            S.put(logdrum(root+off-12 if off==0 else root+off,d),S.at(b,st),.9)
        if b>=4:
            for st in [0,3,6,10,13]:
                for m in ch: S.put(epiano(m+12,.5),S.at(b,st),.13)
        if b>=12: 
            for k,st in enumerate([2,7,9,14]): S.put(pluck(ch[k%4]+24,.3),S.at(b,st),.2)
        S.put(pad(ch,16*S.step),S.at(b,0),.09)
    return S.done()

def chase():   # tense
    S=Song(128,24,swing=.04); P=[(45,[57,60,64,69]),(46,[58,62,65,70]),(45,[57,60,64,69]),(43,[55,58,62,67])]
    K,R,H,HO,C1,C2,SH,CL=kick(),rim(),hat(),hat(True),conga(True),conga(False),shaker(),clap()
    for b in range(S.bars):
        root,ch=P[b%4]
        hits(S,b,K,[0,4,8,12],1.0); hits(S,b,CL,[4,12],.5); hits(S,b,H,range(16),.3,[1,.4,.7,.4]); hits(S,b,HO,[6,14],.3)
        hits(S,b,C1,[2,7,10,15],.4); hits(S,b,C2,[3,9,13],.35); hits(S,b,SH,range(1,16,2),.3)
        for st in range(0,16,2): S.put(bass(root+(12 if st%8==6 else 0),.2),S.at(b,st),.8)
        if b>=4:
            for st in [0,3,6,10,12,14]:
                for m in (ch[1],ch[2],ch[3]): S.put(brass(m+0,.22),S.at(b,st),.12)
        if b>=8:
            for k,st in enumerate(range(0,16,2)): S.put(pluck(ch[[0,2,1,3][k%4]]+12,.18),S.at(b,st),.2)
        if b%4==3:   # riser snare roll
            for st in range(8,16): S.put(rim(),S.at(b,st),.15+.04*(st-8))
    return S.done()

finish(theme(),'theme'); finish(chill(),'chill_interior'); finish(night(),'night_amapiano'); finish(chase(),'chase_tense')
