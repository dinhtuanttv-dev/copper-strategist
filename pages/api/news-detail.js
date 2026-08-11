import { getCached, setCached } from '../../lib/dataCollection/store';
const TTL_SECONDS = 86400;
function cacheKeyFor(t){let h=0;for(let i=0;i<t.length;i++){h=(h<<5)-h+t.charCodeAt(i);h|=0;}return `news-detail:${h}`;}
function extractAnalysis(text){
  if(!text||!text.trim())return null;
  try{const c=text.replace(/```json|```/g,'').trim();const p=JSON.parse(c);if(p?.analysis)return p.analysis.trim();}catch{}
  try{const m=text.match(/\{[^{}]*"analysis"\s*:\s*"([^"]+)"[^{}]*\}/);if(m?.[1])return m[1].trim();}catch{}
  const c=text.replace(/```[a-z]*/gi,'').replace(/```/g,'').replace(/^#+\s*/gm,'').trim();
  return c.length>30?c:null;
}
export default async function handler(req,res){
  const{title}=req.query;
  if(!title)return res.status(400).json({error:'Thieu title'});
  const key=cacheKeyFor(title);
  try{const cached=await getCached(key);if(cached?.analysis)return res.status(200).json({...cached,fromCache:true});}catch{}
  try{
    const base=process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:`http://localhost:3000`;
    const r=await fetch(`${base}/api/claude`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({max_tokens:500,messages:[{role:'user',content:`Bạn là chuyên gia phân tích thị trường đồng. Tiêu đề tin: "${title}"\nViết 2-3 câu tiếng Việt phân tích tác động tới giá đồng. Chỉ viết phân tích, không giải thích thêm.`}]})});
    const d=await r.json();
    const raw=(d.content||[]).map(c=>c.text||'').join('').trim();
    const analysis=extractAnalysis(raw);
    if(!analysis){console.warn('[news-detail] raw:',raw?.slice(0,200));return res.status(200).json({analysis:'Khong tao duoc phan tich.',source:'gemini',fromCache:false});}
    const result={analysis,source:'gemini',analyzedAt:Date.now()};
    try{await setCached(key,result,TTL_SECONDS);}catch{}
    return res.status(200).json({...result,fromCache:false});
  }catch(e){
    console.error('[news-detail]',e.message);
    return res.status(200).json({analysis:null,error:e.message,source:'gemini'});
  }
}
