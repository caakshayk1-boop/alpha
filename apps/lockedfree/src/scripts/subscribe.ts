// Keep native form submission usable with JavaScript disabled.
const form=document.querySelector<HTMLFormElement>('[data-subscribe]');
const msg=form?.querySelector<HTMLElement>('[data-subscribe-msg]');
const button=form?.querySelector<HTMLButtonElement>('button[type=submit]');
if(form && msg && button) form.addEventListener('submit',async e=>{
  e.preventDefault();if(button.disabled)return;
  const data=new FormData(form);button.disabled=true;button.textContent='Saving…';form.setAttribute('aria-busy','true');msg.textContent='';
  try{const r=await fetch('/api/subscribe',{method:'POST',headers:{accept:'application/json'},body:data,signal:AbortSignal.timeout(15000)}),reply=await r.json();
    if(r.ok && reply.ok===true){msg.textContent=reply.delivery==='confirmation'?'Confirmation requested. Check your inbox.':'Interest recorded. Email delivery is not active for this signup.';form.reset();}
    else msg.textContent=reply.error||'Signup could not be confirmed. Please try again.';}
  catch{msg.textContent='We could not confirm your signup. You can retry safely with the same address.';}
  finally{button.disabled=false;button.textContent='Join the list';form.removeAttribute('aria-busy');}
});
