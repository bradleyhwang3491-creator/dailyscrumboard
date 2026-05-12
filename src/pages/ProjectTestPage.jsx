import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

/* ── 상수 ─────────────────────────────────────────────── */
const TSET_GUBUN_OPTIONS   = ["UI", "기능", "데이터", "IF", "BATCH", "기타"];
const TEST_GUBUN_OPTIONS   = ["개발자테스트", "단위테스트", "통합테스트", "MA"];
const INIT_ISSUE = {
  taskId:"", testGubun:"통합테스트", errGubun:"", level:"",
  fixRequestDate:"", menuNm:"", menuPath:"",
  title:"", content:"", systemNms:[], managerId:"", relevantUsers:[],
};

/* ── Excel 스타일 셀 인풋 ──────────────────────────────── */
function CellInput({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      style={{
        fontFamily:"'Pretendard',sans-serif", fontSize:"13px", color:"#1E293B",
        backgroundColor: focused ? "#FFFFFF" : "transparent",
        border: focused ? "1.5px solid #2563EB" : "1px solid transparent",
        borderRadius:"4px", padding:"5px 8px",
        width:"100%", outline:"none", boxSizing:"border-box",
      }}
      value={value ?? ""} placeholder={placeholder}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

/* ── Excel 스타일 셀 셀렉트 (점검구분) ─────────────────── */
function CellSelect({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      style={{
        fontFamily:"'Pretendard',sans-serif", fontSize:"13px",
        color: value ? "#1E293B" : "#94A3B8",
        backgroundColor: focused ? "#FFFFFF" : "transparent",
        border: focused ? "1.5px solid #2563EB" : "1px solid transparent",
        borderRadius:"4px", padding:"5px 6px",
        width:"100%", outline:"none", cursor:"pointer",
      }}
      value={value ?? ""}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <option value="">선택</option>
      {TSET_GUBUN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ── 멀티 유저 선택 ─────────────────────────────────────── */
function MultiUserSelect({ users, selected, onChange, placeholder = "선택 안함" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = id => onChange(selected.includes(id) ? selected.filter(s=>s!==id) : [...selected, id]);
  const label = selected.length === 0 ? placeholder : users.filter(u=>selected.includes(u.ID)).map(u=>u.NAME).join(", ");
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button type="button" onClick={() => setOpen(o=>!o)}
        style={{ width:"100%", padding:"8px 12px", border:"1px solid #CBD5E1", borderRadius:"7px",
          backgroundColor:"#fff", fontSize:"13px", color: selected.length ? "#1E293B" : "#94A3B8",
          textAlign:"left", cursor:"pointer", fontFamily:"'Pretendard',sans-serif",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px", overflow:"hidden" }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{label}</span>
        <span style={{ fontSize:"10px", color:"#94A3B8", flexShrink:0 }}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:300,
          backgroundColor:"#fff", border:"1px solid #E2E8F0", borderRadius:"8px",
          boxShadow:"0 4px 16px rgba(0,0,0,0.12)", maxHeight:"200px", overflowY:"auto" }}>
          {users.length === 0
            ? <p style={{ margin:0, padding:"12px", fontSize:"13px", color:"#94A3B8", textAlign:"center" }}>사용자 없음</p>
            : users.map(u => (
              <label key={u.ID} style={{ display:"flex", alignItems:"center", gap:"10px",
                padding:"8px 14px", cursor:"pointer", fontSize:"13px",
                backgroundColor: selected.includes(u.ID) ? "#EFF6FF" : "transparent",
                color: selected.includes(u.ID) ? "#1D4ED8" : "#1E293B" }}>
                <input type="checkbox" checked={selected.includes(u.ID)} onChange={() => toggle(u.ID)}
                  style={{ width:"15px", height:"15px", cursor:"pointer", accentColor:"#2563EB" }} />
                {u.NAME}
              </label>
            ))
          }
          {selected.length > 0 && (
            <div style={{ borderTop:"1px solid #F1F5F9", padding:"6px 14px" }}>
              <button type="button" onClick={() => onChange([])}
                style={{ fontSize:"11px", color:"#DC2626", background:"none", border:"none", cursor:"pointer", fontFamily:"'Pretendard',sans-serif" }}>
                ✕ 전체 해제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 멀티 시스템 선택 ───────────────────────────────────── */
function MultiSystemSelect({ systems, selected, onChange, placeholder = "선택 안함" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = nm => onChange(selected.includes(nm) ? selected.filter(s=>s!==nm) : [...selected, nm]);
  const label = selected.length === 0 ? placeholder : selected.join(", ");
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button type="button" onClick={() => setOpen(o=>!o)}
        style={{ width:"100%", padding:"8px 12px", border:"1px solid #CBD5E1", borderRadius:"7px",
          backgroundColor:"#fff", fontSize:"13px", color: selected.length ? "#1E293B" : "#94A3B8",
          textAlign:"left", cursor:"pointer", fontFamily:"'Pretendard',sans-serif",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px" }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{label}</span>
        <span style={{ fontSize:"10px", color:"#94A3B8", flexShrink:0 }}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:300,
          backgroundColor:"#fff", border:"1px solid #E2E8F0", borderRadius:"8px",
          boxShadow:"0 4px 16px rgba(0,0,0,0.12)", maxHeight:"200px", overflowY:"auto" }}>
          {systems.length === 0
            ? <p style={{ margin:0, padding:"12px", fontSize:"13px", color:"#94A3B8", textAlign:"center" }}>시스템 없음</p>
            : systems.map(s => (
              <label key={s.SYSTEM_NM} style={{ display:"flex", alignItems:"center", gap:"10px",
                padding:"8px 14px", cursor:"pointer", fontSize:"13px",
                backgroundColor: selected.includes(s.SYSTEM_NM) ? "#EFF6FF" : "transparent",
                color: selected.includes(s.SYSTEM_NM) ? "#1D4ED8" : "#1E293B" }}>
                <input type="checkbox" checked={selected.includes(s.SYSTEM_NM)} onChange={() => toggle(s.SYSTEM_NM)}
                  style={{ width:"15px", height:"15px", cursor:"pointer", accentColor:"#2563EB" }} />
                {s.SYSTEM_NM}
              </label>
            ))
          }
          {selected.length > 0 && (
            <div style={{ borderTop:"1px solid #F1F5F9", padding:"6px 14px" }}>
              <button type="button" onClick={() => onChange([])}
                style={{ fontSize:"11px", color:"#DC2626", background:"none", border:"none", cursor:"pointer", fontFamily:"'Pretendard',sans-serif" }}>
                ✕ 전체 해제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 줌 버튼 스타일 ── */
const zoomBtnStyle = {
  width:"24px", height:"24px", borderRadius:"4px", border:"1px solid #E2E8F0",
  backgroundColor:"#F8FAFC", color:"#1E293B", fontSize:"14px", fontWeight:"700",
  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  lineHeight:1, fontFamily:"monospace",
};

/* ══════════════════════════════════════════
   캔버스 이미지 편집기 (IssueManagePage 동일)
══════════════════════════════════════════ */
function CanvasEditor({ onImageReady, editorWidth = 560 }) {
  const canvasRef  = useRef(null);
  const scrollRef  = useRef(null);
  const baseData   = useRef(null);
  const objsRef    = useRef([]);
  const selIdRef   = useRef(null);

  const [tool,       setTool]      = useState("draw");
  const [color,      setColor]     = useState("#DC2626");
  const [lineWidth,  setLineWidth] = useState(3);
  const [fontSize,   setFontSize]  = useState(20);
  const [objects,   _setObjects]   = useState([]);
  const [selId,     _setSelId]     = useState(null);
  const [history,    setHistory]   = useState([]);
  const [hasImage,   setHasImage]  = useState(false);
  const [zoom,       setZoom]      = useState(1);
  const [canvasSize, setCanvasSize] = useState({ w:0, h:0 });
  const [moveCursor, setMoveCursor] = useState("crosshair");

  function setObjects(val) {
    const next = typeof val === "function" ? val(objsRef.current) : val;
    objsRef.current = next;
    _setObjects(next);
  }
  function setSelId(val) {
    selIdRef.current = val;
    _setSelId(val);
  }

  const isDrawing    = useRef(false);
  const lastPos      = useRef(null);
  const strokeInfo   = useRef(null);
  const shapeStart   = useRef(null);
  const snapBefore   = useRef(null);
  const isDragging   = useRef(false);
  const dragStart    = useRef(null);
  const dragObjStart = useRef(null);

  function renderAll(objs, sid) {
    const canvas = canvasRef.current;
    if (!canvas || !baseData.current) return;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(baseData.current, 0, 0);
    const list = objs ?? objsRef.current;
    list.forEach(o => renderObj(ctx, o));
    const sel = list.find(o => o.id === (sid !== undefined ? sid : selIdRef.current));
    if (sel) renderSel(ctx, sel);
  }

  useEffect(() => { if (hasImage) renderAll(); }, [objects, selId]); // eslint-disable-line

  function renderObj(ctx, obj) {
    ctx.save();
    ctx.strokeStyle = obj.color;
    ctx.lineWidth   = obj.lw ?? 3;
    ctx.lineCap     = "round";
    if (obj.type === "rect") {
      ctx.beginPath(); ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    } else if (obj.type === "circle") {
      const rx = obj.w/2, ry = obj.h/2;
      ctx.beginPath(); ctx.ellipse(obj.x+rx, obj.y+ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI*2); ctx.stroke();
    } else if (obj.type === "text") {
      ctx.font = `bold ${obj.fs}px sans-serif`; ctx.fillStyle = obj.color; ctx.fillText(obj.text, obj.x, obj.y);
    }
    ctx.restore();
  }

  function renderSel(ctx, obj) {
    const pad = 6;
    let bx, by, bw, bh;
    if (obj.type === "text") {
      ctx.save(); ctx.font = `bold ${obj.fs}px sans-serif`;
      const tw = ctx.measureText(obj.text).width; ctx.restore();
      bx=obj.x-pad; by=obj.y-obj.fs-pad; bw=tw+pad*2; bh=obj.fs+pad*2;
    } else {
      bx=Math.min(obj.x,obj.x+obj.w)-pad; by=Math.min(obj.y,obj.y+obj.h)-pad;
      bw=Math.abs(obj.w)+pad*2; bh=Math.abs(obj.h)+pad*2;
    }
    ctx.save();
    ctx.strokeStyle="#2563EB"; ctx.lineWidth=1.5; ctx.setLineDash([6,3]);
    ctx.strokeRect(bx,by,bw,bh); ctx.setLineDash([]);
    ctx.fillStyle="#2563EB";
    [[bx,by],[bx+bw,by],[bx,by+bh],[bx+bw,by+bh]].forEach(([hx,hy]) => ctx.fillRect(hx-4,hy-4,8,8));
    ctx.restore();
  }

  function hitTest(obj, x, y) {
    const pad=10;
    if (obj.type==="rect") {
      const l=Math.min(obj.x,obj.x+obj.w)-pad, r=Math.max(obj.x,obj.x+obj.w)+pad;
      const t=Math.min(obj.y,obj.y+obj.h)-pad, b=Math.max(obj.y,obj.y+obj.h)+pad;
      return x>=l&&x<=r&&y>=t&&y<=b;
    } else if (obj.type==="circle") {
      const cx=obj.x+obj.w/2, cy=obj.y+obj.h/2;
      const rx=Math.abs(obj.w/2)+pad, ry=Math.abs(obj.h/2)+pad;
      return ((x-cx)**2)/(rx**2)+((y-cy)**2)/(ry**2)<=1;
    } else if (obj.type==="text") {
      const ctx=canvasRef.current.getContext("2d");
      ctx.save(); ctx.font=`bold ${obj.fs}px sans-serif`;
      const tw=ctx.measureText(obj.text).width; ctx.restore();
      return x>=obj.x-pad&&x<=obj.x+tw+pad&&y>=obj.y-obj.fs-pad&&y<=obj.y+pad;
    }
    return false;
  }

  function pushHistory() {
    const bd=baseData.current;
    setHistory(h => [...h.slice(-19), {
      base: bd ? new ImageData(new Uint8ClampedArray(bd.data), bd.width, bd.height) : null,
      objs: [...objsRef.current], sid: selIdRef.current,
    }]);
  }

  function handleUndo() {
    if (!history.length) return;
    const prev=history[history.length-1];
    baseData.current=prev.base;
    setHistory(h => h.slice(0,-1));
    setObjects(prev.objs); setSelId(prev.sid ?? null);
    renderAll(prev.objs, prev.sid ?? null);
    notifyParent();
  }

  function loadImageFile(file) {
    const reader=new FileReader();
    reader.onload=(ev) => {
      const img=new Image();
      img.onload=() => {
        const canvas=canvasRef.current;
        const MAX=4000;
        let w=img.width, h=img.height;
        if (w>MAX) { h=Math.round(h*MAX/w); w=MAX; }
        if (h>MAX) { w=Math.round(w*MAX/h); h=MAX; }
        canvas.width=w; canvas.height=h;
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,w,h);
        baseData.current=ctx.getImageData(0,0,w,h);
        setObjects([]); setSelId(null); setHistory([]);
        setCanvasSize({w,h}); setHasImage(true);
        const initZoom=Math.min(1, editorWidth/w);
        setZoom(parseFloat(initZoom.toFixed(2)));
        canvas.toBlob(blob => { if (blob) onImageReady(blob); }, "image/png");
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(e) {
    const file=e.target.files?.[0];
    if (!file) return;
    loadImageFile(file);
  }

  useEffect(() => {
    function onPaste(e) {
      const items=e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) { const file=item.getAsFile(); if (file) loadImageFile(file); break; }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []); // eslint-disable-line

  function getPos(e) {
    const rect=canvasRef.current.getBoundingClientRect();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    return { x:(clientX-rect.left)/zoom, y:(clientY-rect.top)/zoom };
  }

  function onMouseDown(e) {
    if (!hasImage) return;
    const pos=getPos(e);
    if (tool==="select") {
      const hit=[...objsRef.current].reverse().find(o=>hitTest(o,pos.x,pos.y));
      if (hit) { pushHistory(); setSelId(hit.id); isDragging.current=true; dragStart.current=pos; dragObjStart.current={x:hit.x,y:hit.y}; }
      else setSelId(null);
      return;
    }
    if (tool==="text") {
      const text=window.prompt("입력할 텍스트:");
      if (!text) return;
      pushHistory();
      const newObj={id:Date.now(),type:"text",x:pos.x,y:pos.y,text,color,fs:fontSize};
      setObjects(objs=>[...objs,newObj]); setSelId(newObj.id); notifyParent(); return;
    }
    if (tool==="rect"||tool==="circle") {
      pushHistory(); isDrawing.current=true; shapeStart.current=pos;
      const canvas=canvasRef.current;
      snapBefore.current=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height); return;
    }
    pushHistory(); isDrawing.current=true; lastPos.current=pos;
    strokeInfo.current={color,lw:lineWidth,type:tool,points:[pos]};
  }

  function onMouseMove(e) {
    if (!hasImage) return;
    const pos=getPos(e);
    if (tool==="select") {
      if (isDragging.current&&selIdRef.current) {
        const dx=pos.x-dragStart.current.x, dy=pos.y-dragStart.current.y;
        setObjects(objs=>objs.map(o=>o.id===selIdRef.current?{...o,x:dragObjStart.current.x+dx,y:dragObjStart.current.y+dy}:o));
      } else {
        const hit=[...objsRef.current].reverse().find(o=>hitTest(o,pos.x,pos.y));
        setMoveCursor(hit?"move":"default");
      }
      return;
    }
    if (!isDrawing.current) return;
    const canvas=canvasRef.current, ctx=canvas.getContext("2d");
    if (tool==="rect"||tool==="circle") {
      ctx.putImageData(snapBefore.current,0,0);
      ctx.strokeStyle=color; ctx.lineWidth=lineWidth; ctx.lineCap="round";
      const sx=shapeStart.current.x, sy=shapeStart.current.y;
      ctx.beginPath();
      if (tool==="rect") { ctx.strokeRect(sx,sy,pos.x-sx,pos.y-sy); }
      else { const rx=(pos.x-sx)/2,ry=(pos.y-sy)/2; ctx.ellipse(sx+rx,sy+ry,Math.abs(rx),Math.abs(ry),0,0,Math.PI*2); ctx.stroke(); }
      return;
    }
    const si=strokeInfo.current;
    ctx.strokeStyle=si.color; ctx.lineWidth=si.lw; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(lastPos.current.x,lastPos.current.y);
    const nextPos=si.type==="underline"?{x:pos.x,y:lastPos.current.y}:pos;
    ctx.lineTo(nextPos.x,nextPos.y); ctx.stroke();
    si.points.push(nextPos); lastPos.current=nextPos; notifyParent();
  }

  function onMouseUp(e) {
    if (!hasImage) return;
    if (tool==="select") { if (isDragging.current) { isDragging.current=false; notifyParent(); } return; }
    if (isDrawing.current&&(tool==="rect"||tool==="circle")&&e) {
      const pos=getPos(e);
      const sx=shapeStart.current.x, sy=shapeStart.current.y;
      const w=pos.x-sx, h=pos.y-sy;
      if (Math.abs(w)>3||Math.abs(h)>3) {
        const newObj={id:Date.now(),type:tool,x:sx,y:sy,w,h,color,lw:lineWidth};
        canvasRef.current.getContext("2d").putImageData(snapBefore.current,0,0);
        setObjects(objs=>[...objs,newObj]); setSelId(newObj.id); notifyParent();
      }
      shapeStart.current=null; snapBefore.current=null;
    }
    if (isDrawing.current&&(tool==="draw"||tool==="underline")) {
      const si=strokeInfo.current;
      if (si&&si.points.length>=2) {
        const canvas=canvasRef.current, ctx=canvas.getContext("2d");
        ctx.putImageData(baseData.current,0,0);
        ctx.strokeStyle=si.color; ctx.lineWidth=si.lw; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(si.points[0].x,si.points[0].y);
        si.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
        baseData.current=ctx.getImageData(0,0,canvas.width,canvas.height);
        renderAll();
      }
      strokeInfo.current=null; notifyParent();
    }
    isDrawing.current=false; lastPos.current=null;
  }

  const zoomIn  = () => setZoom(z=>Math.min(parseFloat((z+0.1).toFixed(2)),3));
  const zoomOut = () => setZoom(z=>Math.max(parseFloat((z-0.1).toFixed(2)),0.1));
  const zoomFit = () => setZoom(parseFloat(Math.min(1,editorWidth/(canvasSize.w||editorWidth)).toFixed(2)));

  function notifyParent() {
    const canvas=canvasRef.current;
    if (!canvas||!hasImage) return;
    canvas.toBlob(blob=>{ if (blob) onImageReady(blob); },"image/png");
  }

  const toolBtns=[
    {id:"select",icon:"↖",label:"선택/이동"},
    {id:"draw",icon:"✏️",label:"펜"},
    {id:"underline",icon:"▬",label:"밑줄"},
    {id:"rect",icon:"▭",label:"네모"},
    {id:"circle",icon:"◯",label:"동그라미"},
    {id:"text",icon:"T",label:"텍스트"},
  ];
  const canvasCursor=tool==="select"?moveCursor:tool==="text"?"text":"crosshair";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px", height:"100%" }}>
      {/* 툴바 */}
      <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap", flexShrink:0 }}>
        {toolBtns.map(b=>(
          <button key={b.id} onClick={()=>setTool(b.id)} style={{
            padding:"4px 10px", borderRadius:"6px", fontSize:"12px", fontWeight:"600",
            border:tool===b.id?"2px solid #2563EB":"1px solid #E2E8F0",
            backgroundColor:tool===b.id?"#EFF6FF":"#F8FAFC",
            color:tool===b.id?"#2563EB":"#64748B",
            cursor:"pointer", fontFamily:"'Pretendard',sans-serif",
          }}>{b.icon} {b.label}</button>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
          <span style={{ fontSize:"11px", color:"#64748B" }}>색상</span>
          <input type="color" value={color} onChange={e=>setColor(e.target.value)}
            style={{ width:"28px", height:"26px", border:"1px solid #E2E8F0", borderRadius:"4px", cursor:"pointer", padding:"1px" }} />
        </div>
        {tool!=="text"&&tool!=="select"&&(
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <span style={{ fontSize:"11px", color:"#64748B" }}>굵기</span>
            <input type="range" min="1" max="8" value={lineWidth} onChange={e=>setLineWidth(Number(e.target.value))}
              style={{ width:"55px", cursor:"pointer" }} />
            <span style={{ fontSize:"11px", color:"#64748B", minWidth:"12px" }}>{lineWidth}</span>
          </div>
        )}
        {tool==="text"&&(
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            <span style={{ fontSize:"11px", color:"#64748B" }}>크기</span>
            <input type="number" min="8" max="200" value={fontSize}
              onChange={e=>setFontSize(Math.max(8,Math.min(200,Number(e.target.value))))}
              style={{ width:"58px", padding:"3px 6px", border:"1px solid #CBD5E1", borderRadius:"5px", fontSize:"12px", color:"#1E293B", fontFamily:"'Pretendard',sans-serif", outline:"none", textAlign:"center" }} />
            <span style={{ fontSize:"11px", color:"#64748B" }}>px</span>
          </div>
        )}
        <button onClick={handleUndo} disabled={!history.length} style={{
          padding:"4px 10px", borderRadius:"6px", fontSize:"11px",
          border:"1px solid #E2E8F0", backgroundColor:"#F8FAFC",
          color:history.length?"#1E293B":"#CBD5E1",
          cursor:history.length?"pointer":"not-allowed", fontFamily:"'Pretendard',sans-serif",
        }}>↩ 실행취소</button>
        {hasImage&&(
          <div style={{ display:"flex", alignItems:"center", gap:"4px", marginLeft:"auto" }}>
            <button onClick={zoomOut} style={zoomBtnStyle}>−</button>
            <span style={{ fontSize:"11px", color:"#475569", minWidth:"38px", textAlign:"center" }}>{Math.round(zoom*100)}%</span>
            <button onClick={zoomIn} style={zoomBtnStyle}>+</button>
            <button onClick={zoomFit} style={{ ...zoomBtnStyle, padding:"3px 8px", fontSize:"10px" }}>맞춤</button>
          </div>
        )}
      </div>

      {/* 업로드 영역 */}
      <div style={{ flex:1, display:hasImage?"none":"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", border:"2px dashed #CBD5E1", borderRadius:"10px", gap:"10px", backgroundColor:"#F8FAFC" }}>
        <span style={{ fontSize:"40px" }}>🖼️</span>
        <label style={{ cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
          <span style={{ fontSize:"14px", color:"#2563EB", fontWeight:"700",
            padding:"7px 20px", border:"1.5px solid #93C5FD", borderRadius:"8px", backgroundColor:"#EFF6FF" }}>
            📁 파일 선택 (클릭)
          </span>
          <span style={{ fontSize:"11px", color:"#94A3B8" }}>PNG, JPG, GIF · 원본 사이즈 지원</span>
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display:"none" }} />
        </label>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", width:"60%", maxWidth:"280px" }}>
          <div style={{ flex:1, height:"1px", backgroundColor:"#E2E8F0" }} />
          <span style={{ fontSize:"11px", color:"#CBD5E1", flexShrink:0 }}>또는</span>
          <div style={{ flex:1, height:"1px", backgroundColor:"#E2E8F0" }} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <kbd style={{ padding:"2px 7px", border:"1px solid #CBD5E1", borderRadius:"4px",
              backgroundColor:"#F1F5F9", fontSize:"12px", fontWeight:"700", color:"#475569",
              fontFamily:"monospace", boxShadow:"0 1px 0 #CBD5E1" }}>Ctrl</kbd>
            <span style={{ fontSize:"12px", color:"#94A3B8", fontWeight:"600" }}>+</span>
            <kbd style={{ padding:"2px 7px", border:"1px solid #CBD5E1", borderRadius:"4px",
              backgroundColor:"#F1F5F9", fontSize:"12px", fontWeight:"700", color:"#475569",
              fontFamily:"monospace", boxShadow:"0 1px 0 #CBD5E1" }}>V</kbd>
            <span style={{ fontSize:"13px", color:"#64748B", fontWeight:"600" }}>로 스크린샷 붙여넣기</span>
          </div>
          <span style={{ fontSize:"11px", color:"#94A3B8" }}>캡처 후 바로 붙여넣으면 자동으로 불러옵니다</span>
        </div>
      </div>

      {/* 캔버스 뷰어 */}
      <div ref={scrollRef} style={{ flex:1, overflow:"auto", backgroundColor:"#e8eaed",
        borderRadius:"8px", border:"1px solid #E2E8F0", position:"relative",
        display:hasImage?"block":"none" }}>
        <div style={{ width:canvasSize.w*zoom||"100%", height:canvasSize.h*zoom||"100%",
          position:"relative", minWidth:"100%", minHeight:"100%" }}>
          <canvas ref={canvasRef}
            style={{ position:"absolute", top:0, left:0, transformOrigin:"0 0", transform:`scale(${zoom})`,
              cursor:canvasCursor, imageRendering:zoom>1?"pixelated":"auto" }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove}
            onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
        </div>
        <label style={{ position:"sticky", bottom:"8px", left:"calc(100% - 90px)",
          display:"block", width:"80px", padding:"4px 8px", backgroundColor:"rgba(0,0,0,0.6)",
          color:"#fff", borderRadius:"6px", fontSize:"11px", cursor:"pointer", textAlign:"center" }}>
          🔄 교체
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display:"none" }} />
        </label>
      </div>
    </div>
  );
}

/* ── ProjectTestPage ─────────────────────────────────── */
export default function ProjectTestPage() {
  const { user } = useAuth();
  const deptCd = user?.deptCd ?? "";

  /* 검색 */
  const [searchSystem, setSearchSystem] = useState("");
  const [searchMenu1,  setSearchMenu1]  = useState("");
  const [searchMenu2,  setSearchMenu2]  = useState("");

  /* 드롭다운 옵션 */
  const [systemNames, setSystemNames] = useState([]);
  const [menu1Names,  setMenu1Names]  = useState([]);
  const [menu2Names,  setMenu2Names]  = useState([]);

  /* 테스트케이스 생성 */
  const [tcCreating, setTcCreating] = useState(false);

  /* 마스터 목록 */
  const [menuList,     setMenuList]     = useState([]);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [loading,      setLoading]      = useState(false);

  /* 좌측 패널 */
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  /* 점검항목 */
  const [planRows,   setPlanRows]   = useState([]);
  const [planSaving, setPlanSaving] = useState(false);

  /* 시스템/화면 등록 팝업 */
  const [showReg,   setShowReg]   = useState(false);
  const [regForm,   setRegForm]   = useState({ SYSTEM_NAME:"", MENU1:"", MENU2:"" });
  const [regSaving, setRegSaving] = useState(false);
  const [regErr,    setRegErr]    = useState({});

  /* 시스템/화면 수정 팝업 */
  const [showEdit,   setShowEdit]   = useState(false);
  const [editForm,   setEditForm]   = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  /* 이슈 등록 팝업 */
  const [showIssueReg,  setShowIssueReg]  = useState(false);
  const [issueRegStep,  setIssueRegStep]  = useState(1);   // 1: 이미지, 2: 폼
  const [issueForm,     setIssueForm]     = useState(INIT_ISSUE);
  const [issueErr,      setIssueErr]      = useState({});
  const [issueSaving,   setIssueSaving]   = useState(false);
  const [imageBlob,     setImageBlob]     = useState(null);

  /* 이슈 등록 - 시스템 인라인 등록 */
  const [showSysReg,   setShowSysReg]   = useState(false);
  const [newSysNm,     setNewSysNm]     = useState("");
  const [sysRegSaving, setSysRegSaving] = useState(false);
  const [sysRegErr,    setSysRegErr]    = useState("");

  /* 이슈 등록에 필요한 마스터 데이터 */
  const [tm1List,    setTm1List]    = useState([]);
  const [deptUsers,  setDeptUsers]  = useState([]);
  const [systemList, setSystemList] = useState([]);
  const [userMap,    setUserMap]    = useState({});

  useEffect(() => {
    fetchDropdownOptions();
    handleSearch("", "", "");
    loadIssueMasters();
  }, []);

  /* ── 드롭다운 옵션 ── */
  async function fetchDropdownOptions() {
    let q = supabase.from("SYSTEM_MENU_MASTER").select("SYSTEM_NAME,MENU1,MENU2").order("ID");
    if (deptCd) q = q.eq("DEPT_CD", deptCd);
    const { data } = await q;
    const rows = data ?? [];
    setSystemNames([...new Set(rows.map(r => r.SYSTEM_NAME).filter(Boolean))]);
    setMenu1Names([...new Set(rows.map(r => r.MENU1).filter(Boolean))]);
    setMenu2Names([...new Set(rows.map(r => r.MENU2).filter(Boolean))]);
  }

  /* ── 이슈 등록용 마스터 로드 ── */
  async function loadIssueMasters() {
    const dept = user?.deptCd;
    let q = supabase.from("TASK_MASTER").select("TASK_ID,TASK_NAME").eq("LEVEL","1").order("TASK_NAME");
    if (dept) q = q.eq("DEPT_CD", dept);
    const { data: tm } = await q;
    setTm1List(tm ?? []);

    const { data: users } = await supabase.from("SCRUMBOARD_USER").select("ID,NAME,DEPT_CD");
    if (users) {
      const map = {};
      users.forEach(u => { map[u.ID] = u.NAME; });
      setUserMap(map);
      setDeptUsers(dept ? users.filter(u => u.DEPT_CD === dept) : users);
    }

    let sq = supabase.from("OPERATING_SYSTEM").select("SYSTEM_NM,DEPT_CD").order("SYSTEM_NM");
    if (dept) sq = sq.eq("DEPT_CD", dept);
    const { data: sys } = await sq;
    setSystemList(sys ?? []);
  }

  /* ── 시스템 인라인 등록 (이슈 팝업 내부) ── */
  async function handleSysRegSave() {
    if (!newSysNm.trim()) { setSysRegErr("시스템명을 입력해주세요."); return; }
    setSysRegSaving(true); setSysRegErr("");
    const { error } = await supabase.from("OPERATING_SYSTEM").insert({
      SYSTEM_NM: newSysNm.trim(), DEPT_CD: user?.deptCd ?? null,
    });
    setSysRegSaving(false);
    if (error) { setSysRegErr("저장 오류: " + error.message); return; }
    setNewSysNm(""); setShowSysReg(false);
    await loadIssueMasters();
  }

  /* ── 조회 ── */
  async function handleSearch(sysVal, m1Val, m2Val) {
    const sys = sysVal !== undefined ? sysVal : searchSystem;
    const m1  = m1Val  !== undefined ? m1Val  : searchMenu1;
    const m2  = m2Val  !== undefined ? m2Val  : searchMenu2;
    setLoading(true);
    setSelectedMenu(null);
    setPlanRows([]);
    let q = supabase.from("SYSTEM_MENU_MASTER").select("*").order("ID", { ascending: true });
    if (deptCd) q = q.eq("DEPT_CD", deptCd);
    if (sys)    q = q.eq("SYSTEM_NAME", sys);
    if (m1)     q = q.eq("MENU1", m1);
    if (m2)     q = q.eq("MENU2", m2);
    const { data } = await q;
    setMenuList(data ?? []);
    setLoading(false);
  }

  function handleReset() {
    setSearchSystem(""); setSearchMenu1(""); setSearchMenu2("");
    handleSearch("", "", "");
  }

  /* ── 테스트케이스 일괄 생성 ── */
  async function handleCreateTestCases() {
    if (menuList.length === 0) {
      alert("먼저 조회 버튼을 눌러 시스템/화면 목록을 불러오세요.");
      return;
    }
    if (!window.confirm(
      `조회된 ${menuList.length}개 메뉴의 점검항목 전체를 기반으로 테스트케이스를 생성하시겠습니까?`
    )) return;

    setTcCreating(true);
    try {
      const userId = user?.id ?? "";

      // 1. 현재 사용자의 최대 TEST_SEQUENCE 조회
      const { data: seqData } = await supabase
        .from("SYSTEM_TEST_RESULT")
        .select("TEST_SEQUENCE")
        .eq("TESTER_ID", userId)
        .order("TEST_SEQUENCE", { ascending: false })
        .limit(1);
      const nextSeq = seqData && seqData.length > 0
        ? (seqData[0].TEST_SEQUENCE ?? 0) + 1
        : 1;

      // 2. 현재 menuList의 모든 PLAN 데이터 조회
      const menuIds = menuList.map(m => m.ID);
      const { data: planData, error: planErr } = await supabase
        .from("SYSTEM_TEST_PLANDATA")
        .select("PLAN_ID, ID")
        .in("ID", menuIds);
      if (planErr) throw new Error("점검항목 조회 오류: " + planErr.message);
      if (!planData || planData.length === 0) {
        alert("조회된 메뉴에 등록된 점검항목이 없습니다.\n먼저 점검항목을 등록해주세요.");
        setTcCreating(false);
        return;
      }

      // 3. SYSTEM_TEST_RESULT INSERT
      const now = new Date().toISOString();
      const rows = planData.map(p => ({
        TESTER_ID:     userId,
        TEST_SEQUENCE: nextSeq,
        PLAN_ID:       p.PLAN_ID,
        ID:            p.ID,          // SYSTEM_MENU_MASTER PK
        STATUS:        "테스트중",
        DEPT_CD:       deptCd || null,
        USR_CD:        userId,
        SYS_DT:        now,
      }));

      const { error: insErr } = await supabase.from("SYSTEM_TEST_RESULT").insert(rows);
      if (insErr) throw new Error("테스트케이스 생성 오류: " + insErr.message);

      alert(
        `테스트케이스 생성 완료!\n` +
        `- 생성 건수: ${rows.length}건\n` +
        `- TEST_SEQUENCE: ${nextSeq}`
      );
    } catch (e) {
      alert(e.message);
    } finally {
      setTcCreating(false);
    }
  }

  /* ── 점검항목 조회 ── */
  async function fetchPlanData(id) {
    console.log("[fetchPlanData] ID =", id);
    const { data, error } = await supabase
      .from("SYSTEM_TEST_PLANDATA")
      .select("*")
      .eq("ID", id)
      .order("PLAN_ID", { ascending: true });
    console.log("[fetchPlanData] data =", data, "error =", error);
    if (error) { alert("점검항목 조회 오류: " + error.message); return; }
    setPlanRows((data ?? []).map(r => ({ ...r, _selected:false, _modified:false, _isNew:false })));
  }

  function handleMenuSelect(row) {
    setSelectedMenu(row);
    fetchPlanData(row.ID);
  }

  /* ── 점검항목 편집 ── */
  function handlePlanCell(idx, field, val) {
    setPlanRows(rows => rows.map((r,i) => i===idx ? { ...r, [field]:val, _modified:true } : r));
  }
  function handlePlanSelect(idx) {
    setPlanRows(rows => rows.map((r,i) => i===idx ? { ...r, _selected:!r._selected } : r));
  }
  function handleSelectAll(checked) {
    setPlanRows(rows => rows.map(r => ({ ...r, _selected:checked })));
  }
  function addPlanRow() {
    setPlanRows(rows => [...rows, {
      PLAN_ID:null, ID:selectedMenu?.ID,
      TSET_GUBUN:"", TEST_CONTENT:"", DEPT_CD:deptCd,
      _selected:false, _modified:true, _isNew:true,
    }]);
  }

  async function deleteSelected() {
    const selected = planRows.filter(r => r._selected);
    if (selected.length === 0) { alert("삭제할 항목을 선택하세요."); return; }
    if (!window.confirm(`선택한 ${selected.length}개 항목을 삭제하시겠습니까?`)) return;
    const ids = selected.filter(r => !r._isNew && r.PLAN_ID).map(r => r.PLAN_ID);
    if (ids.length > 0) await supabase.from("SYSTEM_TEST_PLANDATA").delete().in("PLAN_ID", ids);
    setPlanRows(rows => rows.filter(r => !r._selected));
  }

  async function savePlanRows() {
    if (!selectedMenu) return;
    const modified = planRows.filter(r => r._modified);
    if (modified.length === 0) { alert("변경된 항목이 없습니다."); return; }
    setPlanSaving(true);
    const errors = [];
    for (const row of modified) {
      const payload = { ID:selectedMenu.ID, TSET_GUBUN:row.TSET_GUBUN, TEST_CONTENT:row.TEST_CONTENT, DEPT_CD:deptCd };
      if (row._isNew || !row.PLAN_ID) {
        const { error } = await supabase.from("SYSTEM_TEST_PLANDATA").insert(payload);
        if (error) { console.error("[savePlanRows] INSERT error:", error); errors.push(error.message); }
      } else {
        const { error } = await supabase.from("SYSTEM_TEST_PLANDATA").update(payload).eq("PLAN_ID", row.PLAN_ID);
        if (error) { console.error("[savePlanRows] UPDATE error:", error); errors.push(error.message); }
      }
    }
    setPlanSaving(false);
    if (errors.length > 0) {
      alert("저장 오류 (RLS 정책 확인 필요):\n" + errors.join("\n"));
      return;
    }
    await fetchPlanData(selectedMenu.ID);
    alert("저장되었습니다.");
  }

  /* ── 이슈 등록 팝업 열기 (자동 세팅) ── */
  function handleOpenIssueReg(row) {
    const menuNm   = selectedMenu?.MENU2 || selectedMenu?.MENU1 || "";
    const menuPath = selectedMenu?.MENU2
      ? `${selectedMenu.MENU1} > ${selectedMenu.MENU2}`
      : (selectedMenu?.MENU1 || "");
    const title = row.TSET_GUBUN
      ? `[${row.TSET_GUBUN}] ${row.TEST_CONTENT}`
      : (row.TEST_CONTENT || "");
    setIssueForm({ ...INIT_ISSUE, testGubun:"통합테스트", menuNm, menuPath, title });
    setIssueErr({});
    setImageBlob(null);
    setIssueRegStep(1);
    setShowSysReg(false);
    setShowIssueReg(true);
  }

  /* ── 이슈 저장 ── */
  async function handleIssueRegSave() {
    const errs = {};
    if (!issueForm.taskId)       errs.taskId   = "프로젝트를 선택해주세요.";
    if (!issueForm.errGubun)     errs.errGubun = "오류구분을 선택해주세요.";
    if (!issueForm.level)        errs.level    = "중요도를 선택해주세요.";
    if (!issueForm.title.trim()) errs.title    = "제목을 입력해주세요.";
    if (Object.keys(errs).length) { setIssueErr(errs); return; }

    setIssueSaving(true);

    // 이미지 업로드
    let imageUrl = null;
    if (imageBlob) {
      const fileName = `${Date.now()}_${user?.id ?? "unknown"}.png`;
      const { data: upData, error: upErr } = await supabase.storage
        .from("issue-images")
        .upload(fileName, imageBlob, { contentType:"image/png", upsert:false });
      if (!upErr && upData) {
        const { data: urlData } = supabase.storage.from("issue-images").getPublicUrl(fileName);
        imageUrl = urlData?.publicUrl ?? null;
      }
    }

    const now = new Date().toISOString();
    const relevantNm = issueForm.relevantUsers.length > 0
      ? issueForm.relevantUsers.map(id => userMap[id] ?? id).join(",")
      : null;

    const { error } = await supabase.from("SYSTEM_ERRORREPORT").insert({
      TASK_ID:          Number(issueForm.taskId),
      TEST_GUBUN:       issueForm.testGubun  || null,
      ERROR_GUBUN:      issueForm.errGubun,
      IMPORTANT_LEVEL:  issueForm.level,
      FIX_REQUEST_DATE: issueForm.fixRequestDate || null,
      MENU_NM:          issueForm.menuNm.trim()   || null,
      MENU_PATH:        issueForm.menuPath.trim()  || null,
      ERROR_TITLE:      issueForm.title.trim(),
      ERROR_CONTENT:    issueForm.content.trim(),
      SYSTEM_NM:        issueForm.systemNms.length ? issueForm.systemNms.join(",") : null,
      MANAGE_ID:        issueForm.managerId || null,
      MANAGE_DT:        issueForm.managerId ? now : null,
      RELEVANT_USER_NM: relevantNm,
      image_url:        imageUrl,
      INSERT_ID:        user?.id ?? "",
      INSERT_DT:        now,
      COMPLETE_YN:      "N",
    });

    setIssueSaving(false);
    if (error) { alert("등록 오류: " + error.message); return; }
    alert("이슈가 등록되었습니다.");
    setShowIssueReg(false);
    setIssueForm(INIT_ISSUE);
    setImageBlob(null);
  }

  /* ── 마스터 등록/수정/삭제 ── */
  async function handleRegSave() {
    const err = {};
    if (!regForm.SYSTEM_NAME.trim()) err.SYSTEM_NAME = "시스템명을 입력하세요.";
    if (!regForm.MENU1.trim())       err.MENU1       = "대메뉴를 입력하세요.";
    if (Object.keys(err).length) { setRegErr(err); return; }
    setRegSaving(true);
    const { error } = await supabase.from("SYSTEM_MENU_MASTER").insert({
      SYSTEM_NAME: regForm.SYSTEM_NAME.trim(), MENU1: regForm.MENU1.trim(),
      MENU2: regForm.MENU2.trim() || null, DEPT_CD: deptCd,
    });
    setRegSaving(false);
    if (error) { alert("등록 오류: " + error.message); return; }
    setShowReg(false); setRegForm({ SYSTEM_NAME:"", MENU1:"", MENU2:"" }); setRegErr({});
    fetchDropdownOptions(); handleSearch();
  }

  async function handleDeleteMenu() {
    if (!selectedMenu) { alert("삭제할 항목을 선택하세요."); return; }
    if (!window.confirm(`[${selectedMenu.SYSTEM_NAME} - ${selectedMenu.MENU1}]을 삭제하시겠습니까?\n관련 점검항목도 모두 삭제됩니다.`)) return;
    await supabase.from("SYSTEM_TEST_PLANDATA").delete().eq("ID", selectedMenu.ID);
    await supabase.from("SYSTEM_MENU_MASTER").delete().eq("ID", selectedMenu.ID);
    setSelectedMenu(null); setPlanRows([]);
    fetchDropdownOptions(); handleSearch();
  }

  async function handleEditSave() {
    if (!editForm) return;
    if (!editForm.SYSTEM_NAME?.trim() || !editForm.MENU1?.trim()) { alert("시스템명과 대메뉴는 필수입니다."); return; }
    setEditSaving(true);
    const { error } = await supabase.from("SYSTEM_MENU_MASTER").update({
      SYSTEM_NAME: editForm.SYSTEM_NAME.trim(), MENU1: editForm.MENU1.trim(),
      MENU2: editForm.MENU2?.trim() || null,
    }).eq("ID", editForm.ID);
    setEditSaving(false);
    if (error) { alert("수정 오류: " + error.message); return; }
    setShowEdit(false);
    setSelectedMenu(prev => prev?.ID === editForm.ID ? { ...prev, ...editForm } : prev);
    fetchDropdownOptions(); handleSearch();
  }

  /* ── STEP 인디케이터 스타일 ── */
  const stepCircle = (active, done) => ({
    width:"32px", height:"32px", borderRadius:"50%", fontSize:"13px", fontWeight:"700",
    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
    backgroundColor: done ? "#16A34A" : active ? "#2563EB" : "#E2E8F0",
    color: done || active ? "#fff" : "#94A3B8", transition:"all 0.2s",
  });
  const stepLine = (done) => ({
    flex:1, height:"2px", borderRadius:"2px", margin:"0 8px",
    backgroundColor: done ? "#16A34A" : "#E2E8F0", transition:"background 0.3s",
  });

  /* ── RENDER ─────────────────────────────────────────── */
  return (
    <div style={pt.wrap}>

      {/* 페이지 헤더 */}
      <div style={pt.pageHeader}>
        <h2 style={pt.pageTitle}>📋 PROJECT TEST</h2>
        <p style={pt.pageDesc}>시스템 & 화면별 점검항목을 등록·관리합니다.</p>
      </div>

      {/* 검색 */}
      <div style={pt.searchBar}>
        <div style={pt.searchField}>
          <label style={pt.label}>시스템명</label>
          <select style={pt.select} value={searchSystem} onChange={e => setSearchSystem(e.target.value)}>
            {systemNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={pt.searchField}>
          <label style={pt.label}>대메뉴 (화면1)</label>
          <select style={pt.select} value={searchMenu1} onChange={e => setSearchMenu1(e.target.value)}>
            <option value="">전체</option>
            {menu1Names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={pt.searchField}>
          <label style={pt.label}>소메뉴 (화면2)</label>
          <select style={pt.select} value={searchMenu2} onChange={e => setSearchMenu2(e.target.value)}>
            <option value="">전체</option>
            {menu2Names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:"6px" }}>
          <button style={pt.resetBtn} onClick={handleReset}>초기화</button>
          <button style={pt.searchBtn} onClick={() => handleSearch()} disabled={loading}>
            {loading ? "조회중..." : "🔍 조회"}
          </button>
          <button
            style={{
              fontFamily:"'Pretendard',sans-serif", fontSize:"13px", fontWeight:"700",
              color: tcCreating ? "#94A3B8" : "#FFFFFF",
              backgroundColor: tcCreating ? "#F1F5F9" : "#7C3AED",
              border:"none", borderRadius:"7px", padding:"7px 18px",
              cursor: tcCreating ? "not-allowed" : "pointer",
              whiteSpace:"nowrap",
            }}
            onClick={handleCreateTestCases}
            disabled={tcCreating || menuList.length === 0}
            title={menuList.length === 0 ? "먼저 조회 버튼을 눌러 목록을 불러오세요" : "조회된 점검항목 전체로 테스트케이스 생성"}
          >
            {tcCreating ? "⏳ 생성중..." : "📋 테스트케이스 생성"}
          </button>
        </div>
      </div>

      {/* 메인 */}
      <div style={pt.mainArea}>

        {/* ── 좌측 패널 ── */}
        <div style={{ ...pt.leftPanel, width: leftCollapsed ? "42px" : "400px", transition:"width 0.22s ease", overflow:"hidden", flexShrink:0 }}>
          <div style={pt.panelHeader}>
            {!leftCollapsed && <span style={pt.panelTitle}>시스템 & 화면 목록</span>}
            <div style={{ display:"flex", gap:"6px", marginLeft: leftCollapsed ? "auto" : 0 }}>
              {!leftCollapsed && (<>
                <button style={pt.addBtn} onClick={() => { setRegForm({ SYSTEM_NAME:"", MENU1:"", MENU2:"" }); setRegErr({}); setShowReg(true); }}>+ 등록</button>
                {selectedMenu && (<>
                  <button style={pt.editBtn} onClick={() => { setEditForm({...selectedMenu}); setShowEdit(true); }}>수정</button>
                  <button style={pt.deleteBtn} onClick={handleDeleteMenu}>삭제</button>
                </>)}
              </>)}
              <button style={{ ...pt.collapseBtn, marginLeft: leftCollapsed ? 0 : "4px" }}
                onClick={() => setLeftCollapsed(v=>!v)}
                title={leftCollapsed ? "목록 펼치기" : "목록 접기"}>
                {leftCollapsed ? "▶" : "◀"}
              </button>
            </div>
          </div>

          {leftCollapsed ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"12px 0" }}>
              <span style={{ writingMode:"vertical-rl", fontSize:"11px", fontWeight:"600", color:"#94A3B8", letterSpacing:"2px", userSelect:"none" }}>
                시스템 & 화면
              </span>
            </div>
          ) : (
            <div style={pt.leftTableWrap}>
              {loading ? (
                <div style={pt.empty}>조회 중...</div>
              ) : menuList.length === 0 ? (
                <div style={pt.empty}>
                  <span style={{ fontSize:"28px" }}>📂</span>
                  <p style={{ margin:"8px 0 0", fontSize:"13px", color:"#94A3B8" }}>조회된 데이터가 없습니다.</p>
                </div>
              ) : (
                <table style={pt.table}>
                  <thead>
                    <tr>
                      <th style={pt.th}>시스템명</th>
                      <th style={pt.th}>대메뉴</th>
                      <th style={pt.th}>소메뉴</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuList.map((row, idx) => {
                      const isActive = selectedMenu?.ID === row.ID;
                      return (
                        <tr key={row.ID} onClick={() => handleMenuSelect(row)}
                          style={{ backgroundColor: isActive ? "#EFF6FF" : idx%2===0 ? "#FFFFFF" : "#F8FAFC",
                            outline: isActive ? "2px solid #2563EB" : "none",
                            cursor:"pointer", borderBottom:"1px solid #F1F5F9" }}>
                          <td style={{ ...pt.td, fontWeight: isActive?"600":"400", color: isActive?"#1D4ED8":"#1E293B" }}>{row.SYSTEM_NAME}</td>
                          <td style={pt.td}>{row.MENU1}</td>
                          <td style={{ ...pt.td, color:"#64748B" }}>{row.MENU2 || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* ── 우측 패널: 점검항목 ── */}
        <div style={pt.rightPanel}>
          <div style={pt.panelHeader}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
              <span style={pt.panelTitle}>점검항목</span>
              {selectedMenu && (
                <span style={pt.selectedChip}>
                  {selectedMenu.SYSTEM_NAME}
                  {selectedMenu.MENU1 ? ` · ${selectedMenu.MENU1}` : ""}
                  {selectedMenu.MENU2 ? ` · ${selectedMenu.MENU2}` : ""}
                </span>
              )}
            </div>
            {selectedMenu && (
              <div style={{ display:"flex", gap:"6px" }}>
                <button style={pt.addRowBtn} onClick={addPlanRow}>+ 행 추가</button>
                <button style={pt.delRowBtn} onClick={deleteSelected}>선택 삭제</button>
                <button style={pt.saveBtn} onClick={savePlanRows} disabled={planSaving}>
                  {planSaving ? "저장중..." : "💾 저장"}
                </button>
              </div>
            )}
          </div>

          {!selectedMenu ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#94A3B8" }}>
              <span style={{ fontSize:"36px" }}>👈</span>
              <p style={{ margin:"10px 0 0", fontSize:"13px" }}>왼쪽 목록에서 시스템/화면을 선택하세요.</p>
            </div>
          ) : (
            <div style={pt.gridWrap}>
              <table style={pt.gridTable}>
                <colgroup>
                  <col style={{ width:"40px" }} />
                  <col style={{ width:"44px" }} />
                  <col style={{ width:"130px" }} />
                  <col />
                  <col style={{ width:"90px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={pt.gth}>
                      <input type="checkbox" style={{ cursor:"pointer" }}
                        checked={planRows.length > 0 && planRows.every(r => r._selected)}
                        onChange={e => handleSelectAll(e.target.checked)} />
                    </th>
                    <th style={{ ...pt.gth, textAlign:"center" }}>No</th>
                    <th style={pt.gth}>점검구분</th>
                    <th style={pt.gth}>점검항목</th>
                    <th style={{ ...pt.gth, textAlign:"center" }}>이슈 등록</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((row, idx) => (
                    <tr key={row.PLAN_ID ?? `new-${idx}`}
                      style={{
                        backgroundColor: row._selected ? "#FFF7ED" : row._isNew ? "#F0FDF4" : idx%2===0 ? "#FFFFFF" : "#F8FAFC",
                        borderBottom:"1px solid #F1F5F9",
                      }}>
                      <td style={{ ...pt.gtd, textAlign:"center" }}>
                        <input type="checkbox" style={{ cursor:"pointer" }} checked={!!row._selected} onChange={() => handlePlanSelect(idx)} />
                      </td>
                      <td style={{ ...pt.gtd, textAlign:"center", color:"#94A3B8", fontSize:"12px" }}>{idx+1}</td>
                      <td style={pt.gtd}>
                        <CellSelect value={row.TSET_GUBUN} onChange={e => handlePlanCell(idx,"TSET_GUBUN",e.target.value)} />
                      </td>
                      <td style={pt.gtd}>
                        <CellInput value={row.TEST_CONTENT} placeholder="점검항목 내용 입력" onChange={e => handlePlanCell(idx,"TEST_CONTENT",e.target.value)} />
                      </td>
                      <td style={{ ...pt.gtd, textAlign:"center" }}>
                        <button
                          style={{
                            fontFamily:"'Pretendard',sans-serif", fontSize:"11px", fontWeight:"600",
                            color: row.TEST_CONTENT?.trim() ? "#DC2626" : "#CBD5E1",
                            backgroundColor: row.TEST_CONTENT?.trim() ? "#FEF2F2" : "#F8FAFC",
                            border: `1px solid ${row.TEST_CONTENT?.trim() ? "#FECACA" : "#E2E8F0"}`,
                            borderRadius:"5px", padding:"4px 8px", cursor: row.TEST_CONTENT?.trim() ? "pointer" : "not-allowed",
                            whiteSpace:"nowrap",
                          }}
                          disabled={!row.TEST_CONTENT?.trim()}
                          onClick={() => handleOpenIssueReg(row)}
                          title={row.TEST_CONTENT?.trim() ? "이슈 등록 팝업 열기" : "점검항목 내용을 입력하세요"}
                        >
                          🐛 이슈
                        </button>
                      </td>
                    </tr>
                  ))}
                  {planRows.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign:"center", padding:"48px 20px", color:"#94A3B8", fontSize:"13px" }}>
                        <span style={{ fontSize:"28px" }}>📝</span>
                        <p style={{ margin:"8px 0 0" }}>점검항목이 없습니다. "+ 행 추가" 버튼으로 추가하세요.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {selectedMenu && planRows.length > 0 && (
            <div style={{ padding:"8px 16px", borderTop:"1px solid #E2E8F0", display:"flex", gap:"16px", fontSize:"12px", color:"#94A3B8", flexShrink:0 }}>
              <span>전체 {planRows.length}건</span>
              <span>선택 {planRows.filter(r=>r._selected).length}건</span>
              <span>변경 {planRows.filter(r=>r._modified).length}건</span>
              {planRows.some(r=>r._isNew) && <span style={{ color:"#16A34A", fontWeight:"600" }}>신규 {planRows.filter(r=>r._isNew).length}건 (미저장)</span>}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          이슈 등록 팝업 (2-Step, IssueManagePage 동일)
      ══════════════════════════════════════════ */}
      {showIssueReg && (
        <div style={im.overlay} onClick={e => e.target === e.currentTarget && setShowIssueReg(false)}>
          <div style={{ ...im.modal, maxWidth:"1100px", height:"88vh" }}>

            {/* ── 헤더 ── */}
            <div style={{ padding:"18px 28px", borderBottom:"1px solid #E8E8E8", flexShrink:0,
              background:"#fff", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"16px", flex:1 }}>
                <div>
                  <h3 style={{ margin:0, fontSize:"16px", fontWeight:"700", color:"#1E293B" }}>🐛 이슈 등록</h3>
                  <p style={{ margin:"2px 0 0", fontSize:"11px", color:"#94A3B8" }}>PROJECT TEST 연결 이슈 등록</p>
                </div>
                {/* Step 인디케이터 */}
                <div style={{ display:"flex", alignItems:"center", flex:1, maxWidth:"360px", marginLeft:"24px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <div style={stepCircle(issueRegStep===1, issueRegStep>1)}>
                      {issueRegStep > 1 ? "✓" : "1"}
                    </div>
                    <div>
                      <p style={{ margin:0, fontSize:"11px", fontWeight:"700",
                        color: issueRegStep===1 ? "#2563EB" : issueRegStep>1 ? "#16A34A" : "#94A3B8" }}>STEP 1</p>
                      <p style={{ margin:0, fontSize:"12px", color: issueRegStep===1 ? "#1E293B" : "#94A3B8" }}>오류 화면 첨부</p>
                    </div>
                  </div>
                  <div style={stepLine(issueRegStep > 1)} />
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <div style={stepCircle(issueRegStep===2, false)}>2</div>
                    <div>
                      <p style={{ margin:0, fontSize:"11px", fontWeight:"700", color: issueRegStep===2 ? "#2563EB" : "#94A3B8" }}>STEP 2</p>
                      <p style={{ margin:0, fontSize:"12px", color: issueRegStep===2 ? "#1E293B" : "#94A3B8" }}>오류 내용 등록</p>
                    </div>
                  </div>
                </div>
              </div>
              <button style={im.closeBtn} onClick={() => setShowIssueReg(false)}>✕</button>
            </div>

            {/* ── STEP 1: 이미지 업로드 & 편집 ── */}
            {issueRegStep === 1 && (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
                {/* 안내 배너 */}
                <div style={{ padding:"12px 28px", backgroundColor:"#F0F9FF",
                  borderBottom:"1px solid #BAE6FD", flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:"13px", color:"#0369A1" }}>
                    🖼️ &nbsp;파일 선택 또는 <strong>Ctrl+V 붙여넣기</strong>로 오류 화면을 첨부하세요.&nbsp;
                    <strong>이미지 첨부는 선택사항입니다.</strong>
                  </span>
                  {imageBlob && (
                    <span style={{ fontSize:"12px", fontWeight:"700", color:"#16A34A",
                      backgroundColor:"#DCFCE7", padding:"3px 12px", borderRadius:"20px" }}>
                      ✓ 이미지 준비됨
                    </span>
                  )}
                </div>
                {/* 캔버스 */}
                <div style={{ flex:1, padding:"20px 28px", display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
                  <CanvasEditor onImageReady={blob => setImageBlob(blob)} editorWidth={960} />
                </div>
                {/* 푸터 */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"14px 28px", borderTop:"1px solid #E8E8E8", flexShrink:0, backgroundColor:"#fff" }}>
                  <button style={im.resetBtn} onClick={() => setShowIssueReg(false)}>취소</button>
                  <div style={{ display:"flex", gap:"8px" }}>
                    {imageBlob && (
                      <button style={{ ...im.resetBtn, color:"#DC2626", borderColor:"#FECACA" }}
                        onClick={() => setImageBlob(null)}>
                        🗑 이미지 제거
                      </button>
                    )}
                    <button style={{ ...im.searchBtn, padding:"8px 28px" }}
                      onClick={() => setIssueRegStep(2)}>
                      다음 →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: 이슈 정보 입력 ── */}
            {issueRegStep === 2 && (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
                {/* 이미지 요약 배너 */}
                <div style={{ padding:"10px 28px", flexShrink:0,
                  backgroundColor: imageBlob ? "#F0FDF4" : "#FFFBEB",
                  borderBottom:`1px solid ${imageBlob ? "#BBF7D0" : "#FDE68A"}` }}>
                  {imageBlob
                    ? <span style={{ fontSize:"13px", color:"#15803D" }}>✓ 첨부 이미지 연결됨 — 저장 시 함께 업로드됩니다</span>
                    : <span style={{ fontSize:"13px", color:"#92400E" }}>⚠ 첨부 이미지 없음 — Step 1로 돌아가 이미지를 추가할 수 있습니다</span>
                  }
                  <span style={{ marginLeft:"16px", fontSize:"12px", fontWeight:"600", color:"#15803D",
                    backgroundColor:"#DCFCE7", padding:"2px 10px", borderRadius:"20px" }}>
                    ⚡ 화면명·화면경로·이슈제목 자동입력됨
                  </span>
                </div>

                {/* 폼 */}
                <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
                  <div style={{ maxWidth:"720px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"18px" }}>

                    {/* 프로젝트명 */}
                    <div style={im.formRow}>
                      <label style={im.formLabel}>프로젝트명 <span style={{ color:"#DC2626" }}>*</span></label>
                      <select style={{ ...im.select, width:"100%" }}
                        value={issueForm.taskId} onChange={e => setIssueForm(f => ({ ...f, taskId:e.target.value }))}>
                        <option value="">선택</option>
                        {tm1List.map(t => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
                      </select>
                      {issueErr.taskId && <span style={im.errMsg}>{issueErr.taskId}</span>}
                    </div>

                    {/* 테스트구분 / 오류구분 / 중요도 */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"14px" }}>
                      <div style={im.formRow}>
                        <label style={im.formLabel}>
                          테스트구분
                          <span style={{ marginLeft:"6px", fontSize:"11px", color:"#2563EB", fontWeight:"500" }}>⚡자동입력</span>
                        </label>
                        <select style={{ ...im.select, width:"100%", backgroundColor:"#EFF6FF", borderColor:"#BFDBFE" }}
                          value={issueForm.testGubun} onChange={e => setIssueForm(f => ({ ...f, testGubun:e.target.value }))}>
                          <option value="">선택</option>
                          {TEST_GUBUN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div style={im.formRow}>
                        <label style={im.formLabel}>오류구분 <span style={{ color:"#DC2626" }}>*</span></label>
                        <select style={{ ...im.select, width:"100%" }}
                          value={issueForm.errGubun} onChange={e => setIssueForm(f => ({ ...f, errGubun:e.target.value }))}>
                          <option value="">선택</option>
                          <option value="오류">오류</option>
                          <option value="개선">개선</option>
                        </select>
                        {issueErr.errGubun && <span style={im.errMsg}>{issueErr.errGubun}</span>}
                      </div>
                      <div style={im.formRow}>
                        <label style={im.formLabel}>중요도 <span style={{ color:"#DC2626" }}>*</span></label>
                        <select style={{ ...im.select, width:"100%" }}
                          value={issueForm.level} onChange={e => setIssueForm(f => ({ ...f, level:e.target.value }))}>
                          <option value="">선택</option>
                          <option value="긴급">긴급</option>
                          <option value="상">상</option>
                          <option value="중">중</option>
                          <option value="하">하</option>
                        </select>
                        {issueErr.level && <span style={im.errMsg}>{issueErr.level}</span>}
                      </div>
                    </div>

                    {/* 시스템명 */}
                    <div style={im.formRow}>
                      <label style={im.formLabel}>시스템명 <span style={{ fontSize:"11px", color:"#94A3B8", fontWeight:"400" }}>(복수선택 가능)</span></label>
                      <div style={{ display:"flex", gap:"6px" }}>
                        <div style={{ flex:1 }}>
                          <MultiSystemSelect
                            systems={systemList}
                            selected={issueForm.systemNms}
                            onChange={vals => setIssueForm(f => ({ ...f, systemNms:vals }))}
                          />
                        </div>
                        <button type="button"
                          onClick={() => { setNewSysNm(""); setSysRegErr(""); setShowSysReg(true); }}
                          style={{ padding:"0 14px", border:"1px solid #2563EB", borderRadius:"7px",
                            backgroundColor:"#EFF6FF", color:"#2563EB", fontSize:"13px", fontWeight:"700",
                            cursor:"pointer", flexShrink:0, whiteSpace:"nowrap",
                            fontFamily:"'Pretendard',sans-serif" }}>
                          + 등록
                        </button>
                      </div>
                    </div>

                    {/* 시스템 등록 인라인 팝업 */}
                    {showSysReg && (
                      <div style={{ backgroundColor:"#F0F9FF", border:"1px solid #BAE6FD",
                        borderRadius:"10px", padding:"14px 16px",
                        display:"flex", flexDirection:"column", gap:"10px" }}>
                        <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#0369A1" }}>새 시스템 등록</p>
                        <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                          <div style={{ flex:1 }}>
                            <input
                              style={{ ...im.input, width:"100%", boxSizing:"border-box" }}
                              placeholder="시스템명을 입력하세요"
                              value={newSysNm}
                              onChange={e => { setNewSysNm(e.target.value); setSysRegErr(""); }}
                              onKeyDown={e => e.key==="Enter" && handleSysRegSave()}
                              autoFocus
                            />
                            {sysRegErr && <span style={im.errMsg}>{sysRegErr}</span>}
                          </div>
                          <button type="button" onClick={handleSysRegSave} disabled={sysRegSaving}
                            style={{ padding:"8px 18px", border:"none", borderRadius:"7px",
                              backgroundColor: sysRegSaving ? "#CBD5E1" : "#2563EB",
                              color:"#fff", fontSize:"13px", fontWeight:"600",
                              cursor: sysRegSaving ? "not-allowed" : "pointer",
                              fontFamily:"'Pretendard',sans-serif", flexShrink:0 }}>
                            {sysRegSaving ? "저장 중..." : "저장"}
                          </button>
                          <button type="button" onClick={() => setShowSysReg(false)}
                            style={{ padding:"8px 12px", border:"1px solid #E2E8F0", borderRadius:"7px",
                              backgroundColor:"#fff", color:"#64748B", fontSize:"13px",
                              cursor:"pointer", fontFamily:"'Pretendard',sans-serif", flexShrink:0 }}>
                            취소
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 완료요청일자 / 화면명 / 화면경로 */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"14px" }}>
                      <div style={im.formRow}>
                        <label style={im.formLabel}>완료요청일자</label>
                        <input type="date" style={{ ...im.input, width:"100%" }}
                          value={issueForm.fixRequestDate}
                          onChange={e => setIssueForm(f => ({ ...f, fixRequestDate:e.target.value }))} />
                      </div>
                      <div style={im.formRow}>
                        <label style={im.formLabel}>
                          화면명 <span style={{ fontSize:"11px", color:"#2563EB", fontWeight:"500" }}>⚡자동입력</span>
                        </label>
                        <input style={{ ...im.input, width:"100%", backgroundColor:"#EFF6FF", borderColor:"#BFDBFE" }}
                          placeholder="예) 이슈 관리 화면"
                          value={issueForm.menuNm} onChange={e => setIssueForm(f => ({ ...f, menuNm:e.target.value }))} />
                      </div>
                      <div style={im.formRow}>
                        <label style={im.formLabel}>
                          화면 경로 <span style={{ fontSize:"11px", color:"#2563EB", fontWeight:"500" }}>⚡자동입력</span>
                        </label>
                        <input style={{ ...im.input, width:"100%", backgroundColor:"#EFF6FF", borderColor:"#BFDBFE" }}
                          placeholder="예) 메인 > 이슈관리"
                          value={issueForm.menuPath} onChange={e => setIssueForm(f => ({ ...f, menuPath:e.target.value }))} />
                      </div>
                    </div>

                    {/* 접수자 / 연관담당자 */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
                      <div style={im.formRow}>
                        <label style={im.formLabel}>접수자</label>
                        <select style={{ ...im.select, width:"100%" }}
                          value={issueForm.managerId} onChange={e => setIssueForm(f => ({ ...f, managerId:e.target.value }))}>
                          <option value="">선택 안함</option>
                          {deptUsers.map(u => <option key={u.ID} value={u.ID}>{u.NAME}</option>)}
                        </select>
                      </div>
                      <div style={im.formRow}>
                        <label style={im.formLabel}>연관 담당자 <span style={{ fontSize:"11px", color:"#94A3B8", fontWeight:"400" }}>(멀티선택)</span></label>
                        <MultiUserSelect
                          users={deptUsers}
                          selected={issueForm.relevantUsers}
                          onChange={ids => setIssueForm(f => ({ ...f, relevantUsers:ids }))}
                        />
                      </div>
                    </div>

                    {/* 이슈 제목 */}
                    <div style={im.formRow}>
                      <label style={im.formLabel}>
                        이슈 제목 <span style={{ color:"#DC2626" }}>*</span>
                        <span style={{ marginLeft:"6px", fontSize:"11px", color:"#2563EB", fontWeight:"500" }}>⚡자동입력</span>
                      </label>
                      <input
                        style={{ ...im.input, width:"100%", fontSize:"14px", padding:"10px 12px", backgroundColor:"#EFF6FF", borderColor:"#BFDBFE" }}
                        placeholder="이슈 제목을 입력하세요"
                        value={issueForm.title} onChange={e => setIssueForm(f => ({ ...f, title:e.target.value }))} />
                      {issueErr.title && <span style={im.errMsg}>{issueErr.title}</span>}
                    </div>

                    {/* 오류 내용 */}
                    <div style={im.formRow}>
                      <label style={im.formLabel}>오류 내용</label>
                      <textarea
                        style={{ ...im.textarea, width:"100%", minHeight:"200px", resize:"vertical",
                          boxSizing:"border-box", fontSize:"13px", lineHeight:"1.7" }}
                        placeholder={"오류 내용을 상세히 입력하세요\n\n• 발생 상황\n• 재현 방법\n• 예상 동작"}
                        value={issueForm.content} onChange={e => setIssueForm(f => ({ ...f, content:e.target.value }))} />
                    </div>

                  </div>
                </div>

                {/* 푸터 */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"14px 28px", borderTop:"1px solid #E8E8E8", flexShrink:0, backgroundColor:"#fff" }}>
                  <button style={im.resetBtn} onClick={() => setIssueRegStep(1)}>← 이전</button>
                  <div style={{ display:"flex", gap:"8px" }}>
                    <button style={im.resetBtn} onClick={() => setShowIssueReg(false)}>취소</button>
                    <button style={{ ...im.searchBtn, padding:"8px 32px", fontSize:"13px" }}
                      onClick={handleIssueRegSave} disabled={issueSaving}>
                      {issueSaving ? "저장 중..." : "✓ 등록"}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── 시스템/화면 등록 팝업 ── */}
      {showReg && (
        <div style={pt.overlay} onClick={e => { if (e.target === e.currentTarget) setShowReg(false); }}>
          <div style={pt.modal}>
            <div style={pt.modalHeader}>
              <span style={pt.modalTitle}>시스템 & 화면 등록</span>
              <button style={pt.closeBtn} onClick={() => setShowReg(false)}>✕</button>
            </div>
            <div style={pt.modalBody}>
              <div style={pt.formRow}>
                <label style={pt.formLabel}>시스템명 <span style={{ color:"#DC2626" }}>*</span></label>
                <input style={pt.formInput} value={regForm.SYSTEM_NAME}
                  onChange={e => setRegForm(f => ({ ...f, SYSTEM_NAME:e.target.value }))} placeholder="시스템명을 입력하세요" />
                {regErr.SYSTEM_NAME && <p style={pt.errMsg}>{regErr.SYSTEM_NAME}</p>}
              </div>
              <div style={pt.formRow}>
                <label style={pt.formLabel}>대메뉴 (화면1) <span style={{ color:"#DC2626" }}>*</span></label>
                <input style={pt.formInput} value={regForm.MENU1}
                  onChange={e => setRegForm(f => ({ ...f, MENU1:e.target.value }))} placeholder="대메뉴를 입력하세요" />
                {regErr.MENU1 && <p style={pt.errMsg}>{regErr.MENU1}</p>}
              </div>
              <div style={pt.formRow}>
                <label style={pt.formLabel}>소메뉴 (화면2) <span style={{ color:"#94A3B8", fontWeight:"400" }}>(선택)</span></label>
                <input style={pt.formInput} value={regForm.MENU2}
                  onChange={e => setRegForm(f => ({ ...f, MENU2:e.target.value }))} placeholder="소메뉴를 입력하세요 (없으면 공란)" />
              </div>
            </div>
            <div style={pt.modalFooter}>
              <button style={pt.cancelBtn} onClick={() => setShowReg(false)}>취소</button>
              <button style={pt.submitBtn} onClick={handleRegSave} disabled={regSaving}>{regSaving ? "저장중..." : "등록"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 시스템/화면 수정 팝업 ── */}
      {showEdit && editForm && (
        <div style={pt.overlay} onClick={e => { if (e.target === e.currentTarget) setShowEdit(false); }}>
          <div style={pt.modal}>
            <div style={pt.modalHeader}>
              <span style={pt.modalTitle}>시스템 & 화면 수정</span>
              <button style={pt.closeBtn} onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <div style={pt.modalBody}>
              <div style={pt.formRow}>
                <label style={pt.formLabel}>시스템명 <span style={{ color:"#DC2626" }}>*</span></label>
                <input style={pt.formInput} value={editForm.SYSTEM_NAME}
                  onChange={e => setEditForm(f => ({ ...f, SYSTEM_NAME:e.target.value }))} placeholder="시스템명을 입력하세요" />
              </div>
              <div style={pt.formRow}>
                <label style={pt.formLabel}>대메뉴 (화면1) <span style={{ color:"#DC2626" }}>*</span></label>
                <input style={pt.formInput} value={editForm.MENU1}
                  onChange={e => setEditForm(f => ({ ...f, MENU1:e.target.value }))} placeholder="대메뉴를 입력하세요" />
              </div>
              <div style={pt.formRow}>
                <label style={pt.formLabel}>소메뉴 (화면2) <span style={{ color:"#94A3B8", fontWeight:"400" }}>(선택)</span></label>
                <input style={pt.formInput} value={editForm.MENU2 ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, MENU2:e.target.value }))} placeholder="소메뉴를 입력하세요 (없으면 공란)" />
              </div>
            </div>
            <div style={pt.modalFooter}>
              <button style={pt.cancelBtn} onClick={() => setShowEdit(false)}>취소</button>
              <button style={pt.submitBtn} onClick={handleEditSave} disabled={editSaving}>{editSaving ? "저장중..." : "수정"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── pt 스타일 ──────────────────────────────────────── */
const pt = {
  wrap: { display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", gap:"16px", fontFamily:"'Pretendard',sans-serif" },
  pageHeader: { flexShrink:0 },
  pageTitle: { margin:0, fontSize:"20px", fontWeight:"700", color:"#1E293B" },
  pageDesc:  { margin:"4px 0 0", fontSize:"13px", color:"#94A3B8" },
  searchBar: { display:"flex", gap:"12px", flexWrap:"wrap", backgroundColor:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"12px", padding:"14px 20px", alignItems:"flex-end", flexShrink:0 },
  searchField: { display:"flex", flexDirection:"column", gap:"4px" },
  label: { fontSize:"12px", fontWeight:"600", color:"#475569" },
  select: { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", color:"#1E293B", backgroundColor:"#F8FAFC", border:"1px solid #CBD5E1", borderRadius:"7px", padding:"7px 10px", minWidth:"130px", cursor:"pointer" },
  resetBtn:  { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", color:"#475569", backgroundColor:"#F1F5F9", border:"1px solid #CBD5E1", borderRadius:"7px", padding:"7px 16px", cursor:"pointer", fontWeight:"500" },
  searchBtn: { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", color:"#FFFFFF", backgroundColor:"#1E293B", border:"none", borderRadius:"7px", padding:"7px 18px", cursor:"pointer", fontWeight:"600" },
  mainArea: { display:"flex", gap:"16px", flex:1, minHeight:0 },
  leftPanel: { display:"flex", flexDirection:"column", backgroundColor:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"hidden" },
  leftTableWrap: { overflowY:"auto", flex:1 },
  rightPanel: { display:"flex", flexDirection:"column", flex:1, backgroundColor:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"hidden" },
  gridWrap: { overflowY:"auto", flex:1 },
  panelHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:"1px solid #E2E8F0", backgroundColor:"#F8FAFC", flexShrink:0 },
  panelTitle: { fontSize:"14px", fontWeight:"700", color:"#1E293B", whiteSpace:"nowrap" },
  selectedChip: { fontSize:"12px", color:"#2563EB", backgroundColor:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"20px", padding:"2px 10px", fontWeight:"500", whiteSpace:"nowrap" },
  empty: { padding:"48px 20px", textAlign:"center", fontSize:"13px", color:"#94A3B8" },
  collapseBtn: { fontFamily:"'Pretendard',sans-serif", fontSize:"11px", fontWeight:"700", color:"#475569", backgroundColor:"#E2E8F0", border:"none", borderRadius:"5px", padding:"5px 8px", cursor:"pointer", flexShrink:0 },
  addBtn:    { fontFamily:"'Pretendard',sans-serif", fontSize:"12px", fontWeight:"600", color:"#FFFFFF", backgroundColor:"#2563EB", border:"none", borderRadius:"6px", padding:"6px 12px", cursor:"pointer", whiteSpace:"nowrap" },
  editBtn:   { fontFamily:"'Pretendard',sans-serif", fontSize:"12px", fontWeight:"600", color:"#FFFFFF", backgroundColor:"#0891B2", border:"none", borderRadius:"6px", padding:"6px 12px", cursor:"pointer" },
  deleteBtn: { fontFamily:"'Pretendard',sans-serif", fontSize:"12px", fontWeight:"600", color:"#FFFFFF", backgroundColor:"#DC2626", border:"none", borderRadius:"6px", padding:"6px 12px", cursor:"pointer" },
  addRowBtn: { fontFamily:"'Pretendard',sans-serif", fontSize:"12px", fontWeight:"600", color:"#FFFFFF", backgroundColor:"#2563EB", border:"none", borderRadius:"6px", padding:"6px 12px", cursor:"pointer" },
  delRowBtn: { fontFamily:"'Pretendard',sans-serif", fontSize:"12px", fontWeight:"600", color:"#FFFFFF", backgroundColor:"#DC2626", border:"none", borderRadius:"6px", padding:"6px 12px", cursor:"pointer" },
  saveBtn:   { fontFamily:"'Pretendard',sans-serif", fontSize:"12px", fontWeight:"600", color:"#FFFFFF", backgroundColor:"#16A34A", border:"none", borderRadius:"6px", padding:"6px 14px", cursor:"pointer" },
  table: { width:"100%", borderCollapse:"collapse" },
  th: { position:"sticky", top:0, backgroundColor:"#F1F5F9", padding:"10px 12px", fontSize:"12px", fontWeight:"600", color:"#475569", textAlign:"left", borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap" },
  td: { padding:"9px 12px", fontSize:"13px", color:"#1E293B" },
  gridTable: { width:"100%", borderCollapse:"collapse" },
  gth: { position:"sticky", top:0, backgroundColor:"#F1F5F9", padding:"10px 12px", fontSize:"12px", fontWeight:"600", color:"#475569", textAlign:"left", borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap" },
  gtd: { padding:"3px 6px", verticalAlign:"middle" },
  overlay: { position:"fixed", inset:0, backgroundColor:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 },
  modal: { backgroundColor:"#FFFFFF", borderRadius:"12px", width:"90%", maxWidth:"480px", boxShadow:"0 8px 32px rgba(0,0,0,0.18)", display:"flex", flexDirection:"column", overflow:"hidden" },
  modalHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid #E2E8F0" },
  modalTitle: { fontSize:"16px", fontWeight:"700", color:"#1E293B" },
  closeBtn: { background:"none", border:"none", fontSize:"18px", color:"#94A3B8", cursor:"pointer" },
  modalBody: { padding:"24px", display:"flex", flexDirection:"column", gap:"16px" },
  modalFooter: { display:"flex", justifyContent:"flex-end", gap:"8px", padding:"16px 24px", borderTop:"1px solid #E2E8F0" },
  formRow: { display:"flex", flexDirection:"column", gap:"6px" },
  formLabel: { fontSize:"13px", fontWeight:"600", color:"#374151" },
  formInput: { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", color:"#1E293B", backgroundColor:"#F8FAFC", border:"1px solid #CBD5E1", borderRadius:"8px", padding:"10px 12px", outline:"none" },
  errMsg: { margin:"2px 0 0", fontSize:"12px", color:"#DC2626" },
  cancelBtn: { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", fontWeight:"600", color:"#475569", backgroundColor:"#F1F5F9", border:"1px solid #CBD5E1", borderRadius:"8px", padding:"9px 20px", cursor:"pointer" },
  submitBtn: { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", fontWeight:"600", color:"#FFFFFF", backgroundColor:"#2563EB", border:"none", borderRadius:"8px", padding:"9px 24px", cursor:"pointer" },
};

/* ── 이슈 등록 폼 전용 스타일 (IssueManagePage 동일) ── */
const im = {
  overlay:    { position:"fixed", inset:0, backgroundColor:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" },
  modal:      { backgroundColor:"#fff", borderRadius:"14px", width:"96vw", maxWidth:"1400px", height:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 40px rgba(0,0,0,0.22)", overflow:"hidden" },
  closeBtn:   { background:"none", border:"none", fontSize:"18px", color:"#94A3B8", cursor:"pointer" },
  formRow:    { display:"flex", flexDirection:"column", gap:"5px" },
  formLabel:  { fontSize:"13px", fontWeight:"600", color:"#374151" },
  select:     { padding:"8px 10px", border:"1px solid #CBD5E1", borderRadius:"7px", fontSize:"13px", color:"#1E293B", backgroundColor:"#FFFFFF", fontFamily:"'Pretendard',sans-serif", cursor:"pointer", outline:"none" },
  input:      { padding:"8px 10px", border:"1px solid #CBD5E1", borderRadius:"7px", fontSize:"13px", color:"#1E293B", fontFamily:"'Pretendard',sans-serif", outline:"none" },
  textarea:   { padding:"10px 12px", border:"1px solid #CBD5E1", borderRadius:"7px", fontSize:"13px", color:"#1E293B", fontFamily:"'Pretendard',sans-serif", outline:"none", resize:"vertical" },
  resetBtn:   { padding:"9px 20px", border:"1px solid #E2E8F0", borderRadius:"8px", backgroundColor:"#F8FAFC", color:"#64748B", fontSize:"13px", fontWeight:"500", cursor:"pointer", fontFamily:"'Pretendard',sans-serif" },
  searchBtn:  { padding:"9px 24px", border:"none", borderRadius:"8px", backgroundColor:"#1E293B", color:"#FFFFFF", fontSize:"13px", fontWeight:"600", cursor:"pointer", fontFamily:"'Pretendard',sans-serif" },
  errMsg:     { fontSize:"11px", color:"#DC2626", marginTop:"2px" },
};
