import { useCallback, useEffect, useState } from "react";

// 목록·상세 세 화면이 같은 "불러오는 중 / 실패 / 다시 불러오기" 패턴을 쓴다.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e) => alive && setState({ data: null, error: e.message, loading: false })
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload };
}

// 불러오는 중·실패·0건을 한 줄로. 세 화면이 같은 문구를 쓴다.
export function AsyncStatus({ loading, error, empty, onRetry }) {
  const box = { padding: "40px 20px", textAlign: "center", fontSize: 13, color: "#8A94A3" };
  if (loading) return <div style={box}>불러오는 중…</div>;
  if (error)
    return (
      <div style={box}>
        {error}{" "}
        <button onClick={onRetry} style={{ marginLeft: 8, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
          다시 시도
        </button>
      </div>
    );
  if (empty) return <div style={box}>저장된 안건이 없습니다. 새 심의 요청으로 시작하세요.</div>;
  return null;
}
