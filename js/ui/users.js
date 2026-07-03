/* ===== USERS ===== */
function renderUsers(){
  if(me.role!=='superadmin') return `<div class="card"><p style="text-align:center;padding:32px;color:var(--muted)">🚫 Hanya Super Admin yang dapat mengelola user.</p></div>`;
  const rows=S.users.map(u=>`<tr>
    <td style="font-size:12px">${esc(u.username)}</td>
    <td style="font-size:12px">${esc(u.name)}</td>
    <td><span class="badge ${u.role==='superadmin'?'badge-isi':'badge-kosong'}">${u.role==='superadmin'?'⚡ Super Admin':'👷 Operator'}</span></td>
    <td style="font-size:12px">${esc(u.region)||'—'}</td>
    <td>
      <div style="display:flex;gap:5px">
        <button class="btn btn-blue btn-sm" onclick="openEditUser('${u.id}')">✏️ Edit</button>
        ${u.id!=='sa'?`<button class="btn btn-danger btn-sm" onclick="confirmDelUser('${u.id}')">🗑</button>`:'-'}
      </div>
    </td>
  </tr>`).join('');
  return `
  <div class="stats-grid" style="margin-bottom:14px">
    <div class="stat-card stat-blue"><div class="val">${S.users.length}</div><div class="lbl">Total Pengguna</div></div>
    <div class="stat-card stat-orange"><div class="val">${S.users.filter(u=>u.role==='superadmin').length}</div><div class="lbl">Super Admin</div></div>
    <div class="stat-card stat-green"><div class="val">${S.users.filter(u=>u.role==='operator').length}</div><div class="lbl">Operator</div></div>
  </div>
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between">
      <span>👥 Daftar User</span>
      <button class="btn btn-primary btn-sm" onclick="modalSt={t:'addUser'};render()">+ Tambah User</button>
    </div>
    <div class="monitor-wrap">
      <table class="riwayat-tbl">
        <tr><th>Username</th><th>Nama</th><th>Role</th><th>Region</th><th>Aksi</th></tr>
        ${rows}
      </table>
    </div>
  </div>
  <div class="alert alert-info">ℹ️ Operator hanya bisa mengakses dan menginput data region yang ditugaskan.</div>`;
}

function openEditUser(id){ const u=S.users.find(x=>x.id===id); if(!u)return; modalSt={t:'editUser',userId:id}; render(); }

function confirmDelUser(id){
  const u=S.users.find(x=>x.id===id);
  showConfirm({
    ico:'🗑️',title:'Hapus User',
    msg:`Yakin hapus user <b>${u?esc(u.name):''}</b> (${u?esc(u.username):''})?<br>Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel:'Ya, Hapus User',
    confirmClass:'btn-danger',
    onConfirm:async()=>{
      await deleteUser(id);
      if(u) await writeLog('HAPUS_USER',`User dihapus: ${u.name} (${u.username}) – ${u.role}${u.region?' – '+u.region:''}`);
      showAlert('🗑️ User dihapus');
      render();
    }
  });
}

async function saveNewUser(){
  const name=document.getElementById('mn').value.trim();
  const username=document.getElementById('mu').value.trim();
  const password=document.getElementById('mp').value.trim();
  const role=document.getElementById('mr').value;
  const region=role==='superadmin'?null:document.getElementById('mreg').value;
  if(!name||!username||!password){showAlert('❌ Semua field wajib diisi!','error');return;}
  if(S.users.find(u=>u.username===username)){showAlert('❌ Username sudah dipakai!','error');return;}
  showConfirm({
    ico:'👤', title:'Tambah User',
    msg:`Tambah user baru <b>${esc(name)}</b> (${esc(username)}) sebagai ${role==='superadmin'?'Super Admin':'Operator'}${region?' di region <b>'+esc(region)+'</b>':''}?`,
    confirmLabel:'Ya, Tambah', confirmClass:'btn-primary',
    onConfirm:async()=>{
      const newUser={id:gid(),username,name,role,region};
      if(useSupabase){
        const { error } = await SB.rpc('lpg_create_user',{p_id:newUser.id,p_username:username,p_password:password,p_name:name,p_role:role,p_region:region});
        if(error){
          if(rpcMissing(error)){ await SB.from('lpg_users').insert({id:newUser.id,username,password,name,role,region:region||null}); }
          else { showAlert('❌ Gagal menyimpan user: '+(error.message||error),'error'); return; }
        }
      }
      S.users.push(newUser);
      await writeLog('TAMBAH_USER',`User baru: ${name} (${username}) – ${role}${region?' – '+region:''}`);
      modalSt=null; render(); showAlert('✅ User berhasil ditambahkan!');
    }
  });
}

async function saveEditUser(id){
  const u=S.users.find(x=>x.id===id);
  if(!u){showAlert('❌ User tidak ditemukan','error');return;}
  const newName=document.getElementById('eu-name').value.trim();
  const newUser=(id==='sa')?u.username:document.getElementById('eu-user').value.trim();
  const newPass=document.getElementById('eu-pass').value.trim();
  const newRole=(id==='sa')?u.role:document.getElementById('eu-role').value;
  const newRegion=newRole==='superadmin'?null:document.getElementById('eu-reg').value;
  if(!newName||!newUser){showAlert('❌ Nama dan username tidak boleh kosong','error');return;}
  if(S.users.find(x=>x.username===newUser&&x.id!==id)){showAlert('❌ Username sudah dipakai user lain!','error');return;}
  const changes=[];
  if(u.name!==newName) changes.push(`Nama: "${u.name}"→"${newName}"`);
  if(u.username!==newUser) changes.push(`Username: "${u.username}"→"${newUser}"`);
  if(newPass) changes.push('Password diubah');
  if(u.role!==newRole) changes.push(`Role: ${u.role}→${newRole}`);
  if((u.region||'')!==(newRegion||'')) changes.push(`Region: "${u.region||'—'}"→"${newRegion||'—'}"`);
  if(!changes.length){showAlert('Tidak ada perubahan','error');return;}
  showConfirm({
    ico:'✏️', title:'Simpan Perubahan User',
    msg:`Simpan perubahan untuk user <b>${esc(newName)}</b>?<br><span style="font-size:11px;color:var(--muted)">${changes.map(esc).join('<br>')}</span>`,
    confirmLabel:'Ya, Simpan', confirmClass:'btn-primary',
    onConfirm:async()=>{
      if(useSupabase){
        const { error } = await SB.rpc('lpg_update_user',{p_id:id,p_username:newUser,p_name:newName,p_role:newRole,p_region:newRegion,p_password:newPass||null});
        if(error){
          if(rpcMissing(error)){
            const upd={name:newName,username:newUser,role:newRole,region:newRegion||null};
            if(newPass) upd.password=newPass;
            await SB.from('lpg_users').update(upd).eq('id',id);
          } else { showAlert('❌ Gagal memperbarui user: '+(error.message||error),'error'); return; }
        }
      }
      u.name=newName; u.username=newUser; u.role=newRole; u.region=newRegion;
      if(me&&me.id===id){ me.name=newName; me.username=newUser; me.role=newRole; me.region=newRegion; sessionStorage.setItem('lpg_me',JSON.stringify(me)); }
      await writeLog('EDIT_USER',`Edit user ${newUser} (${id}): ${changes.join(' | ')}`);
      modalSt=null; render(); showAlert(`✅ Data user "${newName}" berhasil diperbarui!`);
    }
  });
}
