// components/verdict/SensitivityMatrixCard.jsx
import { cardStyle, lblStyle } from './shared';
import { SENSITIVITY_MATRIX } from '../../lib/verdictCalculations';

export function SensitivityMatrixCard({ C }) {
  const cols = [
    { key:'beatBig',   label:'Beat lớn',  color:C.green },
    { key:'beatSmall', label:'Beat nhỏ',  color:C.green },
    { key:'missSmall', label:'Miss nhỏ',  color:C.red },
    { key:'missBig',   label:'Miss lớn',  color:C.red },
  ];

  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>▦ Sensitivity matrix — % COMEX lịch sử</div>
      <div style={{ display:'grid', gridTemplateColumns:'72px repeat(4,1fr)', gap:2, fontSize:9 }}>
        <div />
        {cols.map(c => (
          <div key={c.key} style={{ textAlign:'center', padding:2, color:c.color, fontWeight:c.key.includes('Big')?500:400 }}>
            {c.label}
          </div>
        ))}
        {SENSITIVITY_MATRIX.map((row, i) => (
          <>
            <div key={`lbl${i}`} style={{ color:'#b0b8d0', display:'flex', alignItems:'center', fontSize:9 }}>
              {row.event}
            </div>
            {cols.map(c => {
              const val = row[c.key];
              const color = val > 0 ? C.green : C.red;
              const isStrong = Math.abs(val) > 1.5;
              return (
                <div key={c.key} style={{
                  height:24, borderRadius:3, display:'flex', alignItems:'center', justifyContent:'center',
                  background:`${color}${isStrong?'28':'12'}`, color, fontWeight:isStrong?500:400,
                  fontFamily:'monospace',
                }}>
                  {val > 0 ? '+' : ''}{val}%
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}