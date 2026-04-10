import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ── 배지 스타일 ── */
const ERROR_GUBUN_STYLE = {
  오류: { bg: "#FEE2E2", color: "#DC2626" },
  개선: { bg: "#DBEAFE", color: "#2563EB" },
};
const LEVEL_STYLE = {
  긴급: { bg: "#FEE2E2", color: "#DC2626" },
  상:   { bg: "#FFEDD5", color: "#C2410C" },
  중:   { bg: "#E0F2FE", color: "#0369A1" },
  하:   { bg: "#F1F5F9", color: "#64748B" },
};

function Badge({ text, styles }) {
  if (!text) return <span style={{ color: "#94A3B8", fontSize: "12px" }}>-</span>;
  const s = styles?.[text];
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: "12px",
      fontSize: "11px", fontWeight: "600",
      backgroundColor: s?.bg ?? "#F1F5F9", color: s?.color ?? "#64748B",
    }}>{text}</span>
  );
}

function formatDate(val) {
  if (!val) return "-";
  const s = String(val).replace(/[-T]/g, "").slice(0, 8);
  if (s.length === 8) return `${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`;
  return String(val).slice(0, 10).replace(/-/g, ".");
}

/* ── 줌 버튼 스타일 (CanvasEditor 내부에서 사용) ── */
const zoomBtnStyle = {
  width: "24px", height: "24px", borderRadius: "4px", border: "1px solid #E2E8F0",
  backgroundColor: "#F8FAFC", color: "#1E293B", fontSize: "14px", fontWeight: "700",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  lineHeight: 1, fontFamily: "monospace",
};

/* ══════════════════════════════════════════
   캔버스 이미지 편집기
   - baseData(ref): 이미지 + 확정된 펜 스트로크 (objects 미포함)
   - objects(state): 도형·텍스트 객체 목록 (이동 가능)
   - select 툴로 객체 선택 후 드래그로 이동
══════════════════════════════════════════ */
function CanvasEditor({ onImageReady }) {
  const canvasRef  = useRef(null);
  const scrollRef  = useRef(null);
  const baseData   = useRef(null);   // ImageData: image + pen strokes
  const objsRef    = useRef([]);     // objects 미러 ref (stale closure 방지)
  const selIdRef   = useRef(null);   // selId 미러 ref

  const [tool,       setTool]      = useState("draw");
  const [color,      setColor]     = useState("#DC2626");
  const [lineWidth,  setLineWidth] = useState(3);
  const [fontSize,   setFontSize]  = useState(20);
  const [objects,   _setObjects]   = useState([]);
  const [selId,     _setSelId]     = useState(null);
  const [history,    setHistory]   = useState([]);
  const [hasImage,   setHasImage]  = useState(false);
  const [zoom,       setZoom]      = useState(1);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
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

  /* ── 렌더링 ── */
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
      ctx.beginPath();
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    } else if (obj.type === "circle") {
      const rx = obj.w / 2, ry = obj.h / 2;
      ctx.beginPath();
      ctx.ellipse(obj.x + rx, obj.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (obj.type === "text") {
      ctx.font      = `bold ${obj.fs}px sans-serif`;
      ctx.fillStyle = obj.color;
      ctx.fillText(obj.text, obj.x, obj.y);
    }
    ctx.restore();
  }

  function renderSel(ctx, obj) {
    const pad = 6;
    let bx, by, bw, bh;
    if (obj.type === "text") {
      ctx.save();
      ctx.font = `bold ${obj.fs}px sans-serif`;
      const tw = ctx.measureText(obj.text).width;
      ctx.restore();
      bx = obj.x - pad; by = obj.y - obj.fs - pad;
      bw = tw + pad * 2; bh = obj.fs + pad * 2;
    } else {
      bx = Math.min(obj.x, obj.x + obj.w) - pad;
      by = Math.min(obj.y, obj.y + obj.h) - pad;
      bw = Math.abs(obj.w) + pad * 2;
      bh = Math.abs(obj.h) + pad * 2;
    }
    ctx.save();
    ctx.strokeStyle = "#2563EB";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);
    ctx.fillStyle = "#2563EB";
    [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].forEach(([hx, hy]) => {
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
    });
    ctx.restore();
  }

  /* ── 히트 테스트 ── */
  function hitTest(obj, x, y) {
    const pad = 10;
    if (obj.type === "rect") {
      const l = Math.min(obj.x, obj.x + obj.w) - pad, r = Math.max(obj.x, obj.x + obj.w) + pad;
      const t = Math.min(obj.y, obj.y + obj.h) - pad, b = Math.max(obj.y, obj.y + obj.h) + pad;
      return x >= l && x <= r && y >= t && y <= b;
    } else if (obj.type === "circle") {
      const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
      const rx = Math.abs(obj.w / 2) + pad, ry = Math.abs(obj.h / 2) + pad;
      return ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1;
    } else if (obj.type === "text") {
      const ctx = canvasRef.current.getContext("2d");
      ctx.save();
      ctx.font = `bold ${obj.fs}px sans-serif`;
      const tw = ctx.measureText(obj.text).width;
      ctx.restore();
      return x >= obj.x - pad && x <= obj.x + tw + pad && y >= obj.y - obj.fs - pad && y <= obj.y + pad;
    }
    return false;
  }

  /* ── 히스토리 ── */
  function pushHistory() {
    const bd = baseData.current;
    setHistory(h => [...h.slice(-19), {
      base: bd ? new ImageData(new Uint8ClampedArray(bd.data), bd.width, bd.height) : null,
      objs: [...objsRef.current],
      sid:  selIdRef.current,
    }]);
  }

  function handleUndo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    baseData.current = prev.base;
    setHistory(h => h.slice(0, -1));
    setObjects(prev.objs);
    setSelId(prev.sid ?? null);
    renderAll(prev.objs, prev.sid ?? null);
    notifyParent();
  }

  /* ── 이미지 업로드 ── */
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const MAX = 4000;
        let w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        baseData.current = ctx.getImageData(0, 0, w, h);
        setObjects([]); setSelId(null); setHistory([]);
        setCanvasSize({ w, h }); setHasImage(true);
        const initZoom = Math.min(1, 560 / w);
        setZoom(parseFloat(initZoom.toFixed(2)));
        canvas.toBlob(blob => { if (blob) onImageReady(blob); }, "image/png");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ── 좌표 변환 ── */
  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  }

  /* ── 마우스 핸들러 ── */
  function onMouseDown(e) {
    if (!hasImage) return;
    const pos = getPos(e);

    /* SELECT 툴: 객체 선택 & 드래그 준비 */
    if (tool === "select") {
      const hit = [...objsRef.current].reverse().find(o => hitTest(o, pos.x, pos.y));
      if (hit) {
        pushHistory();
        setSelId(hit.id);
        isDragging.current   = true;
        dragStart.current    = pos;
        dragObjStart.current = { x: hit.x, y: hit.y };
      } else {
        setSelId(null);
      }
      return;
    }

    /* TEXT 툴 */
    if (tool === "text") {
      const text = window.prompt("입력할 텍스트:");
      if (!text) return;
      pushHistory();
      const newObj = { id: Date.now(), type: "text", x: pos.x, y: pos.y, text, color, fs: fontSize };
      setObjects(objs => [...objs, newObj]);
      setSelId(newObj.id);
      notifyParent();
      return;
    }

    /* SHAPE 툴 */
    if (tool === "rect" || tool === "circle") {
      pushHistory();
      isDrawing.current  = true;
      shapeStart.current = pos;
      const canvas = canvasRef.current;
      snapBefore.current = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      return;
    }

    /* PEN / UNDERLINE */
    pushHistory();
    isDrawing.current  = true;
    lastPos.current    = pos;
    strokeInfo.current = { color, lw: lineWidth, type: tool, points: [pos] };
  }

  function onMouseMove(e) {
    if (!hasImage) return;
    const pos = getPos(e);

    /* SELECT 툴: 드래그 중이면 이동, 아니면 커서 변경 */
    if (tool === "select") {
      if (isDragging.current && selIdRef.current) {
        const dx = pos.x - dragStart.current.x;
        const dy = pos.y - dragStart.current.y;
        setObjects(objs => objs.map(o =>
          o.id === selIdRef.current
            ? { ...o, x: dragObjStart.current.x + dx, y: dragObjStart.current.y + dy }
            : o
        ));
      } else {
        const hit = [...objsRef.current].reverse().find(o => hitTest(o, pos.x, pos.y));
        setMoveCursor(hit ? "move" : "default");
      }
      return;
    }

    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    /* SHAPE 미리보기 */
    if (tool === "rect" || tool === "circle") {
      ctx.putImageData(snapBefore.current, 0, 0);
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = "round";
      const sx = shapeStart.current.x, sy = shapeStart.current.y;
      ctx.beginPath();
      if (tool === "rect") {
        ctx.strokeRect(sx, sy, pos.x - sx, pos.y - sy);
      } else {
        const rx = (pos.x - sx) / 2, ry = (pos.y - sy) / 2;
        ctx.ellipse(sx + rx, sy + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    /* PEN / UNDERLINE 실시간 드로잉 */
    const si = strokeInfo.current;
    ctx.strokeStyle = si.color; ctx.lineWidth = si.lw; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    const nextPos = si.type === "underline" ? { x: pos.x, y: lastPos.current.y } : pos;
    ctx.lineTo(nextPos.x, nextPos.y);
    ctx.stroke();
    si.points.push(nextPos);
    lastPos.current = nextPos;
    notifyParent();
  }

  function onMouseUp(e) {
    if (!hasImage) return;

    /* SELECT: 드래그 종료 */
    if (tool === "select") {
      if (isDragging.current) { isDragging.current = false; notifyParent(); }
      return;
    }

    /* SHAPE 확정 */
    if (isDrawing.current && (tool === "rect" || tool === "circle") && e) {
      const pos = getPos(e);
      const sx = shapeStart.current.x, sy = shapeStart.current.y;
      const w = pos.x - sx, h = pos.y - sy;
      if (Math.abs(w) > 3 || Math.abs(h) > 3) {
        const newObj = { id: Date.now(), type: tool, x: sx, y: sy, w, h, color, lw: lineWidth };
        canvasRef.current.getContext("2d").putImageData(snapBefore.current, 0, 0);
        setObjects(objs => [...objs, newObj]);
        setSelId(newObj.id);
        notifyParent();
      }
      shapeStart.current = null; snapBefore.current = null;
    }

    /* PEN / UNDERLINE 확정 — baseData에 커밋 후 objects 재렌더 */
    if (isDrawing.current && (tool === "draw" || tool === "underline")) {
      const si = strokeInfo.current;
      if (si && si.points.length >= 2) {
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext("2d");
        // baseData(objects 없음)에 스트로크 재현 후 새 baseData로 저장
        ctx.putImageData(baseData.current, 0, 0);
        ctx.strokeStyle = si.color; ctx.lineWidth = si.lw; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(si.points[0].x, si.points[0].y);
        si.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        baseData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        renderAll(); // objects를 baseData 위에 재렌더
      }
      strokeInfo.current = null;
      notifyParent();
    }

    isDrawing.current = false;
    lastPos.current   = null;
  }

  /* ── 줌 ── */
  const zoomIn  = () => setZoom(z => Math.min(parseFloat((z + 0.1).toFixed(2)), 3));
  const zoomOut = () => setZoom(z => Math.max(parseFloat((z - 0.1).toFixed(2)), 0.1));
  const zoomFit = () => setZoom(parseFloat(Math.min(1, 560 / (canvasSize.w || 560)).toFixed(2)));

  function notifyParent() {
    const canvas = canvasRef.current;
    if (!canvas || !hasImage) return;
    canvas.toBlob(blob => { if (blob) onImageReady(blob); }, "image/png");
  }

  const toolBtns = [
    { id: "select",    icon: "↖",  label: "선택/이동" },
    { id: "draw",      icon: "✏️", label: "펜" },
    { id: "underline", icon: "▬",  label: "밑줄" },
    { id: "rect",      icon: "▭",  label: "네모" },
    { id: "circle",    icon: "◯",  label: "동그라미" },
    { id: "text",      icon: "T",  label: "텍스트" },
  ];

  const canvasCursor = tool === "select" ? moveCursor : tool === "text" ? "text" : "crosshair";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", height: "100%" }}>
      {/* 툴바 */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flexShrink: 0 }}>
        {toolBtns.map(b => (
          <button key={b.id} onClick={() => setTool(b.id)} style={{
            padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "600",
            border: tool === b.id ? "2px solid #2563EB" : "1px solid #E2E8F0",
            backgroundColor: tool === b.id ? "#EFF6FF" : "#F8FAFC",
            color: tool === b.id ? "#2563EB" : "#64748B",
            cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
          }}>{b.icon} {b.label}</button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "11px", color: "#64748B" }}>색상</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: "28px", height: "26px", border: "1px solid #E2E8F0", borderRadius: "4px", cursor: "pointer", padding: "1px" }} />
        </div>
        {tool !== "text" && tool !== "select" && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "#64748B" }}>굵기</span>
            <input type="range" min="1" max="8" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))}
              style={{ width: "55px", cursor: "pointer" }} />
            <span style={{ fontSize: "11px", color: "#64748B", minWidth: "12px" }}>{lineWidth}</span>
          </div>
        )}
        {tool === "text" && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "#64748B" }}>크기</span>
            <input type="number" min="8" max="200" value={fontSize}
              onChange={e => setFontSize(Math.max(8, Math.min(200, Number(e.target.value))))}
              style={{ width: "58px", padding: "3px 6px", border: "1px solid #CBD5E1", borderRadius: "5px", fontSize: "12px", color: "#1E293B", fontFamily: "'Pretendard', sans-serif", outline: "none", textAlign: "center" }}
            />
            <span style={{ fontSize: "11px", color: "#64748B" }}>px</span>
          </div>
        )}
        <button onClick={handleUndo} disabled={!history.length} style={{
          padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
          border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC",
          color: history.length ? "#1E293B" : "#CBD5E1",
          cursor: history.length ? "pointer" : "not-allowed", fontFamily: "'Pretendard', sans-serif",
        }}>↩ 실행취소</button>

        {hasImage && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
            <button onClick={zoomOut} style={zoomBtnStyle}>−</button>
            <span style={{ fontSize: "11px", color: "#475569", minWidth: "38px", textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={zoomIn} style={zoomBtnStyle}>+</button>
            <button onClick={zoomFit} style={{ ...zoomBtnStyle, padding: "3px 8px", fontSize: "10px" }}>맞춤</button>
          </div>
        )}
      </div>

      {/* 업로드 영역 */}
      <label style={{
        flex: 1, display: hasImage ? "none" : "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", border: "2px dashed #CBD5E1", borderRadius: "10px",
        cursor: "pointer", gap: "10px", backgroundColor: "#F8FAFC",
      }}>
        <span style={{ fontSize: "40px" }}>🖼️</span>
        <span style={{ fontSize: "14px", color: "#64748B", fontWeight: "600" }}>클릭하여 이미지 업로드</span>
        <span style={{ fontSize: "12px", color: "#94A3B8" }}>PNG, JPG, GIF · 원본 사이즈 지원</span>
        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
      </label>

      {/* 캔버스 뷰어 */}
      <div ref={scrollRef} style={{
        flex: 1, overflow: "auto", backgroundColor: "#e8eaed",
        borderRadius: "8px", border: "1px solid #E2E8F0", position: "relative",
        display: hasImage ? "block" : "none",
      }}>
        <div style={{
          width: canvasSize.w * zoom || "100%",
          height: canvasSize.h * zoom || "100%",
          position: "relative", minWidth: "100%", minHeight: "100%",
        }}>
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute", top: 0, left: 0,
              transformOrigin: "0 0",
              transform: `scale(${zoom})`,
              cursor: canvasCursor,
              imageRendering: zoom > 1 ? "pixelated" : "auto",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </div>
        <label style={{
          position: "sticky", bottom: "8px", left: "calc(100% - 90px)",
          display: "block", width: "80px",
          padding: "4px 8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff",
          borderRadius: "6px", fontSize: "11px", cursor: "pointer", textAlign: "center",
        }}>
          🔄 교체
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        </label>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════ */
const INIT_REG = { taskId: "", testGubun: "", errGubun: "", level: "", fixRequestDate: "", menuNm: "", menuPath: "", title: "", content: "" };
const TEST_GUBUN_OPTIONS = ["개발자테스트", "단위테스트", "통합테스트", "MA"];

export default function IssueManagePage() {
  const { user } = useAuth();

  const [tm1List,   setTm1List]   = useState([]);
  const [userMap,   setUserMap]   = useState({});
  const [deptUsers, setDeptUsers] = useState([]);

  const getToday    = () => new Date().toISOString().split("T")[0];
  const getMonthAgo = () => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().split("T")[0]; };

  const [searchTask,     setSearchTask]     = useState("");
  const [searchFrom,     setSearchFrom]     = useState(getMonthAgo);
  const [searchTo,       setSearchTo]       = useState(getToday);
  const [searchTestGubun, setSearchTestGubun] = useState("");
  const [searchErrGubun,  setSearchErrGubun]  = useState("");
  const [searchLevel,     setSearchLevel]     = useState("");
  const [searchManager,  setSearchManager]  = useState("");
  const [searchTitle,    setSearchTitle]    = useState("");
  const [searchComplete, setSearchComplete] = useState("");

  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [showReg,   setShowReg]   = useState(false);
  const [regForm,   setRegForm]   = useState(INIT_REG);
  const [regErr,    setRegErr]    = useState({});
  const [regSaving, setRegSaving] = useState(false);
  const [imageBlob, setImageBlob] = useState(null); // 편집된 이미지 blob

  const [accepting, setAccepting] = useState(false);

  const [showFix,   setShowFix]   = useState(false);
  const [fixContent, setFixContent] = useState("");
  const [fixSaving,  setFixSaving]  = useState(false);

  const [showEdit,   setShowEdit]   = useState(false);
  const [editForm,   setEditForm]   = useState(INIT_REG);
  const [editErr,    setEditErr]    = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const [detailRow,    setDetailRow]    = useState(null);
  const [detailImgOpen, setDetailImgOpen] = useState(false);

  useEffect(() => { loadMasters(); }, [user]);
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setDetailImgOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function loadMasters() {
    const dept = user?.deptCd;
    let q = supabase.from("TASK_MASTER").select("TASK_ID, TASK_NAME").eq("LEVEL","1").order("TASK_NAME");
    if (dept) q = q.eq("DEPT_CD", dept);
    const { data: tm } = await q;
    setTm1List(tm ?? []);
    const { data: users } = await supabase.from("SCRUMBOARD_USER").select("ID, NAME, DEPT_CD");
    if (users) {
      const map = {};
      users.forEach(u => { map[u.ID] = u.NAME; });
      setUserMap(map);
      setDeptUsers(dept ? users.filter(u => u.DEPT_CD === dept) : users);
    }
  }

  async function handleSearch() {
    setLoading(true); setSearched(true); setSelectedId(null);
    let q = supabase.from("SYSTEM_ERRORREPORT").select("*").order("ID", { ascending: false });
    if (searchTask)             q = q.eq("TASK_ID", searchTask);
    if (searchFrom)             q = q.gte("INSERT_DT", searchFrom);
    if (searchTo)               q = q.lte("INSERT_DT", searchTo + "T23:59:59");
    if (searchTestGubun)         q = q.eq("TEST_GUBUN", searchTestGubun);
    if (searchErrGubun)          q = q.eq("ERROR_GUBUN", searchErrGubun);
    if (searchLevel)            q = q.eq("IMPORTANT_LEVEL", searchLevel);
    if (searchManager)          q = q.eq("MANAGE_ID", searchManager);
    if (searchTitle.trim())     q = q.ilike("ERROR_TITLE", `%${searchTitle.trim()}%`);
    if (searchComplete === "Y") q = q.eq("COMPLETE_YN", "Y");
    if (searchComplete === "N") q = q.neq("COMPLETE_YN", "Y");
    const { data, error } = await q;
    if (!error) setRows(data ?? []);
    setLoading(false);
  }

  function handleReset() {
    setSearchTask(""); setSearchFrom(getMonthAgo()); setSearchTo(getToday());
    setSearchTestGubun(""); setSearchErrGubun(""); setSearchLevel(""); setSearchManager("");
    setSearchTitle(""); setSearchComplete(""); setRows([]); setSearched(false); setSelectedId(null);
  }

  async function handleRegSave() {
    const errs = {};
    if (!regForm.taskId)       errs.taskId   = "프로젝트를 선택해주세요.";
    if (!regForm.errGubun)     errs.errGubun = "오류구분을 선택해주세요.";
    if (!regForm.level)        errs.level    = "중요도를 선택해주세요.";
    if (!regForm.title.trim()) errs.title    = "제목을 입력해주세요.";
    if (Object.keys(errs).length) { setRegErr(errs); return; }

    setRegSaving(true);
    let imageUrl = null;

    // 이미지 업로드 (편집된 캔버스 blob)
    if (imageBlob) {
      const fileName = `${Date.now()}_${user?.id ?? "unknown"}.png`;
      const { data: upData, error: upErr } = await supabase.storage
        .from("issue-images")
        .upload(fileName, imageBlob, { contentType: "image/png", upsert: false });
      if (!upErr && upData) {
        const { data: urlData } = supabase.storage.from("issue-images").getPublicUrl(fileName);
        imageUrl = urlData?.publicUrl ?? null;
      }
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("SYSTEM_ERRORREPORT").insert({
      TASK_ID:          regForm.taskId,
      TEST_GUBUN:       regForm.testGubun || null,
      ERROR_GUBUN:      regForm.errGubun,
      IMPORTANT_LEVEL:  regForm.level,
      FIX_REQUEST_DATE: regForm.fixRequestDate || null,
      MENU_NM:          regForm.menuNm.trim() || null,
      MENU_PATH:        regForm.menuPath.trim() || null,
      ERROR_TITLE:      regForm.title.trim(),
      ERROR_CONTENT:    regForm.content.trim(),
      image_url:        imageUrl,
      INSERT_ID:        user?.id ?? "",
      INSERT_DT:        now,
      COMPLETE_YN:      "N",
    });
    setRegSaving(false);
    if (error) { alert("등록 오류: " + error.message); return; }
    setShowReg(false); setRegForm(INIT_REG); setRegErr({}); setImageBlob(null);
    if (searched) handleSearch();
  }

  /* 상세페이지에서 저장 후 detailRow 최신화 */
  async function refreshDetailRow(id) {
    const { data } = await supabase.from("SYSTEM_ERRORREPORT").select("*").eq("ID", id).single();
    if (data) setDetailRow(data);
  }

  async function handleAccept(rowId) {
    const id = rowId ?? selectedId;
    if (!id) return;
    const row = detailRow ?? rows.find(r => r.ID === id);
    if (!row) return;
    if (row.MANAGE_ID) { alert("이미 접수된 이슈입니다."); return; }
    setAccepting(true);
    const { error } = await supabase.from("SYSTEM_ERRORREPORT")
      .update({ MANAGE_ID: user?.id, MANAGE_DT: new Date().toISOString() })
      .eq("ID", id);
    setAccepting(false);
    if (error) { alert("접수 오류: " + error.message); return; }
    if (detailRow) { await refreshDetailRow(id); } else { handleSearch(); }
  }

  async function handleFixSave(rowId) {
    if (!fixContent.trim()) { alert("조치 내용을 입력해주세요."); return; }
    const id = rowId ?? selectedId;
    setFixSaving(true);
    const { error } = await supabase.from("SYSTEM_ERRORREPORT")
      .update({
        FIX_CONTENT:  fixContent.trim(),
        FIX_ID:       user?.id ?? "",
        COMPLETE_YN:  "Y",
        FIX_DATE:     new Date().toISOString().split("T")[0],
      })
      .eq("ID", id);
    setFixSaving(false);
    if (error) { alert("조치등록 오류: " + error.message); return; }
    setShowFix(false); setFixContent("");
    if (detailRow) { await refreshDetailRow(id); } else { handleSearch(); }
  }

  async function handleEditSave(rowId) {
    const errs = {};
    if (!editForm.taskId)       errs.taskId   = "프로젝트를 선택해주세요.";
    if (!editForm.errGubun)     errs.errGubun = "오류구분을 선택해주세요.";
    if (!editForm.level)        errs.level    = "중요도를 선택해주세요.";
    if (!editForm.title.trim()) errs.title    = "제목을 입력해주세요.";
    if (Object.keys(errs).length) { setEditErr(errs); return; }

    const id = rowId ?? selectedId;
    setEditSaving(true);
    const { error } = await supabase.from("SYSTEM_ERRORREPORT").update({
      TASK_ID:          editForm.taskId,
      TEST_GUBUN:       editForm.testGubun || null,
      ERROR_GUBUN:      editForm.errGubun,
      IMPORTANT_LEVEL:  editForm.level,
      FIX_REQUEST_DATE: editForm.fixRequestDate || null,
      MENU_NM:          editForm.menuNm.trim() || null,
      MENU_PATH:        editForm.menuPath.trim() || null,
      ERROR_TITLE:      editForm.title.trim(),
      ERROR_CONTENT:    editForm.content.trim(),
    }).eq("ID", id);
    setEditSaving(false);
    if (error) { alert("수정 오류: " + error.message); return; }
    setShowEdit(false);
    if (detailRow) { await refreshDetailRow(id); } else { handleSearch(); }
  }

  const taskNameMap = Object.fromEntries(tm1List.map(t => [String(t.TASK_ID), t.TASK_NAME]));
  const selectedRow = rows.find(r => r.ID === selectedId);
  const canAccept   = selectedId && selectedRow && !selectedRow.MANAGE_ID;
  const canFix      = selectedId && selectedRow && selectedRow.MANAGE_ID && selectedRow.COMPLETE_YN !== "Y";
  const canEdit     = selectedId && selectedRow && selectedRow.INSERT_ID === user?.id;

  // 상세 페이지 전환
  if (detailRow) {
    const d = detailRow;
    const isComplete    = d.COMPLETE_YN === "Y";
    const canEditDetail = d.INSERT_ID === user?.id;
    const canAcceptDetail = !d.MANAGE_ID;
    const canFixDetail  = !!d.MANAGE_ID && d.COMPLETE_YN !== "Y";
    let elapsedDays = null;
    if (d.FIX_REQUEST_DATE && d.FIX_DATE) {
      const req  = new Date(d.FIX_REQUEST_DATE);
      const done = new Date(d.FIX_DATE);
      elapsedDays = Math.round((done - req) / (1000 * 60 * 60 * 24));
    }

    const openDetailEdit = () => {
      setEditForm({
        taskId:         String(d.TASK_ID ?? ""),
        testGubun:      d.TEST_GUBUN ?? "",
        errGubun:       d.ERROR_GUBUN ?? "",
        level:          d.IMPORTANT_LEVEL ?? "",
        fixRequestDate: d.FIX_REQUEST_DATE ? String(d.FIX_REQUEST_DATE).slice(0,10) : "",
        menuNm:         d.MENU_NM ?? "",
        menuPath:       d.MENU_PATH ?? "",
        title:          d.ERROR_TITLE ?? "",
        content:        d.ERROR_CONTENT ?? "",
      });
      setEditErr({});
      setShowEdit(true);
    };

    const openDetailFix = () => {
      setFixContent(d.FIX_CONTENT ?? "");
      setShowFix(true);
    };

    return (
      <div style={{ fontFamily:"'Pretendard', sans-serif", minHeight:"100%", display:"flex", flexDirection:"column" }}>
        {/* 상단 네비게이션 */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px", flexWrap:"wrap" }}>
          <button onClick={() => { setDetailRow(null); handleSearch(); }} style={{
            display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px",
            border:"1px solid #E2E8F0", borderRadius:"8px", backgroundColor:"#fff",
            color:"#475569", fontSize:"13px", fontWeight:"600", cursor:"pointer",
            fontFamily:"'Pretendard', sans-serif",
          }}>← 목록으로</button>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
            <span style={{ fontSize:"13px", color:"#94A3B8" }}>ISSUE MANAGE</span>
            <span style={{ color:"#CBD5E1" }}>›</span>
            <span style={{ fontSize:"13px", color:"#1E293B", fontWeight:"600",
              maxWidth:"300px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
              title={d.ERROR_TITLE}>{d.ERROR_TITLE}</span>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            <Badge text={d.IMPORTANT_LEVEL} styles={LEVEL_STYLE} />
            <Badge text={d.ERROR_GUBUN} styles={ERROR_GUBUN_STYLE} />
            <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:"12px", fontSize:"11px", fontWeight:"600",
              backgroundColor: isComplete ? "#DCFCE7" : "#FEF3C7", color: isComplete ? "#16A34A" : "#D97706" }}>
              {isComplete ? "✓ 완료" : "⏳ 미완료"}
            </span>
            {/* 액션 버튼 */}
            {canEditDetail && (
              <button onClick={openDetailEdit} style={{
                padding:"6px 14px", border:"none", borderRadius:"7px",
                backgroundColor:"#7C3AED", color:"#fff", fontSize:"12px", fontWeight:"600",
                cursor:"pointer", fontFamily:"'Pretendard', sans-serif",
              }}>✏ 수정</button>
            )}
            {canAcceptDetail && (
              <button onClick={() => handleAccept(d.ID)} disabled={accepting} style={{
                padding:"6px 14px", border:"none", borderRadius:"7px",
                backgroundColor: accepting ? "#CBD5E1" : "#2563EB", color:"#fff",
                fontSize:"12px", fontWeight:"600", cursor: accepting ? "not-allowed" : "pointer",
                fontFamily:"'Pretendard', sans-serif",
              }}>{accepting ? "접수 중..." : "✓ 접수"}</button>
            )}
            {canFixDetail && (
              <button onClick={openDetailFix} style={{
                padding:"6px 14px", border:"none", borderRadius:"7px",
                backgroundColor:"#16A34A", color:"#fff", fontSize:"12px", fontWeight:"600",
                cursor:"pointer", fontFamily:"'Pretendard', sans-serif",
              }}>📋 조치등록</button>
            )}
          </div>
        </div>

        {/* 본문 — 좌우 2컬럼 */}
        <div style={{ display:"flex", gap:"20px", flex:1, minHeight:0, alignItems:"flex-start" }}>

          {/* 왼쪽: 이미지 (고정 높이 + 스크롤) */}
          <div style={{ flex:"0 0 52%", backgroundColor:"#fff", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ padding:"12px 20px", borderBottom:"1px solid #F1F5F9", backgroundColor:"#F8FAFC", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:"12px", fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:"0.05em" }}>첨부 이미지</span>
              {d.image_url && (
                <button onClick={() => setDetailImgOpen(true)} style={{
                  padding:"4px 12px", border:"1px solid #CBD5E1", borderRadius:"6px",
                  backgroundColor:"#fff", color:"#475569", fontSize:"12px", fontWeight:"600",
                  cursor:"pointer", fontFamily:"'Pretendard', sans-serif",
                }}>⛶ 전체보기</button>
              )}
            </div>
            <div style={{ height:"520px", overflow:"auto", backgroundColor:"#e8eaed", display:"flex",
              alignItems: d.image_url ? "flex-start" : "center",
              justifyContent: d.image_url ? "flex-start" : "center", padding:"16px" }}>
              {d.image_url ? (
                <img src={d.image_url} alt="이슈 첨부 이미지"
                  style={{ display:"block", maxWidth:"none", height:"auto", borderRadius:"6px", boxShadow:"0 2px 12px rgba(0,0,0,0.15)" }} />
              ) : (
                <div style={{ textAlign:"center", color:"#94A3B8" }}>
                  <div style={{ fontSize:"48px", marginBottom:"10px" }}>🖼️</div>
                  <p style={{ fontSize:"13px", margin:0 }}>첨부된 이미지가 없습니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 정보 */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"16px" }}>

            {/* ① 이슈 기본 정보 */}
            <div style={{ backgroundColor:"#fff", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ padding:"12px 20px", borderBottom:"1px solid #F1F5F9", backgroundColor:"#F8FAFC" }}>
                <span style={detailSection}>이슈 정보</span>
              </div>
              <div style={{ padding:"16px 20px" }}>
                <div style={detailGrid}>
                  <DetailItem label="프로젝트"   value={taskNameMap[String(d.TASK_ID)] ?? "-"} bold />
                  <DetailItem label="테스트구분" value={d.TEST_GUBUN || "-"} />
                  <DetailItem label="오류구분"   value={<Badge text={d.ERROR_GUBUN} styles={ERROR_GUBUN_STYLE} />} />
                  <DetailItem label="중요도"     value={<Badge text={d.IMPORTANT_LEVEL} styles={LEVEL_STYLE} />} />
                  <DetailItem label="화면명"     value={d.MENU_NM || "-"} />
                  <DetailItem label="화면 경로"  value={d.MENU_PATH || "-"} />
                  <DetailItem label="완료요청일" value={formatDate(d.FIX_REQUEST_DATE)} />
                  <DetailItem label="완료여부"   value={
                    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:"12px", fontSize:"11px", fontWeight:"600",
                      backgroundColor: isComplete ? "#DCFCE7" : "#FEF3C7", color: isComplete ? "#16A34A" : "#D97706" }}>
                      {isComplete ? "✓ 완료" : "⏳ 미완료"}
                    </span>
                  } />
                  <DetailItem label="등록자"   value={userMap[d.INSERT_ID] ?? d.INSERT_ID ?? "-"} />
                  <DetailItem label="등록일자" value={formatDate(d.INSERT_DT)} />
                  <DetailItem label="접수자"   value={userMap[d.MANAGE_ID] ?? d.MANAGE_ID ?? "-"} />
                  <DetailItem label="접수일자" value={formatDate(d.MANAGE_DT)} />
                </div>
              </div>
            </div>

            {/* ② 오류 내용 */}
            {d.ERROR_CONTENT && (
              <div style={{ backgroundColor:"#fff", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ padding:"12px 20px", borderBottom:"1px solid #F1F5F9", backgroundColor:"#F8FAFC" }}>
                  <span style={detailSection}>오류 내용</span>
                </div>
                <div style={{ padding:"16px 20px" }}>
                  <p style={{ margin:0, fontSize:"13px", color:"#334155", lineHeight:"1.7", whiteSpace:"pre-wrap" }}>{d.ERROR_CONTENT}</p>
                </div>
              </div>
            )}

            {/* ③ 조치 결과 */}
            <div style={{ backgroundColor:"#fff", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ padding:"12px 20px", borderBottom:"1px solid #F1F5F9", backgroundColor:"#F8FAFC" }}>
                <span style={detailSection}>조치 결과</span>
              </div>
              <div style={{ padding:"16px 20px" }}>
                {isComplete ? (
                  <>
                    <div style={{ display:"flex", gap:"12px", marginBottom:"16px", flexWrap:"wrap" }}>
                      <div style={{ flex:1, minWidth:"110px", backgroundColor:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"10px", padding:"12px 16px", textAlign:"center" }}>
                        <p style={{ margin:0, fontSize:"11px", color:"#2563EB", fontWeight:"600" }}>완료일자</p>
                        <p style={{ margin:"4px 0 0", fontSize:"15px", fontWeight:"700", color:"#1E40AF" }}>{formatDate(d.FIX_DATE)}</p>
                      </div>
                      {elapsedDays !== null && (
                        <div style={{ flex:1, minWidth:"110px",
                          backgroundColor: elapsedDays <= 0 ? "#DCFCE7" : elapsedDays <= 3 ? "#FEF3C7" : "#FEE2E2",
                          border:`1px solid ${elapsedDays <= 0 ? "#86EFAC" : elapsedDays <= 3 ? "#FDE68A" : "#FECACA"}`,
                          borderRadius:"10px", padding:"12px 16px", textAlign:"center" }}>
                          <p style={{ margin:0, fontSize:"11px", fontWeight:"600",
                            color: elapsedDays <= 0 ? "#16A34A" : elapsedDays <= 3 ? "#D97706" : "#DC2626" }}>소요일수</p>
                          <p style={{ margin:"4px 0 0", fontSize:"22px", fontWeight:"800",
                            color: elapsedDays <= 0 ? "#15803D" : elapsedDays <= 3 ? "#B45309" : "#B91C1C" }}>
                            {elapsedDays > 0 ? `+${elapsedDays}일` : elapsedDays === 0 ? "당일" : `${Math.abs(elapsedDays)}일 조기`}
                          </p>
                          <p style={{ margin:"2px 0 0", fontSize:"10px",
                            color: elapsedDays <= 0 ? "#16A34A" : elapsedDays <= 3 ? "#D97706" : "#DC2626" }}>
                            {elapsedDays <= 0 ? "요청일 내 완료" : elapsedDays <= 3 ? "소폭 지연" : "지연 완료"}
                          </p>
                        </div>
                      )}
                      <div style={{ flex:1, minWidth:"110px", backgroundColor:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"10px", padding:"12px 16px", textAlign:"center" }}>
                        <p style={{ margin:0, fontSize:"11px", color:"#64748B", fontWeight:"600" }}>조치등록자</p>
                        <p style={{ margin:"4px 0 0", fontSize:"15px", fontWeight:"700", color:"#1E293B" }}>{userMap[d.FIX_ID] ?? d.FIX_ID ?? "-"}</p>
                      </div>
                    </div>
                    {d.FIX_CONTENT && (
                      <div style={{ backgroundColor:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"14px 16px" }}>
                        <p style={{ margin:"0 0 8px", fontSize:"11px", fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:"0.05em" }}>조치 내용</p>
                        <p style={{ margin:0, fontSize:"13px", color:"#334155", lineHeight:"1.7", whiteSpace:"pre-wrap" }}>{d.FIX_CONTENT}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign:"center", padding:"24px 0", color:"#94A3B8" }}>
                    <p style={{ fontSize:"28px", margin:"0 0 8px" }}>⏳</p>
                    <p style={{ fontSize:"13px", margin:0 }}>아직 조치가 완료되지 않았습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 이미지 전체보기 모달 */}
        {detailImgOpen && d.image_url && (
          <div
            onClick={() => setDetailImgOpen(false)}
            style={{ position:"fixed", inset:0, backgroundColor:"rgba(0,0,0,0.85)", zIndex:9999,
              display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
            <div onClick={e => e.stopPropagation()}
              style={{ position:"relative", maxWidth:"95vw", maxHeight:"92vh",
                backgroundColor:"#1a1a1a", borderRadius:"12px", overflow:"hidden",
                display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}>
              {/* 모달 헤더 */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"12px 18px", backgroundColor:"#111", flexShrink:0 }}>
                <span style={{ fontSize:"13px", color:"#94A3B8", fontWeight:"600" }}>첨부 이미지 전체보기</span>
                <button onClick={() => setDetailImgOpen(false)} style={{
                  background:"none", border:"none", color:"#94A3B8", fontSize:"20px",
                  cursor:"pointer", lineHeight:1, padding:"2px 6px",
                }}>✕</button>
              </div>
              {/* 이미지 스크롤 영역 */}
              <div style={{ overflow:"auto", flex:1, padding:"16px", display:"flex",
                alignItems:"flex-start", justifyContent:"flex-start" }}>
                <img src={d.image_url} alt="첨부 이미지"
                  style={{ display:"block", maxWidth:"none", height:"auto",
                    borderRadius:"4px", userSelect:"none" }} />
              </div>
              <div style={{ padding:"8px 18px", backgroundColor:"#111", flexShrink:0,
                textAlign:"center", fontSize:"11px", color:"#64748B" }}>
                ESC 또는 바깥 영역 클릭으로 닫기
              </div>
            </div>
          </div>
        )}

        {/* 조치등록 모달 (상세페이지) */}
        {showFix && (
          <div style={im.overlay} onClick={e => e.target === e.currentTarget && setShowFix(false)}>
            <div style={{ ...im.modal, maxWidth:"560px", height:"auto", maxHeight:"80vh" }}>
              <div style={im.modalHeader}>
                <div>
                  <h3 style={im.modalTitle}>조치 등록</h3>
                  <p style={{ margin:"4px 0 0", fontSize:"12px", color:"#94A3B8" }}>{d.ERROR_TITLE}</p>
                </div>
                <button style={im.closeBtn} onClick={() => setShowFix(false)}>✕</button>
              </div>
              <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"16px", overflowY:"auto" }}>
                <div style={{ backgroundColor:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"12px 16px", display:"flex", gap:"24px", flexWrap:"wrap" }}>
                  <div><span style={{ fontSize:"11px", color:"#94A3B8", display:"block" }}>프로젝트</span>
                    <span style={{ fontSize:"13px", fontWeight:"600", color:"#1E293B" }}>{taskNameMap[String(d.TASK_ID)] ?? "-"}</span></div>
                  <div><span style={{ fontSize:"11px", color:"#94A3B8", display:"block" }}>오류구분</span>
                    <Badge text={d.ERROR_GUBUN} styles={ERROR_GUBUN_STYLE} /></div>
                  <div><span style={{ fontSize:"11px", color:"#94A3B8", display:"block" }}>중요도</span>
                    <Badge text={d.IMPORTANT_LEVEL} styles={LEVEL_STYLE} /></div>
                </div>
                <div style={im.formRow}>
                  <label style={im.formLabel}>조치 결과 내용 <span style={{ color:"#DC2626" }}>*</span></label>
                  <textarea style={{ ...im.textarea, minHeight:"200px", resize:"vertical" }}
                    placeholder="조치한 내용을 상세히 입력하세요"
                    value={fixContent} onChange={e => setFixContent(e.target.value)} />
                </div>
                <p style={{ margin:0, fontSize:"12px", color:"#94A3B8" }}>
                  * 저장 시 완료여부가 <strong style={{ color:"#16A34A" }}>완료</strong>로 자동 변경됩니다.
                </p>
              </div>
              <div style={im.modalFooter}>
                <button style={im.resetBtn} onClick={() => setShowFix(false)}>취소</button>
                <button style={{ ...im.searchBtn, backgroundColor:"#16A34A" }} onClick={() => handleFixSave(d.ID)} disabled={fixSaving}>
                  {fixSaving ? "저장 중..." : "조치 등록"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 이슈수정 모달 (상세페이지) */}
        {showEdit && (
          <div style={im.overlay} onClick={e => e.target === e.currentTarget && setShowEdit(false)}>
            <div style={{ ...im.modal, maxWidth:"760px", height:"auto", maxHeight:"90vh" }}>
              <div style={im.modalHeader}>
                <div>
                  <h3 style={im.modalTitle}>이슈 수정</h3>
                  <p style={{ margin:"4px 0 0", fontSize:"12px", color:"#94A3B8" }}>내가 등록한 이슈만 수정할 수 있습니다.</p>
                </div>
                <button style={im.closeBtn} onClick={() => setShowEdit(false)}>✕</button>
              </div>
              <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:"14px", overflowY:"auto", flex:1 }}>
                <div style={im.formRow}>
                  <label style={im.formLabel}>프로젝트명 <span style={{ color:"#DC2626" }}>*</span></label>
                  <select style={{ ...im.select, width:"100%" }}
                    value={editForm.taskId} onChange={e => setEditForm(f => ({ ...f, taskId: e.target.value }))}>
                    <option value="">선택</option>
                    {tm1List.map(t => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
                  </select>
                  {editErr.taskId && <span style={im.errMsg}>{editErr.taskId}</span>}
                </div>
                <div style={im.formRow}>
                  <label style={im.formLabel}>테스트구분</label>
                  <select style={{ ...im.select, width:"100%" }}
                    value={editForm.testGubun} onChange={e => setEditForm(f => ({ ...f, testGubun: e.target.value }))}>
                    <option value="">선택</option>
                    {TEST_GUBUN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ display:"flex", gap:"12px" }}>
                  <div style={{ ...im.formRow, flex:1 }}>
                    <label style={im.formLabel}>오류구분 <span style={{ color:"#DC2626" }}>*</span></label>
                    <select style={{ ...im.select, width:"100%" }}
                      value={editForm.errGubun} onChange={e => setEditForm(f => ({ ...f, errGubun: e.target.value }))}>
                      <option value="">선택</option><option value="오류">오류</option><option value="개선">개선</option>
                    </select>
                    {editErr.errGubun && <span style={im.errMsg}>{editErr.errGubun}</span>}
                  </div>
                  <div style={{ ...im.formRow, flex:1 }}>
                    <label style={im.formLabel}>중요도 <span style={{ color:"#DC2626" }}>*</span></label>
                    <select style={{ ...im.select, width:"100%" }}
                      value={editForm.level} onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))}>
                      <option value="">선택</option><option value="긴급">긴급</option><option value="상">상</option>
                      <option value="중">중</option><option value="하">하</option>
                    </select>
                    {editErr.level && <span style={im.errMsg}>{editErr.level}</span>}
                  </div>
                </div>
                <div style={im.formRow}>
                  <label style={im.formLabel}>완료요청일자</label>
                  <input type="date" style={{ ...im.input, width:"100%" }}
                    value={editForm.fixRequestDate} onChange={e => setEditForm(f => ({ ...f, fixRequestDate: e.target.value }))} />
                </div>
                <div style={{ display:"flex", gap:"12px" }}>
                  <div style={{ ...im.formRow, flex:1 }}>
                    <label style={im.formLabel}>화면명</label>
                    <input style={{ ...im.input, width:"100%" }} placeholder="예) 이슈 관리 화면"
                      value={editForm.menuNm} onChange={e => setEditForm(f => ({ ...f, menuNm: e.target.value }))} />
                  </div>
                  <div style={{ ...im.formRow, flex:1 }}>
                    <label style={im.formLabel}>화면 경로</label>
                    <input style={{ ...im.input, width:"100%" }} placeholder="예) 메인 > 프로젝트 리포트 > 이슈관리"
                      value={editForm.menuPath} onChange={e => setEditForm(f => ({ ...f, menuPath: e.target.value }))} />
                  </div>
                </div>
                <div style={im.formRow}>
                  <label style={im.formLabel}>제목 <span style={{ color:"#DC2626" }}>*</span></label>
                  <input style={{ ...im.input, width:"100%" }} placeholder="이슈 제목을 입력하세요"
                    value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                  {editErr.title && <span style={im.errMsg}>{editErr.title}</span>}
                </div>
                <div style={{ ...im.formRow, flex:1 }}>
                  <label style={im.formLabel}>오류 내용</label>
                  <textarea style={{ ...im.textarea, minHeight:"160px", resize:"vertical" }}
                    placeholder="오류 내용을 상세히 입력하세요"
                    value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} />
                </div>
                <p style={{ margin:0, fontSize:"12px", color:"#94A3B8" }}>* 첨부 이미지는 수정되지 않습니다.</p>
              </div>
              <div style={im.modalFooter}>
                <button style={im.resetBtn} onClick={() => setShowEdit(false)}>취소</button>
                <button style={{ ...im.searchBtn, backgroundColor:"#7C3AED" }} onClick={() => handleEditSave(d.ID)} disabled={editSaving}>
                  {editSaving ? "저장 중..." : "수정 저장"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={im.wrap}>
      {/* 헤더 */}
      <div style={im.pageHeader}>
        <div>
          <h2 style={im.pageTitle}>ISSUE MANAGE</h2>
          <p style={im.pageSub}>이슈 현황을 조회하고 관리합니다</p>
        </div>
        {searched && !loading && <span style={im.totalBadge}>총 {rows.length}건</span>}
      </div>

      {/* 조회 조건 */}
      <div style={im.searchPanel}>
        <div style={im.searchGrid}>
          <div style={im.field}>
            <label style={im.label}>업무구분</label>
            <select style={im.select} value={searchTask} onChange={e => setSearchTask(e.target.value)}>
              {tm1List.map(t => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
            </select>
          </div>
          <div style={im.field}>
            <label style={im.label}>이슈등록일</label>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <input type="date" style={im.dateInput} value={searchFrom} onChange={e => setSearchFrom(e.target.value)} />
              <span style={{ color:"#94A3B8" }}>~</span>
              <input type="date" style={im.dateInput} value={searchTo}   onChange={e => setSearchTo(e.target.value)} />
            </div>
          </div>
          <div style={{ ...im.field, width:"120px" }}>
            <label style={im.label}>테스트구분</label>
            <select style={im.select} value={searchTestGubun} onChange={e => setSearchTestGubun(e.target.value)}>
              <option value="">전체</option>
              {TEST_GUBUN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ ...im.field, width:"100px" }}>
            <label style={im.label}>오류구분</label>
            <select style={im.select} value={searchErrGubun} onChange={e => setSearchErrGubun(e.target.value)}>
              <option value="">전체</option><option value="오류">오류</option><option value="개선">개선</option>
            </select>
          </div>
          <div style={{ ...im.field, width:"100px" }}>
            <label style={im.label}>중요도</label>
            <select style={im.select} value={searchLevel} onChange={e => setSearchLevel(e.target.value)}>
              <option value="">전체</option><option value="긴급">긴급</option><option value="상">상</option>
              <option value="중">중</option><option value="하">하</option>
            </select>
          </div>
          <div style={{ ...im.field, width:"110px" }}>
            <label style={im.label}>담당자</label>
            <select style={im.select} value={searchManager} onChange={e => setSearchManager(e.target.value)}>
              <option value="">전체</option>
              {deptUsers.map(u => <option key={u.ID} value={u.ID}>{u.NAME}</option>)}
            </select>
          </div>
          <div style={{ ...im.field, width:"320px" }}>
            <label style={im.label}>이슈제목</label>
            <input style={im.input} placeholder="이슈 제목 검색..."
              value={searchTitle} onChange={e => setSearchTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()} />
          </div>
          <div style={{ ...im.field, width:"100px" }}>
            <label style={im.label}>조치여부</label>
            <select style={im.select} value={searchComplete} onChange={e => setSearchComplete(e.target.value)}>
              <option value="">전체</option><option value="Y">조치완료</option><option value="N">미완료</option>
            </select>
          </div>
          <div style={{ ...im.field, justifyContent:"flex-end" }}>
            <label style={{ ...im.label, visibility:"hidden" }}>ㅤ</label>
            <div style={{ display:"flex", gap:"6px" }}>
              <button style={im.resetBtn} onClick={handleReset}>초기화</button>
              <button style={im.searchBtn} onClick={handleSearch} disabled={loading}>
                {loading ? "조회 중..." : "🔍 조회"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"10px", justifyContent:"flex-end" }}>
        <button style={im.actionBtn} onClick={() => { setRegForm(INIT_REG); setRegErr({}); setImageBlob(null); setShowReg(true); }}>
          + 이슈등록
        </button>
      </div>

      {/* 결과 테이블 */}
      {!searched ? (
        <div style={im.emptyBox}><span style={{ fontSize:"36px" }}>🔍</span><p style={im.emptyText}>조회 조건을 입력하고 조회 버튼을 눌러주세요.</p></div>
      ) : loading ? (
        <div style={im.emptyBox}><p style={im.emptyText}>데이터를 불러오는 중입니다...</p></div>
      ) : rows.length === 0 ? (
        <div style={im.emptyBox}><span style={{ fontSize:"36px" }}>📭</span><p style={im.emptyText}>조회된 데이터가 없습니다.</p></div>
      ) : (
        <div style={im.tableWrap}>
          <table style={im.table}>
            <thead>
              <tr>
                {["No","프로젝트","테스트구분","오류구분","중요도","화면명","이슈제목","완료요청일","완료여부","완료일자","조치담당자","접수자","접수일자","등록일자","등록자"].map(h => (
                  <th key={h} style={im.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isComplete = row.COMPLETE_YN === "Y";
                const isSelected = row.ID === selectedId;
                return (
                  <tr key={row.ID} onClick={() => setSelectedId(isSelected ? null : row.ID)}
                    style={{ ...im.tr, backgroundColor: isSelected ? "#EFF6FF" : idx%2===0 ? "#FFFFFF" : "#F8FAFC", cursor:"pointer", outline: isSelected ? "2px solid #2563EB" : "none" }}>
                    <td style={{ ...im.td, textAlign:"center", color:"#94A3B8", width:"44px" }}>{idx+1}</td>
                    <td style={{ ...im.td, fontWeight:"600", color:"#1E293B", maxWidth:"120px" }}>
                      <span style={im.ellipsis} title={taskNameMap[String(row.TASK_ID)]}>{taskNameMap[String(row.TASK_ID)] ?? "-"}</span>
                    </td>
                    <td style={{ ...im.td, textAlign:"center", color:"#64748B", fontSize:"12px" }}>{row.TEST_GUBUN || "-"}</td>
                    <td style={{ ...im.td, textAlign:"center" }}><Badge text={row.ERROR_GUBUN} styles={ERROR_GUBUN_STYLE} /></td>
                    <td style={{ ...im.td, textAlign:"center" }}><Badge text={row.IMPORTANT_LEVEL} styles={LEVEL_STYLE} /></td>
                    <td style={{ ...im.td, maxWidth:"120px" }}>
                      <span style={im.ellipsis} title={row.MENU_NM}>{row.MENU_NM || "-"}</span>
                    </td>
                    <td style={{ ...im.td, maxWidth:"200px" }}>
                      <span
                        style={{ ...im.ellipsis, color:"#2563EB", cursor:"pointer", textDecoration:"underline", textUnderlineOffset:"2px" }}
                        title={row.ERROR_TITLE}
                        onClick={e => { e.stopPropagation(); setSelectedId(row.ID); setDetailRow(row); }}
                      >{row.ERROR_TITLE ?? "-"}</span>
                    </td>
                    <td style={{ ...im.td, textAlign:"center", color:"#64748B" }}>{formatDate(row.FIX_REQUEST_DATE)}</td>
                    <td style={{ ...im.td, textAlign:"center" }}>
                      <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:"12px", fontSize:"11px", fontWeight:"600", backgroundColor: isComplete?"#DCFCE7":"#FEF3C7", color: isComplete?"#16A34A":"#D97706" }}>
                        {isComplete ? "✓ 완료" : "⏳ 미완료"}
                      </span>
                    </td>
                    <td style={{ ...im.td, textAlign:"center", color:"#64748B" }}>{formatDate(row.FIX_DATE)}</td>
                    <td style={{ ...im.td, textAlign:"center" }}>{userMap[row.FIX_ID] ?? (row.FIX_ID || "-")}</td>
                    <td style={{ ...im.td, textAlign:"center" }}>{userMap[row.MANAGE_ID] ?? (row.MANAGE_ID||"-")}</td>
                    <td style={{ ...im.td, textAlign:"center", color:"#64748B" }}>{formatDate(row.MANAGE_DT)}</td>
                    <td style={{ ...im.td, textAlign:"center", color:"#64748B" }}>{formatDate(row.INSERT_DT)}</td>
                    <td style={{ ...im.td, textAlign:"center" }}>{userMap[row.INSERT_ID] ?? row.INSERT_ID ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 이슈등록 모달 ── */}
      {showReg && (
        <div style={im.overlay} onClick={e => e.target === e.currentTarget && setShowReg(false)}>
          <div style={im.modal}>
            <div style={im.modalHeader}>
              <h3 style={im.modalTitle}>이슈 등록</h3>
              <button style={im.closeBtn} onClick={() => setShowReg(false)}>✕</button>
            </div>
            <div style={im.modalBody}>
              {/* 2컬럼 레이아웃 */}
              <div style={{ display:"flex", gap:"24px", flex:1, minHeight:0 }}>

                {/* 왼쪽: 이미지 편집기 */}
                <div style={{ flex:"0 0 560px", display:"flex", flexDirection:"column", gap:"8px" }}>
                  <p style={{ margin:0, fontSize:"13px", fontWeight:"600", color:"#374151" }}>
                    이미지 첨부 &amp; 편집
                    <span style={{ marginLeft:"8px", fontSize:"11px", color:"#94A3B8", fontWeight:"400" }}>
                      업로드 후 펜·밑줄·텍스트로 편집하세요
                    </span>
                  </p>
                  <CanvasEditor onImageReady={blob => setImageBlob(blob)} />
                </div>

                {/* 오른쪽: 폼 */}
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"14px", overflowY:"auto" }}>
                  <div style={im.formRow}>
                    <label style={im.formLabel}>프로젝트명 <span style={{ color:"#DC2626" }}>*</span></label>
                    <select style={{ ...im.select, width:"100%" }}
                      value={regForm.taskId} onChange={e => setRegForm(f => ({ ...f, taskId: e.target.value }))}>
                      <option value="">선택</option>
                      {tm1List.map(t => <option key={t.TASK_ID} value={t.TASK_ID}>{t.TASK_NAME}</option>)}
                    </select>
                    {regErr.taskId && <span style={im.errMsg}>{regErr.taskId}</span>}
                  </div>
                  <div style={im.formRow}>
                    <label style={im.formLabel}>테스트구분</label>
                    <select style={{ ...im.select, width:"100%" }}
                      value={regForm.testGubun} onChange={e => setRegForm(f => ({ ...f, testGubun: e.target.value }))}>
                      <option value="">선택</option>
                      {TEST_GUBUN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ display:"flex", gap:"12px" }}>
                    <div style={{ ...im.formRow, flex:1 }}>
                      <label style={im.formLabel}>오류구분 <span style={{ color:"#DC2626" }}>*</span></label>
                      <select style={{ ...im.select, width:"100%" }}
                        value={regForm.errGubun} onChange={e => setRegForm(f => ({ ...f, errGubun: e.target.value }))}>
                        <option value="">선택</option><option value="오류">오류</option><option value="개선">개선</option>
                      </select>
                      {regErr.errGubun && <span style={im.errMsg}>{regErr.errGubun}</span>}
                    </div>
                    <div style={{ ...im.formRow, flex:1 }}>
                      <label style={im.formLabel}>중요도 <span style={{ color:"#DC2626" }}>*</span></label>
                      <select style={{ ...im.select, width:"100%" }}
                        value={regForm.level} onChange={e => setRegForm(f => ({ ...f, level: e.target.value }))}>
                        <option value="">선택</option><option value="긴급">긴급</option><option value="상">상</option>
                        <option value="중">중</option><option value="하">하</option>
                      </select>
                      {regErr.level && <span style={im.errMsg}>{regErr.level}</span>}
                    </div>
                  </div>
                  <div style={im.formRow}>
                    <label style={im.formLabel}>완료요청일자</label>
                    <input type="date" style={{ ...im.input, width:"100%" }}
                      value={regForm.fixRequestDate} onChange={e => setRegForm(f => ({ ...f, fixRequestDate: e.target.value }))} />
                  </div>
                  <div style={{ display:"flex", gap:"12px" }}>
                    <div style={{ ...im.formRow, flex:1 }}>
                      <label style={im.formLabel}>화면명</label>
                      <input style={{ ...im.input, width:"100%" }} placeholder="예) 이슈 관리 화면"
                        value={regForm.menuNm} onChange={e => setRegForm(f => ({ ...f, menuNm: e.target.value }))} />
                    </div>
                    <div style={{ ...im.formRow, flex:1 }}>
                      <label style={im.formLabel}>화면 경로</label>
                      <input style={{ ...im.input, width:"100%" }} placeholder="예) 메인 > 프로젝트 리포트 > 이슈관리"
                        value={regForm.menuPath} onChange={e => setRegForm(f => ({ ...f, menuPath: e.target.value }))} />
                    </div>
                  </div>
                  <div style={im.formRow}>
                    <label style={im.formLabel}>제목 <span style={{ color:"#DC2626" }}>*</span></label>
                    <input style={{ ...im.input, width:"100%" }} placeholder="이슈 제목을 입력하세요"
                      value={regForm.title} onChange={e => setRegForm(f => ({ ...f, title: e.target.value }))} />
                    {regErr.title && <span style={im.errMsg}>{regErr.title}</span>}
                  </div>
                  <div style={{ ...im.formRow, flex:1 }}>
                    <label style={im.formLabel}>오류 내용</label>
                    <textarea style={{ ...im.textarea, flex:1, minHeight:"200px", resize:"vertical" }}
                      placeholder="오류 내용을 상세히 입력하세요&#10;&#10;• 발생 상황&#10;• 재현 방법&#10;• 예상 동작"
                      value={regForm.content} onChange={e => setRegForm(f => ({ ...f, content: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
            <div style={im.modalFooter}>
              {imageBlob && (
                <span style={{ fontSize:"12px", color:"#16A34A", marginRight:"auto" }}>✓ 이미지 편집 완료 (저장 시 업로드됩니다)</span>
              )}
              <button style={im.resetBtn} onClick={() => setShowReg(false)}>취소</button>
              <button style={im.searchBtn} onClick={handleRegSave} disabled={regSaving}>
                {regSaving ? "저장 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 상세 모달 헬퍼 컴포넌트 ── */
function DetailItem({ label, value, bold }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
      <span style={{ fontSize:"11px", fontWeight:"600", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.04em" }}>{label}</span>
      <span style={{ fontSize:"13px", color: bold ? "#1E293B" : "#334155", fontWeight: bold ? "700" : "400" }}>{value}</span>
    </div>
  );
}
const detailSection = { margin:"0 0 12px", fontSize:"11px", fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em", borderLeft:"3px solid #2563EB", paddingLeft:"8px" };
const detailGrid    = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px 24px" };

/* ── 스타일 ── */
const im = {
  wrap:       { fontFamily:"'Pretendard', sans-serif", minHeight:"100%" },
  pageHeader: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"20px" },
  pageTitle:  { fontSize:"20px", fontWeight:"700", color:"#1E293B", margin:0 },
  pageSub:    { fontSize:"13px", color:"#94A3B8", margin:"4px 0 0" },
  totalBadge: { backgroundColor:"#EFF6FF", color:"#2563EB", fontSize:"13px", fontWeight:"600", padding:"4px 14px", borderRadius:"20px", border:"1px solid #BFDBFE" },
  searchPanel:{ backgroundColor:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"12px", padding:"20px 24px", marginBottom:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" },
  searchGrid: { display:"flex", flexWrap:"wrap", alignItems:"flex-end", gap:"12px 16px" },
  field:      { display:"flex", flexDirection:"column", gap:"5px" },
  label:      { fontSize:"12px", fontWeight:"600", color:"#475569" },
  select:     { padding:"8px 10px", border:"1px solid #CBD5E1", borderRadius:"7px", fontSize:"13px", color:"#1E293B", backgroundColor:"#FFFFFF", fontFamily:"'Pretendard', sans-serif", cursor:"pointer", outline:"none" },
  input:      { padding:"8px 10px", border:"1px solid #CBD5E1", borderRadius:"7px", fontSize:"13px", color:"#1E293B", fontFamily:"'Pretendard', sans-serif", outline:"none" },
  dateInput:  { padding:"7px 8px", border:"1px solid #CBD5E1", borderRadius:"7px", fontSize:"13px", color:"#1E293B", fontFamily:"'Pretendard', sans-serif", outline:"none", flex:1 },
  resetBtn:   { padding:"9px 20px", border:"1px solid #E2E8F0", borderRadius:"8px", backgroundColor:"#F8FAFC", color:"#64748B", fontSize:"13px", fontWeight:"500", cursor:"pointer", fontFamily:"'Pretendard', sans-serif" },
  searchBtn:  { padding:"9px 24px", border:"none", borderRadius:"8px", backgroundColor:"#1E293B", color:"#FFFFFF", fontSize:"13px", fontWeight:"600", cursor:"pointer", fontFamily:"'Pretendard', sans-serif" },
  actionBtn:  { padding:"8px 18px", border:"none", borderRadius:"8px", backgroundColor:"#1E293B", color:"#fff", fontSize:"13px", fontWeight:"600", cursor:"pointer", fontFamily:"'Pretendard', sans-serif" },
  emptyBox:   { backgroundColor:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"12px", padding:"60px 24px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:"12px" },
  emptyText:  { fontSize:"14px", color:"#94A3B8", margin:0 },
  tableWrap:  { backgroundColor:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"auto", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" },
  table:      { width:"100%", borderCollapse:"collapse", minWidth:"1000px" },
  th:         { padding:"11px 12px", textAlign:"left", fontSize:"12px", fontWeight:"700", color:"#475569", backgroundColor:"#F8FAFC", borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap" },
  tr:         { borderBottom:"1px solid #F1F5F9", transition:"background 0.1s" },
  td:         { padding:"11px 12px", fontSize:"13px", color:"#334155", verticalAlign:"middle" },
  ellipsis:   { display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  overlay:    { position:"fixed", inset:0, backgroundColor:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" },
  modal:      { backgroundColor:"#fff", borderRadius:"14px", width:"95vw", maxWidth:"1100px", height:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 40px rgba(0,0,0,0.22)", overflow:"hidden" },
  modalHeader:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", borderBottom:"1px solid #E8E8E8", flexShrink:0 },
  modalTitle: { fontSize:"16px", fontWeight:"700", color:"#1E293B", margin:0 },
  closeBtn:   { background:"none", border:"none", fontSize:"18px", color:"#94A3B8", cursor:"pointer" },
  modalBody:  { padding:"20px 24px", flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  modalFooter:{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:"8px", padding:"14px 24px", borderTop:"1px solid #E8E8E8", flexShrink:0 },
  formRow:    { display:"flex", flexDirection:"column", gap:"5px" },
  formLabel:  { fontSize:"13px", fontWeight:"600", color:"#374151" },
  textarea:   { padding:"10px 12px", border:"1px solid #CBD5E1", borderRadius:"7px", fontSize:"13px", color:"#1E293B", fontFamily:"'Pretendard', sans-serif", outline:"none", resize:"vertical" },
  errMsg:     { fontSize:"11px", color:"#DC2626", marginTop:"2px" },
};
