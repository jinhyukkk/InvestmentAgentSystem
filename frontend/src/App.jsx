import { useState } from "react";
import { colors, fontFamily } from "./theme.js";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import Dashboard from "./Dashboard.jsx";
import CaseList from "./CaseList.jsx";
import CaseDetail from "./CaseDetail.jsx";
import RequestScreen from "./RequestScreen.jsx";

const titles = { dashboard: "대시보드", list: "안건 목록 · 심의 이력", detail: "안건 상세", request: "새 심의 요청" };

export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [selectedCase, setSelectedCase] = useState(null);

  function openCase(c) {
    setSelectedCase(c);
    setScreen("detail");
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily, color: colors.text, background: colors.bg, letterSpacing: "-0.01em" }}>
      <Sidebar screen={screen} onNavigate={setScreen} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title={titles[screen]} />
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {screen === "dashboard" && <Dashboard onOpenCase={openCase} onNewRequest={() => setScreen("request")} />}
          {screen === "list" && <CaseList onOpenCase={openCase} onNewRequest={() => setScreen("request")} />}
          {screen === "detail" && <CaseDetail caseItem={selectedCase} onBack={() => setScreen("list")} />}
          {screen === "request" && <RequestScreen />}
        </main>
      </div>
    </div>
  );
}
