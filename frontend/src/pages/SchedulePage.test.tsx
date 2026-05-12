import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SchedulePage from "./SchedulePage";

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

const SAMPLE_JOB = {
  job_id: "ws-1::sales::0 9 * * *",
  name: "ws-1::sales::0 9 * * *",
  next_run_time: "2024-06-01T09:00:00+00:00",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/schedules"]}>
      <Routes>
        <Route path="/settings/schedules" element={<SchedulePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SchedulePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listWorkspaces.mockResolvedValue([WS]);
    mocks.apiGet.mockResolvedValue({ data: [] });
  });

  it("renders schedule page heading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("schedule-page")).toBeInTheDocument();
      expect(screen.getByText("Schedules")).toBeInTheDocument();
    });
  });

  it("shows empty state when no jobs", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no scheduled jobs yet/i)).toBeInTheDocument();
    });
  });

  it("shows job list when jobs exist", async () => {
    mocks.apiGet.mockResolvedValue({ data: [SAMPLE_JOB] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId(`schedule-item-${SAMPLE_JOB.job_id}`)).toBeInTheDocument();
    });
  });

  it("shows add-schedule form", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("add-schedule-form")).toBeInTheDocument();
    });
    expect(screen.getByTestId("schedule-table-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("schedule-preset-select")).toBeInTheDocument();
    expect(screen.getByTestId("add-schedule-button")).toBeInTheDocument();
  });

  it("add schedule button disabled when table name empty", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("add-schedule-button")).toBeDisabled();
    });
  });

  it("add schedule calls API and refreshes list", async () => {
    mocks.apiPost.mockResolvedValue({ data: { job_id: "new-job", name: "new-job", next_run_time: null } });
    mocks.apiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [SAMPLE_JOB] });
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("schedule-table-name-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("schedule-table-name-input"), "sales");
    await user.click(screen.getByTestId("add-schedule-button"));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith(
        "/api/scheduler/ws-1/jobs",
        expect.objectContaining({ table_name: "sales" }),
      );
    });
  });

  it("delete schedule calls API", async () => {
    mocks.apiGet.mockResolvedValue({ data: [SAMPLE_JOB] });
    mocks.apiDelete.mockResolvedValue({ data: {} });
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId(`delete-schedule-${SAMPLE_JOB.job_id}`)).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(`delete-schedule-${SAMPLE_JOB.job_id}`));

    await waitFor(() => {
      expect(mocks.apiDelete).toHaveBeenCalled();
    });
  });
});
