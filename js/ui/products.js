/* ===== KELOLA PRODUK ===== */
let prodCat='lpg';

function renderProducts(){
  if(me.role!=='superadmin') return `<div class="card"><div class="empty"><div class="ico"><i class="bi bi-slash-circle"></i></div>Hanya Super Admin yang dapat mengelola produk.</div></div>`;
  if(!S.schemaV3) return schemaMissingCard();
  const list=productsOf(prodCat,true);
  const rows=list.map(p=>{
    const used=S.transactions.some(t=>t.tabung===p.name)||S.transfers.some(x=>x.items.some(i=>i.product===p.name));
    const total=S.regions.reduce((a,r)=>a+stockNow(r,p.name,goodStatus(prodCat)),0);
    const locked=PROTECTED_PRODUCTS.includes(p.id);
    return `<tr>
      <td><b>${esc(p.name)}</b>${p.active?'':' <span class="badge badge-kosong">Nonaktif</span>'}</td>
      <td>${fmtNum(total)} ${catMeta(prodCat).unit}</td>
      <td>${p.minStock?fmtNum(p.minStock):'<span class="muted">Tidak diatur</span>'}</td>
      <td class="td-end"><div class="row-actions">
        <button class="btn btn-ghost btn-sm" onclick="openProductForm('${p.id}')"><i class="bi bi-pencil"></i> Edit</button>
        ${!locked&&!used?`<button class="icon-btn icon-btn-sm" onclick="confirmDeleteProduct('${p.id}')" aria-label="Hapus"><i class="bi bi-trash3"></i></button>`:''}
      </div></td>
    </tr>`;
  }).join('');
  return `
  <div class="page-head">
    <div><h1>Kelola Produk</h1><p>Daftar produk yang dipantau per kategori.</p></div>
    <button class="btn btn-primary" onclick="openProductForm()"><i class="bi bi-plus-lg"></i> Tambah Produk</button>
  </div>
  <div class="toolbar">
    <div class="seg">${CATEGORY_KEYS.map(c=>`<button class="seg-btn${prodCat===c?' active':''}" onclick="prodCat='${c}';setContent(renderProducts())"><i class="bi ${catMeta(c).icon}"></i> ${catMeta(c).label}</button>`).join('')}</div>
  </div>
  <div class="card card-flush"><div class="monitor-wrap"><table class="riwayat-tbl">
    <tr><th>Nama</th><th>Stok ${esc(goodStatus(prodCat))} (semua gudang)</th><th>Batas minimum per gudang</th><th></th></tr>
    ${rows||`<tr><td colspan="4" class="empty">Belum ada produk pada kategori ini</td></tr>`}
  </table></div></div>
  <p class="field-note">Produk yang sudah punya riwayat tidak bisa dihapus, tetapi bisa dinonaktifkan. Batas minimum memunculkan peringatan di Dashboard.</p>`;
}
function openProductForm(id){
  const p=id?S.products.find(x=>x.id===id):null;
  const locked=p&&PROTECTED_PRODUCTS.includes(p.id);
  setModal(`<div class="modal-bg" onclick="if(event.target===this)setModal('')">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>${p?'Edit Produk':'Tambah Produk'}</h4><button class="modal-close" onclick="setModal('')"><i class="bi bi-x-lg"></i></button></div>
      <div class="field"><label>Kategori</label><input value="${escAttr(catMeta(p?p.category:prodCat).label)}" readonly></div>
      <div class="field"><label>Nama Produk</label><input id="pf-name" value="${escAttr(p?p.name:'')}" placeholder="Contoh: Fastron 4 L"${locked?' readonly':''}>
        ${locked?'<p class="field-note">Nama ini dipakai modul Kontrol Surabaya, jadi tidak bisa diubah.</p>':''}</div>
      <div class="field"><label>Batas Minimum per Gudang</label><input id="pf-min" type="number" min="0" value="${escAttr(p?p.minStock:0)}"></div>
      ${p&&!locked?`<div class="field"><label class="check-row"><input type="checkbox" id="pf-active"${p.active?' checked':''}> Aktif dan muncul di form input</label></div>`:''}
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="setModal('')">Batal</button>
        <button class="btn btn-primary" onclick="submitProduct(${p?`'${p.id}'`:'null'})">Simpan</button>
      </div>
    </div></div>`);
}
async function submitProduct(id){
  const p=id?S.products.find(x=>x.id===id):null;
  const name=document.getElementById('pf-name').value.trim();
  const minStock=Math.max(0,parseInt(document.getElementById('pf-min').value)||0);
  const activeEl=document.getElementById('pf-active');
  if(!name){ showAlert('Nama produk wajib diisi','error'); return; }
  /* "_" dipakai sebagai pemisah kunci S.stokAwal. */
  if(name.includes('_')){ showAlert('Nama produk tidak boleh memakai garis bawah','error'); return; }
  if(S.products.some(x=>x.name===name&&x.id!==id)){ showAlert('Nama produk sudah dipakai','error'); return; }
  try{
    if(p){
      if(p.name!==name) await renameProduct(p.id,name);
      await saveProduct({...p,name,minStock,active:activeEl?activeEl.checked:p.active});
      await writeLog('EDIT_PRODUK',`${name} (${catMeta(p.category).label})`);
    } else {
      const sortOrder=productsOf(prodCat,true).length;
      await saveProduct({id:gid(),category:prodCat,name,sortOrder,minStock,active:true});
      await writeLog('TAMBAH_PRODUK',`${name} (${catMeta(prodCat).label})`);
    }
    setModal(''); setContent(renderProducts()); showAlert('Produk disimpan');
  }catch(e){ showAlert('Gagal menyimpan: '+(e.message||e),'error'); }
}
function confirmDeleteProduct(id){
  const p=S.products.find(x=>x.id===id); if(!p) return;
  showConfirm({ico:'<i class="bi bi-trash3"></i>',title:'Hapus Produk',msg:`Hapus <b>${esc(p.name)}</b>?`,
    confirmLabel:'Ya, Hapus',confirmClass:'btn-danger',
    onConfirm:async()=>{
      try{ await deleteProduct(id); await writeLog('HAPUS_PRODUK',p.name); setContent(renderProducts()); showAlert('Produk dihapus'); }
      catch(e){ showAlert('Gagal menghapus: '+(e.message||e),'error'); }
    }});
}
