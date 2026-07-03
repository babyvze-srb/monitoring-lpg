/* ===== STATE ===== */
let S={regions:[],users:[],transactions:[],stokAwal:{},sbyKirim:[],sbyLo:[],sbySo:[],sbyKirimTujuan:[],customers:[]};
let me=null, page='dashboard', alertMsg=null, modalSt=null;
let activeMonth=new Date().getMonth();
let useSupabase=false;
let SB=null;
