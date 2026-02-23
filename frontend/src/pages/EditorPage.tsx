import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/services/api";
import { useDuckDB } from "@/hooks/useDuckDB";
import type { QueryResult as QueryResultData } from "@/hooks/useDuckDB";
import SQLEditor from "@/components/editor/SQLEditor";
import SchemaExplorer from "@/components/editor/SchemaExplorer";
import QueryResult from "@/components/editor/QueryResult";

const MIN_SIDEBAR_WIDTH = 140;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 224;
const MIN_EDITOR_HEIGHT = 80;
const MIN_RESULT_HEIGHT = 80;
const DEFAULT_EDITOR_FRACTION = 0.4;

function EditorPage() {
  const { query, isReady } = useDuckDB();

  // Workspace
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // SQL state
  const [sql, setSql] = useState("SELECT 1;");
  const [queryResult, setQueryResult] = useState<QueryResultData | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Resizable pane state
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [editorFraction, setEditorFraction] = useState(DEFAULT_EDITOR_FRACTION);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // Drag tracking refs
  const dragTypeRef = useRef<"sidebar" | "editor" | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartValueRef = useRef(0);

  // Fetch default workspace
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

  // Run query
  const handleRun = useCallback(async () => {
    const trimmed = sql.trim();
    if (!trimmed) return;
    if (!isReady) return;

    setQueryLoading(true);
    setQueryError(null);
    try {
      const result = await query(trimmed);
      setQueryResult(result);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : String(err));
      setQueryResult(null);
    } finally {
      setQueryLoading(false);
    }
  }, [query, sql, isReady]);

  // Insert column name into SQL editor
  const handleColumnClick = useCallback(
    (_tableName: string, columnName: string) => {
      setSql((prev) => {
        if (prev.length === 0) return columnName;
        return prev.endsWith(" ") ? prev + columnName : prev + " " + columnName;
      });
    },
    [],
  );

  // Mouse drag handler for resizable panes
  const handleMouseDown = useCallback(
    (type: "sidebar" | "editor", e: React.MouseEvent) => {
      e.preventDefault();
      dragTypeRef.current = type;
      dragStartXRef.current = e.clientX;
      dragStartYRef.current = e.clientY;
      dragStartValueRef.current =
        type === "sidebar" ? sidebarWidth : editorFraction;
    },
    [sidebarWidth, editorFraction],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragTypeRef.current) return;
      e.preventDefault();

      if (dragTypeRef.current === "sidebar") {
        const dx = e.clientX - dragStartXRef.current;
        const newWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, dragStartValueRef.current + dx),
        );
        setSidebarWidth(newWidth);
      } else if (dragTypeRef.current === "editor") {
        const pane = rightPaneRef.current;
        if (!pane) return;
        const totalHeight = pane.clientHeight;
        if (totalHeight <= 0) return;
        const dy = e.clientY - dragStartYRef.current;
        const deltaFraction = dy / totalHeight;
        const newFraction = Math.min(
          1 - MIN_RESULT_HEIGHT / totalHeight,
          Math.max(
            MIN_EDITOR_HEIGHT / totalHeight,
            dragStartValueRef.current + deltaFraction,
          ),
        );
        setEditorFraction(newFraction);
      }
    };

    const handleMouseUp = () => {
      dragTypeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="flex h-full overflow-hidden" data-testid="editor-page">
      {/* Left: Schema Explorer */}
      <div
        className="flex-shrink-0 border-r border-gray-200"
        style={{ width: sidebarWidth }}
        data-testid="editor-sidebar"
      >
        <SchemaExplorer
          workspaceId={workspaceId}
          onColumnClick={handleColumnClick}
          className="h-full"
        />
      </div>

      {/* Sidebar resize handle */}
      <div
        className="flex-shrink-0 w-1 cursor-col-resize bg-transparent hover:bg-blue-300 active:bg-blue-400 transition-colors"
        onMouseDown={(e) => handleMouseDown("sidebar", e)}
        data-testid="sidebar-resize-handle"
        role="separator"
        aria-orientation="vertical"
      />

      {/* Right: Editor (top) + Results (bottom) */}
      <div
        ref={rightPaneRef}
        className="flex flex-col flex-1 min-w-0"
        data-testid="editor-main"
      >
        {/* SQL Editor pane */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ height: `${editorFraction * 100}%` }}
          data-testid="editor-pane"
        >
          <SQLEditor
            value={sql}
            onChange={setSql}
            onRun={handleRun}
            className="flex flex-col h-full"
          />
        </div>

        {/* Horizontal resize handle */}
        <div
          className="flex-shrink-0 h-1 cursor-row-resize bg-transparent hover:bg-blue-300 active:bg-blue-400 transition-colors"
          onMouseDown={(e) => handleMouseDown("editor", e)}
          data-testid="editor-resize-handle"
          role="separator"
          aria-orientation="horizontal"
        />

        {/* Query Results pane */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          data-testid="result-pane"
        >
          <QueryResult
            result={queryResult}
            loading={queryLoading}
            error={queryError}
            className="h-full overflow-auto"
          />
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
