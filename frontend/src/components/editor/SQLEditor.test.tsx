import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Monaco Editor — capture mount handler so we can simulate editor behavior
const mocks = vi.hoisted(() => {
  return {
    Editor: vi.fn(),
    onMountHandler: null as
      | ((
          editor: Record<string, unknown>,
          monaco: Record<string, unknown>,
        ) => void)
      | null,
    onChangeHandler: null as
      | ((value: string | undefined) => void)
      | null,
  };
});

vi.mock("@monaco-editor/react", () => {
  const MockEditor = (props: Record<string, unknown>) => {
    mocks.Editor(props);
    // Store handlers for test access
    mocks.onMountHandler = props.onMount as typeof mocks.onMountHandler;
    mocks.onChangeHandler = props.onChange as typeof mocks.onChangeHandler;
    return <div data-testid="monaco-editor-mock" />;
  };
  return {
    default: MockEditor,
  };
});

import SQLEditor, { SQL_KEYWORDS, SQL_FUNCTIONS } from "./SQLEditor";

interface Suggestion {
  label: string;
  insertText: string;
  kind: number;
  range: unknown;
}

interface CompletionProvider {
  provideCompletionItems: (
    model: { getWordUntilPosition: (pos: unknown) => { startColumn: number; endColumn: number } },
    position: { lineNumber: number; column: number },
  ) => { suggestions: Suggestion[] };
}

function createMockMonaco() {
  return {
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
    KeyMod: { CtrlCmd: 2048 },
    KeyCode: { Enter: 3 },
    languages: {
      registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
      CompletionItemKind: { Keyword: 17, Function: 1 },
      CompletionItemInsertTextRule: { None: 0 },
    },
  };
}

function getCompletionProvider(
  registerFn: ReturnType<typeof vi.fn>,
): CompletionProvider {
  const calls = registerFn.mock.calls as unknown[][];
  return calls[0][1] as CompletionProvider;
}

function getCompletionResult(provider: CompletionProvider) {
  const mockModel = {
    getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
  };
  const position = { lineNumber: 1, column: 1 };
  return provider.provideCompletionItems(mockModel, position);
}

describe("SQLEditor", () => {
  const defaultProps = {
    value: "SELECT * FROM users",
    onChange: vi.fn(),
    onRun: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onMountHandler = null;
    mocks.onChangeHandler = null;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders the editor container", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(screen.getByTestId("sql-editor")).toBeInTheDocument();
  });

  it("renders the Monaco editor mock", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument();
  });

  it("renders a Run button", () => {
    render(<SQLEditor {...defaultProps} />);
    const btn = screen.getByTestId("run-button");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("Run");
  });

  it("renders SQL label in toolbar", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(screen.getByText("SQL")).toBeInTheDocument();
  });

  it("renders Ctrl+Enter keyboard shortcut hint", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(screen.getByText("Ctrl+Enter")).toBeInTheDocument();
  });

  it("applies className to container", () => {
    render(<SQLEditor {...defaultProps} className="my-editor" />);
    expect(screen.getByTestId("sql-editor")).toHaveClass("my-editor");
  });

  // --- Monaco Editor props ---

  it("passes value to Monaco Editor", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(mocks.Editor).toHaveBeenCalledWith(
      expect.objectContaining({ value: "SELECT * FROM users" }),
    );
  });

  it("passes sql as default language", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(mocks.Editor).toHaveBeenCalledWith(
      expect.objectContaining({ defaultLanguage: "sql" }),
    );
  });

  it("sets height to 100%", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(mocks.Editor).toHaveBeenCalledWith(
      expect.objectContaining({ height: "100%" }),
    );
  });

  it("disables minimap", () => {
    render(<SQLEditor {...defaultProps} />);
    const call = (mocks.Editor.mock.calls as unknown[][])[0][0] as Record<string, Record<string, unknown>>;
    expect(call.options.minimap).toEqual({ enabled: false });
  });

  it("sets font size to 14", () => {
    render(<SQLEditor {...defaultProps} />);
    const call = (mocks.Editor.mock.calls as unknown[][])[0][0] as Record<string, Record<string, unknown>>;
    expect(call.options.fontSize).toBe(14);
  });

  it("enables line numbers", () => {
    render(<SQLEditor {...defaultProps} />);
    const call = (mocks.Editor.mock.calls as unknown[][])[0][0] as Record<string, Record<string, unknown>>;
    expect(call.options.lineNumbers).toBe("on");
  });

  it("enables word wrap", () => {
    render(<SQLEditor {...defaultProps} />);
    const call = (mocks.Editor.mock.calls as unknown[][])[0][0] as Record<string, Record<string, unknown>>;
    expect(call.options.wordWrap).toBe("on");
  });

  it("enables automatic layout", () => {
    render(<SQLEditor {...defaultProps} />);
    const call = (mocks.Editor.mock.calls as unknown[][])[0][0] as Record<string, Record<string, unknown>>;
    expect(call.options.automaticLayout).toBe(true);
  });

  it("disables scroll beyond last line", () => {
    render(<SQLEditor {...defaultProps} />);
    const call = (mocks.Editor.mock.calls as unknown[][])[0][0] as Record<string, Record<string, unknown>>;
    expect(call.options.scrollBeyondLastLine).toBe(false);
  });

  it("passes readOnly option when readOnly prop is true", () => {
    render(<SQLEditor {...defaultProps} readOnly />);
    const call = (mocks.Editor.mock.calls as unknown[][])[0][0] as Record<string, Record<string, unknown>>;
    expect(call.options.readOnly).toBe(true);
  });

  it("sets readOnly to false by default", () => {
    render(<SQLEditor {...defaultProps} />);
    const call = (mocks.Editor.mock.calls as unknown[][])[0][0] as Record<string, Record<string, unknown>>;
    expect(call.options.readOnly).toBe(false);
  });

  // --- Run button ---

  it("calls onRun when Run button is clicked", async () => {
    const user = userEvent.setup();
    render(<SQLEditor {...defaultProps} />);
    await user.click(screen.getByTestId("run-button"));
    expect(defaultProps.onRun).toHaveBeenCalledTimes(1);
  });

  it("disables Run button when readOnly is true", () => {
    render(<SQLEditor {...defaultProps} readOnly />);
    expect(screen.getByTestId("run-button")).toBeDisabled();
  });

  it("enables Run button when readOnly is false", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(screen.getByTestId("run-button")).not.toBeDisabled();
  });

  // --- onChange ---

  it("calls onChange when editor value changes", () => {
    render(<SQLEditor {...defaultProps} />);
    expect(mocks.onChangeHandler).not.toBeNull();
    mocks.onChangeHandler?.("SELECT 1");
    expect(defaultProps.onChange).toHaveBeenCalledWith("SELECT 1");
  });

  it("calls onChange with empty string when value is undefined", () => {
    render(<SQLEditor {...defaultProps} />);
    mocks.onChangeHandler?.(undefined);
    expect(defaultProps.onChange).toHaveBeenCalledWith("");
  });

  // --- onMount (Ctrl+Enter keybinding + completions) ---

  it("registers run-query action on mount", () => {
    const addAction = vi.fn();
    const mockEditor = { addAction };
    const mockMonaco = createMockMonaco();

    render(<SQLEditor {...defaultProps} />);
    expect(mocks.onMountHandler).not.toBeNull();
    mocks.onMountHandler?.(mockEditor, mockMonaco);

    expect(addAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "run-query",
        label: "Run Query",
        keybindings: [2048 | 3],
      }),
    );
  });

  it("calls onRun when run-query action is triggered", () => {
    const addAction = vi.fn();
    const mockEditor = { addAction };
    const mockMonaco = createMockMonaco();

    render(<SQLEditor {...defaultProps} />);
    mocks.onMountHandler?.(mockEditor, mockMonaco);

    const actionCalls = addAction.mock.calls as unknown[][];
    const actionDef = actionCalls[0][0] as { run: () => void };
    actionDef.run();
    expect(defaultProps.onRun).toHaveBeenCalledTimes(1);
  });

  it("registers SQL completion provider on mount", () => {
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = createMockMonaco();

    render(<SQLEditor {...defaultProps} />);
    mocks.onMountHandler?.(mockEditor, mockMonaco);

    expect(mockMonaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
      "sql",
      expect.objectContaining({
        provideCompletionItems: expect.any(Function),
      }),
    );
  });

  it("provides SQL keyword suggestions", () => {
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = createMockMonaco();

    render(<SQLEditor {...defaultProps} />);
    mocks.onMountHandler?.(mockEditor, mockMonaco);

    const provider = getCompletionProvider(mockMonaco.languages.registerCompletionItemProvider);
    const result = getCompletionResult(provider);

    const labels = result.suggestions.map((s) => s.label);
    expect(labels).toContain("SELECT");
    expect(labels).toContain("FROM");
    expect(labels).toContain("WHERE");
    expect(labels).toContain("JOIN");
  });

  it("provides SQL function suggestions with parentheses", () => {
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = createMockMonaco();

    render(<SQLEditor {...defaultProps} />);
    mocks.onMountHandler?.(mockEditor, mockMonaco);

    const provider = getCompletionProvider(mockMonaco.languages.registerCompletionItemProvider);
    const result = getCompletionResult(provider);

    const countSuggestion = result.suggestions.find((s) => s.label === "COUNT");
    expect(countSuggestion).toBeDefined();
    expect(countSuggestion!.insertText).toBe("COUNT()");

    const sumSuggestion = result.suggestions.find((s) => s.label === "SUM");
    expect(sumSuggestion).toBeDefined();
    expect(sumSuggestion!.insertText).toBe("SUM()");
  });

  it("includes all SQL keywords in suggestions", () => {
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = createMockMonaco();

    render(<SQLEditor {...defaultProps} />);
    mocks.onMountHandler?.(mockEditor, mockMonaco);

    const provider = getCompletionProvider(mockMonaco.languages.registerCompletionItemProvider);
    const result = getCompletionResult(provider);

    const labels = result.suggestions.map((s) => s.label);
    for (const kw of SQL_KEYWORDS) {
      expect(labels).toContain(kw);
    }
  });

  it("includes all SQL functions in suggestions", () => {
    const mockEditor = { addAction: vi.fn() };
    const mockMonaco = createMockMonaco();

    render(<SQLEditor {...defaultProps} />);
    mocks.onMountHandler?.(mockEditor, mockMonaco);

    const provider = getCompletionProvider(mockMonaco.languages.registerCompletionItemProvider);
    const result = getCompletionResult(provider);

    const labels = result.suggestions.map((s) => s.label);
    for (const fn of SQL_FUNCTIONS) {
      expect(labels).toContain(fn);
    }
  });

  // --- Value updates ---

  it("updates editor value when prop changes", () => {
    const { rerender } = render(<SQLEditor {...defaultProps} />);
    rerender(<SQLEditor {...defaultProps} value="SELECT 1" />);

    const calls = mocks.Editor.mock.calls as unknown[][];
    const lastCall = calls[calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.value).toBe("SELECT 1");
  });

  it("passes empty string value correctly", () => {
    render(<SQLEditor {...defaultProps} value="" />);
    expect(mocks.Editor).toHaveBeenCalledWith(
      expect.objectContaining({ value: "" }),
    );
  });

  // --- Exports ---

  it("exports SQL_KEYWORDS array", () => {
    expect(SQL_KEYWORDS).toBeInstanceOf(Array);
    expect(SQL_KEYWORDS.length).toBeGreaterThan(0);
    expect(SQL_KEYWORDS).toContain("SELECT");
  });

  it("exports SQL_FUNCTIONS array", () => {
    expect(SQL_FUNCTIONS).toBeInstanceOf(Array);
    expect(SQL_FUNCTIONS.length).toBeGreaterThan(0);
    expect(SQL_FUNCTIONS).toContain("COUNT");
  });
});
