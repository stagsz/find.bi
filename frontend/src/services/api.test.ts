import { describe, it, expect, afterEach } from "vitest";
import { AxiosHeaders } from "axios";
import api, {
  setAccessToken,
  getAccessToken,
  clearAccessToken,
} from "@/services/api";

describe("api service", () => {
  afterEach(() => {
    clearAccessToken();
  });

  describe("token management", () => {
    it("starts with no token", () => {
      expect(getAccessToken()).toBeNull();
    });

    it("stores and retrieves a token", () => {
      setAccessToken("test-jwt-123");
      expect(getAccessToken()).toBe("test-jwt-123");
    });

    it("clears the token", () => {
      setAccessToken("test-jwt-123");
      clearAccessToken();
      expect(getAccessToken()).toBeNull();
    });
  });

  describe("axios instance", () => {
    it("has the correct base URL", () => {
      expect(api.defaults.baseURL).toBe("http://localhost:8000");
    });

    it("has JSON content type", () => {
      expect(api.defaults.headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("request interceptor", () => {
    it("attaches Authorization header when token is set", async () => {
      setAccessToken("my-jwt");
      const config = await api.interceptors.request.handlers![0].fulfilled!({
        headers: new AxiosHeaders(),
      } as never);

      expect(config.headers.Authorization).toBe("Bearer my-jwt");
    });

    it("does not attach Authorization header when no token", async () => {
      const config = await api.interceptors.request.handlers![0].fulfilled!({
        headers: new AxiosHeaders(),
      } as never);

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe("response interceptor", () => {
    it("clears token on 401 response", async () => {
      setAccessToken("my-jwt");

      const handler = api.interceptors.response.handlers![0].rejected!;
      const error = {
        response: { status: 401 },
        isAxiosError: true,
      };

      await expect(handler(error)).rejects.toBe(error);
      expect(getAccessToken()).toBeNull();
    });

    it("does not clear token on other errors", async () => {
      setAccessToken("my-jwt");

      const handler = api.interceptors.response.handlers![0].rejected!;
      const error = {
        response: { status: 500 },
        isAxiosError: true,
      };

      await expect(handler(error)).rejects.toBe(error);
      expect(getAccessToken()).toBe("my-jwt");
    });
  });
});
