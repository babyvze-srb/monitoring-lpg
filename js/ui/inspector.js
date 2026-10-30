/* ===== ALAT TUNJUK TAMPILAN =====
   Tahan Alt untuk menyorot bagian halaman, klik untuk menulis perubahan yang
   diinginkan, lalu Salin untuk ditempel ke chat. Hanya aktif di localhost,
   dan gayanya ada di file ini supaya mudah dilepas dari aplikasi. */
(function(){
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)) return;

  const STYLE=`
  #insp-box{position:fixed;z-index:2147483000;pointer-events:none;display:none;border:2px solid var(--accent);border-radius:3px;background:color-mix(in srgb,var(--accent) 12%,transparent);}
  #insp-tag{position:fixed;z-index:2147483001;pointer-events:none;display:none;max-width:min(320px,calc(100vw - 16px));padding:3px 7px;border-radius:5px;background:var(--text);color:var(--bg);font:500 11.5px/1.4 'Geist Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  html.insp-on,html.insp-on *{cursor:crosshair!important;}
  #insp-pop{position:fixed;z-index:2147483002;display:none;width:min(360px,calc(100vw - 32px));padding:14px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.35);font-size:13px;}
  #insp-pop .insp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-weight:600;}
  #insp-pop .insp-target{margin-bottom:10px;padding:7px 9px;background:var(--surface2);border-radius:6px;color:var(--muted);font:12px/1.45 'Geist Mono',monospace;word-break:break-word;max-height:76px;overflow:auto;}
  #insp-pop textarea{display:block;width:100%;min-height:84px;margin-bottom:10px;resize:vertical;}
  #insp-pop .insp-actions{display:flex;gap:8px;}
  #insp-pop .insp-actions .btn-primary{flex:1;justify-content:center;}
  #insp-pop .btn:disabled{opacity:.5;cursor:not-allowed;}`;

  let box,tag,pop,note,target,copyBtn;
  let hovered=null,picked=null,pickedInfo=null,lastX=-1,lastY=-1,usedAlt=false;

  function build(){
    const st=document.createElement('style'); st.textContent=STYLE; document.head.appendChild(st);
    box=document.createElement('div'); box.id='insp-box';
    tag=document.createElement('div'); tag.id='insp-tag';
    pop=document.createElement('div'); pop.id='insp-pop'; pop.setAttribute('role','dialog'); pop.setAttribute('aria-label','Perubahan tampilan');
    pop.innerHTML=`<div class="insp-head"><span><i class="bi bi-cursor"></i> Perubahan yang diinginkan</span>
        <button type="button" class="modal-close" id="insp-close" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
      <div class="insp-target" id="insp-target"></div>
      <textarea id="insp-note" placeholder="Contoh: buat tombol ini lebih besar dan warnanya hijau"></textarea>
      <div class="insp-actions">
        <button type="button" class="btn btn-primary" id="insp-copy" disabled><i class="bi bi-clipboard"></i> Salin</button>
        <button type="button" class="btn btn-ghost" id="insp-cancel">Batal</button>
      </div>`;
    document.body.append(box,tag,pop);
    note=pop.querySelector('#insp-note'); target=pop.querySelector('#insp-target'); copyBtn=pop.querySelector('#insp-copy');
    note.addEventListener('input',()=>{ copyBtn.disabled=!note.value.trim(); });
    note.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.ctrlKey&&!copyBtn.disabled) copy(); });
    copyBtn.addEventListener('click',copy);
    pop.querySelector('#insp-close').addEventListener('click',closePop);
    pop.querySelector('#insp-cancel').addEventListener('click',closePop);
  }

  const inTool=el=>!!(el&&el.closest&&el.closest('#insp-pop'));
  const popOpen=()=>pop.style.display==='block';
  const clean=(s,n)=>{ const t=String(s||'').replace(/\s+/g,' ').trim(); return t.length>n?t.slice(0,n)+'…':t; };

  function selectorOf(el){
    const parts=[];
    for(let n=el;n&&n.nodeType===1&&n!==document.documentElement&&parts.length<6;n=n.parentElement){
      if(n.id){ parts.unshift('#'+n.id); break; }
      let p=n.tagName.toLowerCase();
      const cls=[...n.classList].slice(0,2);
      if(cls.length) p+='.'+cls.join('.');
      const same=n.parentElement?[...n.parentElement.children].filter(c=>c.tagName===n.tagName):[];
      if(same.length>1) p+=`:nth-of-type(${same.indexOf(n)+1})`;
      parts.unshift(p);
    }
    return parts.join(' > ');
  }
  function shortName(el){
    const cls=[...el.classList].slice(0,2).map(c=>'.'+c).join('');
    return el.tagName.toLowerCase()+(el.id?'#'+el.id:cls);
  }
  /* Isi kolom input tidak pernah ikut disalin, hanya label dan placeholder-nya. */
  function textOf(el){
    if(el.matches('input,textarea,select')){
      const f=el.closest('.field'), lb=f&&f.querySelector('label');
      return clean((lb?lb.textContent:'')||el.getAttribute('placeholder')||el.getAttribute('aria-label'),120);
    }
    return clean(el.innerText||el.getAttribute('aria-label')||el.getAttribute('title'),120);
  }
  function describe(el){
    const r=el.getBoundingClientRect();
    return {name:shortName(el),selector:selectorOf(el),text:textOf(el),size:`${Math.round(r.width)} x ${Math.round(r.height)} px`,
      page:clean(document.title,80),path:location.pathname.replace(/^\/monitoring-lpg-main\//,''),
      category:document.documentElement.getAttribute('data-cat')||''};
  }

  function drawBox(el){
    if(!el||!el.isConnected){ box.style.display='none'; tag.style.display='none'; return; }
    const r=el.getBoundingClientRect();
    Object.assign(box.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    if(el===picked){ tag.style.display='none'; return; }
    tag.textContent=`${shortName(el)}  ${Math.round(r.width)}×${Math.round(r.height)}`;
    tag.style.display='block';
    const th=tag.offsetHeight, tw=tag.offsetWidth;
    tag.style.left=Math.max(8,Math.min(r.left,innerWidth-tw-8))+'px';
    tag.style.top=(r.top-th-4>=8?r.top-th-4:Math.min(r.bottom+4,innerHeight-th-8))+'px';
  }
  function setInspecting(on){
    document.documentElement.classList.toggle('insp-on',on);
    if(!on){ hovered=null; drawBox(popOpen()?picked:null); }
  }
  function hoverAt(x,y){
    const el=document.elementFromPoint(x,y);
    if(!el||inTool(el)||el===document.documentElement) return;
    hovered=el; drawBox(el);
  }
  function placePop(r){
    pop.style.display='block';
    const w=pop.offsetWidth,h=pop.offsetHeight,g=10;
    let top=r.bottom+g;
    if(top+h>innerHeight-g) top=r.top-h-g;
    if(top<g) top=Math.max(g,(innerHeight-h)/2);
    pop.style.left=Math.max(16,Math.min(r.left,innerWidth-w-16))+'px';
    pop.style.top=top+'px';
  }
  function openPop(el){
    picked=el; pickedInfo=describe(el);
    target.textContent=pickedInfo.text?`${pickedInfo.name}: "${pickedInfo.text}"`:pickedInfo.name;
    note.value=''; copyBtn.disabled=true;
    placePop(el.getBoundingClientRect());
    drawBox(el);
    note.focus();
  }
  function closePop(){
    pop.style.display='none'; picked=null; pickedInfo=null;
    resetCopyBtn(); drawBox(null);
  }
  function resetCopyBtn(){ copyBtn.innerHTML='<i class="bi bi-clipboard"></i> Salin'; }

  function buildText(){
    const i=pickedInfo;
    return ['Perubahan tampilan:',note.value.trim(),'',
      `Halaman: ${i.page} (${i.path})`+(i.category?` | Kategori: ${i.category}`:''),
      `Elemen: ${i.name}`,
      i.text?`Teks: "${i.text}"`:null,
      `Selector: ${i.selector}`,
      `Ukuran: ${i.size}`].filter(l=>l!==null).join('\n');
  }
  async function writeClipboard(text){
    try{ await navigator.clipboard.writeText(text); return true; }
    catch(e){
      const ta=document.createElement('textarea'); ta.value=text; pop.appendChild(ta); ta.select();
      let ok=false; try{ ok=document.execCommand('copy'); }catch(e2){}
      ta.remove(); return ok;
    }
  }
  async function copy(){
    const ok=await writeClipboard(buildText());
    if(!ok){
      if(typeof showAlert==='function') showAlert('Gagal menyalin. Salin teksnya secara manual dari kotak ini.','error');
      note.value=buildText(); note.select(); return;
    }
    copyBtn.innerHTML='<i class="bi bi-check-lg"></i> Tersalin, tempel di chat';
    setTimeout(closePop,1200);
  }

  /* Mousemove juga membawa status Alt, jadi tetap jalan walau fokus keyboard
     sedang di luar halaman (misalnya di panel chat). */
  document.addEventListener('mousemove',e=>{
    lastX=e.clientX; lastY=e.clientY;
    const on=e.altKey&&!e.ctrlKey;
    if(on){ setInspecting(true); hoverAt(lastX,lastY); }
    else if(hovered) setInspecting(false);
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&popOpen()){ e.preventDefault(); e.stopPropagation(); closePop(); return; }
    if(e.key==='Alt'&&!e.ctrlKey&&lastX>=0){ setInspecting(true); hoverAt(lastX,lastY); }
  },true);
  document.addEventListener('keyup',e=>{
    if(e.key!=='Alt') return;
    setInspecting(false);
    if(usedAlt){ e.preventDefault(); usedAlt=false; } /* cegah fokus pindah ke menu browser */
  },true);
  window.addEventListener('blur',()=>setInspecting(false));
  window.addEventListener('scroll',()=>{
    if(popOpen()) drawBox(picked); else if(hovered) drawBox(hovered);
  },true);
  window.addEventListener('resize',()=>{ if(popOpen()&&picked) placePop(picked.getBoundingClientRect()); });

  /* Saat Alt ditahan, klik hanya menunjuk: tombol dan tautan di halaman tidak ikut jalan. */
  const swallow=e=>{
    if(!e.altKey||e.ctrlKey||inTool(e.target)) return;
    e.preventDefault(); e.stopPropagation();
  };
  ['pointerdown','mousedown','mouseup','pointerup','dblclick','auxclick','dragstart'].forEach(t=>document.addEventListener(t,swallow,true));
  document.addEventListener('click',e=>{
    if(!e.altKey||e.ctrlKey||inTool(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    const el=document.elementFromPoint(e.clientX,e.clientY);
    if(!el||el===document.documentElement||inTool(el)) return;
    usedAlt=true;
    hovered=null;
    openPop(el);
  },true);

  if(document.body) build(); else document.addEventListener('DOMContentLoaded',build);
})();
