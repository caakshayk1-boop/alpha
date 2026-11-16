let gsap,Flip,ScrollTrigger,Lenis,autoAnimate,ready;
function engines(){return ready??=import('./vendor/motion.js').then(lib=>{({gsap,Flip,ScrollTrigger,Lenis,autoAnimate}=lib);gsap.registerPlugin(Flip,ScrollTrigger);});}
let context,lenis,tick,controllers=[],seen=new Set(),activeTransition;
const reduced=()=>document.documentElement.dataset.motion==='reduce'||matchMedia('(prefers-reduced-motion: reduce)').matches;
export function mountMotion(page,reduce){
 if(!gsap){if(!reduce)engines().then(()=>{if(document.querySelector('main')?.dataset.page===page)mountMotion(page,reduced());});return;}
 context?.revert();controllers.forEach(c=>c.disable());controllers=[];if(tick)gsap.ticker.remove(tick);lenis?.destroy();lenis=null;
 if(reduce)return;
 if(['discover','company'].includes(page)&&matchMedia('(hover:hover) and (pointer:fine)').matches){lenis=new Lenis({autoRaf:false,duration:.65,anchors:false});tick=t=>lenis?.raf(t*1000);lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(tick);}
 document.querySelectorAll('#screen-table tbody,.research-cards,.journal-grid').forEach(el=>controllers.push(autoAnimate(el,{duration:150,easing:'cubic-bezier(.22,1,.36,1)'})));
 context=gsap.context(()=>{
 const moment=(key,selector,from)=>{if(seen.has(key)||!document.querySelector(selector))return;gsap.from(selector,{...from,duration:.32,ease:'power4.out',scrollTrigger:{trigger:selector,start:'top 92%',once:true,onEnter:()=>seen.add(key)}});};
 moment('dial','.dial-arc',{strokeDashoffset:100});moment('sectors','.weather-cell',{y:5,stagger:.02});moment('evidence:'+location.hash,'.evidence-bar',{scaleX:0,transformOrigin:'left'});
 const key='duel:'+Array.from(document.querySelectorAll('.compare-card')).map(e=>e.dataset.flipId).join();if(!seen.has(key)&&document.querySelector('.duel-bar')){seen.add(key);gsap.from('.duel-bar',{scaleX:0,transformOrigin:'center',duration:.32,ease:'power4.out'});}
 });
}
export function prepareShared(link){document.querySelectorAll('[style*="view-transition-name"]').forEach(e=>e.style.removeProperty('view-transition-name'));const row=link.closest('tr,.research-mobile-card');[[link.querySelector('strong'),'name'],[row?.querySelector('.numeric,.mobile-card-price>strong'),'price'],[row?.querySelector('[data-spark]'),'spark']].forEach(([e,k])=>{if(e){e.style.viewTransitionName='company-'+k;e.dataset.flipId='company-'+k;}});}
export async function routeTransition(update,reduce){
 activeTransition?.skipTransition();
 const names=()=>document.querySelectorAll('[data-shared]').forEach(e=>{e.style.viewTransitionName='company-'+e.dataset.shared;e.dataset.flipId='company-'+e.dataset.shared;});
 if(reduce){update();return;}
 if(document.startViewTransition){activeTransition=document.startViewTransition(()=>{update();names();});await activeTransition.updateCallbackDone;activeTransition.finished.catch(()=>{});}
 else {await engines();const state=Flip.getState('[data-flip-id]');update();names();Flip.from(state,{targets:'[data-flip-id]',duration:.42,ease:'power4.out',absolute:true});}
}
export function compareFlip(update,reduce){if(reduce||!gsap){update();return;}const state=Flip.getState('.compare-card');update();Flip.from(state,{targets:'.compare-card',duration:.32,ease:'power4.out',absolute:true,onEnter:els=>gsap.from(els,{opacity:0,y:8,duration:.2})});}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>mountMotion(document.querySelector('main')?.dataset.page,reduced()));
// Reuse keyed rows across full route renders so AutoAnimate observes actual list changes.
export function retainList(previous,selector){const next=document.querySelector(selector);if(!previous||!next)return;const key=e=>e.querySelector('[data-company]')?.dataset.company||e.querySelector('a[href*="/company/"]')?.getAttribute('href');const old=new Map([...previous.children].map(e=>[key(e),e])),wanted=[...next.children];next.replaceWith(previous);const keep=new Set();for(const child of wanted){const id=key(child),existing=old.get(id);if(existing&&existing.innerHTML===child.innerHTML){keep.add(existing);previous.append(existing);}else{keep.add(child);previous.append(child);}}for(const child of [...previous.children])if(!keep.has(child))child.remove();}
