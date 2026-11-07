export const Inventory={
  items:[],
  onChange:null,
  add(item){
    const existing=this.items.find(i=>i.id===item.id);
    if(existing){existing.qty=(existing.qty||1)+1;}
    else this.items.push({qty:1,...item});
    this.onChange&&this.onChange(this.items);
  },
  remove(id,qty){
    qty=qty||1;
    const idx=this.items.findIndex(i=>i.id===id);
    if(idx<0)return false;
    this.items[idx].qty-=qty;
    if(this.items[idx].qty<=0)this.items.splice(idx,1);
    this.onChange&&this.onChange(this.items);
    return true;
  },
  has(id){return this.items.some(i=>i.id===id);},
  count(id){const it=this.items.find(i=>i.id===id);return it?it.qty:0;},
  clear(){this.items=[];this.onChange&&this.onChange(this.items);},
};

// Registered item types
export const ITEMS={
  knife:  {id:"knife",  name:"KITCHEN KNIFE", type:"weapon", damage:35},
  cleaver:{id:"cleaver",name:"CLEAVER",       type:"weapon", damage:40},
  pistol: {id:"pistol", name:"PISTOL",        type:"weapon", damage:60},
  deed:   {id:"deed",   name:"HOUSE DEED",    type:"deed",   place:"myhouse"},
  key_myhouse:{id:"key_myhouse",name:"HOUSE KEY",type:"key",   place:"myhouse"},
  tea:    {id:"tea",    name:"CUP OF TEA",    type:"food",   heal:15},
  eggs:   {id:"eggs",   name:"SCRAMBLED EGGS",type:"food",   heal:25},
  pasta:  {id:"pasta",  name:"PASTA",         type:"food",   heal:40},
  roast:  {id:"roast",  name:"ROAST DINNER",  type:"food",   heal:60},
  book:   {id:"book",   name:"BOOK",          type:"junk"},
  vase:   {id:"vase",   name:"VASE",          type:"junk"},
  ball:   {id:"ball",   name:"BALL",          type:"junk"},
};

