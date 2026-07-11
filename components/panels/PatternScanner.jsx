// ─── Pattern Scanner — phát hiện mô hình kỹ thuật ────────────────────────────
import { useState, useMemo } from 'react';
import { C } from '../constants/colors';
import { Bdg, Panel } from '../ui/Primitives';

export function detectPatterns(bars, ew, vsa, currentPrice) {
  if (!bars||bars.length<10) return [];
  const cu   = currentPrice||6.07;
  const hi20 = Math.max(...bars.slice(-20).map(b=>b.high||b.comex||cu));
  const lo20 = Math.min(...bars.slice(-20).map(b=>b.low||b.comex||cu));
  const rng  = Math.max(hi20-lo20, 0.01);
  const pos  = (cu-lo20)/rng;
  const mom5 = bars.length>=5
    ?(bars[bars.length-1].comex||cu)-(bars[bars.length-5].comex||cu):0;
  const p = [];

  if (pos<0.35&&vsa?.bullish)
    p.push({id:'ihs_1',tf:'H4',name:'Vai đầu vai ngược (IH&S)',
      status:'forming',direction:'long',probability:72,
      target:+(cu+rng*0.7).toFixed(3),invalidation:+(lo20-rng*0.1).toFixed(3),
      ai_tags:['accumulation','wyckoff','spring']});
  if (pos>0.6&&mom5>0&&ew?.wave==='3')
    p.push({id:'cup_1',tf:'D',name:'Cốc tay cầm (Cup & Handle)',
      status:'forming',direction:'long',probability:68,
      target:+(cu+rng*0.5).toFixed(3),invalidation:+(cu-rng*0.15).toFixed(3),
      ai_tags:['breakout','elliott_w3']});
  if (pos>=0.45&&pos<=0.65)
    p.push({id:'tri_1',tf:'H4',name:'Tam giác tăng (Ascending Triangle)',
      status:pos>0.58?'formed':'forming',direction:'long',probability:64,
      target:+(hi20+rng*0.3).toFixed(3),invalidation:+(lo20+rng*0.3).toFixed(3),
      ai_tags:['triangle','breakout_pending']});
  if (ew?.wave==='4')
    p.push({id:'flat_1',tf:'H4',name:'Phẳng (Flat Correction)',
      status:'forming',direction:'long',probability:58,
      target:+(cu+rng*0.4).toFixed(3),
      invalidation:+(ew.fib786||cu-rng*0.2).toFixed(3),
      ai_tags:['correction','wave4','accumulation']});
  if (pos>0.85&&vsa?.bearish)
    p.push({id:'hns_1',tf:'D',name:'Vai đầu vai (H&S — phân phối)',
      status:'forming',direction:'short',probability:65,
      target:+(cu-rng*0.5).toFixed(3),invalidation:+(hi20+rng*0.05).toFixed(3),
      ai_tags:['distribution','wyckoff_upthrust']});
  if (pos<0.25&&mom5>0)
    p.push({id:'fw_1',tf:'W',name:'Nêm giảm (Falling Wedge)',
      status:'formed',direction:'long',probability:75,
      target:+(cu+rng*0.6).toFixed(3),invalidation:+(lo20-rng*0.05).toFixed(3),
      ai_tags:['reversal','oversold']});
  return p;
}

export default function PatternScanner({ bars, ew, vsa, safeS }) {
  const [filterTF,  setFilterTF]  = useState('all');
  const [filterDir, setFilterDir] = useState('all');
  const [minProb,   setMinProb]   = useState(60);

  const allPatterns = useMemo(()=>
    detectPatterns(bars,ew,vsa,safeS.comex),
    [bars,ew,vsa,safeS.comex]
  );

  const filtered = useMemo(()=>allPatterns.filter(p=>{
    if (filterTF!=='all'&&p.tf!==filterTF) return false;
    if (filterDir!=='all'&&p.direction!==filterDir) return false;
    if (p.probability<minProb) return false;
    return true;
  }),[allPatterns,filterTF,filterDir,minProb]);

  return (
    <Panel title="PATTERN SCANNER" icon="🔍" glow={C.cyan}
      badge={`${filtered.length} mô hình`} badgeCol={C.cyan}>
      <div style={{ display:'flex', gap:4, marginBottom:8,
        flexWrap:'wrap', alignItems:'center' }}>
        {['all','H1','H4','D','W'].map(tf=>(
          <button key={tf} onClick={()=>setFilterTF(tf)} style={{
            fontSize:8, padding:'2px 7px', borderRadius:4, cursor:'pointer',
            border:`0.5px solid ${filterTF===tf?C.cyan:'#1e3050'}`,
            background:filterTF===tf?`${C.cyan}18`:'transparent',
            color:filterTF===tf?C.cyan:C.muted,
          }}>{tf==='all'?'All TF':tf}</button>
        ))}
        {['all','long','short'].map(d=>{
          const dc=d==='long'?C.green:d==='short'?C.red:C.muted;
          return (
            <button key={d} onClick={()=>setFilterDir(d)} style={{
              fontSize:8, padding:'2px 7px', borderRadius:4, cursor:'pointer',
              border:`0.5px solid ${filterDir===d?dc:'#1e3050'}`,
              background:filterDir===d?`${dc}18`:'transparent',
              color:filterDir===d?dc:C.muted,
            }}>{d==='all'?'All':d==='long'?'🟢 Long':'🔴 Short'}</button>
          );
        })}
        <div style={{ display:'flex', alignItems:'center', gap:5, marginLeft:'auto' }}>
          <span style={{ fontSize:8, color:C.muted }}>Min:</span>
          <input type="range" min={50} max={90} value={minProb}
            onChange={e=>setMinProb(+e.target.value)}
            style={{ width:60, accentColor:C.cyan }}/>
          <span style={{ fontSize:8, color:C.cyan, fontFamily:'monospace' }}>
            {minProb}%
          </span>
        </div>
      </div>

      {filtered.length===0?(
        <div style={{ padding:'12px 0', textAlign:'center',
          color:C.muted, fontSize:9 }}>
          Không tìm thấy mô hình với bộ lọc hiện tại
        </div>
      ):filtered.map((p,i)=>{
        const dc = p.direction==='long'?C.green:C.red;
        const sc2 = p.status==='formed'?C.green:p.status==='forming'?C.amber:C.muted;
        return (
          <div key={p.id} style={{ background:'#0a1520',
            border:`0.5px solid ${dc}33`, borderRadius:8,
            padding:'8px 10px', marginBottom:5 }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'flex-start', marginBottom:5 }}>
              <div>
                <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0' }}>
                  {p.name}
                </div>
                <div style={{ display:'flex', gap:4, marginTop:3 }}>
                  <Bdg label={p.tf} col={C.blue} size={7}/>
                  <Bdg label={p.status==='formed'
                    ?'✅ Đã hình thành':'⏳ Đang hình thành'}
                    col={sc2} size={7}/>
                </div>
              </div>
              <div style={{ textAlign:'center', background:dc+'12',
                borderRadius:7, padding:'4px 8px',
                border:`0.5px solid ${dc}44` }}>
                <div style={{ fontFamily:'monospace', fontSize:16,
                  fontWeight:700, color:dc, lineHeight:1 }}>
                  {p.probability}%
                </div>
                <div style={{ fontSize:7, color:C.muted }}>prob</div>
              </div>
            </div>
            <div style={{ display:'grid',
              gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
              {[
                {lbl:p.direction==='long'?'🟢 LONG':'🔴 SHORT',
                 val:p.direction==='long'?'Chiều Mua':'Chiều Bán', col:dc},
                {lbl:'🎯 Target',   val:`$${p.target}`,      col:C.green},
                {lbl:'⛔ Vô hiệu', val:`$${p.invalidation}`, col:C.red},
              ].map((m,j)=>(
                <div key={j} style={{ background:'#060d18', borderRadius:5,
                  padding:'4px 6px', border:`0.5px solid ${m.col}22` }}>
                  <div style={{ fontSize:7, color:C.muted }}>{m.lbl}</div>
                  <div style={{ fontFamily:'monospace', fontSize:9,
                    fontWeight:700, color:m.col }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:5 }}>
              {p.ai_tags.map((tag,j)=>(
                <span key={j} style={{ fontSize:7, padding:'1px 5px',
                  borderRadius:3, background:`${C.purple}18`,
                  color:C.purple, border:`0.5px solid ${C.purple}33` }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}