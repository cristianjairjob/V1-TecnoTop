// Colombian national holidays: Ley 51 de 1983. Dates use UTC for calendar arithmetic only.
const iso=(d:Date)=>d.toISOString().slice(0,10);
export function colombiaHolidays(year:number) {
 const dates=new Set<string>(); const add=(m:number,d:number,monday=false)=>{const v=new Date(Date.UTC(year,m-1,d,12));if(monday)v.setUTCDate(v.getUTCDate()+(8-v.getUTCDay())%7);dates.add(iso(v));};
 [[1,1],[5,1],[7,20],[8,7],[12,8],[12,25]].forEach(([m,d])=>add(m,d));
 [[1,6],[3,19],[6,29],[8,15],[10,12],[11,1],[11,11]].forEach(([m,d])=>add(m,d,true));
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,n=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*n+114)/31),day=(h+l-7*n+114)%31+1;
 const easter=new Date(Date.UTC(year,month-1,day,12));
 [-3,-2,43,64,71].forEach(offset=>{const v=new Date(easter);v.setUTCDate(v.getUTCDate()+offset);dates.add(iso(v));}); return dates;
}
export function isBusinessDay(value:string) {const d=new Date(value+"T12:00:00Z");return Number.isFinite(d.getTime()) && d.getUTCDay()!==0 && d.getUTCDay()!==6 && !colombiaHolidays(d.getUTCFullYear()).has(value);}
export function addBusinessDays(value:string,count:number) {const d=new Date(value+"T12:00:00Z");while(count>0){d.setUTCDate(d.getUTCDate()+1);if(isBusinessDay(iso(d)))count--;}return iso(d);}
