// lib/calculations.js — FINAL, match chính xác index.js imports
// Verified imports from index.js:
// A, calcVSA, calcElliott, calcTI, calcMH, calcVerdict,
// calcPricePattern, analyzeCurve, runStress, calcHandoff,
// interpCG, calcPCI, detectRegime, getWeights,
// fmtTime, fmtAge, extractJ, getTxt,
// calcLiq, calcEZ, calcSC, buildPlan

// ─── Constants ────────────────────────────────────────────────────────────────
export const A = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b', orange:'#f97316',
  blue:'#3b82f6',  teal:'#14b8a6', purple:'#8b5cf6', cyan:'#06b6d4',
  muted:'#5a7090',
  BULL:'TĂNG', BEAR:'GIẢM', NEUTRAL:'TRUNG LẬP',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function fmtTime(ts) {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString('vi-VN',{
    hour:'2-digit', minute:'2-digit', second:'2-digit',
  });
}

export function fmtAge(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000)    return `${Math.floor(d/1000)}s ago`;
  if (d < 3600000)  return `${Math.floor(d/60000)}m ago`;
  return `${Math.floor(d/3600000)}h ago`;
}

export function extractJ(text) {
  if (!text) return null;
  try {
    const arr = text.match(/\[[\s\S]*?\]/);
    if (arr) return JSON.parse(arr[0]);
    const obj = text.match(/\{[\s\S]*?\}/);
    if (obj) return JSON.parse(obj[0]);
  } catch {}
  return null;
}

export function getTxt(d) {
  if (!d) return '';
  if (Array.isArray(d.content))
    return d.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  if (d.choices?.[0]?.message?.content) return d.choices[0].message.content;
  if (typeof d === 'string') return d;
  return '';
}

// ─── calcVSA(priceChart) ─────────────────────────────────────────────────────
export function calcVSA(priceChart) {
  const bars = priceChart || [];
  const EMPTY = {
    score:50, bullish:false, bearish:false,
    meta:{short:'N/A', label:'VSA: N/A'},
    latestBar:{volRatio:1, relSpread:1}, atr:0.12, bars:[],
  };
  if (!bars.length) return EMPTY;
  const n      = bars.length;
  const avgVol = bars.slice(-20).reduce((s,b)=>s+(b.vol||0),0) / Math.min(20,n);
  const last   = bars[n-1];
  const prev   = bars[n>1?n-2:0];
  const volR   = avgVol>0 ? (last.vol||0)/avgVol : 1;
  const isUp   = (last.comex||0) >= (prev?.comex||0);
  // ATR approximation
  const atr    = bars.slice(-10).reduce((s,b,i,a)=>{
    if (!i) return s;
    return s + Math.abs((b.comex||0)-(a[i-1].comex||0));
  },0) / Math.max(bars.slice(-10).length-1,1) || 0.12;

  let score=50, bullish=false, bearish=false;
  let short='Neutral', label='VSA: Neutral';
  if (volR>1.5&&isUp)  {score=75;bullish=true;short=`Demand ${volR.toFixed(1)}×`;label=`VSA: Demand Bar (${volR.toFixed(1)}×)`;}
  if (volR>1.5&&!isUp) {score=28;bearish=true;short=`Supply ${volR.toFixed(1)}×`;label=`VSA: Supply Bar (${volR.toFixed(1)}×)`;}
  if (volR<0.5&&!isUp) {score=65;bullish=true;short='No Supply';label='VSA: No Supply';}
  if (volR<0.5&&isUp)  {score=40;short='No Demand';label='VSA: No Demand';}
  if (volR>2.5)        {
    bullish=isUp; bearish=!isUp;
    score=isUp?72:30;
    short='Climax'; label=`VSA: Climax (${volR.toFixed(1)}×)`;
  }
  return { score, bullish, bearish, atr,
    meta:{short, label},
    latestBar:{volRatio:volR, relSpread:volR},
    bars:[] };
}

// ─── calcElliott(priceChart, comex) ──────────────────────────────────────────
export function calcElliott(priceChart, cp) {
  const bars  = priceChart || [];
  const price = cp || bars[bars.length-1]?.comex || 6.07;
  const DEF   = {
    wave:'?', label:'W?: N/A', score:50, failure:false, prob:50, rsi:50,
    fib382:+(price*0.990).toFixed(4), fib500:+(price*0.985).toFixed(4),
    fib618:+(price*0.975).toFixed(4), fib786:+(price*0.960).toFixed(4),
    w3Target:+(price*1.10).toFixed(4), scenario:'Chờ dữ liệu',
  };
  if (!bars.length) return DEF;
  const n   = bars.length;
  const sl  = bars.slice(-20);
  const hi  = Math.max(...sl.map(b=>b.comex||price));
  const lo  = Math.min(...sl.map(b=>b.comex||price));
  const rng = Math.max(hi-lo, 0.001);
  const pos = (price-lo)/rng;
  const cl  = bars.slice(-15).map(b=>b.comex||price);
  let g=0,ls=0;
  for(let i=1;i<cl.length;i++){const d=cl[i]-cl[i-1];d>0?g+=d:ls-=d;}
  const rsi = ls===0?100:Math.round(100-100/(1+g/ls));
  const mom = n>=5?(bars[n-1].comex||price)-(bars[n-5].comex||price):0;
  let wave='3',label='Wave 3 (Impulse)',score=65,failure=false;
  if      (pos<0.25&&mom<0)           {wave='4';label='Wave 4 (Correction)';score=58;}
  else if (pos<0.35&&mom>0)           {wave='2';label='Wave 2 (Spring)';score=62;}
  else if (pos>0.8&&rsi>70)           {wave='5';label='Wave 5 (Exhaustion)';score=50;failure=true;}
  else if (pos>0.7&&mom<0)            {wave='A';label='Wave A (Reversal)';score=42;failure=true;}
  else if (pos>0.55&&mom>0&&rsi>50)   {wave='3';label='Wave 3 (Impulse ↑)';score=75;}
  return {
    wave, label, score, failure, rsi, prob:score,
    fib382:+(lo+rng*0.618).toFixed(4), fib500:+(lo+rng*0.5).toFixed(4),
    fib618:+(lo+rng*0.382).toFixed(4), fib786:+(lo+rng*0.214).toFixed(4),
    w3Target:+(lo+rng*1.618).toFixed(4),
    scenario:failure?'Cẩn thận đảo chiều':'Uptrend continuation',
  };
}

// ─── calcTI(priceChart, comex, rsiH4, vsa, ew) ───────────────────────────────
export function calcTI(priceChart, cp, rsiH4, vsa, ew) {
  const rsi     = rsiH4 || ew?.rsi || 50;
  const ewScore = ew?.score  || 50;
  const vsaScore= vsa?.score || 50;
  const pk1Score= Math.round(ewScore*0.40 + vsaScore*0.35 + (rsi>50?65:35)*0.25);
  const pk1Col  = pk1Score>=65?A.green:pk1Score>=45?A.amber:A.red;
  const bars    = priceChart||[];
  const sma20   = bars.length
    ? bars.slice(-20).reduce((a,b)=>a+(b.comex||0),0)/Math.min(20,bars.length)
    : cp||6.07;
  return {
    pk1Score, pk1Col, rsi, sma20, score:pk1Score,
    bb:{upper:+(sma20*1.02).toFixed(4), lower:+(sma20*0.98).toFixed(4), mid:+sma20.toFixed(4)},
  };
}

// ─── calcMH(invChart,cotChart,cmex,pCmex,lme,pLme,shfe,pShfe,mmLong) ─────────
export function calcMH(invChart,cotChart,cmex,pCmex,lme,pLme,shfe,pShfe,mmLong) {
  const dCmex = pCmex>0 ? ((cmex||0)-(pCmex||0))/(pCmex||1)*100 : 0;
  const dLme  = pLme >0 ? ((lme||0)-(pLme||0))  /(pLme||1) *100 : 0;
  const dShfe = pShfe>0 ? ((shfe||0)-(pShfe||0)) /(pShfe||1)*100 : 0;
  const invScore = dCmex<0&&dLme<0 ? 70 : dCmex<0||dLme<0 ? 58 : 42;
  const mmScore  = (mmLong||0)>60000?68:(mmLong||0)>50000?55:40;
  const pk2Score = Math.round(invScore*0.6 + mmScore*0.4);
  const pk2Col   = pk2Score>=60?A.green:pk2Score>=45?A.amber:A.red;
  return {
    pk2Score, pk2Col, invScore, mmScore, score:pk2Score,
    dCmex:+dCmex.toFixed(1), dLme:+dLme.toFixed(1), dShfe:+dShfe.toFixed(1),
  };
}

// ─── calcPricePattern(priceChart) ────────────────────────────────────────────
export function calcPricePattern(priceChart) {
  const bars = priceChart||[];
  if (!bars.length) return {pattern:'None',score:50};
  const n   = bars.length;
  const hi  = Math.max(...bars.slice(-10).map(b=>b.comex||0));
  const lo  = Math.min(...bars.slice(-10).map(b=>b.comex||0));
  const cp  = bars[n-1]?.comex||0;
  const rng = hi-lo||0.001;
  const pos = (cp-lo)/rng;
  let pattern='Consolidation', score=50;
  if (pos<0.2) {pattern='Near Support';   score=65;}
  if (pos>0.8) {pattern='Near Resistance';score=40;}
  return {pattern,score,hi,lo};
}

// ─── analyzeCurve(futures) ───────────────────────────────────────────────────
export function analyzeCurve(futures) {
  if (!futures?.length) return {
    type:'CONTANGO', col:A.amber, biasAdj:0,
    label:'Contango (normal)', detail:'Chưa có dữ liệu',
  };
  const sorted = [...futures].sort((a,b)=>a.months-b.months);
  const first  = sorted[0]?.price||6.07;
  const last   = sorted[sorted.length-1]?.price||6.07;
  const spread = ((last-first)/first*100);
  const isBack = spread < -0.3;
  return {
    type:    isBack?'BACKWARDATION':'CONTANGO',
    col:     isBack?A.green:A.amber,
    biasAdj: isBack?8:-3,
    spread:  +spread.toFixed(2),
    label:   isBack?'Backwardation (bullish)':'Contango (bearish/normal)',
    detail:  `Spread ${spread.toFixed(2)}% · ${sorted.length} tháng`,
  };
}

// ─── runStress(bsEvents, biasRaw) ────────────────────────────────────────────
export function runStress(bsEvents, biasRaw) {
  const evs    = bsEvents||[];
  const avgImp = evs.length ? evs.reduce((a,e)=>a+(e.impact||0),0)/evs.length : 0;
  const maxImp = evs.length ? Math.max(...evs.map(e=>e.impact||0)) : 0;
  const bsRisk = Math.round(avgImp*0.6 + maxImp*0.4);
  const sevCol = bsRisk>70?A.red:bsRisk>50?A.orange:A.amber;
  const bias   = biasRaw||63;
  return {
    bsRisk, sevCol,
    avgImp:+avgImp.toFixed(1), maxImp,
    bearCase:Math.max(0,bias-Math.round(bsRisk*0.3)),
    bullCase:Math.min(100,bias+10),
    baseCase:bias,
  };
}

// ─── calcHandoff(comex_chg_pct, session_vol, avg_vol) ────────────────────────
export function calcHandoff(chgPct, sessionVol, avgVol) {
  const volR  = avgVol>0 ? (sessionVol||0)/(avgVol||1) : 1;
  const base  = (chgPct||0)>0 ? 60 : 40;
  const score = Math.max(0,Math.min(100, base + (volR>1.2?8:volR<0.8?-8:0)));
  return {
    score, volR:+volR.toFixed(2),
    label:volR>1.5?'Volume cao':volR<0.8?'Volume thấp':'Volume bình thường',
  };
}

// ─── interpCG(cu_gold_ratio) ─────────────────────────────────────────────────
export function interpCG(ratio) {
  const r   = ratio||0.059;
  const adj = r>0.065?8:r>0.055?3:r>0.045?-3:-8;
  const label = r>0.065?'Cu/Au cao (bullish)':r<0.045?'Cu/Au thấp (bearish)':'Bình thường';
  return {adj, label, ratio:r};
}

// ─── calcPCI(mm_long, comm_short) ────────────────────────────────────────────
export function calcPCI(mmLong, commShort) {
  const mm    = mmLong||0;
  const cs    = Math.abs(commShort||0);
  const total = mm+cs||1;
  return Math.round(mm/total*100);
}

// ─── detectRegime(dxy_chg, fear_greed, cu_gold_ratio) ────────────────────────
export function detectRegime(dxyChg, fearGreed, cuGoldRatio) {
  const dxy = dxyChg||0, fg = fearGreed||58, cgr = cuGoldRatio||0.059;
  if (dxy>0.5 && fg<35)   return 'risk_off';
  if (dxy>0.3 && cgr<0.05) return 'stagflation';
  return 'risk_on';
}

// ─── getWeights(regime) ───────────────────────────────────────────────────────
export function getWeights(regime) {
  if (regime==='risk_off')    return {elliott:0.30,vsa:0.25,wyckoff:0.20,ti:0.15,inter:0.10};
  if (regime==='stagflation') return {elliott:0.25,vsa:0.20,wyckoff:0.25,ti:0.15,inter:0.15};
  return {elliott:0.25,vsa:0.25,wyckoff:0.20,ti:0.15,inter:0.15};
}

// ─── calcVerdict(pk1Score, pk2Score, bias, stress) ───────────────────────────
export function calcVerdict(pk1Score, pk2Score, bias, stress) {
  const bsAdj = Math.round((stress?.bsRisk||0)*0.12);
  const final = Math.max(0,Math.min(100,
    Math.round(pk1Score*0.35 + pk2Score*0.30 + bias*0.35) - bsAdj
  ));
  const verdictLabel = final>=70?'🚀 LONG SETUP'
    :final>=55?'⏳ THEO DÕI'
    :final>=40?'⚠️ THẬN TRỌNG'
    :'🛑 KHÔNG GIAO DỊCH';
  const verdictCol = final>=70?A.green:final>=55?A.amber:final>=40?A.orange:A.red;
  const verdictDesc= final>=70?'Confluence đủ mạnh, vào lệnh với SL chặt'
    :final>=55?'Chờ thêm xác nhận'
    :'Rủi ro cao, đứng ngoài';
  return {final, verdictLabel, verdictCol, verdictDesc, pk1Score, pk2Score, bias};
}

// ─── calcLiq(comex, prevHigh, prevLow, sessionVol, avgVol) ───────────────────
export function calcLiq(comex, prevHigh, prevLow, sessionVol, avgVol) {
  const cp   = comex||6.07;
  const volR = avgVol>0 ? (sessionVol||0)/(avgVol||1) : 1;
  const nearH= Math.abs(cp-(prevHigh||cp)) < 0.05;
  const nearL= Math.abs(cp-(prevLow||cp))  < 0.05;
  const type = volR>2.5?'volume_climax'
    :nearH?'resistance_sweep'
    :nearL?'support_sweep'
    :'normal';
  const col   = type!=='normal'?A.amber:A.green;
  const badge = type==='volume_climax'?'⚡ VOLUME CLIMAX'
    :type==='resistance_sweep'?'🔴 RESISTANCE ZONE'
    :type==='support_sweep'?'🟢 SUPPORT ZONE'
    :'💧 NORMAL LIQ';
  return {
    type, col, badge, volR:+volR.toFixed(2),
    detail:`Vol ${volR.toFixed(1)}× TB | H:$${(prevHigh||cp).toFixed(3)} L:$${(prevLow||cp).toFixed(3)}`,
  };
}

// ─── calcEZ(comex, sl, tp1, tp2, prevHigh, prevLow, atr) ─────────────────────
export function calcEZ(comex, sl, tp1, tp2, prevHigh, prevLow, atr) {
  const cp = comex||6.07, at = atr||0.12;
  const rr = (cp>0&&sl>0) ? +((tp1-cp)/(cp-sl)).toFixed(1) : 2.0;
  return {
    z1:{ low:+(cp-at*0.3).toFixed(3), high:+(cp+at*0.3).toFixed(3), rr },
    z2:{ low:+(cp*0.995).toFixed(3),  high:+(cp*1.005).toFixed(3),  rr:+(rr*0.8).toFixed(1) },
    sl:  sl  || +(cp-at*2).toFixed(3),
    tp1: tp1 || +(cp+at*2).toFixed(3),
    tp2: tp2 || +(cp+at*4).toFixed(3),
    rr,
  };
}

// ─── calcSC(ew, vsa, stress, bias, comex, tp1, tp2, sl) ──────────────────────
export function calcSC(ew, vsa, stress, bias, comex, tp1, tp2, sl) {
  const cp   = comex||6.07;
  const bsR  = stress?.bsRisk||30;
  const convP= Math.min(95,Math.max(5,Math.round(bias*0.6+((ew?.score||50)-50)*0.4)));
  const divP = Math.min(90,Math.max(5,100-convP-10));
  const brkP = Math.min(85,Math.max(5,Math.round(bsR*0.5+(100-bias)*0.3)));
  return {
    conv:{
      label:'HỘI TỤ TĂNG', prob:convP, col:A.green,
      detail:`Elliott W${ew?.wave||'?'} + VSA ${vsa?.meta?.short||'N/A'}`,
      tp:+(cp+(tp1-cp)*1.3).toFixed(3),
      cond:'Vol > 1.2× TB, giá giữ trên EZ',
    },
    div:{
      label:'PHÂN KỲ', prob:divP, col:A.amber,
      detail:'Tín hiệu mâu thuẫn, thận trọng',
      cond:'Vol thấp, giá dao động sideways',
    },
    brk:{
      label:'PHÁ VỠ GIẢM', prob:brkP, col:A.red,
      detail:`BS Risk ${bsR}/100`,
      target:+(cp-(tp1-cp)).toFixed(3),
      cond:`H4 đóng cửa dưới $${sl||+(cp-0.24).toFixed(3)}`,
    },
  };
}

// ─── buildPlan(s,ew,vsa,ti,mh,verdict,bias,stress,liq,ez,sc) ─────────────────
export function buildPlan(s,ew,vsa,ti,mh,verdict,bias,stress,liq,ez,sc) {
  const cp = s?.comex||6.07;
  const sl = s?.sl   ||+(cp-0.24).toFixed(3);
  const tp1= s?.tp1  ||+(cp+0.25).toFixed(3);
  const tp2= s?.tp2  ||+(cp+0.51).toFixed(3);
  const v  = verdict?.final||50;

  const scenarios = [
    {
      id:'A', name:'LONG SETUP',
      badge:v>=65?'✅ ACTIVE':'⏳ WATCH',
      col:A.green, prob:sc?.conv?.prob||60,
      active:v>=65, type:'long',
      thesis:`W${ew?.wave||'?'} + ${vsa?.meta?.short||'VSA'} hỗ trợ. Bias ${bias}/100.`,
      entry:{low:ez?.z1?.low||cp, high:ez?.z1?.high||cp, rr:ez?.rr||2},
      sl, tp1, tp2,
      confirmations:[
        {lbl:'Verdict ≥ 65',       ok:v>=65,              note:`${v}/100`},
        {lbl:'Elliott không Fail',  ok:!ew?.failure,       note:`W${ew?.wave||'?'}`},
        {lbl:'VSA Bullish',         ok:!!vsa?.bullish,     note:vsa?.meta?.short||'N/A'},
        {lbl:'Vol > 1.2× TB',       ok:(liq?.volR||1)>1.2, note:`${(liq?.volR||1).toFixed(1)}×`},
      ],
      invalidation:`H4 đóng dưới $${sl}`,
    },
    {
      id:'B', name:'THEO DÕI',
      badge:'⏳ WATCH', col:A.amber,
      prob:sc?.div?.prob||25, active:v>=45&&v<65, type:'watch',
      thesis:'Tín hiệu hỗn hợp. Chờ xác nhận thêm.',
      entry:{low:0,high:0,rr:0}, sl:0, tp1:0, tp2:0,
      confirmations:[
        {lbl:'Verdict 45–65', ok:v>=45&&v<65, note:`${v}/100`},
        {lbl:'Vol bình thường',ok:(liq?.volR||1)<1.5, note:`${(liq?.volR||1).toFixed(1)}×`},
      ],
      invalidation:'Verdict giảm dưới 40',
    },
    {
      id:'C', name:'TRÁNH / SHORT',
      badge:'🛑 AVOID', col:A.red,
      prob:sc?.brk?.prob||15, active:v<45, type:'avoid',
      thesis:`BS Risk ${stress?.bsRisk||0}/100. Verdict ${v}/100.`,
      entry:{low:0,high:0,rr:0}, sl:0, tp1:0, tp2:0,
      confirmations:[
        {lbl:'Verdict < 45',  ok:v<45,                      note:`${v}/100`},
        {lbl:'BS Risk cao',   ok:(stress?.bsRisk||0)>60,    note:`${stress?.bsRisk||0}/100`},
      ],
      invalidation:'Verdict vượt 55',
    },
  ];

  const keyLevels = [
    {icon:'🎯',lbl:'TP2',    price:+tp2,              type:'TARGET',   col:A.cyan,  action:'Chốt 100% lợi nhuận'},
    {icon:'🎯',lbl:'TP1',    price:+tp1,              type:'TARGET',   col:A.green, action:'Chốt 50%, giữ 50%'},
    {icon:'⚡',lbl:'Entry',  price:cp,                type:'ENTRY',    col:A.blue,  action:'Vào lệnh theo plan'},
    {icon:'🛑',lbl:'SL',     price:+sl,               type:'STOPLOSS', col:A.red,   action:'Thoát toàn bộ'},
    {icon:'📌',lbl:'Prev H', price:s?.prev_high||cp,  type:'RESIST',   col:A.orange,action:'Kháng cự quan trọng'},
    {icon:'📌',lbl:'Prev L', price:s?.prev_low||cp,   type:'SUPPORT',  col:A.purple,action:'Hỗ trợ quan trọng'},
  ].sort((a,b)=>b.price-a.price);

  return {scenarios, keyLevels};
}

// ─── calcShortSetup ───────────────────────────────────────────────────────────
export function calcShortSetup(safeS, ew, vsa, verdict, imSignals, atr) {
  const cp  = safeS?.comex||6.07;
  const at  = atr||0.12;
  const c1  = (verdict?.final||50)<42;
  const c2  = ew?.failure||ew?.wave==='5'||ew?.wave==='A';
  const c3  = vsa?.bearish||(vsa?.score||50)<38;
  const c4  = imSignals
    ? Object.entries(imSignals).some(([k,v])=>k==='DXY'&&v?.change>0)
    : false;
  const met = [c1,c2,c3,c4].filter(Boolean).length;
  if (met<2) return {active:false,strength:0,conditions:{cond1:c1,cond2:c2,cond3:c3,cond4:c4}};
  const strength = Math.min(100,Math.round((c1?25:0)+(c2?30:0)+(c3?25:0)+(c4?20:0)));
  const sl=+(cp+at*2).toFixed(3), tp1=+(cp-at*1.5).toFixed(3);
  return {
    active:true, strength,
    conditions:{cond1:c1,cond2:c2,cond3:c3,cond4:c4},
    entry:{low:+(cp*0.998).toFixed(3), high:+(cp*1.005).toFixed(3)},
    sl, tp1, tp2:+(cp-at*3).toFixed(3), tp3:+(cp-at*5).toFixed(3),
    rr:+((cp-tp1)/(sl-cp)).toFixed(1),
    thesis:`SHORT ${met}/4 điều kiện`,
    trigger:`Đóng dưới $${(cp-at*0.5).toFixed(3)}`,
    invalidation:`Vượt $${sl}`,
  };
}

export default {
  A, fmtTime, fmtAge, extractJ, getTxt,
  calcVSA, calcElliott, calcTI, calcMH, calcVerdict,
  calcPricePattern, analyzeCurve, runStress, calcHandoff,
  interpCG, calcPCI, detectRegime, getWeights,
  calcLiq, calcEZ, calcSC, buildPlan, calcShortSetup,
};

// ─── getSession — xác định phiên giao dịch hiện tại ─────────────────────────
// Layout.js: getSession()
export function getSession() {
  const h = new Date().getUTCHours();
  // Asian: 0-8 UTC, London: 7-16 UTC, NY: 12-21 UTC
  if (h >= 12 && h < 21) return { name:'New York',   col:'#3b82f6', icon:'🗽', active:true  };
  if (h >=  7 && h < 16) return { name:'London',     col:'#8b5cf6', icon:'🇬🇧', active:true  };
  if (h >=  0 && h <  8) return { name:'Asia',       col:'#22c55e', icon:'🌏', active:true  };
  return                         { name:'Off-Hours',  col:'#5a7090', icon:'🌙', active:false };
}

// ─── getHunting — xác định liquidity hunting zones ───────────────────────────
// Layout.js: getHunting(priceData)
export function getHunting(priceData) {
  const cp  = priceData?.comex || 6.07;
  const atr = priceData?.atr   || 0.12;
  const hi  = priceData?.prev_high || cp * 1.01;
  const lo  = priceData?.prev_low  || cp * 0.99;
  // Stop hunt zones
  const huntUp   = +(hi + atr * 0.3).toFixed(3);
  const huntDown = +(lo - atr * 0.3).toFixed(3);
  const nearUp   = Math.abs(cp - hi) < atr * 0.5;
  const nearDown = Math.abs(cp - lo) < atr * 0.5;
  return {
    huntUp,
    huntDown,
    nearUp,
    nearDown,
    active: nearUp || nearDown,
    label:  nearUp   ? `🎯 Stop Hunt ↑ $${huntUp}`
          : nearDown ? `🎯 Stop Hunt ↓ $${huntDown}`
          : 'No Hunt Zone',
    col:    nearUp || nearDown ? '#f59e0b' : '#5a7090',
  };
}

// ─── isOverlap — kiểm tra 2 phiên có overlap không ──────────────────────────
// Layout.js: isOverlap()
export function isOverlap() {
  const h = new Date().getUTCHours();
  // London–NY overlap: 12-16 UTC
  if (h >= 12 && h < 16) return { overlap:true,  name:'London–NY',  col:'#22c55e', vol:'Cao nhất' };
  // Asia–London overlap: 7-8 UTC
  if (h >=  7 && h <  8) return { overlap:true,  name:'Asia–London',col:'#14b8a6', vol:'Trung bình' };
  return                         { overlap:false, name:'No Overlap', col:'#5a7090', vol:'Thấp' };
}