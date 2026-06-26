import {clsx,type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
export const cn=(...i:ClassValue[])=>twMerge(clsx(i));
export const fmt={
  currency:(v:number|string|null|undefined)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(typeof v==='string'?parseFloat(v):v??0),
  number:(v:number|string|null|undefined,d=0)=>new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(typeof v==='string'?parseFloat(v):v??0),
  percent:(v:number,d=1)=>`${v.toFixed(d)}%`,
  date:(v:string|Date)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(v)),
  datetime:(v:string|Date)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v)),
};
export const VENDORS=['Pepsi','Coca-Cola','Frito-Lay','RNK','GG','McLane','Core-Mark'];
