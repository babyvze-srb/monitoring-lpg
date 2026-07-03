/* ===== CONFIG / CONSTANTS ===== */
const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
let REGIONS=['Ternate','Tobelo','Tidore','Morotai','Bacan'];
const TABUNGS=['50 KG','12 KG','5.5 KG'];
const STATUSES=['ISI','KOSONG','BOCOR'];
const CUR_YEAR=new Date().getFullYear();

/* Label fitur penjualan / pengantaran / pinjaman */
const SALE_TYPE_LABEL     = { penjualan:'🛒 Penjualan', pindah_gudang:'🔄 Pindah Gudang' };
const PURCHASE_TYPE_LABEL = { isi:'Beli Isi (refill)', isi_tabung:'Beli Isi + Tabung' };
const DELIVERY_LABEL      = { belum:'⏳ Belum Terantar', terantar:'✅ Sudah Terantar' };

const SB_URL='https://mpdtlufbtahnrmzisggs.supabase.co';
const SB_ANON='sb_publishable_0s7XVtHpxblOeZY5uYTyBw_HA1eyie7';

/* ===== TEMA (terang / gelap) ===== */
function getTheme(){
  return document.documentElement.getAttribute('data-theme')==='light' ? 'light' : 'dark';
}
function applyTheme(theme){
  const t = theme==='light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem('lpg_theme', t); }catch(e){}
  if(typeof updateThemeToggleUI==='function') updateThemeToggleUI();
}
function toggleTheme(){
  applyTheme(getTheme()==='light' ? 'dark' : 'light');
}
/* Terapkan tema tersimpan SEGERA (config.js = skrip pertama tiap halaman),
   supaya minim kedip sebelum konten dirender. Default: gelap. */
(function(){
  let t='dark';
  try{ if(localStorage.getItem('lpg_theme')==='light') t='light'; }catch(e){}
  document.documentElement.setAttribute('data-theme', t);
})();
