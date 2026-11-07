import * as THREE from "three";
/* SPEED: bumped SP from 2.2 to 3.3 and RU from 1.9 to 2.1 so the
   WalkControls-based interiors (Governor's Mansion) match the speed
   bump applied to ThirdPersonControls across every other interior. */
const FOV=72,EYE=1.65,ES=1.12,EL=.72,EC=1.05,SP=3.3,RU=2.1,CR=.55,BR=.40,PM=Math.PI/3,BA=.03,BH=1.6,SR=1.6,PR=2.4,GR=18,JV=6,WH=3,HC=WH-.1;
export class WalkControls{
  constructor(cam,dom,rooms,opt={}){
    Object.assign(this,{camera:cam,dom,rooms,opts:opt,yaw:opt.yaw||0,pitch:0,bobT:0,moving:false,
      state:"standing",eye:EYE,sitTarget:null,nearSit:null,vel:new THREE.Vector3(),
      onGround:true,height:1.72,carryables:[],held:null,interactables:[],
      keys:Object.create(null),joy:{on:false,id:null,ox:0,oy:0,dx:0,dy:0},
      look:{on:false,id:null,x:0,y:0},tapQ:null});
    cam.fov=FOV;cam.updateProjectionMatrix();
    this.phoneHold=false;this.poseType=null;this.sitPoints=this._sits();this._bind();this._btn();this._lbl();
  }
  _sits(){const P=[];for(const r of this.rooms){const cx=r.x+r.w/2,cz=r.z+r.d/2;
    P.push({x:cx,z:cz,mode:"sit"});
    if(r.w>6&&r.d>5){P.push({x:r.x+r.w*.3,z:r.z+r.d*.7,mode:"sit"});
      P.push({x:r.x+r.w*.7,z:r.z+r.d*.3,mode:"sit"});}}
    return P;}
  setPhoneHold(v){ this.phoneHold = !!v; this._ul(); }
  setPose(t){ this.poseType = t || null; }
  registerCarryables(list){this.carryables=list;for(const c of list){
    if(!c.mesh.userData.phys)c.mesh.userData.phys={
      vel:new THREE.Vector3(),radius:c.radius,halfH:c.halfH,active:false};}}
  registerInteractable(item){this.interactables.push(item);}
  _btn(){const o=document.getElementById("ph3d-act-btn");o&&o.remove();
    const b=document.createElement("div");b.id="ph3d-act-btn";
    Object.assign(b.style,{position:"fixed",right:"18px",bottom:"calc(env(safe-area-inset-bottom) + 32px)",
      zIndex:"30",padding:"14px 26px",borderRadius:"999px",background:"rgba(8,16,28,.85)",
      border:"1px solid rgba(94,224,255,.5)",color:"#eaf6ff",fontSize:"12px",fontWeight:"800",
      letterSpacing:".14em",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",
      cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",opacity:"0",
      transform:"translateY(10px)",transition:"opacity .25s, transform .25s",
      pointerEvents:"none",fontFamily:"inherit",boxShadow:"0 10px 28px rgba(0,0,0,.5)"});
    document.body.appendChild(b);this._b=b;
    const s=e=>{e.stopPropagation();e.cancelable && e.preventDefault();};
    b.addEventListener("pointerdown",e=>{s(e);this.triggerAction();});
    ["pointerup","pointermove","click"].forEach(k=>b.addEventListener(k,s));}
  _lbl(){const o=document.getElementById("ph3d-state");o&&o.remove();
    const e=document.createElement("div");e.id="ph3d-state";
    Object.assign(e.style,{position:"fixed",left:"18px",bottom:"calc(env(safe-area-inset-bottom) + 32px)",
      zIndex:"30",padding:"9px 16px",borderRadius:"999px",background:"rgba(8,16,28,.7)",
      border:"1px solid rgba(94,224,255,.25)",color:"#eaf6ff",fontSize:"10px",fontWeight:"800",
      letterSpacing:".18em",textTransform:"uppercase",backdropFilter:"blur(10px)",
      WebkitBackdropFilter:"blur(10px)",pointerEvents:"none",fontFamily:"inherit"});
    e.textContent="STANDING";document.body.appendChild(e);this._s=e;}
  _ul(){if(!this._s)return;let s="STANDING";
    if(this.state==="crouching")s="CROUCHING";
    if(this.state==="sitting")s="SITTING";
    if(this.state==="lying")s="LYING DOWN";
    if(this.state==="bathing")s="IN BATHTUB";
    if(this.state==="seated")s="ON TOILET";
    if(this.held)s+=" · CARRYING";
    this._s.textContent=s;}
  sit(p,m="sit"){
    if(m==="lie")this.state="lying";
    else if(m==="bath")this.state="bathing";
    else if(m==="toilet")this.state="seated";
    else this.state="sitting";
    this.poseType=m;
    this.sitTarget=p;this._ul();
  }
  sitHere(){if(this.state!=="standing")return;const p=this.camera.position;
    this.sit({x:p.x,z:p.z,yaw:this.yaw,h:0.5,mode:"sit"},"sit");}
  stand(){this.state="standing";this.sitTarget=null;this._ul();}
  crouch(){this.state=this.state==="crouching"?"standing":"crouching";this._ul();}
  jump(){if(this.onGround&&this.state==="standing"){this.vel.y=JV;this.onGround=false;}}
  pickUp(m){this.held=m;this._ul();}
  dropHeld(t=false){if(!this.held)return;
    const d=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    const p=this.held.userData.phys;p.active=true;
    if(t){p.vel.copy(d).multiplyScalar(10);p.vel.y+=2.8;}
    else{p.vel.copy(d).multiplyScalar(1.2);p.vel.y+=.6;}
    this.held=null;this._ul();}
  triggerAction(){
    if(this.state==="sitting"||this.state==="lying"){this.stand();return;}
    if(this.held){this.dropHeld(false);return;}
    const inter=this._nearInter();
    if(inter&&inter.onInteract){inter.onInteract(this);return;}
    if(this.nearSit){this.sit(this.nearSit,this.nearSit.mode);return;}
    const n=this._nc();n&&this.pickUp(n);}
  _nearInter(){
    const p=this.camera.position;let b=null,bd=PR*PR;
    for(const it of this.interactables){
      if(!it.mesh||!it.mesh.position)continue;
      const dx=it.mesh.position.x-p.x,dz=it.mesh.position.z-p.z,dy=it.mesh.position.y-p.y;
      const d=dx*dx+dz*dz+dy*dy*.3;
      if(d<bd){bd=d;b=it;}}
    return b;}
  _nc(){const p=this.camera.position;let b=null,bd=PR*PR;
    for(const c of this.carryables){if(c.mesh===this.held)continue;
      if(c.mesh.userData.phys&&c.mesh.userData.phys.active)continue;
      const dx=c.mesh.position.x-p.x,dz=c.mesh.position.z-p.z,dy=c.mesh.position.y-p.y;
      const d=dx*dx+dz*dz+dy*dy*.3;
      if(d<bd){bd=d;b=c.mesh;}}
    return b;}
  _ns(){if(this.state==="sitting"||this.state==="lying"){this.nearSit=this.sitTarget;return;}
    const p=this.camera.position;let b=null,bd=SR*SR;
    for(const s of this.sitPoints){const dx=s.x-p.x,dz=s.z-p.z,d=dx*dx+dz*dz;
      if(d<bd){bd=d;b=s;}}
    this.nearSit=b;}
  _ub(){const b=this._b;if(!b)return;let t="";
    /* State drives a data-attr; hud.css colours it — no inline colours here */
    let ds="default";
    if(this.state==="sitting"||this.state==="lying"){t="STAND";ds="active";}
    else if(this.held){t="DROP";ds="warn";}
    else{const inter=this._nearInter();
      if(inter){t=inter.label||"USE";ds="interact";}
      else if(this.nearSit){t="SIT";}
      else if(this._nc()){t="TAKE";ds="take";}}
    if(t){b.textContent=t;b.style.opacity="1";b.style.transform="translateY(0)";
      b.style.pointerEvents="auto";b.dataset.state=ds;}
    else{b.style.opacity="0";b.style.transform="translateY(10px)";b.style.pointerEvents="none";}}
  _bind(){const el=this.dom;
    this._kd=e=>{this.keys[e.code]=true;
      if(e.code==="KeyE")this.triggerAction();
      if(e.code==="KeyQ"&&this.held)this.dropHeld(true);
      if(e.code==="KeyF")this._fl();
      if(e.code==="KeyC")this.crouch();
      if(e.code==="KeyX")this.sitHere();
      if(e.code==="Space"){e.preventDefault();this.jump();}};
    this._ku=e=>{this.keys[e.code]=false;};
    window.addEventListener("keydown",this._kd);window.addEventListener("keyup",this._ku);
    this._pd=e=>{const isL=e.clientX<el.clientWidth*.5;
      if(isL&&!this.joy.on){Object.assign(this.joy,{on:true,id:e.pointerId,ox:e.clientX,oy:e.clientY,dx:0,dy:0});}
      else if(!isL&&!this.look.on){Object.assign(this.look,{on:true,id:e.pointerId,x:e.clientX,y:e.clientY});}};
    this._pm=e=>{
      if(this.joy.on&&e.pointerId===this.joy.id){const dx=e.clientX-this.joy.ox,dy=e.clientY-this.joy.oy;
        const m=Math.min(70,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);
        this.joy.dx=Math.cos(a)*m/70;this.joy.dy=Math.sin(a)*m/70;}
      if(this.look.on&&e.pointerId===this.look.id){const dx=e.clientX-this.look.x,dy=e.clientY-this.look.y;
        this.yaw-=dx*.0022;this.pitch-=dy*.0022;
        this.pitch=Math.max(-PM,Math.min(PM,this.pitch));
        this.look.x=e.clientX;this.look.y=e.clientY;}};
    this._pu=e=>{if(e.pointerId===this.joy.id){this.joy.on=false;this.joy.id=null;this.joy.dx=this.joy.dy=0;}
      if(e.pointerId===this.look.id){this.look.on=false;this.look.id=null;}};
    el.addEventListener("pointerdown",this._pd);el.addEventListener("pointermove",this._pm);
    ["pointerup","pointercancel","pointerleave"].forEach(k=>el.addEventListener(k,this._pu));
    this._nz=e=>e.cancelable && e.preventDefault();
    el.addEventListener("wheel",this._nz,{passive:false});
    el.addEventListener("gesturestart",this._nz,{passive:false});
    el.addEventListener("gesturechange",this._nz,{passive:false});
    document.addEventListener("touchmove",e=>{if(e.touches.length>1&&e.cancelable)e.preventDefault();},{passive:false});}
  _fl(){if(this.state==="lying"){this.stand();return;}
    let b=null,bd=SR*SR;const p=this.camera.position;
    for(const s of this.sitPoints){if(s.mode!=="lie")continue;
      const dx=s.x-p.x,dz=s.z-p.z,d=dx*dx+dz*dz;
      if(d<bd){bd=d;b=s;}}
    b&&this.sit(b,"lie");}
  update(dt){
    this.camera.quaternion.copy(new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch,this.yaw,0,"YXZ")));
    let f=0,s=0;
    if(this.keys.KeyW||this.keys.ArrowUp)f+=1;
    if(this.keys.KeyS||this.keys.ArrowDown)f-=1;
    if(this.keys.KeyA||this.keys.ArrowLeft)s-=1;
    if(this.keys.KeyD||this.keys.ArrowRight)s+=1;
    f+=-this.joy.dy;s+=this.joy.dx;
    const L=Math.hypot(f,s);if(L>1){f/=L;s/=L;}
    const p=this.camera.position;
    if(this.state==="sitting"||this.state==="lying"){
      if(L>.4)this.stand();
      else if(this.sitTarget){const k=Math.min(1,dt*5);
        p.x+=(this.sitTarget.x-p.x)*k;p.z+=(this.sitTarget.z-p.z)*k;
        let ty=ES;
        if(this.state==="lying")ty=EL;
        else if(this.state==="bathing")ty=0.95;
        else if(this.state==="seated")ty=1.05;
        p.y+=(ty-p.y)*k;}
    }else{
      let sp=SP;if(this.state==="crouching")sp*=CR;
      else if(this.keys.ShiftLeft||this.keys.ShiftRight)sp*=RU;
      this.moving=L>.05;
      const sn=Math.sin(this.yaw),cs=Math.cos(this.yaw);
      const dx=(s*cs-f*sn)*sp*dt,dz=(-s*sn-f*cs)*sp*dt;
      if(this._free(p.x+dx,p.z))p.x+=dx;
      if(this._free(p.x,p.z+dz))p.z+=dz;
      this.vel.y-=GR*dt;p.y+=this.vel.y*dt;
      const et=this.state==="crouching"?EC:EYE;
      if(p.y<=et){p.y=et;this.vel.y=0;this.onGround=true;}else this.onGround=false;
      if(p.y>HC){p.y=HC;if(this.vel.y>0)this.vel.y=0;}
      if(this.moving&&this.onGround){this.bobT+=dt;
        p.y+=Math.sin(this.bobT*Math.PI*2*BH)*BA;}}
    if(this.held){const d=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
      const t=new THREE.Vector3().copy(p).addScaledVector(d,1.15);t.y-=.22;
      this.held.position.lerp(t,Math.min(1,20*dt));
      this.held.rotation.y+=dt*.6;}
    for(const c of this.carryables){const o=c.mesh,ph=o.userData.phys;
      if(!ph||!ph.active||o===this.held)continue;
      ph.vel.y-=GR*dt;o.position.addScaledVector(ph.vel,dt);
      if(o.position.y<ph.halfH){o.position.y=ph.halfH;
        if(ph.vel.y<0){ph.vel.y*=-.28;if(Math.abs(ph.vel.y)<.5)ph.vel.y=0;}
        ph.vel.x*=.82;ph.vel.z*=.82;}
      this._rc(o.position,ph.radius);
      if(o.position.y>WH-ph.halfH){o.position.y=WH-ph.halfH;
        ph.vel.y=-Math.abs(ph.vel.y)*.3;}
      const dp=Math.pow(.12,dt);ph.vel.x*=dp;ph.vel.z*=dp;
      if(Math.abs(ph.vel.x)<.05&&Math.abs(ph.vel.z)<.05&&Math.abs(ph.vel.y)<.05&&
         o.position.y<=ph.halfH+.001){ph.vel.set(0,0,0);ph.active=false;}}
    this._ns();this._ub();}
  _free(x,z){for(const r of this.rooms){if(x>r.x+BR&&x<r.x+r.w-BR&&z>r.z+BR&&z<r.z+r.d-BR)return true;}return false;}
  _rc(pos,rad){if(!this._free(pos.x,pos.z)){let b=null,bd=Infinity;
    for(const r of this.rooms){const cx=r.x+r.w/2,cz=r.z+r.d/2;
      const dx=pos.x-cx,dz=pos.z-cz,d=dx*dx+dz*dz;
      if(d<bd){bd=d;b=r;}}
    if(b){const cx=b.x+b.w/2,cz=b.z+b.d/2;pos.x+=(cx-pos.x)*.1;pos.z+=(cz-pos.z)*.1;}}}
  dispose(){window.removeEventListener("keydown",this._kd);
    window.removeEventListener("keyup",this._ku);
    const el=this.dom;
    el.removeEventListener("pointerdown",this._pd);el.removeEventListener("pointermove",this._pm);
    ["pointerup","pointercancel","pointerleave"].forEach(k=>el.removeEventListener(k,this._pu));
    el.removeEventListener("wheel",this._nz);el.removeEventListener("gesturestart",this._nz);
    el.removeEventListener("gesturechange",this._nz);
    this._b&&this._b.parentNode&&this._b.parentNode.removeChild(this._b);
    this._s&&this._s.parentNode&&this._s.parentNode.removeChild(this._s);}
}
