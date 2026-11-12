import { Economy } from './economy.js';

const KEY='everyday_banking_v1';
const DAY=86400000;
const STOCKS=[
 {id:'nigerian-energy',name:'Nigerian Energy Co.',symbol:'NEC',base:1250},
 {id:'garden-city',name:'Garden City Foods',symbol:'GCF',base:840},
 {id:'naija-telecom',name:'Naija Telecom',symbol:'NTL',base:2150},
 {id:'ph-industries',name:'PH Industries',symbol:'PHI',base:560}
];
const COINS=[{id:'bitnaija',name:'BitNaija',symbol:'BNA',base:95000},{id:'nairacoin',name:'NairaCoin',symbol:'NRC',base:1250}];
const fresh=()=>({opened:false,accountNo:'',savings:0,deposit:null,loans:[],creditScore:620,portfolio:{},crypto:{},market:{},history:[],lastAccrual:Date.now()});
function load(){try{return {...fresh(),...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(_){return fresh();}}
let s=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(s));}catch(_){}}
function tx(label,amount,type='info'){s.history.unshift({id:'BK'+Date.now().toString(36),label,amount,type,time:Date.now()});s.history=s.history.slice(0,40);save();}
function price(item){const day=Math.floor(Date.now()/DAY);const seed=[...item.id].reduce((a,c)=>a+c.charCodeAt(0),day);const wave=Math.sin(seed*12.9898)*0.5+Math.sin(seed*.37)*.22;return Math.max(1,Math.round(item.base*(1+wave*.24)));}
function accrue(){const now=Date.now();const days=Math.min(30,Math.floor((now-(s.lastAccrual||now))/DAY));if(days>0){if(s.savings>0){const interest=Math.floor(s.savings*(Math.pow(1+.02/30,days)-1));s.savings+=interest;if(interest)tx('Savings interest',interest,'positive');}if(s.deposit&&now>=s.deposit.maturesAt){const payout=Math.floor(s.deposit.amount*1.08);s.savings+=payout;tx('Fixed deposit matured',payout-s.deposit.amount,'positive');s.deposit=null;}s.lastAccrual+=days*DAY;save();}}
export const Banking={
 snapshot(){accrue();return { ...s,stocks:STOCKS.map(x=>({...x,price:price(x)})),coins:COINS.map(x=>({...x,price:price(x)})),wallet:Economy.balance,loanBalance:s.loans.reduce((a,l)=>a+l.remaining,0)};},
 open(){if(s.opened)return {ok:true};if(Economy.balance<2500)return {ok:false,reason:'funds'};Economy.withdraw(2500);s.opened=true;s.accountNo='20'+String(Math.floor(100000000+Math.random()*899999999));tx('Account opening fee',-2500,'negative');save();return {ok:true};},
 depositSavings(amount){accrue();amount=Math.floor(Number(amount));if(!s.opened)return {ok:false,reason:'account'};if(!amount||amount<1||amount>Economy.balance)return {ok:false,reason:'funds'};Economy.withdraw(amount);s.savings+=amount;tx('Transfer to savings',-amount,'negative');save();return {ok:true};},
 withdrawSavings(amount){accrue();amount=Math.floor(Number(amount));if(!amount||amount<1||amount>s.savings)return {ok:false,reason:'funds'};s.savings-=amount;Economy.receive('Savings withdrawal',amount,'bank savings');tx('Savings withdrawal',amount,'positive');save();return {ok:true};},
 openFixed(amount){accrue();amount=Math.floor(Number(amount));if(!s.opened)return {ok:false,reason:'account'};if(s.deposit)return {ok:false,reason:'active'};if(!amount||amount<10000||amount>Economy.balance)return {ok:false,reason:'funds'};Economy.withdraw(amount);s.deposit={amount,openedAt:Date.now(),maturesAt:Date.now()+30*DAY};tx('30-day fixed deposit',-amount,'negative');save();return {ok:true};},
 breakFixed(){if(!s.deposit)return {ok:false};const amount=s.deposit.amount;s.deposit=null;s.savings+=amount;tx('Fixed deposit broken early',0,'info');save();return {ok:true,amount};},
 requestLoan(amount,term=7){amount=Math.floor(Number(amount));term=Number(term);if(!s.opened)return {ok:false,reason:'account'};const active=s.loans.filter(l=>l.remaining>0);const max=Math.max(25000,Math.floor((s.creditScore-500)*500));if(active.length>=2||!amount||amount<10000||amount>max||![7,14,30].includes(term))return {ok:false,reason:'limit'};const total=Math.ceil(amount*(1+.08*term/30));const loan={id:'LN'+Date.now().toString(36),principal:amount,remaining:total,repayment:total,dueAt:Date.now()+term*DAY,term,status:'active'};s.loans.push(loan);s.creditScore=Math.max(300,s.creditScore-4);Economy.receive('Bank loan',amount,'simulated game loan');tx('Loan received',amount,'positive');save();return {ok:true,loan};},
 repayLoan(id,amount){const l=s.loans.find(x=>x.id===id&&x.remaining>0);amount=Math.floor(Number(amount));if(!l||!amount||amount<1||amount>l.remaining||amount>Economy.balance)return {ok:false,reason:'funds'};Economy.withdraw(amount);l.remaining-=amount;if(l.remaining===0){l.status='repaid';s.creditScore=Math.min(850,s.creditScore+18);tx('Loan fully repaid',-amount,'negative');}else tx('Loan repayment',-amount,'negative');save();return {ok:true,loan:l};},
 buyStock(id,quantity){quantity=Math.floor(Number(quantity));const item=STOCKS.find(x=>x.id===id);if(!item||quantity<1||quantity>10000)return {ok:false};const cost=price(item)*quantity;if(cost>Economy.balance)return {ok:false,reason:'funds'};Economy.withdraw(cost);s.portfolio[id]=(s.portfolio[id]||0)+quantity;tx('Bought '+item.symbol+' shares',-cost,'negative');save();return {ok:true};},
 sellStock(id,quantity){quantity=Math.floor(Number(quantity));const item=STOCKS.find(x=>x.id===id);if(!item||quantity<1||quantity>(s.portfolio[id]||0))return {ok:false};const value=price(item)*quantity;s.portfolio[id]-=quantity;Economy.receive('Stock sale',value,'investment sale');tx('Sold '+item.symbol+' shares',value,'positive');save();return {ok:true,value};},
 buyCoin(id,quantity){quantity=Number(quantity);const item=COINS.find(x=>x.id===id);if(!item||!Number.isFinite(quantity)||quantity<=0||quantity>100000)return {ok:false};const cost=Math.ceil(price(item)*quantity);if(cost>Economy.balance)return {ok:false,reason:'funds'};Economy.withdraw(cost);s.crypto[id]=(s.crypto[id]||0)+quantity;tx('Bought '+item.symbol,-cost,'negative');save();return {ok:true};},
 sellCoin(id,quantity){quantity=Number(quantity);const item=COINS.find(x=>x.id===id);if(!item||!Number.isFinite(quantity)||quantity<=0||quantity>(s.crypto[id]||0))return {ok:false};const value=Math.floor(price(item)*quantity);s.crypto[id]-=quantity;Economy.receive('Crypto sale',value,'investment sale');tx('Sold '+item.symbol,value,'positive');save();return {ok:true,value};},
 history(){accrue();return s.history.slice();}
};
