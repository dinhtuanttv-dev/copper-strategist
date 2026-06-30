// ═══════════════════════════════════════════════════════════════
// COPPER STRATEGIST — Calculations Library
// Tách từ code gốc, dùng chung cho toàn app
// ═══════════════════════════════════════════════════════════════

// ─── Màu sắc ─────────────────────────────────────────────────
export const A = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', teal:'#14b8a6', purple:'#8b5cf6',
  orange:'#f97316', cyan:'#06b6d4', muted:'#5a7090',
};

// ─── Z-Score theo sàn ────────────────────────────────────────
export const zSc = (r, k) => {
  const h = {
    cmex: { mean:1.1, std:0.8 },
    lme:  { mean:0.4, std:0.6 },
    shfe: { mean:0.7, std:0.9 },
  }[k];
  return h ? +((r - h.mean) / h.std).toFixed(2) : 0;
};

// ─── Drain rate ───────────────────────────────────────────────
export const drn = (c, p) => p > 0 ? +((p - c) / p * 100).toFixed(2) : 0;

// ─── Position Crowding Index ──────────────────────────────────
export const calcPCI = (mm, comm) => {
  const a = Math.abs(mm   || 64000);
  const b = Math.abs(comm || 73000);
  return Math.min(Math.round((a / (a + b)) * 100), 99);
};

// ─── Format thời gian ─────────────────────────────────────────
export const fmtAge = ts => {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s trước`;
  if (s < 3600)  return `${Math.floor(s/60)}m trước`;
  if (s < 86400) return `${Math.floor(s/3600)}h trước`;
  return `${Math.floor(s/86400)}d trước`;
};

export const fmtTime = ts =>
  ts ? new Date(ts).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' }) : '–';

export const fmtDate = ts =>
  ts ? new Date(ts).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' }) : '–';

// ─── Regime detection ────────────────────────────────────────
export const detectRegime = (dc, fg, cg) => {
  if (dc > 0.5 && fg < 40)              return 'risk_off';
  if (dc > 0.3 && fg < 55 && cg < 0.050) return 'stagflation';
  return 'risk_on';
};

export const getWeights = r => {
  if (r === 'risk_off')    return [0.10,0.10,0.20,0.20,0.15,0.25];
  if (r === 'stagflation') return [0.10,0.10,0.25,0.25,0.15,0.15];
  return [0.18,0.18,0.15,0.15,0.22,0.12];
};

// ─── Session handoff ──────────────────────────────────────────
export const calcHandoff = (chg, vol, avg) => {
  const m = (chg||0) * ((vol||91000) / (avg||105000));
  if (m >  0.5) return { score:10,  col:A.green  };
  if (m >  0.15) return { score:5,  col:A.teal   };
  if (m < -0.5) return { score:-10, col:A.red    };
  if (m < -0.15) return { score:-5, col:A.orange };
  return { score:0, col:A.muted };
};

// ─── Cu/Gold ratio ────────────────────────────────────────────
export const interpCG = r => {
  if (r > 0.065) return { label:'TĂNG MẠNH',  col:A.green,  adj:5  };
  if (r > 0.055) return { label:'TÍCH CỰC',   col:A.teal,   adj:2  };
  if (r > 0.050) return { label:'TRUNG LẬP',  col:A.amber,  adj:0  };
  if (r > 0.042) return { label:'CẢNH BÁO',   col:A.orange, adj:-5 };
  return           { label:'RISK-OFF',   col:A.red,    adj:-8 };
};

// ─── Black Swan stress test ───────────────────────────────────
export const runStress = (events, raw) => {
  let ac = 0, st = 0;
  (events||[]).forEach(e => {
    const w = e.impact * 0.01;
    if (e.bsType === 'acute') ac += w * 8;
    else                      st += w * 15;
  });
  const bsRisk = Math.min(Math.round(ac + st), 100);
  const pen    = Math.round(ac * 0.08 + st * 0.18);
  return {
    bsRisk,
    acutePts:  Math.round(ac),
    structPts: Math.round(st),
    sevLabel:  bsRisk>70 ? '🔴 CAO' : bsRisk>45 ? '🟠 TB' : '🟢 THẤP',
    sevCol:    bsRisk>70 ? A.red    : bsRisk>45 ? A.orange : A.green,
  };
};

// ─── Session & Kill Zone ──────────────────────────────────────
export const getSession = () => {
  const h = new Date().getHours();
  return h>=9&&h<15 ? 'asia' : h>=15&&h<20 ? 'europe' : 'us';
};

export const getHunting = () => {
  const t = new Date().getHours()*60 + new Date().getMinutes();
  if (t>=360&&t<540)  return { active:true, session:'Á',  range:'06:00–09:00', col:A.cyan   };
  if (t>=810&&t<870)  return { active:true, session:'Âu', range:'13:30–14:30', col:A.purple };
  return { active:false };
};

export const isOverlap = () => {
  const t = new Date().getHours()*60 + new Date().getMinutes();
  return t>=1200 && t<1320;
};

// ─── Futures curve ────────────────────────────────────────────
export const analyzeCurve = futures => {
  if (!futures || futures.length < 2) return {
    type:'FLAT', label:'⚪ Flat', col:A.blue,
    desc:'Chưa đủ dữ liệu.', biasAdj:0,
    tradeSignal:'–', spread12:0, spread16:0, rollYield:0, alerts:[],
  };
  const p = futures.map(f => f.price);
  const hg1=p[0]||6.07, hg2=p[1]||hg1, hg6=p[5]||hg1;
  const spread12 = +(hg1-hg2).toFixed(4);
  const spread16 = +(hg1-hg6).toFixed(3);
  const rollYield = hg1>0 ? +((hg1-hg2)/hg1*100/2*12).toFixed(2) : 0;
  let type,label,col,desc,biasAdj,tradeSignal;
  if (spread12>0.05){
    type='DEEP_BACK';label='🔴 Deep Backwardation';col=A.green;
    desc='Khan hiếm cấp tính.';biasAdj=8;tradeSignal='STRONG LONG';
  } else if (spread16>0.02){
    type='BACKWARDATION';label='🟢 Backwardation';col=A.green;
    desc='Cầu giao ngay > cung.';biasAdj=5;tradeSignal='LONG';
  } else if (Math.abs(spread16)<0.01){
    type='FLAT';label='⚪ Flat/Neutral';col=A.blue;
    desc='Cân bằng cung cầu.';biasAdj=0;tradeSignal='NEUTRAL';
  } else if (spread16<-0.10){
    type='DEEP_CONTANGO';label='🔴 Deep Contango';col=A.red;
    desc='Dư cung nghiêm trọng.';biasAdj=-6;tradeSignal='AVOID LONG';
  } else {
    type='CONTANGO';label='🟠 Contango';col=A.orange;
    desc='Kỳ hạn xa cao hơn giao ngay.';biasAdj=-3;tradeSignal='CAUTION';
  }
  const alerts=[];
  if (spread12>0.05)  alerts.push({ msg:'⚠️ Squeeze Risk',         col:A.red    });
  if (spread16<-0.10) alerts.push({ msg:'🟠 Deep Contango',         col:A.orange });
  if (rollYield>3)    alerts.push({ msg:`✅ Roll Yield +${rollYield}%/năm`, col:A.green });
  if (rollYield<-3)   alerts.push({ msg:`🔴 Negative Roll ${rollYield}%`,  col:A.red   });
  return { type,label,col,desc,biasAdj,tradeSignal,spread12,spread16,rollYield,alerts };
};

// ─── Price Pattern ────────────────────────────────────────────
const PAT_META = {
  DOUBLE_BOTTOM:      { name:'🔷 Double Bottom',    type:'bullish', col:A.green },
  DOUBLE_TOP:         { name:'🔶 Double Top',        type:'bearish', col:A.red   },
  HEAD_SHOULDERS:     { name:'🔴 Head & Shoulders',  type:'bearish', col:A.red   },
  BULL_FLAG:          { name:'🟢 Bull Flag',          type:'bullish', col:A.green },
  BEAR_FLAG:          { name:'🔴 Bear Flag',          type:'bearish', col:A.red   },
  ASCENDING_TRIANGLE: { name:'🟡 Tam Giác Tăng',     type:'bullish', col:A.amber },
  FALLING_WEDGE:      { name:'🟢 Nêm Giảm',          type:'bullish', col:A.green },
  NEUTRAL:            { name:'📊 Tuyến Tính',         type:'neutral', col:A.blue  },
};

export const calcPricePattern = pc => {
  if (!pc||pc.length<6) return {
    pattern:'NEUTRAL', meta:PAT_META.NEUTRAL, reliability:40, target:0,
    desc:'Chưa đủ dữ liệu.',
  };
  const prices=pc.map(b=>b.comex).filter(Boolean);
  const n=prices.length, hi=Math.max(...prices), lo=Math.min(...prices);
  const rng=hi-lo||0.01;
  const pivH=[], pivL=[];
  for (let i=1;i<n-1;i++){
    if (prices[i]>prices[i-1]&&prices[i]>prices[i+1]) pivH.push({i,v:prices[i]});
    if (prices[i]<prices[i-1]&&prices[i]<prices[i+1]) pivL.push({i,v:prices[i]});
  }
  const last=prices[n-1];
  let pattern='NEUTRAL', reliability=40, target=last, desc='';
  if (pivL.length>=2){
    const l1=pivL[pivL.length-2], l2=pivL[pivL.length-1];
    if (Math.abs(l1.v-l2.v)<rng*0.04&&last>l2.v*(1+rng/last*0.5)){
      pattern='DOUBLE_BOTTOM';reliability=72;
      target=+(last+(hi-l2.v)*0.8).toFixed(3);
      desc=`Hai đáy $${l1.v.toFixed(3)} & $${l2.v.toFixed(3)}. Target $${target}.`;
    }
  }
  if (pattern==='NEUTRAL'&&pivH.length>=2){
    const h1=pivH[pivH.length-2], h2=pivH[pivH.length-1];
    if (Math.abs(h1.v-h2.v)<rng*0.04&&last<h2.v*(1-rng/last*0.3)){
      pattern='DOUBLE_TOP';reliability=68;
      target=+(last-(h2.v-lo)*0.7).toFixed(3);
      desc=`Hai đỉnh $${h1.v.toFixed(3)} & $${h2.v.toFixed(3)}. Target $${target}.`;
    }
  }
  return { pattern, meta:PAT_META[pattern]||PAT_META.NEUTRAL, reliability, target, desc };
};

// ─── VSA ─────────────────────────────────────────────────────
const VM = {
  ABSORPTION_BULL: { label:'🟢 Hấp thụ Tăng', short:'Hấp thụ↑', type:'bullish', desc:'SM tích lũy.'      },
  ABSORPTION_BEAR: { label:'🔴 Hấp thụ Giảm', short:'Hấp thụ↓', type:'bearish', desc:'SM phân phối.'    },
  STOPPING_VOLUME: { label:'🟡 Lực Cản',       short:'Stopping',  type:'neutral', desc:'Vol cao giá ít.'  },
  UPTHRUST:        { label:'🔴 Upthrust',       short:'Upthrust',  type:'bearish', desc:'Phá đỉnh vol thấp.'},
  SPRING:          { label:'🟢 Spring',          short:'Spring',    type:'bullish', desc:'Phá đáy vol thấp.'},
  NO_DEMAND:       { label:'🔴 No Demand',       short:'No Demand', type:'bearish', desc:'Giá tăng vol thấp.'},
  NO_SUPPLY:       { label:'🟢 No Supply',       short:'No Supply', type:'bullish', desc:'Giá giảm vol thấp.'},
  NEUTRAL:         { label:'⚪ Bình thường',     short:'Neutral',   type:'neutral', desc:'Không có tín hiệu.'},
};

export const calcVSA = pc => {
  if (!pc||pc.length<3) return {
    bars:[], meta:VM.NEUTRAL, bullish:false, bearish:false, score:50,
    latestBar:{ volRatio:1, up:true, vsa:'NEUTRAL', spread:0 },
  };
  const bars = pc.map((b,i) => {
    if (!i) return {...b, spread:0, volRatio:1, vsa:'NEUTRAL', up:true};
    const sp = Math.abs(b.comex-pc[i-1].comex);
    const av = pc.slice(Math.max(0,i-5),i).reduce((s,x)=>s+(x.vol||100000),0)/Math.max(1,Math.min(5,i));
    const vr = (b.vol||100000)/av;
    const up = b.comex >= pc[i-1].comex;
    let vsa='NEUTRAL';
    if      (sp>0.04&&vr>1.6) vsa = up?'ABSORPTION_BULL':'ABSORPTION_BEAR';
    else if (vr>1.8&&sp<0.02) vsa = 'STOPPING_VOLUME';
    else if (vr<0.6&&sp>0.03) vsa = up?'UPTHRUST':'SPRING';
    else if (vr<0.55)         vsa = up?'NO_DEMAND':'NO_SUPPLY';
    return {...b, spread:+sp.toFixed(4), volRatio:+vr.toFixed(2), vsa, up};
  });
  const lat = bars[bars.length-1];
  const meta = VM[lat.vsa]||VM.NEUTRAL;
  const bullish = ['ABSORPTION_BULL','SPRING','NO_SUPPLY'].includes(lat.vsa);
  const bearish = ['ABSORPTION_BEAR','UPTHRUST','NO_DEMAND'].includes(lat.vsa);
  return { bars, latestBar:lat, meta, bullish, bearish, score:bullish?72:bearish?28:50 };
};

// ─── Elliott Wave ─────────────────────────────────────────────
export const calcElliott = (pc, comex) => {
  if (!pc||pc.length<5) return {
    wave:'?', prob:50, label:'Chưa đủ dữ liệu', scenario:'',
    failure:false, fib382:0, fib500:0, fib618:0, fib786:0, pos:0.5, score:50,
  };
  const prices=pc.map(b=>b.comex).filter(Boolean);
  const hi=Math.max(...prices), lo=Math.min(...prices), rng=hi-lo||0.01;
  const pos=rng>0?(comex-lo)/rng:0.5;
  const f382=hi-rng*0.382, f500=hi-rng*0.5, f618=hi-rng*0.618, f786=hi-rng*0.786;
  const last3=prices.slice(-3), mom=last3[2]-last3[0];
  let wave,prob,label,scenario,failure=false,score=50;
  if      (pos>0.85&&mom>0){ wave='3';prob=72;label='⚡ Sóng 3';score=80;scenario='Xu hướng tăng mạnh.'; }
  else if (pos>0.70&&mom>0){ wave='5';prob=60;label='🏁 Sóng 5';score=55;scenario='Đợt tăng cuối.';     }
  else if (pos<0.40&&mom<0&&comex>f618){ wave='4';prob=65;label='🔄 Sóng 4';score=60;scenario='Điều chỉnh.'; }
  else if (pos<0.30&&comex<f618){ wave='2';prob=58;label='🔁 Sóng 2';score=45;scenario='Pullback sâu.';  }
  else if (comex<f786){ wave='F';prob=80;label='❌ Wave Failure';failure=true;score=15;scenario='Cấu trúc vô hiệu.'; }
  else { wave='1';prob=55;label='🌱 Sóng 1';score=58;scenario='Khởi đầu xu hướng.'; }
  return { wave,prob,label,scenario,failure,
    fib382:+f382.toFixed(3), fib500:+f500.toFixed(3),
    fib618:+f618.toFixed(3), fib786:+f786.toFixed(3),
    pos:+pos.toFixed(3), score };
};

// ─── Technical Indicators ────────────────────────────────────
export const calcTI = (pc, comex, rsi, vsa, ew) => {
  const prices = pc.map(b=>b.comex).filter(Boolean);
  let patOK = true;
  if (['NO_DEMAND','UPTHRUST'].includes(vsa.latestBar?.vsa)&&vsa.latestBar?.up) patOK=false;
  const last5=prices.slice(-5), d1=last5[4]>last5[0]?'UP':'DOWN';
  const h4=rsi>50?'UP':'DOWN', tfc=d1===h4;
  const tfl=tfc?`✅ H4+D1 đồng thuận ${d1}`:`⚠️ H4/D1 phân kỳ`;
  const pk1=Math.max(0,Math.min(100,
    Math.round(ew.score*0.45+vsa.score*0.35+(tfc?20:5))+(patOK?0:-10)
  ));
  return {
    patternReliable:patOK, tfConverge:tfc, tfLabel:tfl,
    pk1Score:pk1,
    pk1Label:pk1>=70?'🟢 KỸ THUẬT MẠNH':pk1>=50?'🟡 TRUNG LẬP':'🔴 KỸ THUẬT YẾU',
    pk1Col:  pk1>=70?A.green:pk1>=50?A.amber:A.red,
  };
};

// ─── Market Health (PK2) ──────────────────────────────────────
export const calcMH = (inv,cot,cs,pc,ls,pl,ss,ps,mmL) => {
  const dC=drn(cs||9500,pc||11000), dL=drn(ls||280000,pl||285000), dS=drn(ss||51000,ps||54000);
  const zC=zSc(dC,'cmex'), zL=zSc(dL,'lme'), zSh=zSc(dS,'shfe');
  const cl=cot?.slice(-2)||[], cotM=cl.length>=2?(cl[1].mm||0)-(cl[0].mm||0):0;
  const cotB=cotM>1000&&(mmL||64000)>50000, dA=zC>1.5||zL>1.5;
  const rT=dA&&cotB, pT=dA&&!cotB;
  const invT=inv&&inv.length>=3
    ?(inv[inv.length-1].lme<inv[inv.length-3].lme?'DECREASING':'INCREASING'):'STABLE';
  const tl=rT?'🟢 THẮT CHẶT THẬT SỰ':pT?'🟡 THẮT CHẶT MỘT PHẦN':'⚪ BÌNH THƯỜNG';
  const tc=rT?A.green:pT?A.amber:A.muted;
  const zA=(zC+zL+zSh)/3;
  const pk2=Math.min(100,Math.round(
    Math.min(40,Math.max(0,zA*15+20))+(cotB?25:cotM>0?12:0)+(invT==='DECREASING'?20:10)
  ));
  return {
    dCmex:dC, dLme:dL, dShfe:dS, zC, zL, zS:zSh,
    cotMomentum:cotM, cotBullish:cotB, drainAlert:dA,
    realTightness:rT, partialTightness:pT,
    tightnessLabel:tl, tightnessCol:tc, invTrend:invT,
    pk2Score:pk2,
    pk2Label:pk2>=65?'🟢 NỀN TẢNG VỮNG':pk2>=40?'🟡 TRUNG LẬP':'🔴 NỀN TẢNG YẾU',
    pk2Col:  pk2>=65?A.green:pk2>=40?A.amber:A.red,
  };
};

// ─── Final Verdict ────────────────────────────────────────────
export const calcVerdict = (pk1, pk2, bias, stress) => {
  const comb=Math.round(pk1*0.4+pk2*0.35+bias*0.25);
  const pen=Math.round(stress.bsRisk*0.1);
  const final=Math.max(0,Math.min(100,comb-pen));
  let v,vl,vc,vd;
  if      (final>=75&&pk1>=65&&pk2>=60){ v='STRONG_BUY'; vl='🚀 STRONG BUY';    vc=A.green;  vd='PK1+PK2 đồng thuận Xanh.';  }
  else if (final>=60){ v='BUY';         vl='✅ BUY';                             vc=A.teal;   vd='Đa số tín hiệu tích cực.';  }
  else if (final>=45){ v='NEUTRAL';     vl='⏳ NEUTRAL';                         vc=A.amber;  vd='Tín hiệu hỗn hợp.';         }
  else if (final>=30){ v='SELL';        vl='⚠️ CAUTION';                         vc=A.orange; vd='Phần lớn tiêu cực.';        }
  else               { v='STRONG_SELL'; vl='🛑 STRONG SELL';                     vc=A.red;    vd='Kỹ thuật và Cơ bản tiêu cực.'; }
  return { verdict:v, verdictLabel:vl, verdictCol:vc, verdictDesc:vd,
    final, combined:comb, bsPenalty:pen,
    pk1OK:pk1>=65, pk2OK:pk2>=60, biasOK:bias>=60 };
};

// ─── Liquidity Detector ─────────────────────────────────────────────────────
export const calcLiq = (comex, pH, pL, sv, av) => {
  const vR = +((sv||91000)/(av||105000)).toFixed(2);
  const ph = pH||6.12, pl = pL||5.89;
  if (comex>ph && vR<0.85) return { type:'sweep_high', col:A.orange, volR:vR,
    badge:'🚀 QUÉT ĐỈNH', detail:`Vượt đỉnh ${ph.toFixed(3)} Vol thấp`, impact:false };
  if (comex<pl && vR<0.85) return { type:'sweep_low', col:A.orange, volR:vR,
    badge:'🚀 QUÉT ĐÁY', detail:`Xuyên đáy ${pl.toFixed(3)} Vol thấp`, impact:true };
  if (vR>1.8) return { type:'breakout_real', col:A.red, volR:vR,
    badge:'⚠️ PHÁ VỠ THẬT', detail:`Volume Climax ${(vR*100).toFixed(0)}% TB`,
    impact: comex>(ph+pl)/2 };
  return { type:'normal', col:A.blue, volR:vR, badge:'🔵 BÌNH THƯỜNG',
    detail:`Trong vùng ${pl.toFixed(3)}–${ph.toFixed(3)}`, impact:null };
};

// ─── Entry Zones (POI) ────────────────────────────────────────────────────
export const calcEZ = (comex, sl, tp1, tp2, pH, pL, atr) => {
  const a = atr||0.12, ph = pH||6.12, pl = pL||5.89;
  const z1L = +(pl+a*0.5).toFixed(3), z1H = +(pl+a*1.2).toFixed(3);
  const z2L = +(ph-a*0.8).toFixed(3), z2H = +(ph+a*0.3).toFixed(3);
  const r1 = +(z1H-(sl||5.72)).toFixed(3), w1 = +((tp1||6.32)-z1H).toFixed(3);
  const rr1 = r1>0 ? +(w1/r1).toFixed(1) : 0;
  const r2 = +(z2H-(sl||5.72)).toFixed(3), w2 = +((tp2||6.58)-z2H).toFixed(3);
  const rr2 = r2>0 ? +(w2/r2).toFixed(1) : 0;
  return { z1:{low:z1L,high:z1H,rr:rr1}, z2:{low:z2L,high:z2H,rr:rr2} };
};

// ─── Scenario Calculator (HỘI TỤ/PHÂN KỲ/GÃY) ────────────────────────────
export const calcSC = (ew, vsa, stress, bias, comex, tp1, tp2, sl) => {
  const bW = stress.bsRisk/100;
  const wP = ['3','1'].includes(ew.wave) ? 1 : ew.wave==='F' ? -2 : 0;
  const vB = vsa.bullish ? 1 : vsa.bearish ? -1 : 0;
  const cP = Math.max(5,Math.min(90, Math.round(35+wP*15+vB*12-bW*20+(bias-50)*0.3)));
  const cT = +(comex+(tp2-comex)*(1-bW*0.3)).toFixed(3);
  const dP = Math.max(5,Math.min(90, Math.round(25+(ew.wave==='5'?15:0)+bW*10)));
  const dTg = +(comex-(comex-sl)*0.5).toFixed(3);
  const bP = Math.max(5,Math.min(90, 100-cP-dP));
  const bTg = +(sl-(comex-sl)*0.3).toFixed(3);
  return {
    conv:{ prob:cP, tp:cT, label:'🟢 HỘI TỤ', col:A.green,
      detail:`W${ew.wave}+${vsa.meta.short} → $${cT}/lb`, cond:`Sóng ${ew.wave}+VSA ${vsa.meta.short}` },
    div:{ prob:dP, target:dTg, label:'🟡 PHÂN KỲ', col:A.amber,
      detail:`VSA yếu → $${dTg}/lb`, cond:'Vol yếu' },
    brk:{ prob:bP, target:bTg, label:'🔴 GÃY CẤU TRÚC', col:A.red,
      detail:`BS ${stress.bsRisk}/100 → $${bTg}/lb`, cond:`BS ${stress.bsRisk}/100` },
  };
};

// ─── Build Trade Plan (3 kịch bản A/B/C) ──────────────────────────────────
export const buildPlan = (s, ew, vsa, ti, mh, verdict, bias, stress, liq, ez, sc) => {
  const ph = (s.prev_high||6.12).toFixed(3);
  const pl = (s.prev_low||5.89).toFixed(3);
  const slA = ((s.prev_high||6.12)-0.03).toFixed(3);

  const scenarios = [
    {
      id:'A', name:'KẾ HOẠCH A – PULLBACK POI', badge:'CHÍNH', type:'primary',
      col:A.green, prob:sc.conv.prob,
      thesis:`Pullback về $${ez.z1.low}–$${ez.z1.high}. SM hấp thụ, tiếp tục ${ew.label}.`,
      trigger:`H1 đóng > $${ez.z1.high}, Vol>1.2×TB`,
      entry:ez.z1, sl:s.sl||5.72, tp1:s.tp1||6.32, tp2:s.tp2||6.58,
      confirmations:[
        {lbl:'Elliott', ok:['1','3','4'].includes(ew.wave)&&!ew.failure, note:ew.label},
        {lbl:'VSA',     ok:vsa.bullish||vsa.meta.type==='neutral', note:vsa.meta.short},
        {lbl:'RSI H4',  ok:(s.rsi_h4||68)>50&&(s.rsi_h4||68)<78, note:`${s.rsi_h4||68}`},
        {lbl:'DXY',     ok:(s.dxy_chg||0)<=0, note:(s.dxy_chg||0)<0?'Yếu ✓':'Mạnh'},
      ],
      invalidation:`H4 < $${((s.prev_low||5.89)-0.02).toFixed(3)}`,
      active: ['1','3','4'].includes(ew.wave)&&!ew.failure&&bias>=55,
    },
    {
      id:'B', name:'KẾ HOẠCH B – BREAKOUT RETEST', badge:'DỰ PHÒNG', type:'secondary',
      col:A.blue, prob:Math.max(10,Math.min(40,sc.conv.prob-15)),
      thesis:`Phá đỉnh $${ph}, retest $${ez.z2.low}–$${ez.z2.high}.`,
      trigger:`Retest Vol<0.8×TB`,
      entry:ez.z2, sl:parseFloat(slA), tp1:s.tp1||6.32, tp2:s.tp2||6.58,
      confirmations:[
        {lbl:'Climax', ok:liq.type==='breakout_real', note:liq.type==='breakout_real'?'✅':'⏳'},
        {lbl:'VSA',    ok:vsa.bullish, note:vsa.meta.short},
        {lbl:'PK2',    ok:mh.pk2Score>=50, note:`${mh.pk2Score}/100`},
      ],
      invalidation:`H4 < $${ph}`,
      active: liq.type==='breakout_real'&&liq.impact===true,
    },
    {
      id:'C', name:'KẾ HOẠCH C – ĐỨNG NGOÀI', badge:'RỦI RO', type:'avoid',
      col:A.red, prob:sc.brk.prob,
      thesis:'Cấu trúc bị phá vỡ. Không vào lệnh mới.',
      trigger:'1 trong 4 điều kiện', entry:null, sl:null, tp1:null, tp2:null,
      confirmations:[
        {lbl:'Elliott OK', ok:!ew.failure, note:ew.failure?'❌':'✅'},
        {lbl:'VSA OK',     ok:!vsa.bearish, note:vsa.bearish?`❌ ${vsa.meta.short}`:'✅'},
        {lbl:'BS ≤ 70',    ok:stress.bsRisk<=70, note:`${stress.bsRisk}`},
        {lbl:'Verdict≥40', ok:verdict.final>=40, note:`${verdict.final}`},
      ],
      invalidation:'Điều kiện bình thường',
      active: ew.failure||vsa.bearish||stress.bsRisk>70||verdict.final<40,
    },
  ];

  const kl = [
    {lbl:'TP2',      price:s.tp2||6.58,        type:'TARGET',  col:A.teal,   action:'Chốt 100%',     icon:'🎯'},
    {lbl:'TP1',      price:s.tp1||6.32,        type:'TARGET',  col:A.green,  action:'Chốt 50%',      icon:'🎯'},
    {lbl:'Đỉnh cũ',  price:parseFloat(ph),     type:'RESIST',  col:A.orange, action:'Hunt Zone',     icon:'⚠️'},
    {lbl:'Entry B',  price:ez.z2.high,         type:'ENTRY-B', col:A.blue,   action:`RR 1:${ez.z2.rr}`, icon:'📈'},
    {lbl:'Entry A',  price:ez.z1.high,         type:'ENTRY-A', col:A.green,  action:`RR 1:${ez.z1.rr}`, icon:'✅'},
    {lbl:'Fib 0.618',price:ew.fib618,          type:'FIB',     col:A.amber,  action:'Hỗ trợ',        icon:'📐'},
    {lbl:'Đáy cũ',   price:parseFloat(pl),     type:'SUPPORT', col:A.orange, action:'Kill Zone',     icon:'⚠️'},
    {lbl:'Fib 0.786',price:ew.fib786,          type:'CRITICAL',col:A.red,    action:'Thoát nếu đóng dưới', icon:'❌'},
    {lbl:'Stop Loss',price:s.sl||5.72,         type:'STOP',    col:A.red,    action:'KHÔNG dời',     icon:'🛑'},
  ].sort((a,b) => b.price-a.price);

  return { scenarios, keyLevels:kl };
};

// ─── Extract JSON helper ──────────────────────────────────────
export const extractJ = txt => {
  if (!txt) return null;
  const fc = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fc){ try{ const r=JSON.parse(fc[1].trim()); if(r&&typeof r==='object') return r; }catch{} }
  let d=0,st=-1;
  for (let i=0;i<txt.length;i++){
    if (txt[i]==='{'){ if(!d)st=i; d++; }
    else if (txt[i]==='}'){ d--; if(!d&&st!==-1){ try{ const r=JSON.parse(txt.slice(st,i+1)); if(r&&typeof r==='object') return r; }catch{st=-1;} } }
  }
  d=0;st=-1;
  for (let i=0;i<txt.length;i++){
    if (txt[i]==='['){ if(!d)st=i; d++; }
    else if (txt[i]===']'){ d--; if(!d&&st!==-1){ try{ const r=JSON.parse(txt.slice(st,i+1)); if(Array.isArray(r)) return r; }catch{st=-1;} } }
  }
  return null;
};

export const getTxt = data => {
  let t='';
  if (Array.isArray(data?.content)){
    for (const b of data.content){
      if (b.type==='text') t+=b.text+'\n';
    }
  }
  return t;
};