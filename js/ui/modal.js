/* ===== MODAL ===== */
function renderModal(){
  if(!modalSt) return '';

  /* --- TAMBAH REGION --- */
  if(modalSt.t==='addRegion'){
    return `<div class="modal-bg" onclick="if(event.target===this){modalSt=null;render()}">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header"><h4><i class="bi bi-buildings"></i> Tambah Region Baru</h4><button class="modal-close" onclick="modalSt=null;render()"><i class="bi bi-x-lg"></i></button></div>
        <div class="field"><label>Nama Region / Gudang</label><input id="m-reg-new" placeholder="Contoh: Halmahera Selatan" autofocus onkeydown="if(event.key==='Enter')addRegion()"></div>
        <p style="font-size:11px;color:var(--muted);margin-bottom:16px">Nama akan muncul di menu rekap dan sebagai pilihan saat input transaksi.</p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" onclick="addRegion()"><i class="bi bi-check-circle"></i> Tambah Region</button>
          <button class="btn btn-ghost" onclick="modalSt=null;render()">Batal</button>
        </div>
      </div>
    </div>`;
  }

  /* --- EDIT REGION --- */
  if(modalSt.t==='editRegion'){
    return `<div class="modal-bg" onclick="if(event.target===this){modalSt=null;render()}">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header"><h4><i class="bi bi-pencil"></i> Edit Nama Region</h4><button class="modal-close" onclick="modalSt=null;render()"><i class="bi bi-x-lg"></i></button></div>
        <div style="margin-bottom:14px;padding:8px 12px;background:color-mix(in srgb,var(--accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:7px;font-size:12px;color:var(--accent)">
          <i class="bi bi-geo-alt"></i> Region saat ini: <b>${esc(modalSt.name)}</b>
        </div>
        <div class="field"><label>Nama Baru</label><input id="m-reg-edit" value="${escAttr(modalSt.name)}" autofocus onkeydown="if(event.key==='Enter')saveEditRegion()"></div>
        <p style="font-size:11px;color:var(--muted);margin-bottom:16px">Semua data transaksi dan user yang terkait akan diperbarui otomatis.</p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" onclick="saveEditRegion()"><i class="bi bi-floppy"></i> Simpan Perubahan</button>
          <button class="btn btn-ghost" onclick="modalSt=null;render()">Batal</button>
        </div>
      </div>
    </div>`;
  }

  /* --- TAMBAH USER --- */
  if(modalSt.t==='addUser'){
    const regOpts=(S.regions||REGIONS).map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
    return `<div class="modal-bg" onclick="if(event.target===this){modalSt=null;render()}">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header"><h4><i class="bi bi-person"></i> Tambah User Baru</h4><button class="modal-close" onclick="modalSt=null;render()"><i class="bi bi-x-lg"></i></button></div>
        <div class="field"><label>Nama Lengkap</label><input id="mn" placeholder="Nama lengkap..."></div>
        <div class="field"><label>Username</label><input id="mu" placeholder="username (tanpa spasi)"></div>
        <div class="field"><label>Password</label><input id="mp" type="password" placeholder="password"></div>
        <div class="field"><label>Role</label>
          <select id="mr" onchange="document.getElementById('mrw').style.display=this.value==='superadmin'?'none':'block';document.getElementById('mreg-none').hidden=this.value!=='sopir'">
            <option value="operator">Admin Gudang</option>
            <option value="sopir">Sopir</option>
            <option value="superadmin">Super Admin</option>
          </select>
        </div>
        <div class="field" id="mrw"><label>Region Gudang</label><select id="mreg"><option value="" id="mreg-none" hidden>Tanpa gudang</option>${regOpts}</select></div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-primary" onclick="saveNewUser()"><i class="bi bi-floppy"></i> Simpan</button>
          <button class="btn btn-ghost" onclick="modalSt=null;render()">Batal</button>
        </div>
      </div>
    </div>`;
  }

  /* --- EDIT USER --- */
  if(modalSt.t==='editUser'){
    const u=S.users.find(x=>x.id===modalSt.userId);
    if(!u) return '';
    const regOpts=(S.regions||REGIONS).map(r=>`<option value="${escAttr(r)}" ${u.region===r?'selected':''}>${esc(r)}</option>`).join('');
    const isSAUser=u.role==='superadmin';
    return `<div class="modal-bg" onclick="if(event.target===this){modalSt=null;render()}">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header"><h4><i class="bi bi-pencil"></i> Edit User</h4><button class="modal-close" onclick="modalSt=null;render()"><i class="bi bi-x-lg"></i></button></div>
        <div style="margin-bottom:14px;padding:8px 12px;background:color-mix(in srgb,var(--info) 8%,transparent);border:1px solid color-mix(in srgb,var(--info) 20%,transparent);border-radius:7px;font-size:11px;color:var(--info)">
          <i class="bi bi-key"></i> Editing: <b>${esc(u.username)}</b> ${u.id==='sa'?'<span style="color:var(--accent)">(akun default – username tidak bisa diubah)</span>':''}
        </div>
        <div class="field"><label>Nama Lengkap</label><input id="eu-name" value="${escAttr(u.name)}" placeholder="Nama lengkap..."></div>
        <div class="field"><label>Username</label><input id="eu-user" value="${escAttr(u.username)}" ${u.id==='sa'?'readonly style="opacity:.5;cursor:not-allowed"':''} placeholder="username"></div>
        <div class="field"><label>Password Baru <span style="color:var(--muted);font-weight:400;text-transform:none">(kosongkan jika tidak diganti)</span></label>
          <input id="eu-pass" type="password" placeholder="••••••••"></div>
        <div class="field"><label>Role</label>
          <select id="eu-role" ${u.id==='sa'?'disabled style="opacity:.5"':''} onchange="document.getElementById('eu-regwrap').style.display=this.value==='superadmin'?'none':'block';document.getElementById('eu-reg-none').hidden=this.value!=='sopir'">
            <option value="operator" ${u.role==='operator'?'selected':''}>Admin Gudang</option>
            <option value="sopir" ${u.role==='sopir'?'selected':''}>Sopir</option>
            <option value="superadmin" ${isSAUser?'selected':''}>Super Admin</option>
          </select>
        </div>
        <div class="field" id="eu-regwrap" style="display:${isSAUser?'none':'block'}">
          <label>Region Gudang</label><select id="eu-reg"><option value="" id="eu-reg-none"${u.role==='sopir'?'':' hidden'}${u.role==='sopir'&&!u.region?' selected':''}>Tanpa gudang</option>${regOpts}</select>
        </div>
        <div style="display:flex;gap:8px;margin-top:18px">
          <button class="btn btn-primary" onclick="saveEditUser('${u.id}')"><i class="bi bi-floppy"></i> Simpan Perubahan</button>
          <button class="btn btn-ghost" onclick="modalSt=null;render()">Batal</button>
        </div>
      </div>
    </div>`;
  }
  return '';
}
