import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TopBar from "./TopBar";

function renderTopBar(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TopBar />
    </MemoryRouter>
  );
}

describe("TopBar", () => {
  it("shows Home title on root route", () => {
    renderTopBar("/");
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("shows SQL Editor title on editor route", () => {
    renderTopBar("/editor");
    expect(screen.getByText("SQL Editor")).toBeInTheDocument();
  });

  it("shows Upload Data title on upload route", () => {
    renderTopBar("/upload");
    expect(screen.getByText("Upload Data")).toBeInTheDocument();
  });

  it("shows Dashboard title on dashboard route", () => {
    renderTopBar("/dashboard/abc-123");
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
