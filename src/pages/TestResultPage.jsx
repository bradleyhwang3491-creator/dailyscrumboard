import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function TestResultPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const deptCd = user?.deptCd ?? "";

  /* ── 검색 ── */
  const [searchSystem,   setSearchSystem]   = useState("");
  const [searchSeq,      setSearchSeq]      = useState("");
  const [searchComplete, setSearchComplete] = useState("");

  /* ── 드롭다운 옵션 ── */
  const [systemOptions, setSystemOptions] = useState([]);   // 시스템명 목록
  const [seqOptions,    setSeqOptions]    = useState([]);   // 테스트 회차 목록

  /* ── 그리드 ── */
  const [resultRows, setResultRows] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [completing, setCompleting] = useState(false);
  const [searched,   setSearched]   = useState(false);

  useEffect(() => { loadSystemOptions(); }, []);

  /* ── 시스템명 목록 (로그인 사용자 부서 기준) ── */
  async function loadSystemOptions() {
    let q = supabase.from("SYSTEM_MENU_MASTER").select("SYSTEM_NAME").order("SYSTEM_NAME");
    if (deptCd) q = q.eq("DEPT_CD", deptCd);
    const { data } = await q;
    const unique = [...new Set((data ?? []).map(r => r.SYSTEM_NAME).filter(Boolean))];
    setSystemOptions(unique);
  }

  /* ── 시스템 변경 시 테스트 회차 로드 ── */
  async function loadSeqOptions(sysName) {
    setSeqOptions([]); setSearchSeq("");
    if (!sysName) return;

    // 선택된 시스템의 MENU ID 목록
    let mq = supabase.from("SYSTEM_MENU_MASTER").select("ID").eq("SYSTEM_NAME", sysName);
    if (deptCd) mq = mq.eq("DEPT_CD", deptCd);
    const { data: menus } = await mq;
    const menuIds = (menus ?? []).map(m => m.ID);
    if (menuIds.length === 0) return;

    // 해당 시스템 + 현재 사용자의 TEST_SEQUENCE 목록
    const { data: seqs } = await supabase
      .from("SYSTEM_TEST_RESULT")
      .select("TEST_SEQUENCE")
      .eq("TESTER_ID", userId)
      .in("ID", menuIds)
      .order("TEST_SEQUENCE", { ascending: false });

    const unique = [...new Set((seqs ?? []).map(r => r.TEST_SEQUENCE).filter(v => v != null))];
    setSeqOptions(unique);
    if (unique.length > 0) setSearchSeq(String(unique[0]));
  }

  /* ── 조회 ── */
  async function handleSearch() {
    if (!searchSystem) { alert("시스템명을 선택하세요."); return; }
    if (!searchSeq)    { alert("테스트 회차를 선택하세요."); return; }

    setLoading(true); setSearched(true);

    // 1. 선택 시스템 MENU ID 목록
    let mq = supabase.from("SYSTEM_MENU_MASTER").select("ID, SYSTEM_NAME, MENU1, MENU2")
      .eq("SYSTEM_NAME", searchSystem);
    if (deptCd) mq = mq.eq("DEPT_CD", deptCd);
    const { data: menuData } = await mq;
    const menuIds = (menuData ?? []).map(m => m.ID);
    const menuMap = {};
    (menuData ?? []).forEach(m => { menuMap[m.ID] = m; });

    // 2. SYSTEM_TEST_RESULT 조회
    let rq = supabase
      .from("SYSTEM_TEST_RESULT")
      .select("RESULT_ID, PLAN_ID, ID, STATUS, TEST_SEQUENCE, SYS_DT")
      .eq("TESTER_ID", userId)
      .eq("TEST_SEQUENCE", Number(searchSeq))
      .in("ID", menuIds)
      .order("RESULT_ID", { ascending: true });

    if (searchComplete === "완료")   rq = rq.eq("STATUS", "테스트 완료");
    if (searchComplete === "미완료") rq = rq.neq("STATUS", "테스트 완료");

    const { data: results, error: rErr } = await rq;
    if (rErr) { alert("조회 오류: " + rErr.message); setLoading(false); return; }

    if (!results || results.length === 0) {
      setResultRows([]); setLoading(false); return;
    }

    // 3. SYSTEM_TEST_PLANDATA 조회
    const planIds = [...new Set(results.map(r => r.PLAN_ID).filter(Boolean))];
    const planMap = {};
    if (planIds.length > 0) {
      const { data: plans } = await supabase
        .from("SYSTEM_TEST_PLANDATA")
        .select("PLAN_ID, TSET_GUBUN, TEST_CONTENT")
        .in("PLAN_ID", planIds);
      (plans ?? []).forEach(p => { planMap[p.PLAN_ID] = p; });
    }

    // 4. 병합
    const merged = results.map(r => ({
      ...r,
      _selected:    false,
      SYSTEM_NAME:  menuMap[r.ID]?.SYSTEM_NAME  ?? "",
      MENU1:        menuMap[r.ID]?.MENU1         ?? "",
      MENU2:        menuMap[r.ID]?.MENU2         ?? "",
      TSET_GUBUN:   planMap[r.PLAN_ID]?.TSET_GUBUN   ?? "",
      TEST_CONTENT: planMap[r.PLAN_ID]?.TEST_CONTENT ?? "",
    }));

    setResultRows(merged);
    setLoading(false);
  }

  function handleReset() {
    setSearchSystem(""); setSearchSeq(""); setSearchComplete("");
    setSeqOptions([]); setResultRows([]); setSearched(false);
  }

  /* ── 체크박스 ── */
  function handleSelectRow(idx) {
    setResultRows(rows => rows.map((r, i) => i === idx ? { ...r, _selected: !r._selected } : r));
  }
  function handleSelectAll(checked) {
    setResultRows(rows => rows.map(r => ({ ...r, _selected: checked })));
  }

  /* ── 일괄 점검 완료 ── */
  async function handleComplete() {
    const selected = resultRows.filter(r => r._selected && r.STATUS !== "테스트 완료");
    if (selected.length === 0) {
      alert("완료 처리할 미완료 항목을 선택하세요.\n이미 완료된 항목은 처리 대상에서 제외됩니다.");
      return;
    }
    if (!window.confirm(`선택한 ${selected.length}건을 테스트 완료 처리하시겠습니까?`)) return;

    setCompleting(true);
    const ids = selected.map(r => r.RESULT_ID);
    const { error } = await supabase
      .from("SYSTEM_TEST_RESULT")
      .update({ STATUS: "테스트 완료" })
      .in("RESULT_ID", ids);
    setCompleting(false);
    if (error) { alert("처리 오류: " + error.message); return; }

    // 로컬 상태 즉시 반영
    setResultRows(rows =>
      rows.map(r => ids.includes(r.RESULT_ID) ? { ...r, STATUS: "테스트 완료", _selected: false } : r)
    );
    alert(`${selected.length}건이 테스트 완료 처리되었습니다.`);
  }

  /* ── 통계 ── */
  const totalCnt     = resultRows.length;
  const doneCnt      = resultRows.filter(r => r.STATUS === "테스트 완료").length;
  const pendingCnt   = totalCnt - doneCnt;
  const selectedCnt  = resultRows.filter(r => r._selected).length;
  const allSelected  = totalCnt > 0 && resultRows.every(r => r._selected);

  /* ─────────────────────────────── RENDER ─── */
  return (
    <div style={s.wrap}>

      {/* 헤더 */}
      <div style={{ flexShrink:0 }}>
        <h2 style={s.pageTitle}>✅ 테스트 결과등록</h2>
        <p style={s.pageDesc}>테스트케이스 결과를 조회하고 완료 처리합니다.</p>
      </div>

      {/* 검색 */}
      <div style={s.searchBar}>
        {/* 시스템명 */}
        <div style={s.searchField}>
          <label style={s.label}>시스템명</label>
          <select style={s.select} value={searchSystem}
            onChange={e => { setSearchSystem(e.target.value); loadSeqOptions(e.target.value); }}>
            <option value="">선택</option>
            {systemOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* 테스트 회차 */}
        <div style={s.searchField}>
          <label style={s.label}>테스트 회차</label>
          <select style={s.select} value={searchSeq} onChange={e => setSearchSeq(e.target.value)}
            disabled={seqOptions.length === 0}>
            <option value="">선택</option>
            {seqOptions.map(n => <option key={n} value={n}>{n}회차</option>)}
          </select>
        </div>

        {/* 완료구분 */}
        <div style={s.searchField}>
          <label style={s.label}>완료구분</label>
          <select style={s.select} value={searchComplete} onChange={e => setSearchComplete(e.target.value)}>
            <option value="">전체</option>
            <option value="완료">완료</option>
            <option value="미완료">미완료</option>
          </select>
        </div>

        <div style={{ display:"flex", alignItems:"flex-end", gap:"6px" }}>
          <button style={s.resetBtn} onClick={handleReset}>초기화</button>
          <button style={s.searchBtn} onClick={handleSearch} disabled={loading}>
            {loading ? "조회중..." : "🔍 조회"}
          </button>
        </div>
      </div>

      {/* 그리드 패널 */}
      <div style={s.gridPanel}>

        {/* 그리드 헤더 */}
        <div style={s.gridTop}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
            <span style={s.gridTitle}>테스트 결과 목록</span>
            {totalCnt > 0 && (
              <>
                <span style={s.chip}>전체 {totalCnt}건</span>
                <span style={{ ...s.chip, backgroundColor:"#DCFCE7", color:"#16A34A", borderColor:"#86EFAC" }}>
                  완료 {doneCnt}건
                </span>
                <span style={{ ...s.chip, backgroundColor:"#FEF3C7", color:"#D97706", borderColor:"#FDE68A" }}>
                  미완료 {pendingCnt}건
                </span>
              </>
            )}
          </div>
          {selectedCnt > 0 && (
            <button style={{ ...s.completeBtn, opacity: completing ? 0.6 : 1 }}
              onClick={handleComplete} disabled={completing}>
              {completing ? "처리중..." : `✓ 점검 완료 처리 (${selectedCnt}건)`}
            </button>
          )}
        </div>

        {/* 테이블 or 빈 상태 */}
        {totalCnt === 0 ? (
          <div style={s.empty}>
            {loading
              ? "조회 중..."
              : searched
                ? "조회된 데이터가 없습니다."
                : "시스템명과 테스트 회차를 선택하고 조회 버튼을 눌러주세요."}
          </div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <colgroup>
                <col style={{ width:"44px" }} />
                <col style={{ width:"44px" }} />
                <col style={{ width:"130px" }} />
                <col style={{ width:"150px" }} />
                <col style={{ width:"130px" }} />
                <col style={{ width:"100px" }} />
                <col />
                <col style={{ width:"110px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={s.th}>
                    <input type="checkbox" style={{ cursor:"pointer" }}
                      checked={allSelected}
                      onChange={e => handleSelectAll(e.target.checked)} />
                  </th>
                  <th style={{ ...s.th, textAlign:"center" }}>No</th>
                  <th style={s.th}>시스템명</th>
                  <th style={s.th}>대메뉴</th>
                  <th style={s.th}>소메뉴</th>
                  <th style={s.th}>점검구분</th>
                  <th style={s.th}>점검항목</th>
                  <th style={{ ...s.th, textAlign:"center" }}>진행상태</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row, idx) => {
                  const isDone = row.STATUS === "테스트 완료";
                  return (
                    <tr key={row.RESULT_ID}
                      onClick={() => handleSelectRow(idx)}
                      style={{
                        backgroundColor: row._selected
                          ? "#FFF7ED"
                          : idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                        borderBottom:"1px solid #F1F5F9",
                        cursor:"pointer",
                      }}>
                      <td style={{ ...s.td, textAlign:"center" }}>
                        <input type="checkbox" style={{ cursor:"pointer" }}
                          checked={!!row._selected}
                          onChange={() => handleSelectRow(idx)}
                          onClick={e => e.stopPropagation()} />
                      </td>
                      <td style={{ ...s.td, textAlign:"center", color:"#94A3B8", fontSize:"12px" }}>
                        {idx + 1}
                      </td>
                      <td style={s.td}>{row.SYSTEM_NAME}</td>
                      <td style={s.td}>{row.MENU1}</td>
                      <td style={{ ...s.td, color:"#64748B" }}>{row.MENU2 || "-"}</td>
                      <td style={s.td}>
                        {row.TSET_GUBUN ? (
                          <span style={{
                            fontSize:"11px", fontWeight:"600", color:"#0369A1",
                            backgroundColor:"#E0F2FE", border:"1px solid #BAE6FD",
                            borderRadius:"4px", padding:"2px 8px",
                          }}>{row.TSET_GUBUN}</span>
                        ) : "-"}
                      </td>
                      <td style={s.td}>{row.TEST_CONTENT || "-"}</td>
                      <td style={{ ...s.td, textAlign:"center" }}>
                        <span style={{
                          display:"inline-block", fontSize:"11px", fontWeight:"700",
                          padding:"3px 10px", borderRadius:"12px",
                          backgroundColor: isDone ? "#DCFCE7" : "#FEF3C7",
                          color:           isDone ? "#16A34A" : "#D97706",
                          border:`1px solid ${isDone ? "#86EFAC" : "#FDE68A"}`,
                        }}>{row.STATUS || "테스트중"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 하단 요약 */}
        {totalCnt > 0 && (
          <div style={{ padding:"8px 16px", borderTop:"1px solid #E2E8F0",
            display:"flex", gap:"16px", fontSize:"12px", color:"#94A3B8", flexShrink:0 }}>
            <span>전체 {totalCnt}건</span>
            <span style={{ color:"#16A34A", fontWeight:"600" }}>완료 {doneCnt}건</span>
            <span style={{ color:"#D97706", fontWeight:"600" }}>미완료 {pendingCnt}건</span>
            {selectedCnt > 0 && <span style={{ color:"#2563EB", fontWeight:"600" }}>선택 {selectedCnt}건</span>}
            {totalCnt > 0 && (
              <span style={{ color:"#7C3AED", fontWeight:"600" }}>
                진행률 {Math.round(doneCnt / totalCnt * 100)}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 스타일 ── */
const s = {
  wrap:       { display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", gap:"16px", fontFamily:"'Pretendard',sans-serif" },
  pageTitle:  { margin:0, fontSize:"20px", fontWeight:"700", color:"#1E293B" },
  pageDesc:   { margin:"4px 0 0", fontSize:"13px", color:"#94A3B8" },
  searchBar:  { display:"flex", gap:"12px", flexWrap:"wrap", backgroundColor:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"12px", padding:"14px 20px", alignItems:"flex-end", flexShrink:0 },
  searchField:{ display:"flex", flexDirection:"column", gap:"4px" },
  label:      { fontSize:"12px", fontWeight:"600", color:"#475569" },
  select:     { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", color:"#1E293B", backgroundColor:"#F8FAFC", border:"1px solid #CBD5E1", borderRadius:"7px", padding:"7px 10px", minWidth:"140px", cursor:"pointer" },
  resetBtn:   { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", color:"#475569", backgroundColor:"#F1F5F9", border:"1px solid #CBD5E1", borderRadius:"7px", padding:"7px 16px", cursor:"pointer", fontWeight:"500" },
  searchBtn:  { fontFamily:"'Pretendard',sans-serif", fontSize:"13px", color:"#FFFFFF", backgroundColor:"#1E293B", border:"none", borderRadius:"7px", padding:"7px 18px", cursor:"pointer", fontWeight:"600" },
  gridPanel:  { display:"flex", flexDirection:"column", flex:1, backgroundColor:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"hidden", minHeight:0 },
  gridTop:    { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #E2E8F0", backgroundColor:"#F8FAFC", flexShrink:0, flexWrap:"wrap", gap:"8px" },
  gridTitle:  { fontSize:"14px", fontWeight:"700", color:"#1E293B" },
  chip:       { fontSize:"12px", color:"#2563EB", backgroundColor:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"20px", padding:"2px 10px", fontWeight:"500" },
  completeBtn:{ fontFamily:"'Pretendard',sans-serif", fontSize:"13px", fontWeight:"700", color:"#FFFFFF", backgroundColor:"#16A34A", border:"none", borderRadius:"7px", padding:"7px 20px", cursor:"pointer" },
  empty:      { flex:1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", color:"#94A3B8", padding:"40px", textAlign:"center" },
  tableWrap:  { overflowY:"auto", flex:1 },
  table:      { width:"100%", borderCollapse:"collapse" },
  th:         { position:"sticky", top:0, backgroundColor:"#F1F5F9", padding:"10px 12px", fontSize:"12px", fontWeight:"600", color:"#475569", textAlign:"left", borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap", zIndex:1 },
  td:         { padding:"9px 12px", fontSize:"13px", color:"#1E293B", verticalAlign:"middle" },
};
