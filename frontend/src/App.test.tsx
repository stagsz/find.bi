import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string; display_name: string } | null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    login: mocks.login,
    register: mocks.register,
    logout: mocks.logout,
  }),
}));

import App from "./App";

function renderApp() {
  return render(<App />);
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
  });

  describe("when not authenticated", () => {
    beforeEach(() => {
      mocks.user = null;
    });

    it("redirects to login page", () => {
      renderApp();
      expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    });
  });

  describe("when authenticated", () => {
    beforeEach(() => {
      mocks.user = { id: "1", email: "ralph@test.com", display_name: "Ralph" };
    });

    it("renders the sidebar with find.bi brand", () => {
      renderApp();
      const sidebar = screen.getByRole("complementary");
      expect(within(sidebar).getByText("find.bi")).toBeInTheDocument();
    });

    it("renders the tagline on home page", () => {
      renderApp();
      expect(
        screen.getByText("Your data talks. Ralph listens."),
      ).toBeInTheDocument();
    });

    it("renders navigation links in sidebar", () => {
      renderApp();
      const nav = screen.getByRole("navigation");
      expect(within(nav).getByText("Home")).toBeInTheDocument();
      expect(within(nav).getByText("Dashboards")).toBeInTheDocument();
      expect(within(nav).getByText("SQL Editor")).toBeInTheDocument();
      expect(within(nav).getByText("Upload")).toBeInTheDocument();
    });

    it("renders logout button in sidebar", () => {
      renderApp();
      const sidebar = screen.getByRole("complementary");
      expect(within(sidebar).getByText("Log out")).toBeInTheDocument();
    });

    it("renders user display name in sidebar", () => {
      renderApp();
      const sidebar = screen.getByRole("complementary");
      expect(within(sidebar).getByText("Ralph")).toBeInTheDocument();
    });

    it("collapses sidebar when toggle button is clicked", async () => {
      const user = userEvent.setup();
      renderApp();

      const toggleButton = screen.getByLabelText("Collapse sidebar");
      await user.click(toggleButton);

      const nav = screen.getByRole("navigation");
      expect(within(nav).queryByText("Home")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    });

    it("navigates to SQL Editor page when link is clicked", async () => {
      const user = userEvent.setup();
      renderApp();

      const nav = screen.getByRole("navigation");
      await user.click(within(nav).getByText("SQL Editor"));
      expect(
        screen.getByText("Write and execute SQL queries"),
      ).toBeInTheDocument();
    });

    it("navigates to Upload page when link is clicked", async () => {
      const user = userEvent.setup();
      renderApp();

      const nav = screen.getByRole("navigation");
      await user.click(within(nav).getByText("Upload"));
      expect(
        screen.getByText("Import CSV, JSON, Parquet, or Excel files"),
      ).toBeInTheDocument();
    });
  });
});
