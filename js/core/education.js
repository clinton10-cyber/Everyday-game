import { Economy } from "./economy.js";
const KEY="everyday_education_v1";
const PROGRAMS=[
{id:"primary",name:"Primary School",level:"Basic education",fee:2500,years:6,subjects:["English","Mathematics","Basic Science","Social Studies"]},
{id:"secondary",name:"Secondary School",level:"Senior secondary",fee:6000,years:3,subjects:["English","Mathematics","Biology","Chemistry","Physics","Civic Education"]},
{id:"university",name:"University",level:"Higher education",fee:25000,years:4,subjects:["Computer Science","Mathematics","Communication Skills","Programming","General Studies"]}
];
const fresh=()=>({program:null,year:0,credits:0,study:0,attendance:0,exams:0,history:[],scholarship:false});
const clone=x=>JSON.parse(JSON.stringify(x));
function state(){try{return {...fresh(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return fresh()}}
function save(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}}
export const Education={
 catalog:PROGRAMS,
 snapshot(){const s=state();return {...clone(s),balance:Economy.balance,program:PROGRAMS.find(p=>p.id===s.program)||null,canGraduate:!!s.program&&s.credits>=12&&s.exams>=3,grade:s.exams?Math.min(100,Math.round(50+s.study*2+s.attendance*.5)):0};},
 enroll(id){const p=PROGRAMS.find(x=>x.id===id);const s=state();if(!p)return{ok:false,reason:"invalid"};if(s.program)return{ok:false,reason:"enrolled"};if(!Economy.withdraw(p.fee))return{ok:false,reason:"funds",fee:p.fee};s.program=id;s.year=1;s.credits=0;s.study=0;s.attendance=0;s.exams=0;save(s);return{ok:true,program:p};},
 study(){const s=state();if(!s.program)return{ok:false,reason:"not_enrolled"};s.study++;save(s);return{ok:true,study:s.study};},
 attend(){const s=state();if(!s.program)return{ok:false,reason:"not_enrolled"};s.attendance++;save(s);return{ok:true,attendance:s.attendance};},
 exam(){const s=state();if(!s.program)return{ok:false,reason:"not_enrolled"};if(s.study<2)return{ok:false,reason:"study"};s.exams++;s.credits=Math.min(12,s.credits+4);const score=Math.min(100,Math.round(48+s.study*2+s.attendance*.5+Math.random()*12));s.history.unshift({date:Date.now(),score,exam:s.exams});save(s);return{ok:true,score,exam:s.exams,credits:s.credits};},
 scholarship(){const s=state();if(!s.program)return{ok:false,reason:"not_enrolled"};if(s.scholarship)return{ok:false,reason:"claimed"};if(s.exams<2||s.study<5)return{ok:false,reason:"requirements"};s.scholarship=true;save(s);Economy.receive("Academic scholarship",15000,"Education support award");return{ok:true,amount:15000};},
 graduate(){const s=state();if(!s.program)return{ok:false,reason:"not_enrolled"};if(s.credits<12||s.exams<3)return{ok:false,reason:"requirements"};const p=PROGRAMS.find(x=>x.id===s.program);s.history.unshift({graduated:p.name,year:Date.now(),grade:Math.min(100,Math.round(50+s.study*2+s.attendance*.5))});s.program=null;s.year=0;s.credits=0;s.study=0;s.attendance=0;s.exams=0;s.scholarship=false;save(s);return{ok:true,name:p.name};}
};
