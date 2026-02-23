import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: { post: mocks.post, get: mocks.get },
  setAccessToken: mocks.setAccessToken,
  clearAccessToken: mocks.clearAccessToken,
  getAccessToken: vi.fn(),
}));

import { AuthProvider, useAuth } from "./useAuth";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
    spy.mockRestore();
  });

  it("starts with no user and not loading", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  describe("login", () => {
    it("sets user on successful login", async () => {
      mocks.post.mockResolvedValueOnce({
        data: { access_token: "jwt-123", token_type: "bearer", expires_in: 3600 },
      });
      mocks.get.mockResolvedValueOnce({
        data: { id: "1", email: "test@test.com", display_name: "Test" },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login("test@test.com", "password");
      });

      expect(mocks.post).toHaveBeenCalledWith("/api/auth/login", {
        email: "test@test.com",
        password: "password",
      });
      expect(mocks.setAccessToken).toHaveBeenCalledWith("jwt-123");
      expect(mocks.get).toHaveBeenCalledWith("/api/auth/me");
      expect(result.current.user).toEqual({
        id: "1",
        email: "test@test.com",
        display_name: "Test",
      });
      expect(result.current.loading).toBe(false);
    });

    it("clears state and throws on failed login", async () => {
      mocks.post.mockRejectedValueOnce({
        response: { data: { detail: "Invalid email or password" } },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let error: Error | undefined;
      await act(async () => {
        try {
          await result.current.login("bad@test.com", "wrong");
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error?.message).toBe("Invalid email or password");
      expect(mocks.clearAccessToken).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("schedules token refresh after login", async () => {
      mocks.post.mockResolvedValueOnce({
        data: { access_token: "jwt-123", token_type: "bearer", expires_in: 3600 },
      });
      mocks.get.mockResolvedValueOnce({
        data: { id: "1", email: "test@test.com", display_name: "Test" },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login("test@test.com", "password");
      });

      // Refresh should be scheduled for expires_in - 120 = 3480 seconds
      mocks.post.mockResolvedValueOnce({
        data: { access_token: "jwt-refreshed", token_type: "bearer", expires_in: 3600 },
      });

      await act(async () => {
        vi.advanceTimersByTime(3480 * 1000);
      });

      expect(mocks.post).toHaveBeenCalledWith("/api/auth/refresh");
      expect(mocks.setAccessToken).toHaveBeenCalledWith("jwt-refreshed");
    });

    it("logs out user when token refresh fails", async () => {
      mocks.post.mockResolvedValueOnce({
        data: { access_token: "jwt-123", token_type: "bearer", expires_in: 3600 },
      });
      mocks.get.mockResolvedValueOnce({
        data: { id: "1", email: "test@test.com", display_name: "Test" },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login("test@test.com", "password");
      });

      expect(result.current.user).not.toBeNull();

      // Refresh fails
      mocks.post.mockRejectedValueOnce(new Error("Token expired"));

      await act(async () => {
        vi.advanceTimersByTime(3480 * 1000);
      });

      expect(mocks.clearAccessToken).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });
  });

  describe("register", () => {
    it("registers and auto-logs in user", async () => {
      mocks.post
        .mockResolvedValueOnce({
          data: { id: "1", email: "new@test.com", display_name: "New" },
        })
        .mockResolvedValueOnce({
          data: { access_token: "jwt-456", token_type: "bearer", expires_in: 3600 },
        });
      mocks.get.mockResolvedValueOnce({
        data: { id: "1", email: "new@test.com", display_name: "New" },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.register("new@test.com", "password", "New");
      });

      expect(mocks.post).toHaveBeenCalledWith("/api/auth/register", {
        email: "new@test.com",
        password: "password",
        display_name: "New",
      });
      expect(mocks.post).toHaveBeenCalledWith("/api/auth/login", {
        email: "new@test.com",
        password: "password",
      });
      expect(mocks.setAccessToken).toHaveBeenCalledWith("jwt-456");
      expect(result.current.user).toEqual({
        id: "1",
        email: "new@test.com",
        display_name: "New",
      });
    });

    it("clears state and throws on failed registration", async () => {
      mocks.post.mockRejectedValueOnce({
        response: { data: { detail: "Email already registered" } },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let error: Error | undefined;
      await act(async () => {
        try {
          await result.current.register("taken@test.com", "pass", "Taken");
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error?.message).toBe("Email already registered");
      expect(mocks.clearAccessToken).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });
  });

  describe("logout", () => {
    it("clears user, token, and refresh timer", async () => {
      mocks.post.mockResolvedValueOnce({
        data: { access_token: "jwt-123", token_type: "bearer", expires_in: 3600 },
      });
      mocks.get.mockResolvedValueOnce({
        data: { id: "1", email: "test@test.com", display_name: "Test" },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login("test@test.com", "password");
      });
      expect(result.current.user).not.toBeNull();

      act(() => {
        result.current.logout();
      });

      expect(mocks.clearAccessToken).toHaveBeenCalled();
      expect(result.current.user).toBeNull();

      // Advance past where refresh would have fired — should NOT trigger
      mocks.post.mockClear();
      await act(async () => {
        vi.advanceTimersByTime(3600 * 1000);
      });
      expect(mocks.post).not.toHaveBeenCalled();
    });
  });
});
