import { useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor, IDisposable, Position } from "monaco-editor";
import type { editor as editorApi } from "monaco-editor";

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "IN",
  "BETWEEN",
  "LIKE",
  "IS",
  "NULL",
  "AS",
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "OUTER",
  "CROSS",
  "ON",
  "GROUP",
  "BY",
  "HAVING",
  "ORDER",
  "ASC",
  "DESC",
  "LIMIT",
  "OFFSET",
  "UNION",
  "ALL",
  "DISTINCT",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "TABLE",
  "DROP",
  "ALTER",
  "INDEX",
  "VIEW",
  "WITH",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "EXISTS",
  "CAST",
  "COALESCE",
  "NULLIF",
];

const SQL_FUNCTIONS = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "ROUND",
  "ABS",
  "UPPER",
  "LOWER",
  "LENGTH",
  "TRIM",
  "SUBSTRING",
  "REPLACE",
  "CONCAT",
  "STRFTIME",
  "DATE_PART",
  "DATE_TRUNC",
  "NOW",
  "CURRENT_DATE",
  "CURRENT_TIMESTAMP",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "LAG",
  "LEAD",
  "FIRST_VALUE",
  "LAST_VALUE",
  "OVER",
  "PARTITION",
];

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  className?: string;
  readOnly?: boolean;
}

function SQLEditor({
  value,
  onChange,
  onRun,
  className,
  readOnly = false,
}: SQLEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = useRef<IDisposable | null>(null);

  const handleEditorMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;

      // Register Ctrl+Enter / Cmd+Enter to run query
      editorInstance.addAction({
        id: "run-query",
        label: "Run Query",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => {
          onRun();
        },
      });

      // Register SQL keyword and function completions
      completionDisposableRef.current =
        monaco.languages.registerCompletionItemProvider("sql", {
          provideCompletionItems: (_model: editorApi.ITextModel, position: Position) => {
            const word = _model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            const keywordSuggestions = SQL_KEYWORDS.map((kw) => ({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
              range,
            }));

            const functionSuggestions = SQL_FUNCTIONS.map((fn) => ({
              label: fn,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: fn + "()",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.None,
              range,
            }));

            return {
              suggestions: [...keywordSuggestions, ...functionSuggestions],
            };
          },
        });
    },
    [onRun],
  );

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val ?? "");
    },
    [onChange],
  );

  return (
    <div className={className} data-testid="sql-editor">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-500">SQL</span>
        <button
          type="button"
          onClick={onRun}
          disabled={readOnly}
          className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          data-testid="run-button"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M3 1.5v9l7.5-4.5L3 1.5z" />
          </svg>
          Run
          <kbd className="ml-1 rounded border border-blue-400 px-1 text-[10px] opacity-70">
            Ctrl+Enter
          </kbd>
        </button>
      </div>
      <Editor
        height="100%"
        defaultLanguage="sql"
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          readOnly,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          padding: { top: 8 },
        }}
      />
    </div>
  );
}

export type { SQLEditorProps };
export { SQL_KEYWORDS, SQL_FUNCTIONS };
export default SQLEditor;
