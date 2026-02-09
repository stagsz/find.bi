import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshTokenResponse,
  ApiResult,
} from '@hazop/types';
import { api } from './api.client';
import { useAuthStore } from '../store/auth.store';

/**
 * Auth service for handling authentication operations.
 *
 * This service wraps the API client and manages the auth store state
 * for login, registration, logout, and token refresh operations.
 */
export const authService = {
  /**
   * Log in a user with email and password.
   *
   * @param credentials - Login credentials
   * @returns Promise resolving to the API result
   */
  async login(credentials: LoginRequest): Promise<ApiResult<AuthResponse>> {
    const store = useAuthStore.getState();
    store.setLoading(true);
    store.setError(null);

    const result = await api.post<AuthResponse>('/auth/login', credentials, {
      authenticated: false,
    });

    if (result.success) {
      store.setAuth(result.data.user, result.data.tokens);
    } else {
      store.setError(result.error);
    }

    return result;
  },

  /**
   * Register a new user.
   *
   * @param registration - Registration data
   * @returns Promise resolving to the API result
   */
  async register(registration: RegisterRequest): Promise<ApiResult<AuthResponse>> {
    const store = useAuthStore.getState();
    store.setLoading(true);
    store.setError(null);

    const result = await api.post<AuthResponse>('/auth/register', registration, {
      authenticated: false,
    });

    if (result.success) {
      store.setAuth(result.data.user, result.data.tokens);
    } else {
      store.setError(result.error);
    }

    return result;
  },

  /**
   * Log out the current user.
   *
   * Clears local auth state and invalidates the refresh token on the server.
   * If the server call fails, local state is still cleared.
   *
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    const store = useAuthStore.getState();
    const refreshToken = store.tokens?.refreshToken;

    // Clear local state immediately for better UX
    store.clearAuth();

    // Attempt to invalidate refresh token on server
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken }, { authenticated: false });
      } catch {
        // Ignore errors - local logout is the priority
      }
    }
  },

  /**
   * Refresh the access token.
   *
   * @returns Promise resolving to the API result
   */
  async refreshToken(): Promise<ApiResult<RefreshTokenResponse>> {
    const store = useAuthStore.getState();
    const refreshToken = store.tokens?.refreshToken;

    if (!refreshToken) {
      return {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'No refresh token available',
        },
      };
    }

    const result = await api.post<RefreshTokenResponse>(
      '/auth/refresh',
      { refreshToken },
      { authenticated: false }
    );

    if (result.success) {
      store.setAccessToken(result.data.accessToken, result.data.expiresIn);
    }

    return result;
  },

  /**
   * Check if the current session is valid.
   *
   * Attempts to refresh the token if stored tokens exist.
   * Called on app initialization to restore session.
   *
   * @returns Promise resolving to true if session is valid
   */
  async validateSession(): Promise<boolean> {
    const store = useAuthStore.getState();

    // Wait for hydration if not initialized
    if (!store.isInitialized) {
      // Give zustand persist a moment to hydrate
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!store.tokens?.refreshToken) {
      store.setInitialized();
      return false;
    }

    // Attempt to refresh the token to verify session
    const result = await authService.refreshToken();
    store.setInitialized();

    if (!result.success) {
      // Invalid refresh token, clear auth state
      store.clearAuth();
      return false;
    }

    return true;
  },
};
