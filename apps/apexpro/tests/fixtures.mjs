// Deliberately synthetic, deterministic test data. Never shipped in public/.
const base = {sector:'Technology',price:2400,last_date:'2026-11-12',fy:'FY26',sma20:2300,sma50:2200,sma200:2100,roce:30,cfo_pat:1.1,de:.1,pe:18,rev_cagr:12,comp:70,r1d:1.5,r3m:6,r1y:8,rsi:55,high52:3000,low52:1800};
export const screen = {as_of:'2026-11-12',built_on:'2026-11-13',rows:[{...base,sym:'TCS',name:'Tata Consultancy Services Ltd.'},{...base,sym:'INFY',name:'Infosys Ltd.',price:1400,comp:65},{...base,sym:'RELIANCE',name:'Reliance Industries Ltd.',sector:'Energy',r1d:-.5,comp:60},{...base,sym:'HDFCBANK',name:'HDFC Bank Ltd.',sector:'Financial Services',comp:55},{...base,sym:'ITC',name:'ITC Ltd.',sector:'Consumer Defensive',comp:50}]};
export const chart = {ok:true,t:Array.from({length:300},(_,i)=>1700000000+i*86400),c:Array.from({length:300},(_,i)=>2000+i+Math.sin(i)*30)};
export const pulse = {ok:true,quotes:Object.fromEntries(['NIFTY','BANKNIFTY','VIX'].map((s,i)=>[s,{t:chart.t.slice(-30),c:chart.c.slice(-30).map(v=>v/(i+1)),px:chart.c.at(-1)/(i+1),prev:2200/(i+1),pt:chart.t.at(-1)}]))};
export const company={sym:'TCS',row:screen.rows[0],built_on:'2026-11-13',years:[{fy:'FY26',rev_cr:20000,pat_cr:4000,eps:100,roce:30},{fy:'FY25',rev_cr:18000,pat_cr:3500,eps:90,roce:28}]};

for (const r of screen.rows) { r.q=75; r.g=65; r.turnover_cr=100; }
chart.o=chart.c.map(v=>v-8); chart.h=chart.c.map(v=>v+15); chart.l=chart.c.map(v=>v-20); chart.v=chart.c.map((_,i)=>100000+i*100); chart.n=chart.c.map((_,i)=>20000+i*8);
