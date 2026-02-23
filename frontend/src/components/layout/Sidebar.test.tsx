import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

function renderSidebar(collapsed = false, onToggle = vi.fn()) {
  return {
    onToggle,
    ...render(
      <MemoryRouter>
        <Sidebar collapsed={collapsed} onToggle={onToggle} />
      </MemoryRouter>
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
});
