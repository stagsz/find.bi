import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const loginRes = await api.post<{ access_token: string }>(
        "/api/auth/login",
        { email, password },
      );
      setAccessToken(loginRes.data.access_token);

      const meRes = await api.get<User>("/api/auth/me");
      setUser(meRes.data);
    } catch (err) {
      clearAccessToken();
      setUser(null);
      throw new Error(extractErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
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

        const loginRes = await api.post<{ access_token: string }>(
          "/api/auth/login",
          { email, password },
        );
        setAccessToken(loginRes.data.access_token);

        const meRes = await api.get<User>("/api/auth/me");
        setUser(meRes.data);
      } catch (err) {
        clearAccessToken();
        setUser(null);
        throw new Error(extractErrorMessage(err, "Registration failed"));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
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
