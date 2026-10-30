/* ===== CONFIG / CONSTANTS ===== */
const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
let REGIONS=['Ternate','Tobelo','Tidore','Morotai','Bacan'];
const CUR_YEAR=new Date().getFullYear();

/* ===== KATEGORI PRODUK =====
   Nama produk disimpan di kolom "tabung" (transaksi & stok awal), sehingga
   compute.js dan laporan tetap sama untuk semua kategori. TABUNGS & STATUSES
   adalah cermin kategori aktif (lihat syncCategoryLists). */
const CATEGORIES={
  lpg:{label:'LPG',short:'LPG',icon:'bi-fire',unit:'tabung',itemLabel:'Jenis Tabung',statusLabel:'Status Tabung',
    statuses:['ISI','KOSONG','BOCOR']},
  pelumas_retail:{label:'Pelumas Retail',short:'Retail',icon:'bi-droplet-half',unit:'pcs',itemLabel:'Produk',statusLabel:'Kondisi',
    statuses:['BAIK','RUSAK']},
  pelumas_drum:{label:'Pelumas Drum',short:'Drum',icon:'bi-database',unit:'drum',itemLabel:'Produk',statusLabel:'Kondisi',
    statuses:['ISI','KOSONG','RUSAK']}
};
const CATEGORY_KEYS=Object.keys(CATEGORIES);
const DEFAULT_PRODUCTS=[
  {id:'p-lpg-50',category:'lpg',name:'50 KG',sortOrder:0,minStock:0,active:true},
  {id:'p-lpg-12',category:'lpg',name:'12 KG',sortOrder:1,minStock:0,active:true},
  {id:'p-lpg-55',category:'lpg',name:'5.5 KG',sortOrder:2,minStock:0,active:true}
];
/* Dipakai hardcoded oleh modul Surabaya & import, jadi tidak boleh diganti nama. */
const PROTECTED_PRODUCTS=['p-lpg-50','p-lpg-12','p-lpg-55'];

const TABUNGS=['50 KG','12 KG','5.5 KG'];
const STATUSES=['ISI','KOSONG','BOCOR'];
let activeCategory='lpg';

/* Halaman yang hanya berlaku untuk LPG. */
function pageLockedToLpg(){
  return /surabaya-|pinjaman|penerimaan|import/.test(window.location.pathname);
}
/* Halaman yang menampilkan pilihan kategori di topbar. */
function pageHasCategorySwitch(){
  return /dashboard|masuk|keluar|riwayat|pengantaran|rekap|harian/.test(window.location.pathname);
}
function catMeta(cat){ return CATEGORIES[cat||activeCategory]||CATEGORIES.lpg; }
function setActiveCategory(cat){
  activeCategory=CATEGORIES[cat]?cat:'lpg';
  document.documentElement.setAttribute('data-cat',activeCategory);
  STATUSES.splice(0,STATUSES.length,...catMeta().statuses);
}
function pickCategory(cat){
  try{ localStorage.setItem('lpg_category',cat); }catch(e){}
  window.location.reload();
}
(function(){
  let c='lpg';
  try{ c=localStorage.getItem('lpg_category')||'lpg'; }catch(e){}
  setActiveCategory(pageLockedToLpg()?'lpg':c);
})();

/* Tanggal lokal (YYYY-MM-DD). toISOString() memakai UTC, sehingga di WIT
   tanggal masih "kemarin" sampai pukul 09.00. */
function localDate(d){
  d=d||new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* Label fitur penjualan / pengantaran / pinjaman */
const SALE_TYPE_LABEL     = { penjualan:'Penjualan', pindah_gudang:'Pindah Gudang' };
const PURCHASE_TYPE_LABEL = { isi:'Beli Isi (refill)', isi_tabung:'Beli Isi + Tabung' };
const DELIVERY_LABEL      = { belum:'Belum Terantar', terantar:'Sudah Terantar' };
const ROLE_LABEL          = { superadmin:'Super Admin', operator:'Admin Gudang', sopir:'Sopir' };

const SB_URL='https://mpdtlufbtahnrmzisggs.supabase.co';
const SB_ANON='sb_publishable_0s7XVtHpxblOeZY5uYTyBw_HA1eyie7';

/* ===== TEMA (terang / gelap) ===== */
function getTheme(){
  return document.documentElement.getAttribute('data-theme')==='dark' ? 'dark' : 'light';
}
function applyTheme(theme){
  const t = theme==='dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem('lpg_theme_v2', t); }catch(e){}
  if(typeof updateThemeToggleUI==='function') updateThemeToggleUI();
}
function toggleTheme(){
  applyTheme(getTheme()==='light' ? 'dark' : 'light');
}
/* Terapkan tema tersimpan SEGERA (config.js = skrip pertama tiap halaman),
   supaya minim kedip sebelum konten dirender. Default: putih. Key baru agar
   pilihan gelap lama tidak menimpa default ini. */
(function(){
  let t='light';
  try{
    if(localStorage.getItem('lpg_theme_v2')==='dark') t='dark';
    if(localStorage.getItem('lpg_sidebar')==='closed') document.documentElement.classList.add('sb-closed');
  }catch(e){}
  document.documentElement.setAttribute('data-theme', t);
})();
