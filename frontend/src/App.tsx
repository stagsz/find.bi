import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DuckDBProvider } from "@/hooks/useDuckDB";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { useVoiceQuery } from "@/hooks/useVoiceQuery";
import { useVoiceHistory } from "@/hooks/useVoiceHistory";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import ChatPanel from "@/components/ai/ChatPanel";
import TranscriptPanel from "@/components/voice/TranscriptPanel";
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
  const [transcriptOpen, setTranscriptOpen] = useState(false);
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

  const handleTranscriptToggle = useCallback(() => {
    setTranscriptOpen((prev) => !prev);
  }, []);

  return (
    <DuckDBProvider>
      <VoiceProvider>
        <AppLayoutInner
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={() => setSidebarCollapsed((c) => !c)}
          chatOpen={chatOpen}
          onChatToggle={handleChatToggle}
          transcriptOpen={transcriptOpen}
          onTranscriptToggle={handleTranscriptToggle}
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
  transcriptOpen,
  onTranscriptToggle,
  workspaceId,
}: {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  chatOpen: boolean;
  onChatToggle: () => void;
  transcriptOpen: boolean;
  onTranscriptToggle: () => void;
  workspaceId: string | null;
}) {
  const {
    pendingQuery,
    clearPendingQuery,
    speak,
  } = useVoiceQuery(workspaceId);

  const { entries: transcriptEntries, clearHistory: clearTranscriptHistory } =
    useVoiceHistory();

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
          <TranscriptPanel
            open={transcriptOpen}
            onClose={onTranscriptToggle}
            entries={transcriptEntries}
            onClearHistory={clearTranscriptHistory}
            onRerun={(query) => {
              // Inject query into the chat panel as a pending voice query.
              // Re-use the same pending-query infrastructure.
              onChatToggle();
              // pendingQuery is managed by useVoiceQuery; for re-run we open
              // chat and let the user submit manually (text is pre-filled
              // via the chat input in a future iteration).
              // For now, opening the panel provides context.
              void query; // consumed by parent in future
            }}
          />
        </main>
      </div>

      {/* Floating transcript toggle button */}
      {!transcriptOpen && (
        <button
          type="button"
          data-testid="transcript-toggle"
          onClick={onTranscriptToggle}
          aria-label="Open voice history"
          title="Voice history"
          className="fixed bottom-20 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-[#2A2A2A] bg-[#141414] text-[#6B6860] shadow-lg transition-all hover:border-[#F5A623]/30 hover:text-[#F5A623]"
        >
          {transcriptEntries.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F5A623] font-mono text-[0.5rem] font-bold text-[#0D0D0D]">
              {transcriptEntries.length > 9 ? "9+" : transcriptEntries.length}
            </span>
          )}
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
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
