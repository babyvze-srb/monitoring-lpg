/* ===== REGIONS ===== */
function renderRegions(){
  if(me.role!=='superadmin') return `<div class="card"><p style="text-align:center;padding:32px;color:var(--muted)">🚫 Hanya Super Admin yang dapat mengelola region.</p></div>`;
  const regs=S.regions||REGIONS;
  const rows=regs.map((r,i)=>{
    const txCount=S.transactions.filter(t=>t.region===r).length;
    const userCount=S.users.filter(u=>u.region===r).length;
    const canDelete=txCount===0&&userCount===0;
    return `<tr>
      <td><b>${i+1}</b></td>
      <td><b style="color:var(--text)">${esc(r)}</b></td>
      <td style="color:var(--muted)">${txCount} transaksi</td>
      <td style="color:var(--muted)">${userCount} operator</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-blue btn-sm" onclick="openEditRegion(${i})">✏️ Edit</button>
          ${canDelete?`<button class="btn btn-danger btn-sm" onclick="confirmDeleteRegion(${i})">🗑 Hapus</button>`:`<span style="font-size:11px;color:var(--muted);padding:5px 4px">Ada data</span>`}
        </div>
      </td>
    </tr>`;
  }).join('');
  return `
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between">
      <span>🗂️ Daftar Region / Gudang</span>
      <button class="btn btn-primary btn-sm" onclick="modalSt={t:'addRegion'};render()">+ Tambah Region</button>
    </div>
    <table class="riwayat-tbl">
      <tr><th>#</th><th>Nama Region</th><th>Transaksi</th><th>Operator</th><th>Aksi</th></tr>
      ${rows}
    </table>
  </div>
  <div class="alert alert-info">ℹ️ Region dengan data transaksi atau operator tidak bisa dihapus. Edit nama region menggunakan tombol <b>✏️ Edit</b>. Setelah tambah region baru, buat akun operator di menu <b>Kelola User</b>.</div>`;
}

function openEditRegion(idx){
  modalSt={t:'editRegion',idx,name:S.regions[idx]};
  render();
}

function confirmDeleteRegion(idx){
  const name=S.regions[idx];
  showConfirm({
    ico:'🗑️',title:'Hapus Region',
    msg:`Yakin hapus region <b>"${esc(name)}"</b>?<br>Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel:'Ya, Hapus Region',
    confirmClass:'btn-danger',
    onConfirm:async()=>{
      S.regions.splice(idx,1);
      REGIONS.splice(0,REGIONS.length,...S.regions);
      if(useSupabase) await SB.from('lpg_regions').delete().eq('name',name);
      await writeLog('HAPUS_REGION',`Region "${name}" dihapus`);
      showAlert(`🗑️ Region "${name}" dihapus`);
      render();
    }
  });
}

async function addRegion(){
  const inp=document.getElementById('m-reg-new');
  if(!inp)return;
  const name=inp.value.trim();
  if(!name){showAlert('❌ Nama region tidak boleh kosong','error');return;}
  if(S.regions.includes(name)){showAlert('❌ Region sudah ada!','error');return;}
  showConfirm({
    ico:'🗂️', title:'Tambah Region',
    msg:`Tambah region baru <b>"${esc(name)}"</b>?`,
    confirmLabel:'Ya, Tambah', confirmClass:'btn-primary',
    onConfirm:async()=>{
      S.regions.push(name);
      REGIONS.splice(0,REGIONS.length,...S.regions);
      await saveRegions();
      await writeLog('TAMBAH_REGION',`Region baru: "${name}"`);
      modalSt=null; render(); showAlert(`✅ Region "${esc(name)}" berhasil ditambahkan!`);
    }
  });
}

async function saveEditRegion(){
  const idx=modalSt.idx;
  const inp=document.getElementById('m-reg-edit');
  if(!inp) return;
  const newName=inp.value.trim();
  const oldName=S.regions[idx];
  if(!newName){showAlert('❌ Nama region tidak boleh kosong','error');return;}
  if(newName===oldName){modalSt=null;render();return;}
  if(S.regions.includes(newName)){showAlert('❌ Nama region sudah ada!','error');return;}
  S.regions[idx]=newName;
  S.transactions.forEach(t=>{ if(t.region===oldName)t.region=newName; });
  S.users.forEach(u=>{ if(u.region===oldName)u.region=newName; });
  const newStok={};
  Object.entries(S.stokAwal).forEach(([k,v])=>{ newStok[k.replace(oldName+'_',newName+'_')]=v; });
  S.stokAwal=newStok;
  if(me&&me.region===oldName){ me.region=newName; sessionStorage.setItem('lpg_me',JSON.stringify(me)); }
  REGIONS.splice(0,REGIONS.length,...S.regions);
  await updateTxRegion(oldName,newName);
  await saveRegions();
  await writeLog('RENAME_REGION',`"${oldName}" → "${newName}"`);
  modalSt=null; render();
  showAlert(`✅ Region "${esc(oldName)}" berhasil diubah menjadi "${esc(newName)}"`);
}
