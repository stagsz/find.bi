import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DuckDBProvider } from "@/hooks/useDuckDB";
import { VoiceProvider } from "@/contexts/VoiceContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import ChatPanel from "@/components/ai/ChatPanel";
import HomePage from "@/pages/HomePage";
import DashboardListPage from "@/pages/DashboardListPage";
import DashboardPage from "@/pages/DashboardPage";
import EditorPage from "@/pages/EditorPage";
import UploadPage from "@/pages/UploadPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import api from "@/services/api";

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ id: string; name: string }[]>("/api/workspaces/")
      .then((res) => {
        if (res.data.length > 0) {
          setWorkspaceId(res.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleChatToggle = useCallback(() => {
    setChatOpen((prev) => !prev);
  }, []);

  return (
    <DuckDBProvider>
      <VoiceProvider>
        <div className="flex h-screen bg-[#0E0E0E]">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
          />
          <div className="flex flex-col flex-1 min-w-0">
            <TopBar />
            <main className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/dashboards/:id" element={<DashboardPage />} />
                  <Route path="/dashboards" element={<DashboardListPage />} />
                  <Route path="/editor" element={<EditorPage />} />
                  <Route path="/upload" element={<UploadPage />} />
                </Routes>
              </div>
              <ChatPanel
                workspaceId={workspaceId}
                open={chatOpen}
                onToggle={handleChatToggle}
              />
            </main>
          </div>
        </div>
      </VoiceProvider>
    </DuckDBProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<AppLayout />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
