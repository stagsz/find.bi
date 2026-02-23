import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import api, { clearAccessToken, setAccessToken } from "@/services/api";
import type { AxiosError } from "axios";

export interface User {
  id: string;
  email: string;
  display_name: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh the token 2 minutes before expiry. */
const REFRESH_BUFFER_SECONDS = 120;

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<{ detail?: string }>;
  if (axiosErr.response?.data?.detail) {
    return axiosErr.response.data.detail;
  }
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearRefreshTimer() {
    if (refreshTimer.current !== null) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }

  function scheduleRefresh(expiresIn: number) {
    clearRefreshTimer();
    const delaySeconds = Math.max(expiresIn - REFRESH_BUFFER_SECONDS, 10);
    refreshTimer.current = setTimeout(async () => {
      try {
        const res = await api.post<TokenResponse>("/api/auth/refresh");
        setAccessToken(res.data.access_token);
        scheduleRefresh(res.data.expires_in);
      } catch {
        clearAccessToken();
        setUser(null);
      }
    }, delaySeconds * 1000);
  }

  useEffect(() => {
    return () => clearRefreshTimer();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const loginRes = await api.post<TokenResponse>(
        "/api/auth/login",
        { email, password },
      );
      setAccessToken(loginRes.data.access_token);
      scheduleRefresh(loginRes.data.expires_in);

      const meRes = await api.get<User>("/api/auth/me");
      setUser(meRes.data);
    } catch (err) {
      clearRefreshTimer();
      clearAccessToken();
      setUser(null);
      throw new Error(extractErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setLoading(true);
      try {
        await api.post("/api/auth/register", {
          email,
          password,
          display_name: displayName,
        });

        const loginRes = await api.post<TokenResponse>(
          "/api/auth/login",
          { email, password },
        );
        setAccessToken(loginRes.data.access_token);
        scheduleRefresh(loginRes.data.expires_in);

        const meRes = await api.get<User>("/api/auth/me");
        setUser(meRes.data);
      } catch (err) {
        clearRefreshTimer();
        clearAccessToken();
        setUser(null);
        throw new Error(extractErrorMessage(err, "Registration failed"));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const logout = useCallback(() => {
    clearRefreshTimer();
    clearAccessToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
