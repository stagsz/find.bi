import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  user: { id: "1", email: "ralph@test.com", display_name: "Ralph" } as {
    id: string;
    email: string;
    display_name: string;
  } | null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mocks.logout,
  }),
}));

import Sidebar from "./Sidebar";

function renderSidebar(collapsed = false, onToggle = vi.fn()) {
  return {
    onToggle,
    ...render(
      <MemoryRouter>
        <Sidebar collapsed={collapsed} onToggle={onToggle} />
      </MemoryRouter>,
    ),
  };
}

describe("Sidebar", () => {
  it("renders all navigation items when expanded", () => {
    renderSidebar(false);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Dashboards")).toBeInTheDocument();
    expect(screen.getByText("SQL Editor")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
  });

  it("hides nav labels when collapsed", () => {
    renderSidebar(true);
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboards")).not.toBeInTheDocument();
    expect(screen.queryByText("SQL Editor")).not.toBeInTheDocument();
    expect(screen.queryByText("Upload")).not.toBeInTheDocument();
  });

  it("shows brand text when expanded", () => {
    renderSidebar(false);
    expect(screen.getByText("find.bi")).toBeInTheDocument();
  });

  it("hides brand text when collapsed", () => {
    renderSidebar(true);
    expect(screen.queryByText("find.bi")).not.toBeInTheDocument();
  });

  it("calls onToggle when toggle button is clicked", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderSidebar(false);

    await user.click(screen.getByLabelText("Collapse sidebar"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows expand label when collapsed", () => {
    renderSidebar(true);
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("renders logout button when expanded", () => {
    renderSidebar(false);
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });

  it("hides logout label when collapsed but shows title", () => {
    renderSidebar(true);
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
    expect(screen.getByTitle("Log out")).toBeInTheDocument();
  });

  it("shows user display name when expanded", () => {
    mocks.user = { id: "1", email: "ralph@test.com", display_name: "Ralph W" };
    renderSidebar(false);
    expect(screen.getByText("Ralph W")).toBeInTheDocument();
  });

  it("calls logout when logout button is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar(false);

    await user.click(screen.getByText("Log out"));
    expect(mocks.logout).toHaveBeenCalledOnce();
  });
});
