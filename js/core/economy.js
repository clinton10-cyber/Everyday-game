import { Sfx } from "./sfx.js";
export const Economy={
  balance:50000,transactions:[],_ls:new Set(),
  onChange(fn){this._ls.add(fn);return()=>this._ls.delete(fn);},
  _emit(){for(const fn of this._ls){try{fn(this);}catch(e){console.warn(e);}}},
  _tx(type,d){const tx={id:"TX"+Date.now().toString(36).toUpperCase()+
    Math.random().toString(36).slice(2,5).toUpperCase(),type,time:Date.now(),...d};
    this.transactions.unshift(tx);if(this.transactions.length>100)this.transactions.length=100;
    return tx;},
  send(to,amt,note){amt=Math.floor(Number(amt));
    if(!to||!amt||amt<=0||amt>this.balance)return null;
    this.balance-=amt;const tx=this._tx("send",{to,amount:amt,note:note||""});
    try{Sfx.play("money_withdraw");}catch(_){}
    this._emit();return tx;},
  receive(from,amt,note){amt=Math.floor(Number(amt));
    if(!from||!amt||amt<=0)return null;
    this.balance+=amt;const tx=this._tx("receive",{from,amount:amt,note:note||""});
    try{Sfx.play("money_deposit");}catch(_){}
    this._emit();return tx;},
  withdraw(amt){amt=Math.floor(Number(amt));
    if(!amt||amt<=0||amt>this.balance)return null;
    this.balance-=amt;const tx=this._tx("withdraw",{amount:amt});
    try{Sfx.play("money_withdraw");}catch(_){}
    this._emit();return tx;},
  robbed(amt,by){amt=Math.floor(Number(amt));
    if(!amt||amt<=0||amt>this.balance)amt=this.balance;
    this.balance-=amt;const tx=this._tx("robbed",{amount:amt,by});
    this._emit();return tx;},
  format(n){return "₦"+Math.floor(n||0).toLocaleString();}
};

