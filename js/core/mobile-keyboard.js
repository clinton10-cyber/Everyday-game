/* Floating in-game keyboard for Everyday-game mobile text entry.
 * Import once from js/main.js. Inputs are made readonly on touch devices so
 * Android/iOS do not open their native keyboard; this keyboard writes values.
 */
const STYLE_ID = "ph3d-floating-keyboard-style";
const ROOT_ID = "ph3d-floating-keyboard";
const isTouch = () => ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
  #${ROOT_ID}{position:fixed;z-index:1000000;left:50%;bottom:16px;transform:translateX(-50%);
    width:min(94vw,430px);padding:9px;border:1px solid #ffffff30;border-radius:15px;
    background:rgba(13,15,29,.96);box-shadow:0 12px 40px #0009;backdrop-filter:blur(14px);
    color:#fff;font:600 13px system-ui;display:none;touch-action:manipulation;user-select:none}
  #${ROOT_ID}.show{display:block}
  #${ROOT_ID} .kb-head{display:flex;align-items:center;justify-content:space-between;margin:0 2px 7px}
  #${ROOT_ID} .kb-head button{width:auto;padding:5px 10px;background:#34364d}
  #${ROOT_ID} .kb-row{display:flex;gap:4px;margin:4px 0}
  #${ROOT_ID} button{flex:1;min-width:0;height:37px;border:0;border-radius:7px;background:#292c43;color:#fff;
    font:600 13px system-ui;touch-action:manipulation}
  #${ROOT_ID} button:active{background:#6554d9}
  #${ROOT_ID} button.wide{flex:1.6;background:#41445f}
  #${ROOT_ID} button.space{flex:5}
  #${ROOT_ID} .kb-drag{cursor:move;touch-action:none}
  `;
  document.head.appendChild(style);
}

function mount() {
  if (!isTouch() || document.getElementById(ROOT_ID)) return;
  installStyle();
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.setAttribute("aria-label", "In-game keyboard");
  root.innerHTML = `
    <div class="kb-head kb-drag"><span>GAME KEYBOARD</span><button type="button" data-k="hide">−</button></div>
    <div class="kb-rows"></div>`;
  document.body.appendChild(root);
  const rows = root.querySelector(".kb-rows");
  let target = null, shifted = false;
  const layout = ["1234567890","qwertyuiop","asdfghjkl","zxcvbnm"];
  const emit = () => {
    if (!target) return;
    target.dispatchEvent(new Event("input",{bubbles:true}));
    target.dispatchEvent(new Event("change",{bubbles:true}));
  };
  const insert = value => {
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const text = shifted ? value.toUpperCase() : value;
    target.value = target.value.slice(0,start) + text + target.value.slice(end);
    const pos = start + text.length;
    try { target.setSelectionRange(pos,pos); } catch(e) {}
    emit();
  };
  const addRow = keys => {
    const row = document.createElement("div"); row.className = "kb-row";
    keys.forEach(({label,value,wide,space}) => {
      const b = document.createElement("button"); b.type="button"; b.textContent=label;
      if(wide)b.classList.add("wide"); if(space)b.classList.add("space");
      b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation();
        if(value==="hide"){root.classList.remove("show");return;}
        if(value==="shift"){shifted=!shifted; b.style.background=shifted?"#6554d9":"";return;}
        if(value==="back"){if(!target)return;const p=target.selectionStart??target.value.length;
          target.value=target.value.slice(0,Math.max(0,p-1))+target.value.slice(target.selectionEnd??p);try{target.setSelectionRange(Math.max(0,p-1),Math.max(0,p-1));}catch(e){}emit();return;}
        if(value==="enter"){insert("\\n");return;}
        insert(value);
      },{passive:false});
      row.appendChild(b);
    });
    rows.appendChild(row);
  };
  layout.forEach(line=>addRow([...line].map(ch=>({label:ch,value:ch}))));
  addRow([{label:"⇧",value:"shift",wide:true},... "zxcvbnm".split("").map(ch=>({label:ch,value:ch})),{label:"⌫",value:"back",wide:true}]);
  addRow([{label:"?123",value:"shift",wide:true},{label:"SPACE",value:" ",space:true},{label:"↵",value:"enter",wide:true},{label:"Done",value:"hide",wide:true}]);

  document.addEventListener("focusin", e => {
    const el=e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    if (el.disabled || el.readOnly || el.type==="button" || el.type==="submit" || el.type==="checkbox") return;
    target=el;
    el.dataset.ph3dKeyboard="1";
    el.setAttribute("inputmode","none");
    el.readOnly=true; // prevent native keyboard; values are inserted by this keyboard
    root.classList.add("show");
  }, true);
  document.addEventListener("pointerdown", e => {
    if (root.contains(e.target)) return;
    if (target && e.target !== target && !target.contains(e.target)) root.classList.remove("show");
  }, true);

  // Drag the floating panel by its title bar.
  const drag=root.querySelector(".kb-drag");
  let sx=0,sy=0,left=0,bottom=0,dragging=false;
  drag.addEventListener("pointerdown",e=>{if(e.target.tagName==="BUTTON")return;dragging=true;sx=e.clientX;sy=e.clientY;
    const r=root.getBoundingClientRect();left=r.left;bottom=window.innerHeight-r.bottom;
    drag.setPointerCapture(e.pointerId);e.preventDefault();});
  drag.addEventListener("pointermove",e=>{if(!dragging)return;root.style.left=(left+e.clientX-sx+root.offsetWidth/2)+"px";
    root.style.bottom=(bottom-(e.clientY-sy))+"px";});
  drag.addEventListener("pointerup",()=>dragging=false);
}

if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount,{once:true});
else mount();
