import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AlertsPage from "./AlertsPage";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/services/workspaces", () => ({
  listWorkspaces: (...args: unknown[]) => mocks.listWorkspaces(...args),
}));

vi.mock("@/services/api", () => ({
  default: {
    get: (...args: unknown[]) => mocks.apiGet(...args),
    post: (...args: unknown[]) => mocks.apiPost(...args),
    delete: (...args: unknown[]) => mocks.apiDelete(...args),
    defaults: { baseURL: "http://localhost:8000" },
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WS = { id: "ws-1", name: "Default" };

const SAMPLE_ALERT = {
  id: "a-1",
  name: "High nulls",
  sql_query: "SELECT COUNT(*) FROM t WHERE x IS NULL",
  condition: "gt",
  threshold: 10,
  channel: "browser",
  is_active: true,
  last_triggered_at: null,
  last_value: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/alerts"]}>
      <Routes>
        <Route path="/settings/alerts" element={<AlertsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AlertsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listWorkspaces.mockResolvedValue([WS]);
    mocks.apiGet.mockResolvedValue({ data: [] });
  });

  it("renders alerts page heading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("alerts-page")).toBeInTheDocument();
      expect(screen.getByText("Alerts")).toBeInTheDocument();
    });
  });

  it("shows empty state when no alerts", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no alerts yet/i)).toBeInTheDocument();
    });
  });

  it("shows alert list when alerts exist", async () => {
    mocks.apiGet.mockResolvedValue({ data: [SAMPLE_ALERT] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId(`alert-item-${SAMPLE_ALERT.id}`)).toBeInTheDocument();
    });
    expect(screen.getByText("High nulls")).toBeInTheDocument();
  });

  it("shows add-alert form", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("add-alert-form")).toBeInTheDocument();
    });
    expect(screen.getByTestId("alert-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("alert-sql-input")).toBeInTheDocument();
    expect(screen.getByTestId("save-alert-button")).toBeInTheDocument();
  });

  it("save alert button disabled when name or sql empty", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("save-alert-button")).toBeDisabled();
    });
  });

  it("creates alert and refreshes list", async () => {
    mocks.apiPost.mockResolvedValue({ data: SAMPLE_ALERT });
    mocks.apiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [SAMPLE_ALERT] });
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("alert-name-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("alert-name-input"), "High nulls");
    await user.type(screen.getByTestId("alert-sql-input"), "SELECT COUNT(*) FROM t");
    await user.click(screen.getByTestId("save-alert-button"));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith(
        "/api/alerts/ws-1",
        expect.objectContaining({ name: "High nulls" }),
      );
    });
  });

  it("shows email input when email channel selected", async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("alert-channel-select")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId("alert-channel-select"), "email");
    expect(screen.getByTestId("alert-email-input")).toBeInTheDocument();
  });

  it("shows webhook URL input when webhook channel selected", async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("alert-channel-select")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId("alert-channel-select"), "webhook");
    expect(screen.getByTestId("alert-webhook-url-input")).toBeInTheDocument();
  });

  it("delete alert calls API", async () => {
    mocks.apiGet.mockResolvedValue({ data: [SAMPLE_ALERT] });
    mocks.apiDelete.mockResolvedValue({ data: {} });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId(`delete-alert-${SAMPLE_ALERT.id}`)).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(`delete-alert-${SAMPLE_ALERT.id}`));

    await waitFor(() => {
      expect(mocks.apiDelete).toHaveBeenCalledWith(`/api/alerts/ws-1/${SAMPLE_ALERT.id}`);
    });
  });

  it("evaluate alert shows trigger result", async () => {
    mocks.apiGet.mockResolvedValue({ data: [SAMPLE_ALERT] });
    mocks.apiPost.mockResolvedValue({ data: { triggered: true, value: 15, error: null } });
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId(`evaluate-alert-${SAMPLE_ALERT.id}`)).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(`evaluate-alert-${SAMPLE_ALERT.id}`));

    await waitFor(() => {
      expect(screen.getByTestId("alert-eval-result")).toBeInTheDocument();
    });
    expect(screen.getByTestId("alert-eval-result")).toHaveTextContent(/triggered/i);
  });
});
