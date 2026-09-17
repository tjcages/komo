
const stages=[...document.querySelectorAll('[data-motion]')];let mode='soft';let timer;
const descriptions={soft:'A gentle squeeze, a fuller lift, a soft landing.',ripple:'A small wave travels through the letters.',wiggle:'A quick hello, with a little elastic follow-through.'};
function replay(){clearTimeout(timer);stages.forEach(s=>s.classList.remove('play'));void document.body.offsetWidth;stages.forEach(s=>{s.dataset.motion=mode;s.classList.add('play')});timer=setTimeout(()=>stages.forEach(s=>s.classList.remove('play')),1050)}
document.querySelectorAll('[data-style]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.style;document.querySelectorAll('[data-style]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));document.querySelector('#description').textContent=descriptions[mode];document.querySelector('#download').href='komo-'+mode+'.svg';replay()}));
document.querySelector('#replay').onclick=replay;
document.querySelectorAll('.wordmark').forEach(s=>{s.addEventListener('pointerenter',()=>{if(!stages[0].classList.contains('play'))replay()});s.addEventListener('click',replay)});
document.querySelector('#theme').onclick=e=>{const dark=document.querySelector('.stage').classList.toggle('dark');e.currentTarget.textContent=dark?'Light preview':'Dark preview';e.currentTarget.setAttribute('aria-pressed',String(dark))};
replay();
