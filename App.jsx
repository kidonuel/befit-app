import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection, doc,
  getDoc, getDocs,
  setDoc, updateDoc, addDoc,
  query, where, orderBy,
  onSnapshot, serverTimestamp,
  writeBatch
} from "firebase/firestore";

// ─── Firebase Init ────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBiXqhh9Hkelc3kz8nm-sylXXZDjwxWMDk",
  authDomain:        "befit-gym-1af47.firebaseapp.com",
  projectId:         "befit-gym-1af47",
  storageBucket:     "befit-gym-1af47.firebasestorage.app",
  messagingSenderId: "276393389268",
  appId:             "1:276393389268:web:fef8cbfc0efcd082b91f41",
};

const _app = initializeApp(FIREBASE_CONFIG);
const _db  = getFirestore(_app);

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; height: -webkit-fill-available; }
  body {
    height: 100%; height: -webkit-fill-available;
    background: #0D0D0D; margin: 0; padding: 0;
    overscroll-behavior: none; -webkit-tap-highlight-color: transparent;
    font-family: 'DM Sans', sans-serif;
  }
  #root { height: 100%; height: 100dvh; }

  @keyframes fadeUp    { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes slideUp   { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes scaleIn   { from{transform:scale(.88);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes pulse     { 0%,100%{box-shadow:0 0 0 0 #8B1A1A55} 50%{box-shadow:0 0 0 14px #8B1A1A00} }
  @keyframes checkPop  { 0%{transform:scale(0) rotate(-20deg);opacity:0} 60%{transform:scale(1.25) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
  @keyframes shake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
  @keyframes scanLine  { 0%{top:8%} 100%{top:88%} }
  @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes cornerPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.97)} }

  .screen-enter { animation: fadeUp .32s cubic-bezier(.22,1,.36,1) both; }
  .modal-enter  { animation: slideUp .35s cubic-bezier(.22,1,.36,1) both; }
  .scale-enter  { animation: scaleIn .28s cubic-bezier(.22,1,.36,1) both; }
  .shake        { animation: shake .45s ease both; }

  .tap-btn, button, input {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .tap-btn {
    transition: transform .1s ease, opacity .1s ease;
    cursor: pointer;
  }
  .tap-btn:active { transform: scale(0.93); opacity: .82; }

  input { -webkit-appearance: none; appearance: none; border-radius: 12px; }
  input:focus { outline: none; }
  ::-webkit-scrollbar { width: 0; }

  @media (min-width: 540px) {
    .app-shell      { max-width: 430px; margin: 0 auto; border-left: 1px solid #1E1E1E; border-right: 1px solid #1E1E1E; min-height: 100dvh; }
    .app-shell-wide { max-width: 560px; margin: 0 auto; border-left: 1px solid #1E1E1E; border-right: 1px solid #1E1E1E; min-height: 100dvh; }
  }
`;

// ─── Security ─────────────────────────────────────────────────────────────────
const Sec = {
  _a:{}, _l:{},
  hash:(s)=>{ let h=0; for(let i=0;i<s.length;i++) h=(Math.imul(31,h)+s.charCodeAt(i))|0; return h.toString(16); },
  sanitize:(s)=>String(s).replace(/[<>"'`;&\\{}()]/g,"").trim().slice(0,100),
  checkRL:(k)=>{ const n=Date.now(); if(Sec._l[k]&&Sec._l[k]>n) return{locked:true,secs:Math.ceil((Sec._l[k]-n)/1000)}; return{locked:false}; },
  recordAttempt:(k)=>{
    const n=Date.now();
    Sec._a[k]=(Sec._a[k]||[]).filter(t=>n-t<300000); Sec._a[k].push(n);
    if(Sec._a[k].length>=5){Sec._l[k]=n+300000;Sec._a[k]=[];return{locked:true,secs:300};}
    return{locked:false,remaining:5-Sec._a[k].length};
  },
  clearAttempts:(k)=>{ delete Sec._a[k]; delete Sec._l[k]; },
  validatePhone:(p)=>/^0[789][01]\d{8}$/.test(p.replace(/\s/g,"")),
};

const ADMIN_TOKEN  = "bf-x7k2p9q3m4n1";
const ADMIN_PASS   = Sec.hash("BeFit@Secure25!");
const GYM_QR_TOKEN = "BEFIT-CHECKIN-2025-X9K3";
const getParam     = (k)=>{ try{const v=new URLSearchParams(window.location.search).get(k)||""; return v.replace(/[^a-zA-Z0-9-_]/g,"").slice(0,60);}catch{return "";} };

// ─── Brand ────────────────────────────────────────────────────────────────────
const B = {
  red:"#8B1A1A", red2:"#A52020", black:"#0D0D0D",
  card:"#161616", border:"#252525", text:"#F0F0F0",
  muted:"#5A5A5A", faint:"#1A1A1A", overlay:"rgba(0,0,0,.85)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today   = new Date();
const fmt     = (d)=> d.toISOString().split("T")[0];
const aD      = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const subEnd  = (startDate, days)=> fmt(aD(new Date(startDate), days-1));
const dL      = (e)=> Math.ceil((new Date(e)-today)/86400000);
const statusOf= (m)=>{ const d=dL(m.expiry); if(!m.paid||d<0) return"expired"; if(d<=7) return"expiring"; return"active"; };
const mkInitials=(name)=> name.trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();

// ─── Default Pricing ──────────────────────────────────────────────────────────
const DEFAULT_PRICING = {
  registrationFee: 5000,
  plans: {
    Weekly:    { price:5000,   days:7   },
    Monthly:   { price:15000,  days:30  },
    Quarterly: { price:40000,  days:90  },
    HalfYear:  { price:75000,  days:180 },
    Annual:    { price:150000, days:365 },
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE DATA LAYER
// All reads and writes to Firestore happen here.
// The rest of the app never talks to Firebase directly — only through these functions.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Generate a new unique member ID ──────────────────────────────────────────
const genMemberId = async ()=>{
  const snap = await getDocs(collection(_db,"members"));
  const num  = snap.size + 1;
  return "M" + String(num).padStart(3,"0");
};

// ── Load all members from Firestore ──────────────────────────────────────────
const loadMembers = async ()=>{
  const snap = await getDocs(collection(_db,"members"));
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
};

// ── Load attendance for a member ──────────────────────────────────────────────
const loadAttendance = async (memberId)=>{
  const q    = query(collection(_db,"attendance"), where("memberId","==",memberId));
  const snap = await getDocs(q);
  return snap.docs.map(d=> d.data().date);
};

// ── Load payments for a member ────────────────────────────────────────────────
const loadPayments = async (memberId)=>{
  const q    = query(collection(_db,"payments"), where("memberId","==",memberId));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
};

// ── Load ALL payments (for admin revenue view) ────────────────────────────────
const loadAllPayments = async ()=>{
  const snap = await getDocs(collection(_db,"payments"));
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
};

// ── Load ALL attendance (for admin today view) ────────────────────────────────
const loadTodayAttendance = async (dateStr)=>{
  const q    = query(collection(_db,"attendance"), where("date","==",dateStr));
  const snap = await getDocs(q);
  return snap.docs.map(d=> d.data().memberId);
};

// ── Save new member ───────────────────────────────────────────────────────────
const saveMember = async (memberData)=>{
  // Save member profile
  await setDoc(doc(_db,"members",memberData.id), {
    name:     memberData.name,
    phone:    memberData.phone,
    plan:     memberData.plan,
    joined:   memberData.joined,
    expiry:   memberData.expiry,
    paid:     memberData.paid,
    pin:      memberData.pin,
    avatar:   memberData.avatar,
    createdAt: serverTimestamp(),
  });
  // Save payments if any
  for(const p of (memberData.payments||[])){
    await addDoc(collection(_db,"payments"),{
      memberId:   memberData.id,
      memberName: memberData.name,
      date:       p.date,
      amount:     p.amount,
      plan:       p.plan,
      type:       p.type,
      createdAt:  serverTimestamp(),
    });
  }
};

// ── Record clock-in ───────────────────────────────────────────────────────────
const recordClockIn = async (memberId, memberName, dateStr)=>{
  // Check if already clocked in today
  const q    = query(collection(_db,"attendance"), where("memberId","==",memberId), where("date","==",dateStr));
  const snap = await getDocs(q);
  if(snap.empty){
    await addDoc(collection(_db,"attendance"),{
      memberId,
      memberName,
      date:      dateStr,
      createdAt: serverTimestamp(),
    });
    return true; // newly clocked in
  }
  return false; // already clocked in
};

// ── Record payment ────────────────────────────────────────────────────────────
const recordPayment = async (memberId, memberName, paymentData)=>{
  await addDoc(collection(_db,"payments"),{
    memberId,
    memberName,
    date:      paymentData.date,
    amount:    paymentData.amount,
    plan:      paymentData.plan,
    type:      paymentData.type,
    createdAt: serverTimestamp(),
  });
};

// ── Renew member subscription ─────────────────────────────────────────────────
const renewMember = async (memberId, memberName, plan, pricing, todayStr)=>{
  const planData  = pricing.plans[plan];
  const newExpiry = subEnd(todayStr, planData.days);
  // Update member doc
  await updateDoc(doc(_db,"members",memberId),{
    paid:   true,
    expiry: newExpiry,
  });
  // Record payment
  await recordPayment(memberId, memberName,{
    date:   todayStr,
    amount: planData.price,
    plan,
    type:   "cash",
  });
  return newExpiry;
};

// ── Save pricing settings ─────────────────────────────────────────────────────
const savePricing = async (pricingData)=>{
  await setDoc(doc(_db,"settings","pricing"), pricingData);
};

// ── Load pricing settings ─────────────────────────────────────────────────────
const loadPricing = async ()=>{
  const snap = await getDoc(doc(_db,"settings","pricing"));
  return snap.exists() ? snap.data() : DEFAULT_PRICING;
};

// ── Find member by ID or phone (case-insensitive) ────────────────────────────
const findMember = async (query_str)=>{
  const snap = await getDocs(collection(_db,"members"));
  const q    = query_str.trim().toUpperCase();
  const ph   = query_str.replace(/\s/g,"");
  return snap.docs
    .map(d=>({ id:d.id, ...d.data() }))
    .find(m=>
      m.id.toUpperCase()===q ||
      m.phone===ph ||
      m.name.toLowerCase()===query_str.trim().toLowerCase()
    ) || null;
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = ({n,s=20,c="currentColor"})=>{
  const d={
    home:    <><path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    users:   <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    cal:     <><rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    cash:    <><rect x="2" y="5" width="20" height="14" rx="2" stroke={c} strokeWidth="1.8"/><path d="M2 10h20" stroke={c} strokeWidth="1.8"/></>,
    bell:    <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    check:   <><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></>,
    clock:   <><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    trend:   <><path d="M22 7l-8.5 8.5-5-5L2 17M22 7h-6M22 7v6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    plus:    <><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    search:  <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.8"/><path d="M21 21l-4.35-4.35" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    shield:  <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    logout:  <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    eye:     <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={c} strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8"/></>,
    eyeoff:  <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    x:       <><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    refresh: <><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    warn:    <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.8"/><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.5" strokeLinecap="round"/></>,
    lock:    <><rect x="3" y="11" width="18" height="11" rx="2" stroke={c} strokeWidth="1.8"/><path d="M7 11V7a5 5 0 0110 0v4" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    chevron: <><path d="M9 18l6-6-6-6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    link:    <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    copy:    <><rect x="9" y="9" width="13" height="13" rx="2" stroke={c} strokeWidth="1.8"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    person:  <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    qr:      <><rect x="3" y="3" width="7" height="7" stroke={c} strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" stroke={c} strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" stroke={c} strokeWidth="1.8"/><path d="M14 14h3v3M17 17v4M21 14v3M21 21h-4" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></>,
    settings:<><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={c} strokeWidth="1.8"/></>,
    zap:     <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    tag:     <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="7" y1="7" x2="7.01" y2="7" stroke={c} strokeWidth="2.5" strokeLinecap="round"/></>,
    wifi:    <><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none">{d[n]}</svg>;
};

// ─── Logo ─────────────────────────────────────────────────────────────────────
const Logo = ({size=36})=>(
  <div style={{display:"flex",alignItems:"center",gap:10}}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill={B.red}/>
      <rect x="20" y="43" width="60" height="14" rx="4" fill="white"/>
      <rect x="12" y="31" width="18" height="38" rx="5" fill="white"/>
      <rect x="70" y="31" width="18" height="38" rx="5" fill="white"/>
      <rect x="7"  y="39" width="11" height="22" rx="3" fill="white"/>
      <rect x="82" y="39" width="11" height="22" rx="3" fill="white"/>
    </svg>
    <div>
      <div style={{fontSize:size*.62,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,letterSpacing:-.5,color:B.text,lineHeight:1}}>
        BEF<span style={{color:B.red}}>I</span>T
      </div>
      <div style={{fontSize:size*.2,color:B.muted,fontFamily:"'DM Sans',sans-serif",letterSpacing:2.5,textTransform:"uppercase",lineHeight:1}}>Health & Fitness</div>
    </div>
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({size=32,color=B.red})=>(
  <div style={{width:size,height:size,border:`3px solid ${color}30`,borderTop:`3px solid ${color}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
);

// ─── Loading Screen ───────────────────────────────────────────────────────────
const LoadingScreen = ({message="Loading..."})=>(
  <div style={{minHeight:"100dvh",background:B.black,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
    <Logo size={44}/>
    <Spinner/>
    <p style={{color:B.muted,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>{message}</p>
  </div>
);

// ─── Shared UI ────────────────────────────────────────────────────────────────
const Badge = ({status,sm})=>{
  const cfg={active:{bg:"#14291A",br:"#1A4525",cl:"#4ADE80",lb:"ACTIVE"},expiring:{bg:"#2A1F00",br:"#4A3500",cl:"#FBBF24",lb:"EXPIRING"},expired:{bg:"#2A0A0A",br:"#4A1010",cl:"#F87171",lb:"EXPIRED"}}[status];
  return <span style={{background:cfg.bg,border:`1px solid ${cfg.br}`,color:cfg.cl,padding:sm?"2px 8px":"4px 12px",borderRadius:20,fontSize:sm?9:11,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:1.5,whiteSpace:"nowrap"}}>{cfg.lb}</span>;
};

const Av = ({initials:i,size=42})=>(
  <div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${B.red},${B.red2})`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:size*.34,color:"#fff",flexShrink:0,letterSpacing:1}}>{i}</div>
);

const ErrBox = ({msg})=>msg?(
  <div style={{background:"#2A0A0A",border:"1px solid #4A1010",borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",gap:8,alignItems:"center"}}>
    <Ic n="warn" s={15} c="#F87171"/><span style={{color:"#F87171",fontSize:13}}>{msg}</span>
  </div>
):null;

const LockScreen = ({secs})=>(
  <div style={{textAlign:"center",padding:"32px 20px",background:"#1A0808",border:"1px solid #4A1010",borderRadius:16}}>
    <Ic n="lock" s={36} c="#F87171"/>
    <p style={{color:"#F87171",fontWeight:700,marginTop:12,fontFamily:"'Barlow Condensed',sans-serif",fontSize:18}}>Account Locked</p>
    <p style={{color:"#F87171",fontSize:32,fontFamily:"monospace",marginTop:8,fontWeight:700}}>{secs}s</p>
    <p style={{color:"#555",fontSize:12,marginTop:8}}>Too many failed attempts.</p>
  </div>
);

const PinDots = ({value,max=4,shake})=>(
  <div className={shake?"shake":""} style={{display:"flex",gap:16,justifyContent:"center"}}>
    {Array(max).fill(0).map((_,i)=>(
      <div key={i} style={{width:16,height:16,borderRadius:"50%",background:i<value.length?B.red:B.border,transition:"background .1s, transform .1s",transform:i===value.length-1&&value.length>0?"scale(1.3)":"scale(1)",boxShadow:i<value.length?`0 0 10px ${B.red}70`:"none"}}/>
    ))}
  </div>
);

const PinPad = ({value,onChange,maxLen=4})=>{
  const press=d=>{if(value.length<maxLen)onChange(value+d);};
  const del=()=>onChange(value.slice(0,-1));
  const Btn=({label,action,dim})=>(
    <button className="tap-btn" onClick={action}
      style={{width:72,height:72,borderRadius:"50%",border:`1px solid ${dim?"transparent":B.border}`,background:dim?"transparent":B.faint,color:B.text,fontSize:24,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {label}
    </button>
  );
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,72px)",gap:14,justifyContent:"center"}}>
      {[1,2,3,4,5,6,7,8,9].map(n=><Btn key={n} label={n} action={()=>press(String(n))}/>)}
      <Btn label="" action={()=>{}} dim/>
      <Btn label="0" action={()=>press("0")}/>
      <Btn label="⌫" action={del}/>
    </div>
  );
};

const Sheet = ({children,onClose,maxWidth=480})=>(
  <div style={{position:"fixed",inset:0,background:B.overlay,backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="modal-enter" style={{background:"#131313",border:`1px solid ${B.border}`,borderRadius:"22px 22px 0 0",padding:28,width:"100%",maxWidth,boxSizing:"border-box",maxHeight:"92vh",overflowY:"auto",paddingBottom:"calc(28px + env(safe-area-inset-bottom))"}}>
      {children}
    </div>
  </div>
);

const SheetHeader = ({title,onClose})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
    <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800}}>{title}</p>
    <button className="tap-btn" onClick={onClose} style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:8,padding:8,cursor:"pointer",display:"flex"}}><Ic n="x" s={15} c={B.muted}/></button>
  </div>
);

const TopBar = ({right,logoSize=26})=>(
  <div style={{padding:"16px 20px 12px",paddingTop:"calc(16px + env(safe-area-inset-top))",display:"flex",justifyContent:"space-between",alignItems:"center",background:`${B.black}F8`,backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:50}}>
    <Logo size={logoSize}/>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>{right}</div>
  </div>
);

const ScrollContent = ({children})=>(
  <div style={{flex:1,overflowY:"auto",padding:"16px 20px calc(90px + env(safe-area-inset-bottom))",WebkitOverflowScrolling:"touch"}}>
    {children}
  </div>
);

const BottomNav = ({tabs,active,onSelect,maxWidth=430})=>(
  <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth,background:"rgba(13,13,13,.97)",backdropFilter:"blur(24px)",borderTop:`1px solid ${B.border}`,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100}}>
    {tabs.map(t=>(
      <button key={t.id} className="tap-btn" onClick={()=>onSelect(t.id)}
        style={{flex:1,background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"12px 0 10px",position:"relative"}}>
        <Ic n={t.icon} s={22} c={active===t.id?B.red:"#404040"}/>
        <span style={{fontSize:10,color:active===t.id?B.red:"#404040",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{t.label}</span>
        {t.dot&&<div style={{position:"absolute",top:10,right:"28%",width:7,height:7,background:B.red,borderRadius:"50%",border:`2px solid ${B.black}`}}/>}
        {active===t.id&&<div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:24,height:3,background:B.red,borderRadius:"2px 2px 0 0"}}/>}
      </button>
    ))}
  </div>
);

const EmptyState = ({icon,title,subtitle,action})=>(
  <div className="scale-enter" style={{textAlign:"center",padding:"60px 20px"}}>
    <div style={{width:72,height:72,borderRadius:20,background:`${B.red}15`,border:`1px solid ${B.red}25`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
      <Ic n={icon} s={32} c={B.red}/>
    </div>
    <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,marginBottom:8}}>{title}</p>
    <p style={{color:B.muted,fontSize:14,lineHeight:1.6,marginBottom:action?24:0}}>{subtitle}</p>
    {action&&<button className="tap-btn" onClick={action.fn} style={{background:B.red,border:"none",borderRadius:12,padding:"12px 24px",color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"}}>{action.label}</button>}
  </div>
);

const SuccessOverlay = ({message="CLOCKED IN!",sub,onDone})=>{
  useEffect(()=>{const t=setTimeout(onDone,2200);return()=>clearTimeout(t);},[]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.94)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:500}}>
      <div style={{animation:"checkPop .5s cubic-bezier(.22,1,.36,1) both",marginBottom:24}}>
        <div style={{width:100,height:100,borderRadius:"50%",background:"#14291A",border:"3px solid #4ADE80",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 1.5s ease infinite"}}>
          <Ic n="check" s={52} c="#4ADE80"/>
        </div>
      </div>
      <p style={{color:"#4ADE80",fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,letterSpacing:1,animation:"fadeIn .4s .3s both"}}>{message}</p>
      {sub&&<p style={{color:B.muted,fontSize:14,marginTop:8,animation:"fadeIn .4s .5s both"}}>{sub}</p>}
    </div>
  );
};

const Confirm = ({title,subtitle,confirmLabel,onConfirm,onCancel,danger=true,loading=false})=>(
  <div style={{position:"fixed",inset:0,background:B.overlay,backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:24}}>
    <div className="scale-enter" style={{background:"#151515",border:`1px solid ${B.border}`,borderRadius:20,padding:28,width:"100%",maxWidth:360}}>
      <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,marginBottom:8}}>{title}</p>
      <p style={{color:B.muted,fontSize:14,lineHeight:1.6,marginBottom:24}}>{subtitle}</p>
      <div style={{display:"flex",gap:12}}>
        <button className="tap-btn" onClick={onCancel} disabled={loading} style={{flex:1,padding:"13px 0",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,color:B.muted,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"}}>Cancel</button>
        <button className="tap-btn" onClick={onConfirm} disabled={loading}
          style={{flex:1,padding:"13px 0",background:danger?B.red:"#14291A",border:`1px solid ${danger?B.red:"#1A4525"}`,borderRadius:12,color:danger?"#fff":"#4ADE80",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {loading?<Spinner size={18} color={danger?"#fff":"#4ADE80"}/>:confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

const TF = ({label,value,onChange,type="text",placeholder,hint,left,right,disabled,onEnter})=>(
  <div style={{marginBottom:16}}>
    {label&&<label style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:8}}>{label}</label>}
    <div style={{position:"relative"}}>
      {left&&<span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>{left}</span>}
      <input disabled={disabled} value={value} onChange={e=>onChange(Sec.sanitize(e.target.value))} type={type} placeholder={placeholder}
        onKeyDown={e=>e.key==="Enter"&&onEnter&&onEnter()}
        style={{width:"100%",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,padding:left?"14px 14px 14px 44px":"14px 16px",paddingRight:right?"46px":"16px",color:B.text,fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box",opacity:disabled?.5:1}}/>
      {right&&<span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)"}}>{right}</span>}
    </div>
    {hint&&<p style={{color:"#333",fontSize:11,marginTop:6,fontFamily:"monospace"}}>{hint}</p>}
  </div>
);

const PlanSelector = ({selected,onChange,pricing})=>(
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
    {Object.entries(pricing.plans).map(([k,v])=>(
      <button key={k} className="tap-btn" onClick={()=>onChange(k)}
        style={{padding:"14px 8px",border:`1px solid ${selected===k?B.red:B.border}`,borderRadius:12,background:selected===k?`${B.red}18`:B.faint,color:selected===k?B.red:B.muted,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
        <div style={{fontSize:15,marginBottom:2}}>{k}</div>
        <div style={{fontSize:12,opacity:.7}}>₦{v.price.toLocaleString()}</div>
        <div style={{fontSize:10,opacity:.5}}>{v.days} days</div>
      </button>
    ))}
  </div>
);

// ─── QR Code Display ──────────────────────────────────────────────────────────
const GymQRCode = ({size=220})=>{
  const GRID=25, token=GYM_QR_TOKEN;
  const seed=token.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const pseudo=(i)=>((seed*1103515245+i*12345)&0x7fffffff)%100;
  const grid=Array(GRID).fill(null).map(()=>Array(GRID).fill(0));
  const finder=(r,c)=>{ for(let i=0;i<7;i++) for(let j=0;j<7;j++){ const o=i===0||i===6||j===0||j===6,inn=i>=2&&i<=4&&j>=2&&j<=4; grid[r+i][c+j]=(o||inn)?1:0; } if(r+7<GRID) for(let k=0;k<8;k++) grid[r+7][c+k]=0; if(c+7<GRID) for(let k=0;k<8;k++) grid[r+k][c+7]=0; };
  finder(0,0);finder(0,GRID-7);finder(GRID-7,0);
  for(let i=8;i<GRID-8;i++){grid[6][i]=i%2===0?1:0;grid[i][6]=i%2===0?1:0;}
  let bit=0;
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) if(grid[r][c]===0&&!((r<9&&c<9)||(r<9&&c>GRID-9)||(r>GRID-9&&c<9)||(r===6)||(c===6))) grid[r][c]=pseudo(bit++)>45?1:0;
  const cs=size/GRID;
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{borderRadius:12}}>
      <rect width={size} height={size} fill="white"/>
      {grid.map((row,r)=>row.map((cell,c)=>cell?<rect key={`${r}-${c}`} x={c*cs} y={r*cs} width={cs} height={cs} fill="#0D0D0D"/>:null))}
    </svg>
  );
};

// ─── In-App QR Scanner ────────────────────────────────────────────────────────
const QRScanner = ({onSuccess,onExpired,onClose,isExpired})=>{
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [camErr,  setCamErr]  = useState(null);
  const [scanning,setScanning]= useState(true);
  const [hint,    setHint]    = useState("Point camera at the BEFIT QR code on the wall");

  useEffect(()=>{
    let cancelled=false;
    const start=async()=>{
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280},height:{ideal:720}}});
        if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}
        streamRef.current=stream;
        if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play();}
      }catch(e){
        if(!cancelled){
          if(e.name==="NotAllowedError") setCamErr("Camera permission denied. Please allow camera access in your browser settings.");
          else if(e.name==="NotFoundError") setCamErr("No camera found on this device.");
          else setCamErr("Could not open camera. Please try again.");
        }
      }
    };
    start();
    // Simulate scan detection after 2.5s (replace with jsQR in production)
    const scanTimer=setTimeout(()=>{
      if(cancelled)return;
      setScanning(false);
      if(isExpired){setHint("Subscription expired");setTimeout(()=>{if(!cancelled)onExpired();},1000);}
      else{setHint("QR code recognised! ✓");setTimeout(()=>{if(!cancelled)onSuccess();},600);}
    },2500);
    return()=>{
      cancelled=true;
      clearTimeout(scanTimer);
      if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());
    };
  },[]);

  const cornerStyle=(pos)=>{
    const base={position:"absolute",width:28,height:28,zIndex:2};
    const bw="3px",bc=B.red;
    const corners={tl:{top:0,left:0,borderTop:`${bw} solid ${bc}`,borderLeft:`${bw} solid ${bc}`},tr:{top:0,right:0,borderTop:`${bw} solid ${bc}`,borderRight:`${bw} solid ${bc}`},bl:{bottom:0,left:0,borderBottom:`${bw} solid ${bc}`,borderLeft:`${bw} solid ${bc}`},br:{bottom:0,right:0,borderBottom:`${bw} solid ${bc}`,borderRight:`${bw} solid ${bc}`}};
    return{...base,...corners[pos]};
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#000",zIndex:500,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"calc(16px + env(safe-area-inset-top)) 20px 16px",background:"rgba(0,0,0,.75)",backdropFilter:"blur(10px)",zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Ic n="qr" s={20} c={B.red}/>
          <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800}}>Scan QR Code</p>
        </div>
        <button className="tap-btn" onClick={onClose} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"8px 14px",color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          CANCEL
        </button>
      </div>

      <div style={{flex:1,position:"relative",overflow:"hidden"}}>
        {camErr?(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",padding:32,textAlign:"center"}}>
            <Ic n="warn" s={48} c="#F87171"/>
            <p style={{color:"#F87171",fontSize:16,fontWeight:600,marginTop:16,marginBottom:8}}>Camera Error</p>
            <p style={{color:B.muted,fontSize:14,lineHeight:1.6,marginBottom:24}}>{camErr}</p>
            <button className="tap-btn" onClick={onClose} style={{background:B.red,border:"none",borderRadius:12,padding:"14px 28px",color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer"}}>GO BACK</button>
          </div>
        ):(
          <>
            <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:"18%",background:"rgba(0,0,0,.55)"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:"22%",background:"rgba(0,0,0,.55)"}}/>
              <div style={{position:"absolute",top:"18%",left:0,width:"10%",height:"60%",background:"rgba(0,0,0,.55)"}}/>
              <div style={{position:"absolute",top:"18%",right:0,width:"10%",height:"60%",background:"rgba(0,0,0,.55)"}}/>
              <div style={{position:"absolute",top:"18%",left:"10%",right:"10%",height:"60%",animation:"cornerPulse 2s ease infinite"}}>
                <div style={cornerStyle("tl")}/><div style={cornerStyle("tr")}/><div style={cornerStyle("bl")}/><div style={cornerStyle("br")}/>
                {scanning&&<div style={{position:"absolute",left:4,right:4,height:2,background:`linear-gradient(90deg,transparent,${B.red},transparent)`,top:"8%",animation:"scanLine 1.8s ease-in-out infinite",boxShadow:`0 0 8px ${B.red}`}}/>}
                {!scanning&&!isExpired&&<div style={{position:"absolute",inset:0,background:"rgba(20,41,26,.85)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4}}><div style={{animation:"checkPop .4s cubic-bezier(.22,1,.36,1) both"}}><div style={{width:64,height:64,borderRadius:"50%",background:"#14291A",border:"3px solid #4ADE80",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="check" s={34} c="#4ADE80"/></div></div></div>}
                {!scanning&&isExpired&&<div style={{position:"absolute",inset:0,background:"rgba(42,10,10,.85)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4}}><Ic n="warn" s={48} c="#F87171"/></div>}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{padding:"20px 24px",paddingBottom:"calc(20px + env(safe-area-inset-bottom))",background:"rgba(0,0,0,.85)",backdropFilter:"blur(10px)",textAlign:"center"}}>
        <p style={{color:scanning?B.muted:(!isExpired?"#4ADE80":"#F87171"),fontSize:15,fontWeight:500,transition:"color .3s"}}>{hint}</p>
        {scanning&&<p style={{color:"#2A2A2A",fontSize:12,marginTop:6}}>Hold camera steady over the QR code at the gym entrance</p>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBER LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
const MemberLogin = ({onLogin,onRegister})=>{
  const [step,  setStep]  = useState("id");
  const [idVal, setIdVal] = useState("");
  const [pin,   setPin]   = useState("");
  const [err,   setErr]   = useState("");
  const [found, setFound] = useState(null);
  const [lock,  setLock]  = useState(null);
  const [shake, setShake] = useState(false);
  const [busy,  setBusy]  = useState(false);

  useEffect(()=>{if(!lock)return;const t=setInterval(()=>{const r=Sec.checkRL("m_"+(found?.id||""));if(!r.locked){setLock(null);clearInterval(t);}else setLock(r);},1000);return()=>clearInterval(t);},[lock,found]);

  const doShake=()=>{setShake(true);setTimeout(()=>setShake(false),500);};

  const lookup=async()=>{
    if(busy||!idVal.trim())return;
    setBusy(true); setErr("");
    try{
      const m=await findMember(idVal);
      if(!m){doShake();setErr("Member not found. Check your ID or phone number.");}
      else{setFound(m);setStep("pin");}
    }catch(e){setErr("Connection error. Please check your internet.");}
    finally{setBusy(false);}
  };

  const checkPin=useCallback(async()=>{
    if(!found)return;
    const key="m_"+found.id;
    const rl=Sec.checkRL(key);
    if(rl.locked){setLock(rl);return;}
    if(Sec.hash(pin)===found.pin){
      Sec.clearAttempts(key);
      onLogin(found);
    }else{
      const r=Sec.recordAttempt(key);
      setPin(""); doShake();
      if(r.locked)setLock({locked:true,secs:300});
      else setErr(`Incorrect PIN. ${r.remaining} attempt(s) left.`);
    }
  },[pin,found]);

  useEffect(()=>{if(pin.length===4)checkPin();},[pin]);

  return(
    <div className="app-shell" style={{minHeight:"100dvh",background:B.black,display:"flex",flexDirection:"column"}}>
      <div style={{position:"fixed",inset:0,backgroundImage:`radial-gradient(ellipse at 20% 10%, ${B.red}1A 0%,transparent 55%),radial-gradient(ellipse at 80% 90%, ${B.red}10 0%,transparent 55%)`,pointerEvents:"none"}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"0 24px",position:"relative",zIndex:1}}>
        <div style={{paddingTop:"calc(44px + env(safe-area-inset-top))"}}>
          <div style={{marginBottom:40}}><Logo size={42}/></div>

          {step==="id"?(
            <div className="screen-enter">
              <h1 style={{color:B.text,fontSize:34,fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:-.5,marginBottom:6}}>Welcome Back</h1>
              <p style={{color:B.muted,fontSize:15,marginBottom:36,lineHeight:1.5}}>Enter your Member ID or registered phone number.</p>
              <TF value={idVal} onChange={v=>{setIdVal(v);setErr("");}} placeholder="M001 or 08012345678"
                left={<Ic n="users" s={17} c={B.muted}/>} onEnter={lookup}/>
              <ErrBox msg={err}/>
              <button className="tap-btn" onClick={lookup} disabled={!idVal||busy}
                style={{width:"100%",padding:"16px 0",background:idVal?B.red:B.faint,border:"none",borderRadius:14,color:idVal?"#fff":"#383838",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,letterSpacing:1,cursor:idVal?"pointer":"not-allowed",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                {busy?<Spinner size={20} color="#fff"/>:"CONTINUE →"}
              </button>
              <button className="tap-btn" onClick={onRegister}
                style={{width:"100%",padding:"14px 0",background:"transparent",border:`1px solid ${B.border}`,borderRadius:14,color:B.muted,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <Ic n="plus" s={16} c={B.muted}/> NEW MEMBER? REGISTER
              </button>
            </div>
          ):(
            <div className="screen-enter">
              <button className="tap-btn" onClick={()=>{setStep("id");setPin("");setErr("");setFound(null);}} style={{background:"transparent",border:"none",color:B.muted,cursor:"pointer",fontSize:14,marginBottom:28,padding:0,display:"flex",alignItems:"center",gap:6}}>← Back</button>
              <div style={{display:"flex",alignItems:"center",gap:14,background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:"16px 18px",marginBottom:36}}>
                <Av initials={found.avatar} size={52}/>
                <div>
                  <p style={{color:B.text,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:20}}>{found.name}</p>
                  <p style={{color:B.muted,fontSize:13,fontFamily:"monospace",marginTop:3}}>{found.id}</p>
                </div>
              </div>
              <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:700,textAlign:"center",marginBottom:24}}>Enter your 4-digit PIN</p>
              {lock?.locked?<LockScreen secs={lock.secs}/>:(
                <>
                  <div style={{marginBottom:28}}><PinDots value={pin} shake={shake}/></div>
                  <PinPad value={pin} onChange={setPin}/>
                  {err&&<p style={{color:"#F87171",fontSize:13,textAlign:"center",marginTop:16}}>{err}</p>}
                </>
              )}
            </div>
          )}
        </div>
        <p style={{color:"#1E1E1E",fontSize:11,textAlign:"center",paddingBottom:"calc(20px + env(safe-area-inset-bottom))"}}>BEFIT Health & Fitness · Powered by Firebase</p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBER REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════
const MemberRegister = ({pricing,onSuccess,onBack})=>{
  const [step,    setStep]    = useState("info");
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [plan,    setPlan]    = useState("Monthly");
  const [pin,     setPin]     = useState("");
  const [pin2,    setPin2]    = useState("");
  const [pinStep, setPinStep] = useState("set");
  const [err,     setErr]     = useState("");
  const [shake,   setShake]   = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState(false);

  const doShake=()=>{setShake(true);setTimeout(()=>setShake(false),500);};

  const goToPlan=async()=>{
    setErr("");
    if(!name.trim()){setErr("Please enter your full name.");return;}
    if(!Sec.validatePhone(phone)){setErr("Enter a valid Nigerian phone number (e.g. 08012345678).");return;}
    setBusy(true);
    try{
      const existing=await findMember(phone);
      if(existing){setErr("A member with this phone number already exists.");setBusy(false);return;}
    }catch(e){setErr("Connection error. Please try again.");setBusy(false);return;}
    setBusy(false);
    setStep("plan");
  };

  useEffect(()=>{
    if(pin.length===4&&pinStep==="set")setPinStep("confirm");
  },[pin]);

  useEffect(()=>{
    if(pin2.length===4&&pinStep==="confirm"){
      if(pin2===pin)register();
      else{doShake();setPin2("");setErr("PINs do not match. Try again.");}
    }
  },[pin2]);

  const register=async()=>{
    setBusy(true);
    try{
      const id      = await genMemberId();
      const todayStr= fmt(today);
      const planData= pricing.plans[plan];
      const expiry  = subEnd(todayStr, planData.days);
      const av      = mkInitials(name);
      const newMember={
        id, name:Sec.sanitize(name), phone:phone.replace(/\s/g,""),
        plan, joined:todayStr, expiry, paid:true,
        pin:Sec.hash(pin), avatar:av,
        payments:[
          {date:todayStr,amount:pricing.registrationFee,plan:"Registration Fee",type:"registration"},
          {date:todayStr,amount:planData.price,plan,type:"subscription"},
        ]
      };
      await saveMember(newMember);
      setDone(true);
      setTimeout(()=>onSuccess(newMember), 2000);
    }catch(e){setErr("Could not create account. Please check your connection.");setBusy(false);}
  };

  const planData=pricing.plans[plan];
  const total   =pricing.registrationFee+planData.price;

  return(
    <div className="app-shell" style={{minHeight:"100dvh",background:B.black,display:"flex",flexDirection:"column"}}>
      <div style={{position:"fixed",inset:0,backgroundImage:`radial-gradient(ellipse at 20% 10%, ${B.red}18 0%,transparent 55%)`,pointerEvents:"none"}}/>
      <div style={{flex:1,overflowY:"auto",padding:"0 24px",paddingTop:"calc(44px + env(safe-area-inset-top))",paddingBottom:"calc(32px + env(safe-area-inset-bottom))",position:"relative",zIndex:1}}>
        <div style={{marginBottom:32}}><Logo size={38}/></div>

        {done?(
          <div className="screen-enter" style={{textAlign:"center",paddingTop:40}}>
            <div style={{animation:"checkPop .5s cubic-bezier(.22,1,.36,1) both",display:"inline-block",marginBottom:20}}>
              <div style={{width:90,height:90,borderRadius:"50%",background:"#14291A",border:"3px solid #4ADE80",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>
                <Ic n="check" s={46} c="#4ADE80"/>
              </div>
            </div>
            <p style={{color:"#4ADE80",fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,marginBottom:8}}>Welcome to BEFIT!</p>
            <p style={{color:B.muted,fontSize:14}}>Your account has been saved. Logging you in...</p>
          </div>
        ):step==="pin"?(
          <div className="screen-enter">
            <button className="tap-btn" onClick={()=>{setStep("plan");setPin("");setPin2("");setPinStep("set");setErr("");}} style={{background:"transparent",border:"none",color:B.muted,cursor:"pointer",fontSize:14,marginBottom:28,padding:0,display:"flex",alignItems:"center",gap:6}}>← Back</button>
            <h1 style={{color:B.text,fontSize:30,fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:6}}>{pinStep==="set"?"Set Your PIN":"Confirm PIN"}</h1>
            <p style={{color:B.muted,fontSize:14,marginBottom:32,lineHeight:1.5}}>{pinStep==="set"?"Choose a 4-digit PIN to secure your account.":"Enter the same PIN again to confirm."}</p>
            <div style={{marginBottom:28}}><PinDots value={pinStep==="set"?pin:pin2} shake={shake}/></div>
            <PinPad value={pinStep==="set"?pin:pin2} onChange={pinStep==="set"?setPin:setPin2}/>
            {err&&<p style={{color:"#F87171",fontSize:13,textAlign:"center",marginTop:16}}>{err}</p>}
            {busy&&<div style={{display:"flex",justifyContent:"center",marginTop:24}}><Spinner/></div>}
          </div>
        ):step==="plan"?(
          <div className="screen-enter">
            <button className="tap-btn" onClick={()=>{setStep("info");setErr("");}} style={{background:"transparent",border:"none",color:B.muted,cursor:"pointer",fontSize:14,marginBottom:28,padding:0,display:"flex",alignItems:"center",gap:6}}>← Back</button>
            <h1 style={{color:B.text,fontSize:30,fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:6}}>Choose Your Plan</h1>
            <p style={{color:B.muted,fontSize:14,marginBottom:24,lineHeight:1.5}}>Select a subscription plan to get started.</p>
            <PlanSelector selected={plan} onChange={setPlan} pricing={pricing}/>
            <div style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:18,marginTop:16,marginBottom:24}}>
              <p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Payment Summary</p>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{color:B.muted,fontSize:14}}>Registration Fee (one-time)</span>
                <span style={{color:B.text,fontSize:14,fontWeight:600}}>₦{pricing.registrationFee.toLocaleString()}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <span style={{color:B.muted,fontSize:14}}>{plan} Subscription</span>
                <span style={{color:B.text,fontSize:14,fontWeight:600}}>₦{planData.price.toLocaleString()}</span>
              </div>
              <div style={{borderTop:`1px solid ${B.border}`,paddingTop:12,display:"flex",justifyContent:"space-between"}}>
                <span style={{color:B.text,fontWeight:700}}>Total Today</span>
                <span style={{color:B.red,fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900}}>₦{total.toLocaleString()}</span>
              </div>
              <div style={{marginTop:10,background:`${B.red}10`,border:`1px solid ${B.red}25`,borderRadius:8,padding:"8px 12px"}}>
                <p style={{color:B.muted,fontSize:12}}>Active <strong style={{color:B.text}}>{fmt(today)}</strong> → <strong style={{color:B.text}}>{subEnd(fmt(today),planData.days)}</strong></p>
              </div>
            </div>
            <button className="tap-btn" onClick={()=>setStep("pin")}
              style={{width:"100%",padding:"16px 0",background:B.red,border:"none",borderRadius:14,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,letterSpacing:1,cursor:"pointer"}}>
              SET PIN & REGISTER →
            </button>
          </div>
        ):(
          <div className="screen-enter">
            <button className="tap-btn" onClick={onBack} style={{background:"transparent",border:"none",color:B.muted,cursor:"pointer",fontSize:14,marginBottom:28,padding:0,display:"flex",alignItems:"center",gap:6}}>← Back to Login</button>
            <h1 style={{color:B.text,fontSize:34,fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:6}}>Create Account</h1>
            <p style={{color:B.muted,fontSize:14,marginBottom:32,lineHeight:1.5}}>Join BEFIT and manage your membership digitally.</p>
            <TF label="Full Name" value={name} onChange={setName} placeholder="e.g. Emeka Okafor" left={<Ic n="person" s={17} c={B.muted}/>} onEnter={goToPlan}/>
            <TF label="Phone Number" value={phone} onChange={setPhone} placeholder="08012345678" left={<Ic n="users" s={17} c={B.muted}/>} hint="Nigerian format · used as your login ID" onEnter={goToPlan}/>
            <ErrBox msg={err}/>
            <button className="tap-btn" onClick={goToPlan} disabled={!name||!phone||busy}
              style={{width:"100%",padding:"16px 0",background:(name&&phone)?B.red:B.faint,border:"none",borderRadius:14,color:(name&&phone)?"#fff":"#383838",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,letterSpacing:1,cursor:(name&&phone)?"pointer":"not-allowed",marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              {busy?<Spinner size={20} color="#fff"/>:"NEXT: CHOOSE PLAN →"}
            </button>
            <p style={{color:"#2A2A2A",fontSize:12,textAlign:"center",marginTop:20,lineHeight:1.5}}>
              One-time registration fee: <strong style={{color:"#3A3A3A"}}>₦{pricing.registrationFee.toLocaleString()}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
const StaffLogin = ({onLogin,onBack})=>{
  const [pass,  setPass]   = useState("");
  const [showPw,setShowPw] = useState(false);
  const [err,   setErr]    = useState("");
  const [lock,  setLock]   = useState(null);

  useEffect(()=>{if(!lock)return;const t=setInterval(()=>{const r=Sec.checkRL("staff");if(!r.locked){setLock(null);clearInterval(t);}else setLock(r);},1000);return()=>clearInterval(t);},[lock]);

  const handle=()=>{
    const rl=Sec.checkRL("staff");if(rl.locked){setLock(rl);return;}
    if(Sec.hash(pass)===ADMIN_PASS){Sec.clearAttempts("staff");onLogin();}
    else{const r=Sec.recordAttempt("staff");setPass("");if(r.locked)setLock({locked:true,secs:300});else setErr(`Invalid credentials. ${r.remaining} attempt(s) left.`);}
  };

  return(
    <div className="app-shell" style={{minHeight:"100dvh",background:B.black,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px"}}>
      <div style={{position:"fixed",inset:0,backgroundImage:`radial-gradient(ellipse at 50% 30%, ${B.red}18 0%,transparent 60%)`,pointerEvents:"none"}}/>
      <div className="screen-enter" style={{width:"100%",maxWidth:360,zIndex:1}}>
        <button className="tap-btn" onClick={onBack} style={{background:"transparent",border:"none",color:B.muted,cursor:"pointer",fontSize:14,marginBottom:28,padding:0,display:"flex",alignItems:"center",gap:6}}>← Back</button>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:36}}>
          <div style={{width:54,height:54,background:`${B.red}18`,border:`1px solid ${B.red}35`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="shield" s={26} c={B.red}/></div>
          <div>
            <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:800}}>Staff Portal</p>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#4ADE80"}}/>
              <p style={{color:"#4ADE80",fontSize:12}}>Secure link verified</p>
            </div>
          </div>
        </div>
        {lock?.locked?<LockScreen secs={lock.secs}/>:(
          <>
            <TF label="Staff Password" value={pass} onChange={v=>{setPass(v);setErr("");}} type={showPw?"text":"password"} placeholder="Enter staff password"
              left={<Ic n="lock" s={16} c={B.muted}/>} onEnter={handle}
              right={<button className="tap-btn" onClick={()=>setShowPw(!showPw)} style={{background:"transparent",border:"none",cursor:"pointer",padding:4,display:"flex"}}><Ic n={showPw?"eyeoff":"eye"} s={16} c={B.muted}/></button>}/>
            <ErrBox msg={err}/>
            <button className="tap-btn" onClick={handle} disabled={!pass}
              style={{width:"100%",padding:"16px 0",background:pass?B.red:B.faint,border:"none",borderRadius:14,color:pass?"#fff":"#383838",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,letterSpacing:1,cursor:pass?"pointer":"not-allowed"}}>
              SIGN IN →
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBER APP
// ═══════════════════════════════════════════════════════════════════════════════
const MemberApp = ({member: initialMember, pricing, onLogout})=>{
  const [tab,         setTab]         = useState("home");
  const [member,      setMember]      = useState(initialMember);
  const [attendance,  setAttendance]  = useState([]);
  const [payments,    setPayments]    = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loading,     setLoading]     = useState(true);

  const todayStr = fmt(today);
  const status   = statusOf(member);
  const days     = dL(member.expiry);
  const clocked  = attendance.includes(todayStr);
  const thisMonth= attendance.filter(d=>d.startsWith(todayStr.slice(0,7))).length;

  // Load member's attendance and payments from Firebase on mount
  useEffect(()=>{
    const load=async()=>{
      try{
        const [att,pay]=await Promise.all([
          loadAttendance(member.id),
          loadPayments(member.id),
        ]);
        setAttendance(att);
        setPayments(pay.sort((a,b)=>b.date.localeCompare(a.date)));
      }catch(e){ console.error("Load error:",e); }
      finally{setLoading(false);}
    };
    load();
  },[member.id]);

  const doClockIn=async()=>{
    if(clocked||status==="expired")return;
    try{
      const success=await recordClockIn(member.id, member.name, todayStr);
      if(success){
        setAttendance(prev=>[...prev,todayStr]);
        setShowSuccess(true);
      }
    }catch(e){ console.error("Clock-in error:",e); }
  };

  const TABS=[
    {id:"home",    icon:"home",  label:"Home"},
    {id:"history", icon:"cal",   label:"History"},
    {id:"payments",icon:"cash",  label:"Payments"},
    {id:"notifs",  icon:"bell",  label:"Alerts",dot:status!=="active"},
  ];

  if(loading) return <LoadingScreen message="Loading your profile..."/>;

  return(
    <div className="app-shell" style={{minHeight:"100dvh",background:B.black,display:"flex",flexDirection:"column"}}>
      <TopBar logoSize={26} right={
        <>
          <button className="tap-btn" onClick={()=>setShowProfile(true)} style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:10,padding:"7px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
            <Av initials={member.avatar} size={28}/><Ic n="chevron" s={14} c={B.muted}/>
          </button>
          <button className="tap-btn" onClick={onLogout} style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:10,padding:"7px 10px",cursor:"pointer",display:"flex"}}>
            <Ic n="logout" s={16} c={B.muted}/>
          </button>
        </>
      }/>

      <ScrollContent>
        {tab==="home"&&(
          <div className="screen-enter">
            <p style={{color:B.muted,fontSize:13,marginBottom:2}}>{todayStr}</p>
            <h1 style={{color:B.text,fontSize:30,fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:-.5,marginBottom:22}}>Hey, {member.name.split(" ")[0]}! 👋</h1>

            {/* Sub card */}
            <div style={{background:`linear-gradient(135deg,${B.red}22,${B.faint})`,border:`1px solid ${B.red}38`,borderRadius:20,padding:22,marginBottom:14,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",right:-28,top:-28,width:120,height:120,borderRadius:"50%",background:`${B.red}10`}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
                <div><p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Subscription</p><Badge status={status}/></div>
                <div style={{textAlign:"right"}}><p style={{color:B.muted,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>Plan</p><p style={{color:B.red,fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800}}>{member.plan}</p></div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                <div><p style={{color:"#444",fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Expires</p><p style={{color:B.text,fontSize:16,fontFamily:"monospace",fontWeight:700}}>{member.expiry}</p></div>
                <div style={{textAlign:"right"}}><p style={{color:"#444",fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Days Left</p>
                  <p style={{color:days<0?"#F87171":days<=7?"#FBBF24":"#4ADE80",fontFamily:"'Barlow Condensed',sans-serif",fontSize:46,fontWeight:900,lineHeight:1}}>{days<0?"0":days}</p>
                </div>
              </div>
            </div>

            {/* Member ID */}
            <div style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:18,marginBottom:14,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:44,height:44,background:`${B.red}14`,border:`1px solid ${B.red}28`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic n="person" s={20} c={B.red}/></div>
              <div style={{flex:1}}><p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Member ID</p><p style={{color:B.text,fontSize:24,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,letterSpacing:2}}>{member.id}</p></div>
              <p style={{color:"#2A2A2A",fontSize:11,fontFamily:"monospace"}}>{member.phone}</p>
            </div>

            {/* Clock In */}
            <div style={{background:B.card,border:`1px solid ${clocked?"#1A4525":B.border}`,borderRadius:20,padding:22,marginBottom:14,transition:"border-color .3s"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <p style={{color:B.text,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:18}}>Gym Clock-In</p>
                <Ic n="zap" s={19} c={clocked?"#4ADE80":B.muted}/>
              </div>
              <p style={{color:B.muted,fontSize:13,marginBottom:20,lineHeight:1.5}}>
                {clocked?"You're checked in for today's session ✓":status==="expired"?"Your subscription has expired.":"Tap below — your camera will open to scan the QR code at the gym entrance."}
              </p>
              {clocked?(
                <div style={{background:"#14291A",border:"1px solid #1A4525",borderRadius:14,padding:"16px 0",textAlign:"center"}}>
                  <span style={{color:"#4ADE80",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,letterSpacing:1}}>✓ CLOCKED IN · {todayStr}</span>
                </div>
              ):status==="expired"?(
                <button className="tap-btn" onClick={()=>setTab("payments")}
                  style={{width:"100%",padding:"17px 0",background:"#2A0A0A",border:"1px solid #4A1010",borderRadius:14,color:"#F87171",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,letterSpacing:.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                  <Ic n="cash" s={18} c="#F87171"/> RENEW SUBSCRIPTION →
                </button>
              ):(
                <button className="tap-btn" onClick={()=>setShowScanner(true)}
                  style={{width:"100%",padding:"17px 0",background:B.red,border:"none",borderRadius:14,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,letterSpacing:1,cursor:"pointer",animation:"pulse 2s ease infinite",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
                  <Ic n="qr" s={20} c="#fff"/> SCAN TO CLOCK IN
                </button>
              )}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["This Month",thisMonth,"sessions"],["All Time",attendance.length,"visits"]].map(([l,v,s])=>(
                <div key={l} style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:18}}>
                  <p style={{color:B.muted,fontSize:10,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>{l}</p>
                  <p style={{color:B.red,fontFamily:"'Barlow Condensed',sans-serif",fontSize:40,fontWeight:900,lineHeight:1}}>{v}</p>
                  <p style={{color:"#333",fontSize:12,marginTop:4}}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="history"&&(
          <div className="screen-enter">
            <h2 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,marginBottom:20}}>Attendance</h2>
            {!attendance.length?<EmptyState icon="cal" title="No Sessions Yet" subtitle="Your attendance history will appear here once you start clocking in."/>
            :[...attendance].sort((a,b)=>b.localeCompare(a)).map((d,i)=>(
              <div key={i} style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:40,height:40,background:`${B.red}14`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic n="check" s={18} c={B.red}/></div>
                <div style={{flex:1}}><p style={{color:B.text,fontWeight:600,fontFamily:"monospace"}}>{d}</p><p style={{color:B.muted,fontSize:12}}>Gym session</p></div>
                {d===todayStr&&<span style={{background:`${B.red}18`,border:`1px solid ${B.red}38`,color:B.red,fontSize:10,padding:"3px 9px",borderRadius:20,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>TODAY</span>}
              </div>
            ))}
          </div>
        )}

        {tab==="payments"&&(
          <div className="screen-enter">
            <h2 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,marginBottom:20}}>Payments</h2>
            {!payments.length?<EmptyState icon="cash" title="No Payments Yet" subtitle="Your payment history will appear here."/>
            :payments.map((p,i)=>{
              const isReg=p.type==="registration";
              return(
                <div key={i} style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:14,padding:"16px 18px",marginBottom:12,display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:42,height:42,background:isReg?`${B.red}15`:"#14291A",border:`1px solid ${isReg?`${B.red}30`:"#1A4525"}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <Ic n={isReg?"tag":"check"} s={18} c={isReg?B.red:"#4ADE80"}/>
                  </div>
                  <div style={{flex:1}}><p style={{color:B.text,fontWeight:600}}>{p.plan}</p><p style={{color:B.muted,fontSize:12,fontFamily:"monospace"}}>{p.date}</p></div>
                  <p style={{color:isReg?B.red:"#4ADE80",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:18}}>₦{p.amount.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        )}

        {tab==="notifs"&&(
          <div className="screen-enter">
            <h2 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,marginBottom:20}}>Notifications</h2>
            {status==="expired"&&<div style={{background:"#2A0A0A",border:"1px solid #4A1010",borderRadius:16,padding:20,marginBottom:14}}><div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}><Ic n="warn" s={18} c="#F87171"/><p style={{color:"#F87171",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>Subscription Expired</p></div><p style={{color:"#aaa",fontSize:14,lineHeight:1.6}}>Your plan expired on <strong>{member.expiry}</strong>. Visit the front desk to renew.</p></div>}
            {status==="expiring"&&<div style={{background:"#2A1F00",border:"1px solid #4A3500",borderRadius:16,padding:20,marginBottom:14}}><div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}><Ic n="warn" s={18} c="#FBBF24"/><p style={{color:"#FBBF24",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>Expiring in {days} Day{days!==1?"s":""}</p></div><p style={{color:"#aaa",fontSize:14,lineHeight:1.6}}>Your {member.plan} plan expires on <strong>{member.expiry}</strong>.</p></div>}
            {status==="active"&&<div style={{background:"#14291A",border:"1px solid #1A4525",borderRadius:16,padding:20,marginBottom:14}}><div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}><Ic n="check" s={18} c="#4ADE80"/><p style={{color:"#4ADE80",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>All Good!</p></div><p style={{color:"#aaa",fontSize:14,lineHeight:1.6}}>Active for <strong style={{color:B.text}}>{days} more days</strong>. Keep showing up! 💪</p></div>}
            <div style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:20}}>
              <p style={{color:B.text,fontWeight:600,marginBottom:6}}>💡 Fitness Tip</p>
              <p style={{color:B.muted,fontSize:14,lineHeight:1.6}}>Consistency beats intensity. Aim for at least 3 gym visits per week.</p>
            </div>
          </div>
        )}
      </ScrollContent>

      <BottomNav tabs={TABS} active={tab} onSelect={setTab}/>
      {showSuccess&&<SuccessOverlay message="CLOCKED IN!" sub={todayStr} onDone={()=>setShowSuccess(false)}/>}
      {showProfile&&<MemberProfileSheet member={member} setMember={setMember} onClose={()=>setShowProfile(false)} onLogout={onLogout}/>}
      {showScanner&&(
        <QRScanner
          isExpired={status==="expired"}
          onSuccess={()=>{ setShowScanner(false); doClockIn(); }}
          onExpired={()=>{ setShowScanner(false); setTab("payments"); }}
          onClose={()=>setShowScanner(false)}
        />
      )}
    </div>
  );
};

// ─── Member Profile Sheet ─────────────────────────────────────────────────────
const MemberProfileSheet = ({member,setMember,onClose,onLogout})=>{
  const [mode,  setMode]   = useState("view");
  const [oldPin,setOldPin] = useState("");
  const [newPin,setNewPin] = useState("");
  const [step,  setStep]   = useState("old");
  const [pinErr,setPinErr] = useState("");
  const [pinOk, setPinOk]  = useState(false);
  const [shake, setShake]  = useState(false);
  const [busy,  setBusy]   = useState(false);

  const doShake=()=>{setShake(true);setTimeout(()=>setShake(false),500);};

  useEffect(()=>{
    if(oldPin.length===4&&step==="old"){
      if(Sec.hash(oldPin)===member.pin){setStep("new");setOldPin("");}
      else{doShake();setOldPin("");setPinErr("Incorrect current PIN.");}
    }
  },[oldPin]);

  useEffect(()=>{
    if(newPin.length===4&&step==="new"){
      const save=async()=>{
        setBusy(true);
        try{
                    await updateDoc(doc(_db,"members",member.id),{pin:Sec.hash(newPin)});
          setMember(m=>({...m,pin:Sec.hash(newPin)}));
          setNewPin("");setPinOk(true);
          setTimeout(()=>{setPinOk(false);setMode("view");setStep("old");},1500);
        }catch(e){setPinErr("Could not save PIN. Try again.");}
        finally{setBusy(false);}
      };
      save();
    }
  },[newPin]);

  return(
    <Sheet onClose={onClose}>
      <SheetHeader title="My Profile" onClose={onClose}/>
      {mode==="view"?(
        <>
          <div style={{display:"flex",alignItems:"center",gap:16,background:B.faint,borderRadius:16,padding:18,marginBottom:20}}>
            <Av initials={member.avatar} size={60}/>
            <div>
              <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800}}>{member.name}</p>
              <p style={{color:B.muted,fontSize:13,fontFamily:"monospace",marginTop:4}}>{member.id} · {member.phone}</p>
              <div style={{marginTop:8}}><Badge status={statusOf(member)}/></div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[["Plan",member.plan],["Joined",member.joined],["Expiry",member.expiry],["Days Left",dL(member.expiry)<0?"Expired":dL(member.expiry)+"d"]].map(([l,v])=>(
              <div key={l} style={{background:B.faint,borderRadius:10,padding:"12px 14px"}}>
                <p style={{color:B.muted,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{l}</p>
                <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700}}>{v}</p>
              </div>
            ))}
          </div>
          <button className="tap-btn" onClick={()=>setMode("pin")} style={{width:"100%",padding:"14px 0",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12}}>
            <Ic n="lock" s={17} c={B.muted}/> CHANGE PIN
          </button>
          <button className="tap-btn" onClick={onLogout} style={{width:"100%",padding:"14px 0",background:"#2A0A0A",border:"1px solid #4A1010",borderRadius:12,color:"#F87171",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            <Ic n="logout" s={17} c="#F87171"/> SIGN OUT
          </button>
        </>
      ):(
        <div className="screen-enter">
          <button className="tap-btn" onClick={()=>{setMode("view");setOldPin("");setNewPin("");setPinErr("");setStep("old");}} style={{background:"transparent",border:"none",color:B.muted,cursor:"pointer",fontSize:14,marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:6}}>← Back</button>
          {pinOk?(
            <div style={{textAlign:"center",padding:"32px 0"}}>
              <div style={{animation:"checkPop .5s cubic-bezier(.22,1,.36,1) both",display:"inline-block"}}>
                <div style={{width:80,height:80,borderRadius:"50%",background:"#14291A",border:"2px solid #4ADE80",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
                  <Ic n="check" s={40} c="#4ADE80"/>
                </div>
              </div>
              <p style={{color:"#4ADE80",fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:800}}>PIN Updated!</p>
            </div>
          ):(
            <>
              <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:700,textAlign:"center",marginBottom:8}}>{step==="old"?"Enter Current PIN":"Enter New PIN"}</p>
              <p style={{color:B.muted,fontSize:13,textAlign:"center",marginBottom:24}}>{step==="old"?"Verify your identity first":"Choose a new 4-digit PIN"}</p>
              <div style={{marginBottom:24}}><PinDots value={step==="old"?oldPin:newPin} shake={shake}/></div>
              <PinPad value={step==="old"?oldPin:newPin} onChange={step==="old"?setOldPin:setNewPin}/>
              {pinErr&&<p style={{color:"#F87171",fontSize:13,textAlign:"center",marginTop:16}}>{pinErr}</p>}
              {busy&&<div style={{display:"flex",justifyContent:"center",marginTop:16}}><Spinner/></div>}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN APP
// ═══════════════════════════════════════════════════════════════════════════════
const AdminApp = ({pricing,setPricing,onLogout})=>{
  const [tab,          setTab]          = useState("dashboard");
  const [members,      setMembers]      = useState([]);
  const [allPayments,  setAllPayments]  = useState([]);
  const [todayCheckins,setTodayCheckins]= useState([]);
  const [search,       setSearch]       = useState("");
  const [filter,       setFilter]       = useState("all");
  const [showAdd,      setShowAdd]      = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [showUrlInfo,  setShowUrlInfo]  = useState(false);
  const [showQR,       setShowQR]       = useState(false);
  const [newM,         setNewM]         = useState({name:"",phone:"",plan:"Monthly",paid:true});
  const [addErr,       setAddErr]       = useState("");
  const [confirmRenew, setConfirmRenew] = useState(null);
  const [clockSearch,  setClockSearch]  = useState("");
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(false);
  const [pricingSaving,setPricingSaving]= useState(false);

  const todayStr = fmt(today);

  // Load all data from Firebase
  const reload=useCallback(async()=>{
    try{
      const [mems,pays,checks]=await Promise.all([
        loadMembers(),
        loadAllPayments(),
        loadTodayAttendance(todayStr),
      ]);
      setMembers(mems);
      setAllPayments(pays.sort((a,b)=>b.date.localeCompare(a.date)));
      setTodayCheckins(checks);
    }catch(e){ console.error("Admin load error:",e); }
    finally{setLoading(false);}
  },[todayStr]);

  useEffect(()=>{ reload(); },[]);

  const active   = members.filter(m=>statusOf(m)==="active");
  const expiring = members.filter(m=>statusOf(m)==="expiring");
  const expired  = members.filter(m=>statusOf(m)==="expired");
  const totalRev = allPayments.reduce((s,p)=>s+p.amount,0);
  const monthRev = allPayments.filter(p=>p.date.startsWith(todayStr.slice(0,7))).reduce((s,p)=>s+p.amount,0);

  const filtered = members.filter(m=>{
    const q=search.toLowerCase();
    return(m.name.toLowerCase().includes(q)||m.phone.includes(q)||m.id.toLowerCase().includes(q))&&(filter==="all"||statusOf(m)===filter);
  });

  const checkedInMembers  = members.filter(m=>todayCheckins.includes(m.id));
  const notCheckedMembers = members.filter(m=>!todayCheckins.includes(m.id)&&statusOf(m)!=="expired");

  const addMember=async()=>{
    setAddErr("");
    if(!newM.name.trim()){setAddErr("Full name is required.");return;}
    if(!Sec.validatePhone(newM.phone)){setAddErr("Enter a valid Nigerian phone number.");return;}
    setBusy(true);
    try{
      const existing=await findMember(newM.phone);
      if(existing){setAddErr("A member with this phone already exists.");setBusy(false);return;}
      const id      = await genMemberId();
      const planData= pricing.plans[newM.plan];
      const expiry  = subEnd(todayStr, planData.days);
      const av      = mkInitials(newM.name);
      const newMember={
        id, name:Sec.sanitize(newM.name), phone:newM.phone.replace(/\s/g,""),
        plan:newM.plan, joined:todayStr, expiry, paid:newM.paid,
        pin:Sec.hash("1234"), avatar:av,
        payments:newM.paid?[{date:todayStr,amount:planData.price,plan:newM.plan,type:"cash"}]:[],
      };
      await saveMember(newMember);
      setNewM({name:"",phone:"",plan:"Monthly",paid:true});
      setShowAdd(false);
      await reload();
    }catch(e){setAddErr("Could not save member. Check your connection.");}
    finally{setBusy(false);}
  };

  const doRenew=async()=>{
    if(!confirmRenew)return;
    setBusy(true);
    try{
      await renewMember(confirmRenew.id, confirmRenew.name, confirmRenew.plan, pricing, todayStr);
      setConfirmRenew(null);
      await reload();
    }catch(e){ console.error("Renew error:",e); }
    finally{setBusy(false);}
  };

  const adminClockIn=async(memberId,memberName)=>{
    try{
      await recordClockIn(memberId, memberName, todayStr);
      setTodayCheckins(prev=>[...prev,memberId]);
    }catch(e){ console.error("Manual clock-in error:",e); }
  };

  const handleSavePricing=async()=>{
    setPricingSaving(true);
    try{ await savePricing(pricing); }
    catch(e){ console.error("Pricing save error:",e); }
    finally{setPricingSaving(false);}
  };

  const TABS=[
    {id:"dashboard",icon:"home",    label:"Dashboard"},
    {id:"members",  icon:"users",   label:"Members"},
    {id:"checkins", icon:"clock",   label:"Today"},
    {id:"revenue",  icon:"trend",   label:"Revenue"},
    {id:"settings", icon:"settings",label:"Settings"},
  ];

  const StatBox=({icon,label,value,color,onClick})=>(
    <div className={onClick?"tap-btn":""} onClick={onClick} style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:18,cursor:onClick?"pointer":"default"}}>
      <div style={{width:36,height:36,background:`${color}18`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}><Ic n={icon} s={18} c={color}/></div>
      <p style={{color,fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,lineHeight:1}}>{value}</p>
      <p style={{color:B.muted,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",marginTop:6}}>{label}</p>
    </div>
  );

  if(loading) return <LoadingScreen message="Loading dashboard..."/>;

  return(
    <div className="app-shell-wide" style={{minHeight:"100dvh",background:B.black,display:"flex",flexDirection:"column"}}>
      <TopBar logoSize={24} right={
        <>
          <button className="tap-btn" onClick={()=>setShowQR(true)} style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <Ic n="qr" s={14} c={B.muted}/><span style={{color:B.muted,fontSize:11,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>QR</span>
          </button>
          <div style={{background:`${B.red}18`,border:`1px solid ${B.red}30`,borderRadius:8,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
            <Ic n="shield" s={12} c={B.red}/>
            <span style={{color:B.red,fontSize:11,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:.5}}>ADMIN</span>
          </div>
          <button className="tap-btn" onClick={onLogout} style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex"}}>
            <Ic n="logout" s={15} c={B.muted}/>
          </button>
        </>
      }/>

      <ScrollContent>
        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div className="screen-enter">
            <h2 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,marginBottom:4}}>Dashboard</h2>
            <p style={{color:B.muted,fontSize:13,marginBottom:22}}>{todayStr} · Live from Firebase</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <StatBox icon="users"  label="Total Members" value={members.length}  color="#60A5FA" onClick={()=>setTab("members")}/>
              <StatBox icon="check"  label="Active"        value={active.length}   color="#4ADE80" onClick={()=>{setFilter("active");setTab("members");}}/>
              <StatBox icon="warn"   label="Expiring"      value={expiring.length} color="#FBBF24" onClick={()=>{setFilter("expiring");setTab("members");}}/>
              <StatBox icon="shield" label="Expired"       value={expired.length}  color="#F87171" onClick={()=>{setFilter("expired");setTab("members");}}/>
            </div>
            <div style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:20,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
                <div><p style={{color:B.muted,fontSize:10,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Checked In Today</p><p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:42,fontWeight:900,lineHeight:1}}>{todayCheckins.length}</p></div>
                <p style={{color:B.muted,fontSize:13}}>of {members.length} members</p>
              </div>
              <div style={{height:6,background:B.faint,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${members.length?todayCheckins.length/members.length*100:0}%`,background:B.red,borderRadius:3,transition:"width .6s ease"}}/>
              </div>
            </div>
            {(expiring.length>0||expired.length>0)?(
              <div style={{background:"#1A0E00",border:"1px solid #3A2500",borderRadius:16,padding:18}}>
                <p style={{color:"#FBBF24",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,marginBottom:14}}>⚠ Needs Attention</p>
                {[...expiring,...expired.slice(0,3)].map(m=>(
                  <div key={m.id} className="tap-btn" onClick={()=>setSelected(m)} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,cursor:"pointer"}}>
                    <Av initials={m.avatar} size={34}/>
                    <div style={{flex:1}}><p style={{color:B.text,fontSize:14,fontWeight:600}}>{m.name}</p><p style={{color:B.muted,fontSize:12}}>{statusOf(m)==="expiring"?`Expiring in ${dL(m.expiry)}d`:"Expired"}</p></div>
                    <Badge status={statusOf(m)} sm/>
                  </div>
                ))}
              </div>
            ):(
              <div style={{background:"#14291A",border:"1px solid #1A4525",borderRadius:16,padding:20,display:"flex",gap:12,alignItems:"center"}}>
                <Ic n="check" s={20} c="#4ADE80"/>
                <p style={{color:"#4ADE80",fontSize:14}}>All members are in good standing 🎉</p>
              </div>
            )}
            <button className="tap-btn" onClick={reload} style={{width:"100%",padding:"12px 0",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,color:B.muted,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:16}}>
              <Ic n="refresh" s={15} c={B.muted}/> REFRESH DATA
            </button>
          </div>
        )}

        {/* MEMBERS */}
        {tab==="members"&&(
          <div className="screen-enter">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h2 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800}}>Members</h2>
              <button className="tap-btn" onClick={()=>setShowAdd(true)} style={{background:B.red,border:"none",borderRadius:10,padding:"9px 16px",display:"flex",alignItems:"center",gap:6,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,color:"#fff",cursor:"pointer"}}>
                <Ic n="plus" s={15} c="#fff"/> ADD
              </button>
            </div>
            <div style={{position:"relative",marginBottom:10}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}><Ic n="search" s={15} c={B.muted}/></span>
              <input value={search} onChange={e=>setSearch(Sec.sanitize(e.target.value))} placeholder="Search name, ID, or phone…"
                style={{width:"100%",background:B.card,border:`1px solid ${B.border}`,borderRadius:12,padding:"13px 14px 13px 42px",color:B.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:2}}>
              {[["all","All"],["active","Active"],["expiring","Expiring"],["expired","Expired"]].map(([v,l])=>(
                <button key={v} className="tap-btn" onClick={()=>setFilter(v)} style={{flexShrink:0,padding:"6px 16px",borderRadius:20,border:`1px solid ${filter===v?B.red:B.border}`,background:filter===v?`${B.red}18`:B.faint,color:filter===v?B.red:B.muted,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
            {!filtered.length?<EmptyState icon="users" title="No Members Found" subtitle={search?"Try a different search.":"No members match this filter."} action={search?{label:"Clear Search",fn:()=>setSearch("")}:undefined}/>
            :filtered.map(m=>{
              const s=statusOf(m);
              return(
                <div key={m.id} className="tap-btn" onClick={()=>setSelected(m)} style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
                  <Av initials={m.avatar} size={44}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <p style={{color:B.text,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>{m.name}</p>
                      <Badge status={s} sm/>
                    </div>
                    <div style={{display:"flex",gap:12}}>
                      <span style={{color:B.muted,fontSize:12,fontFamily:"monospace"}}>{m.id}</span>
                      <span style={{color:B.muted,fontSize:12}}>{m.plan}</span>
                      <span style={{color:s==="expired"?"#F87171":s==="expiring"?"#FBBF24":"#444",fontSize:12}}>{dL(m.expiry)<0?"Expired":`${dL(m.expiry)}d`}</span>
                    </div>
                  </div>
                  <Ic n="chevron" s={15} c="#2E2E2E"/>
                </div>
              );
            })}
          </div>
        )}

        {/* TODAY */}
        {tab==="checkins"&&(
          <div className="screen-enter">
            <h2 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,marginBottom:4}}>Today's Check-ins</h2>
            <p style={{color:B.muted,fontSize:13,marginBottom:20}}>{todayCheckins.length} member{todayCheckins.length!==1?"s":""} in today · {todayStr}</p>
            {checkedInMembers.length>0&&(
              <>
                <p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Checked In ({checkedInMembers.length})</p>
                {checkedInMembers.map(m=>(
                  <div key={m.id} style={{background:B.card,border:"1px solid #1A2A1A",borderRadius:14,padding:"13px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                    <Av initials={m.avatar} size={40}/>
                    <div style={{flex:1}}><p style={{color:B.text,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:15}}>{m.name}</p><p style={{color:B.muted,fontSize:12}}>{m.id} · {m.plan}</p></div>
                    <div style={{width:30,height:30,background:"#14291A",border:"1px solid #1A4525",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="check" s={14} c="#4ADE80"/></div>
                  </div>
                ))}
              </>
            )}
            {notCheckedMembers.length>0&&(
              <>
                <p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:10,marginTop:24}}>Not Yet In ({notCheckedMembers.length})</p>
                <div style={{position:"relative",marginBottom:12}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}><Ic n="search" s={14} c={B.muted}/></span>
                  <input value={clockSearch} onChange={e=>setClockSearch(Sec.sanitize(e.target.value))} placeholder="Search to clock in manually…"
                    style={{width:"100%",background:B.card,border:`1px solid ${B.border}`,borderRadius:12,padding:"11px 14px 11px 40px",color:B.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                {notCheckedMembers.filter(m=>m.name.toLowerCase().includes(clockSearch.toLowerCase())||m.id.toLowerCase().includes(clockSearch.toLowerCase())).map(m=>(
                  <div key={m.id} style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:14,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                    <Av initials={m.avatar} size={38}/>
                    <div style={{flex:1}}><p style={{color:B.text,fontWeight:600,fontSize:14}}>{m.name}</p><p style={{color:B.muted,fontSize:12}}>{m.id} · {m.plan}</p></div>
                    <button className="tap-btn" onClick={()=>adminClockIn(m.id,m.name)}
                      style={{background:`${B.red}20`,border:`1px solid ${B.red}40`,borderRadius:8,padding:"7px 12px",cursor:"pointer",color:B.red,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                      CLOCK IN
                    </button>
                  </div>
                ))}
              </>
            )}
            {!checkedInMembers.length&&!notCheckedMembers.length&&<EmptyState icon="clock" title="No Activity Yet" subtitle="Today's check-ins will appear here as members arrive."/>}
          </div>
        )}

        {/* REVENUE */}
        {tab==="revenue"&&(
          <div className="screen-enter">
            <h2 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,marginBottom:20}}>Revenue</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <StatBox icon="trend" label="Total Revenue" value={`₦${(totalRev/1000).toFixed(0)}k`} color="#60A5FA"/>
              <StatBox icon="cash"  label="This Month"    value={`₦${(monthRev/1000).toFixed(0)}k`} color="#4ADE80"/>
            </div>
            {!allPayments.length?<EmptyState icon="cash" title="No Transactions Yet" subtitle="Revenue will appear here once members subscribe."/>:(
              <>
                <p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>All Transactions</p>
                {allPayments.slice(0,50).map((p,i)=>{
                  const isReg=p.type==="registration";
                  return(
                    <div key={i} style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:14,padding:"13px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:40,height:40,background:isReg?`${B.red}15`:"#14291A",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <Ic n={isReg?"tag":"cash"} s={17} c={isReg?B.red:"#4ADE80"}/>
                      </div>
                      <div style={{flex:1}}><p style={{color:B.text,fontWeight:600,fontSize:14}}>{p.memberName}</p><p style={{color:B.muted,fontSize:12,fontFamily:"monospace"}}>{p.date} · {p.plan}</p></div>
                      <div style={{textAlign:"right"}}>
                        <p style={{color:isReg?B.red:"#4ADE80",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>₦{p.amount.toLocaleString()}</p>
                        <p style={{color:"#333",fontSize:10,marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{p.type==="registration"?"REG":p.type==="paystack"?"PAYSTACK":"CASH"}</p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {tab==="settings"&&(
          <div className="screen-enter">
            <h2 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,marginBottom:4}}>Settings</h2>
            <p style={{color:B.muted,fontSize:13,marginBottom:24}}>Pricing changes save to Firebase instantly.</p>

            <p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Subscription Pricing</p>
            <div style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:20,marginBottom:16}}>
              <div style={{marginBottom:16}}>
                <label style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:8}}>Registration Fee (one-time)</label>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:B.muted,fontSize:15,fontWeight:600}}>₦</span>
                  <input type="number" value={pricing.registrationFee}
                    onChange={e=>setPricing(p=>({...p,registrationFee:Math.max(0,parseInt(e.target.value)||0)}))}
                    style={{width:"100%",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,padding:"13px 14px 13px 32px",color:B.text,fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
              {Object.entries(pricing.plans).map(([planName,planData])=>(
                <div key={planName} style={{marginBottom:14}}>
                  <label style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:8}}>{planName} ({planData.days} days)</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:B.muted,fontSize:15,fontWeight:600}}>₦</span>
                    <input type="number" value={planData.price}
                      onChange={e=>setPricing(p=>({...p,plans:{...p.plans,[planName]:{...p.plans[planName],price:Math.max(0,parseInt(e.target.value)||0)}}}))}
                      style={{width:"100%",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,padding:"13px 14px 13px 32px",color:B.text,fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                </div>
              ))}
              <button className="tap-btn" onClick={handleSavePricing} disabled={pricingSaving}
                style={{width:"100%",padding:"13px 0",background:B.red,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8}}>
                {pricingSaving?<Spinner size={18} color="#fff"/>:<><Ic n="check" s={16} c="#fff"/> SAVE PRICING TO FIREBASE</>}
              </button>
            </div>

            <p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Gym QR Code</p>
            <div style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:20,marginBottom:16}}>
              <p style={{color:B.text,fontSize:14,marginBottom:12,lineHeight:1.6}}>Post this at the gym entrance. Members scan it to clock in via the BEFIT app.</p>
              <button className="tap-btn" onClick={()=>setShowQR(true)} style={{width:"100%",padding:"13px 0",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <Ic n="qr" s={18} c={B.red}/> VIEW & PRINT QR CODE
              </button>
            </div>

            <p style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Staff Access</p>
            <div style={{background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:20}}>
              <p style={{color:B.text,fontSize:14,marginBottom:12,lineHeight:1.6}}>Share the staff link with authorised staff only.</p>
              <button className="tap-btn" onClick={()=>setShowUrlInfo(true)} style={{width:"100%",padding:"13px 0",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <Ic n="link" s={18} c={B.red}/> VIEW STAFF LINK
              </button>
            </div>
          </div>
        )}
      </ScrollContent>

      <BottomNav tabs={TABS} active={tab} onSelect={setTab} maxWidth={560}/>

      {/* Add Member Sheet */}
      {showAdd&&(
        <Sheet onClose={()=>setShowAdd(false)} maxWidth={560}>
          <SheetHeader title="Add New Member" onClose={()=>setShowAdd(false)}/>
          <TF label="Full Name" value={newM.name} onChange={v=>setNewM(p=>({...p,name:v}))} placeholder="e.g. Emeka Okafor"/>
          <TF label="Phone Number" value={newM.phone} onChange={v=>setNewM(p=>({...p,phone:v}))} placeholder="08012345678" hint="Nigerian format required"/>
          <label style={{color:B.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:10}}>Plan</label>
          <PlanSelector selected={newM.plan} onChange={v=>setNewM(p=>({...p,plan:v}))} pricing={pricing}/>
          <div className="tap-btn" onClick={()=>setNewM(p=>({...p,paid:!p.paid}))} style={{display:"flex",alignItems:"center",gap:12,background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",marginTop:12,marginBottom:20}}>
            <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${newM.paid?B.red:B.border}`,background:newM.paid?B.red:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
              {newM.paid&&<Ic n="check" s={12} c="#fff"/>}
            </div>
            <div><p style={{color:B.text,fontSize:14,fontWeight:600}}>Mark as Paid</p><p style={{color:B.muted,fontSize:12}}>₦{pricing.plans[newM.plan].price.toLocaleString()} · {newM.plan}</p></div>
          </div>
          <ErrBox msg={addErr}/>
          <button className="tap-btn" onClick={addMember} disabled={busy}
            style={{width:"100%",padding:"15px 0",background:B.red,border:"none",borderRadius:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {busy?<Spinner size={20} color="#fff"/>:"ADD MEMBER →"}
          </button>
        </Sheet>
      )}

      {/* Member Detail Sheet */}
      {selected&&(()=>{
        const m=members.find(x=>x.id===selected.id)||selected;
        const s=statusOf(m);
        return(
          <Sheet onClose={()=>setSelected(null)} maxWidth={560}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div style={{display:"flex",gap:14,alignItems:"center"}}>
                <Av initials={m.avatar} size={54}/>
                <div><h3 style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,marginBottom:6}}>{m.name}</h3><Badge status={s}/></div>
              </div>
              <button className="tap-btn" onClick={()=>setSelected(null)} style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:8,padding:8,cursor:"pointer",display:"flex"}}><Ic n="x" s={15} c={B.muted}/></button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[["ID",m.id],["Phone",m.phone],["Plan",m.plan],["Joined",m.joined],["Expiry",m.expiry],["Days Left",dL(m.expiry)<0?"Expired":dL(m.expiry)+"d"]].map(([l,v])=>(
                <div key={l} style={{background:B.faint,borderRadius:10,padding:"12px 14px"}}>
                  <p style={{color:B.muted,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{l}</p>
                  <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700}}>{v}</p>
                </div>
              ))}
            </div>
            {!todayCheckins.includes(m.id)&&s!=="expired"&&(
              <button className="tap-btn" onClick={()=>{adminClockIn(m.id,m.name);setSelected(null);}}
                style={{width:"100%",padding:"13px 0",background:`${B.red}18`,border:`1px solid ${B.red}38`,borderRadius:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:B.red,cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <Ic n="clock" s={16} c={B.red}/> CLOCK IN MANUALLY
              </button>
            )}
            {(s==="expired"||s==="expiring")&&(
              <button className="tap-btn" onClick={()=>setConfirmRenew(m)}
                style={{width:"100%",padding:"15px 0",background:B.red,border:"none",borderRadius:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                <Ic n="refresh" s={17} c="#fff"/> RENEW — ₦{pricing.plans[m.plan]?.price.toLocaleString()}
              </button>
            )}
          </Sheet>
        );
      })()}

      {/* QR Code Modal */}
      {showQR&&(
        <div style={{position:"fixed",inset:0,background:B.overlay,backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:24}}>
          <div className="scale-enter" style={{background:"#111",border:`1px solid ${B.border}`,borderRadius:24,padding:32,width:"100%",maxWidth:360,textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,justifyContent:"center"}}>
              <Ic n="qr" s={22} c={B.red}/>
              <p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800}}>Gym Check-In QR</p>
            </div>
            <div style={{background:"white",borderRadius:16,padding:16,display:"inline-block",marginBottom:20}}>
              <GymQRCode size={200}/>
            </div>
            <p style={{color:B.muted,fontSize:13,lineHeight:1.6,marginBottom:16}}>Post this at the gym entrance. Members open the BEFIT app and tap "Scan to Clock In".</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button className="tap-btn" onClick={()=>window.print()} style={{padding:"12px 0",background:B.red,border:"none",borderRadius:12,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                🖨 Print
              </button>
              <button className="tap-btn" onClick={()=>setShowQR(false)} style={{padding:"12px 0",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,color:B.muted,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRenew&&<Confirm title={`Renew ${confirmRenew.name}?`} subtitle={`Extend their ${confirmRenew.plan} by ${pricing.plans[confirmRenew.plan]?.days} days. Payment: ₦${pricing.plans[confirmRenew.plan]?.price.toLocaleString()}.`} confirmLabel="CONFIRM RENEW" danger={false} loading={busy} onConfirm={doRenew} onCancel={()=>setConfirmRenew(null)}/>}

      {showUrlInfo&&(
        <div style={{position:"fixed",inset:0,background:B.overlay,backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:20}}>
          <StaffUrlInfo onDismiss={()=>setShowUrlInfo(false)}/>
        </div>
      )}
    </div>
  );
};

// ─── Staff URL Info ───────────────────────────────────────────────────────────
const StaffUrlInfo = ({onDismiss})=>{
  const [copied,setCopied]=useState(false);
  const url=`${window.location.origin}${window.location.pathname}?staff=${ADMIN_TOKEN}`;
  const copy=()=>{navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};
  return(
    <div className="scale-enter" style={{background:"#131313",border:`1px solid ${B.border}`,borderRadius:20,padding:28,width:"100%",maxWidth:400}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div style={{width:44,height:44,background:`${B.red}18`,border:`1px solid ${B.red}35`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="link" s={22} c={B.red}/></div>
        <div><p style={{color:B.text,fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800}}>Staff Access Link</p><p style={{color:B.muted,fontSize:12}}>Share only with authorised staff</p></div>
      </div>
      <div style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,padding:"12px 14px",marginBottom:16}}>
        <p style={{color:"#444",fontSize:10,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Staff URL</p>
        <p style={{color:B.text,fontSize:12,fontFamily:"monospace",wordBreak:"break-all",lineHeight:1.6}}>{url}</p>
      </div>
      <button className="tap-btn" onClick={copy} style={{width:"100%",padding:"13px 0",background:copied?"#14291A":B.red,border:`1px solid ${copied?"#1A4525":B.red}`,borderRadius:12,color:copied?"#4ADE80":"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12,transition:"all .2s"}}>
        <Ic n={copied?"check":"copy"} s={16} c={copied?"#4ADE80":"#fff"}/>{copied?"COPIED!":"COPY STAFF LINK"}
      </button>
      <div style={{background:"#2A1F00",border:"1px solid #4A3500",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
        <p style={{color:"#FBBF24",fontSize:12,lineHeight:1.6}}>⚠ Keep this URL private. Do not share publicly or in group chats.</p>
      </div>
      <button className="tap-btn" onClick={onDismiss} style={{width:"100%",padding:"13px 0",background:B.faint,border:`1px solid ${B.border}`,borderRadius:12,color:B.muted,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"}}>CLOSE</button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [ready,    setReady]    = useState(false);
  const [fbError,  setFbError]  = useState(null);
  const [session,  setSession]  = useState(null);
  const [pricing,  setPricing]  = useState(DEFAULT_PRICING);
  const [showReg,  setShowReg]  = useState(false);

  const urlToken   = getParam("staff");
  const tokenValid = urlToken===ADMIN_TOKEN;

  useEffect(()=>{
    // Inject CSS
    const s=document.createElement("style");
    s.textContent=GLOBAL_CSS;
    document.head.appendChild(s);
    // Fonts
    const l=document.createElement("link");
    l.href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap";
    l.rel="stylesheet";
    document.head.appendChild(l);
    // Viewport
    let vm=document.querySelector("meta[name=viewport]");
    if(!vm){vm=document.createElement("meta");vm.name="viewport";document.head.appendChild(vm);}
    vm.content="width=device-width,initial-scale=1,viewport-fit=cover";

    // Firebase is already initialised at module level via npm import.
    // Just load pricing settings then mark ready.
    loadPricing()
      .then(p=>{ setPricing(p); setReady(true); })
      .catch(e=>{
        console.error("Firestore error:",e);
        // Still mark ready — use default pricing if Firestore is unreachable
        setReady(true);
      });
  },[]);

  if(!ready) return <LoadingScreen message="Connecting to database..."/>;

  if(fbError) return(
    <div style={{minHeight:"100dvh",background:B.black,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center"}}>
      <Logo size={44}/>
      <div style={{marginTop:32,background:"#2A0A0A",border:"1px solid #4A1010",borderRadius:16,padding:24,maxWidth:340}}>
        <Ic n="wifi" s={36} c="#F87171"/>
        <p style={{color:"#F87171",fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,marginTop:12,marginBottom:8}}>Connection Error</p>
        <p style={{color:"#aaa",fontSize:14,lineHeight:1.6,marginBottom:20}}>{fbError}</p>
        <button className="tap-btn" onClick={()=>window.location.reload()} style={{background:B.red,border:"none",borderRadius:12,padding:"13px 0",width:"100%",color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"}}>
          RETRY
        </button>
      </div>
    </div>
  );

  if(session?.role==="admin")  return <AdminApp pricing={pricing} setPricing={setPricing} onLogout={()=>setSession(null)}/>;
  if(session?.role==="member") return <MemberApp member={session.member} pricing={pricing} onLogout={()=>setSession(null)}/>;
  if(tokenValid) return <StaffLogin onLogin={()=>setSession({role:"admin"})} onBack={()=>{ window.history.replaceState({},"",window.location.pathname); window.location.reload(); }}/>;
  if(showReg) return <MemberRegister pricing={pricing} onSuccess={m=>setSession({role:"member",member:m})} onBack={()=>setShowReg(false)}/>;
  return <MemberLogin onLogin={m=>setSession({role:"member",member:m})} onRegister={()=>setShowReg(true)}/>;
}
