"""Independent Python reference calculation; reads captured source history, never app code."""
import json, pathlib, datetime
root=pathlib.Path('docs/apexpro/ultimatum/proof/data'); known={}
for symbol in ['RELIANCE','TCS','INFY']:
 d=json.loads((root/(symbol+'.json')).read_text()); points=sorted({t:(c,d.get('h',[None]*len(d['t']))[i]) for i,(t,c) in enumerate(zip(d['t'],d['c'])) if isinstance(c,(int,float)) and c>0}.items()); i=len(points)-101; past=points[:i+1]; prices=[x[1][0] for x in past]; gains=[max(b-a,0) for a,b in zip(prices,prices[1:])];losses=[max(a-b,0) for a,b in zip(prices,prices[1:])];g=sum(gains[:14])/14;l=sum(losses[:14])/14
 for gain,loss in zip(gains[14:],losses[14:]):g=(g*13+gain)/14;l=(l*13+loss)/14
 t=past[-1][0];hi=max(x[1][1] for x in past if x[0]>=t-364*86400);ma={str(n):sum(prices[-n:])/n for n in [20,50,200]}
 known[symbol]={'date':datetime.datetime.fromtimestamp(t,datetime.timezone.utc).isoformat()[:10],'t':t,'index':i,'close':prices[-1],'rsi':100-100/(1+g/l),'sma20':ma['20'],'sma50':ma['50'],'sma200':ma['200'],'high52':hi,'distance':(prices[-1]/hi-1)*100,'trend':'Uptrend' if prices[-1]>ma['50']>ma['200'] else 'Downtrend' if prices[-1]<ma['50']<ma['200'] else 'Mixed'}
pathlib.Path('docs/apexpro/ultimatum/proof/as-of-known.json').write_text(json.dumps(known,indent=2));print(json.dumps(known,indent=2))
