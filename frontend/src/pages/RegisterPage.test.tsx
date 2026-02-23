import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RegisterPage from "./RegisterPage";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    register: mocks.register,
    loading: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the register form", () => {
    renderRegister();
    expect(screen.getByText("find.bi")).toBeInTheDocument();
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
  });

  it("has a link to login page", async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByText("Sign in"));
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("shows validation error when fields are empty", async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "All fields are required",
    );
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("shows validation error for short password", async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText("Display name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Password must be at least 6 characters",
    );
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("calls register with all fields on submit", async () => {
    mocks.register.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText("Display name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    expect(mocks.register).toHaveBeenCalledWith(
      "test@test.com",
      "password123",
      "Test User",
    );
  });

  it("navigates to home on successful registration", async () => {
    mocks.register.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText("Display name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("shows error message on failed registration", async () => {
    mocks.register.mockRejectedValueOnce(
      new Error("Email already registered"),
    );
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText("Display name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "taken@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email already registered",
    );
  });
});
