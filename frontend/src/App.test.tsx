import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import App from "./App";

function renderApp() {
  return render(<App />);
}

describe("App", () => {
  it("renders the sidebar with find.bi brand", () => {
    renderApp();
    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).getByText("find.bi")).toBeInTheDocument();
  });

  it("renders the tagline on home page", () => {
    renderApp();
    expect(
      screen.getByText("Your data talks. Ralph listens.")
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
      screen.getByText("Write and execute SQL queries")
    ).toBeInTheDocument();
  });

  it("navigates to Upload page when link is clicked", async () => {
    const user = userEvent.setup();
    renderApp();

    const nav = screen.getByRole("navigation");
    await user.click(within(nav).getByText("Upload"));
    expect(
      screen.getByText("Import CSV, JSON, Parquet, or Excel files")
    ).toBeInTheDocument();
  });
});
