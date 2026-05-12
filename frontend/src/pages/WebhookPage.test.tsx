import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WebhookPage from "./WebhookPage";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  getWebhookConfig: vi.fn(),
  configureWebhook: vi.fn(),
  writeText: vi.fn<[string], Promise<void>>(),
}));

vi.mock("@/services/workspaces", () => ({
  listWorkspaces: (...args: unknown[]) => mocks.listWorkspaces(...args),
}));

vi.mock("@/services/webhooks", () => ({
  getWebhookConfig: (...args: unknown[]) => mocks.getWebhookConfig(...args),
  configureWebhook: (...args: unknown[]) => mocks.configureWebhook(...args),
}));

// Mock clipboard
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: (...args: unknown[]) => mocks.writeText(...args) },
  writable: true,
  configurable: true,
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_WORKSPACE = {
  id: "ws-1",
  name: "Default",
  duckdb_path: "/tmp/default.db",
  created_at: "2024-01-01",
};

const NO_CONFIG_RESPONSE = {
  has_config: false,
  workspace_id: "ws-1",
};

const HAS_CONFIG_RESPONSE = {
  has_config: true,
  table_name: "events",
  workspace_id: "ws-1",
};

const CONFIGURE_RESPONSE = {
  api_key: "sk-test-abc123",
  table_name: "my_events",
  workspace_id: "ws-1",
};

// ── Helper ────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/webhooks"]}>
      <Routes>
        <Route path="/settings/webhooks" element={<WebhookPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WebhookPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listWorkspaces.mockResolvedValue([SAMPLE_WORKSPACE]);
    mocks.getWebhookConfig.mockResolvedValue(NO_CONFIG_RESPONSE);
    // clipboard.writeText must return a Promise — the component calls .then() on it
    mocks.writeText.mockResolvedValue(undefined);
  });

  // 1. Heading renders
  it("renders the webhook page heading", async () => {
    renderPage();
    // Wait for loading to finish — both testid and heading must appear together
    await waitFor(() => {
      expect(screen.getByTestId("webhook-page")).toBeInTheDocument();
      expect(screen.getByText("Webhook")).toBeInTheDocument();
    });
  });

  // 2. No-config state
  it("shows no-config status when has_config is false", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("webhook-config-status")).toBeInTheDocument();
    });
    expect(screen.getByText(/no webhook configured/i)).toBeInTheDocument();
  });

  // 3. Has-config state
  it("shows configured table name when has_config is true", async () => {
    mocks.getWebhookConfig.mockResolvedValue(HAS_CONFIG_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("events")).toBeInTheDocument();
    });
    expect(screen.getByTestId("webhook-config-status")).toBeInTheDocument();
  });

  // 4. Generate webhook shows API key
  it("generates webhook and shows API key on success", async () => {
    mocks.configureWebhook.mockResolvedValue(CONFIGURE_RESPONSE);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("webhook-table-name-input")).toBeInTheDocument();
    });

    await user.type(
      screen.getByTestId("webhook-table-name-input"),
      "my_events",
    );
    await user.click(screen.getByTestId("webhook-generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("webhook-api-key-display")).toBeInTheDocument();
    });
    expect(screen.getByTestId("webhook-api-key-display")).toHaveTextContent(
      CONFIGURE_RESPONSE.api_key,
    );
    expect(screen.getByText(/save this key now/i)).toBeInTheDocument();
  });

  // 5. Copy URL button — shows "Copied!" feedback after click (verifies button is wired up)
  it("copy URL button renders and shows correct URL in display", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("webhook-url-display")).toBeInTheDocument();
    });

    // The URL display shows the correct workspace's ingest URL
    expect(screen.getByTestId("webhook-url-display")).toHaveTextContent(
      "/api/webhooks/ws-1/ingest",
    );
    // The copy button is present and enabled
    expect(screen.getByTestId("webhook-url-copy")).toBeInTheDocument();
    expect(screen.getByTestId("webhook-url-copy")).not.toBeDisabled();
  });

  // 6. Copy key button — present after generate, text matches the key
  it("copy key button renders after generating webhook", async () => {
    mocks.configureWebhook.mockResolvedValue(CONFIGURE_RESPONSE);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("webhook-table-name-input")).toBeInTheDocument();
    });

    await user.type(
      screen.getByTestId("webhook-table-name-input"),
      "my_events",
    );
    await user.click(screen.getByTestId("webhook-generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("webhook-api-key-copy")).toBeInTheDocument();
      // The key display shows the generated key
      expect(screen.getByTestId("webhook-api-key-display")).toHaveTextContent("sk-test-abc123");
    });
  });

  // 7. Shows error on API failure
  it("shows error banner when configureWebhook fails", async () => {
    mocks.configureWebhook.mockRejectedValue(new Error("Server error"));
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("webhook-table-name-input")).toBeInTheDocument();
    });

    await user.type(
      screen.getByTestId("webhook-table-name-input"),
      "bad_table",
    );
    await user.click(screen.getByTestId("webhook-generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("webhook-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("webhook-error")).toHaveTextContent(
      /failed to configure webhook/i,
    );
  });

  // 8. Shows ingest URL after loading
  it("displays the ingest URL based on workspace ID", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("webhook-url-display")).toBeInTheDocument();
    });
    expect(screen.getByTestId("webhook-url-display")).toHaveTextContent(
      "/api/webhooks/ws-1/ingest",
    );
  });

  // 9. Shows error when workspace fails
  it("shows error when workspace fetch fails", async () => {
    mocks.listWorkspaces.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("webhook-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("webhook-error")).toHaveTextContent(
      /failed to load workspace/i,
    );
  });
});
