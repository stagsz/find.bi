import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./LoginPage";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    login: mocks.login,
    loading: false,
    user: null,
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form", () => {
    renderLogin();
    expect(screen.getByText("find.bi")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();
  });

  it("has a link to register page", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByText("Register"));
    expect(screen.getByText("Register Page")).toBeInTheDocument();
  });

  it("shows validation error when fields are empty", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email and password are required",
    );
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("calls login with email and password on submit", async () => {
    mocks.login.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.login).toHaveBeenCalledWith("test@test.com", "password123");
  });

  it("navigates to home on successful login", async () => {
    mocks.login.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("shows error message on failed login", async () => {
    mocks.login.mockRejectedValueOnce(
      new Error("Invalid email or password"),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "bad@test.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
  });
});
