import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DuckDBProvider } from "@/hooks/useDuckDB";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { useVoiceQuery } from "@/hooks/useVoiceQuery";
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
        <AppLayoutInner
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={() => setSidebarCollapsed((c) => !c)}
          chatOpen={chatOpen}
          onChatToggle={handleChatToggle}
          workspaceId={workspaceId}
        />
      </VoiceProvider>
    </DuckDBProvider>
  );
}

/**
 * Inner layout component rendered inside VoiceProvider so that the
 * useVoiceQuery hook has access to VoiceContext.
 */
function AppLayoutInner({
  sidebarCollapsed,
  onSidebarToggle,
  chatOpen,
  onChatToggle,
  workspaceId,
}: {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  chatOpen: boolean;
  onChatToggle: () => void;
  workspaceId: string | null;
}) {
  const {
    pendingQuery,
    clearPendingQuery,
    speak,
  } = useVoiceQuery(workspaceId);

  // Auto-open chat panel when a voice query is detected.
  const handleVoiceQueryProcessed = useCallback(() => {
    clearPendingQuery();
  }, [clearPendingQuery]);

  const handleAssistantResponse = useCallback(
    (text: string) => {
      speak(text);
    },
    [speak],
  );

  // Open chat panel when voice query arrives.
  useEffect(() => {
    if (pendingQuery && !chatOpen) {
      onChatToggle();
    }
  }, [pendingQuery, chatOpen, onChatToggle]);

  return (
    <div className="flex h-screen bg-[#0E0E0E]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={onSidebarToggle}
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
            onToggle={onChatToggle}
            pendingVoiceQuery={pendingQuery}
            onVoiceQueryProcessed={handleVoiceQueryProcessed}
            onAssistantResponse={handleAssistantResponse}
          />
        </main>
      </div>
    </div>
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
