import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, TokenPair, ApiError } from '@hazop/types';

/**
 * Storage key for persisted auth state.
 */
const AUTH_STORAGE_KEY = 'hazop-auth';

/**
 * Auth state interface.
 */
interface AuthState {
  /** Currently authenticated user, null if not logged in */
  user: User | null;

  /** JWT tokens for API authentication */
  tokens: TokenPair | null;

  /** Whether an auth operation is in progress */
  isLoading: boolean;

  /** Whether initial auth check has completed */
  isInitialized: boolean;

  /** Last authentication error */
  error: ApiError | null;
}

/**
 * Auth store actions interface.
 */
interface AuthActions {
  /** Set the authenticated user and tokens */
  setAuth: (user: User, tokens: TokenPair) => void;

  /** Update just the access token (after refresh) */
  setAccessToken: (accessToken: string, expiresIn: number) => void;

  /** Clear authentication state (logout) */
  clearAuth: () => void;

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  /** Set error state */
  setError: (error: ApiError | null) => void;

  /** Mark auth as initialized after checking stored tokens */
  setInitialized: () => void;

  /** Get the current access token (for API requests) */
  getAccessToken: () => string | null;

  /** Check if user is authenticated */
  isAuthenticated: () => boolean;

  /** Check if user has a specific role */
  hasRole: (role: User['role'] | User['role'][]) => boolean;

  /** Check if user can perform a role-based action */
  canAccess: (minRole: User['role']) => boolean;
}

/**
 * Complete auth store type.
 */
export type AuthStore = AuthState & AuthActions;

/**
 * Role hierarchy for permission checks.
 * Higher index = more privileges.
 */
const ROLE_HIERARCHY: User['role'][] = ['viewer', 'analyst', 'lead_analyst', 'administrator'];

/**
 * Get the index of a role in the hierarchy.
 */
function getRoleIndex(role: User['role']): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Initial auth state.
 */
const initialState: AuthState = {
  user: null,
  tokens: null,
  isLoading: false,
  isInitialized: false,
  error: null,
};

/**
 * Auth store for managing user authentication state.
 *
 * Features:
 * - Persists tokens to localStorage for session persistence
 * - Provides role-based access control helpers
 * - Manages loading and error states for auth operations
 *
 * @example
 * ```tsx
 * // In a component
 * const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore();
 *
 * // Check authentication
 * if (isAuthenticated()) {
 *   console.log('Logged in as:', user?.name);
 * }
 *
 * // Check role access
 * if (canAccess('lead_analyst')) {
 *   // Show admin features
 * }
 * ```
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,

      // Actions
      setAuth: (user: User, tokens: TokenPair) => {
        set({
          user,
          tokens,
          error: null,
          isLoading: false,
        });
      },

      setAccessToken: (accessToken: string, expiresIn: number) => {
        const currentTokens = get().tokens;
        if (currentTokens) {
          set({
            tokens: {
              ...currentTokens,
              accessToken,
              expiresIn,
            },
          });
        }
      },

      clearAuth: () => {
        set({
          user: null,
          tokens: null,
          error: null,
          isLoading: false,
        });
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      setError: (error: ApiError | null) => {
        set({ error, isLoading: false });
      },

      setInitialized: () => {
        set({ isInitialized: true });
      },

      getAccessToken: () => {
        return get().tokens?.accessToken ?? null;
      },

      isAuthenticated: () => {
        const { user, tokens } = get();
        return user !== null && tokens !== null;
      },

      hasRole: (role: User['role'] | User['role'][]) => {
        const user = get().user;
        if (!user) return false;

        if (Array.isArray(role)) {
          return role.includes(user.role);
        }
        return user.role === role;
      },

      canAccess: (minRole: User['role']) => {
        const user = get().user;
        if (!user) return false;

        const userRoleIndex = getRoleIndex(user.role);
        const minRoleIndex = getRoleIndex(minRole);
        return userRoleIndex >= minRoleIndex;
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist user and tokens, not loading/error state
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
      }),
      // On rehydration, mark as initialized
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setInitialized();
        }
      },
    }
  )
);

/**
 * Selector for getting just the user.
 */
export const selectUser = (state: AuthStore) => state.user;

/**
 * Selector for getting authentication status.
 */
export const selectIsAuthenticated = (state: AuthStore) =>
  state.user !== null && state.tokens !== null;

/**
 * Selector for getting loading state.
 */
export const selectIsLoading = (state: AuthStore) => state.isLoading;

/**
 * Selector for getting error state.
 */
export const selectError = (state: AuthStore) => state.error;

/**
 * Selector for getting initialization status.
 */
export const selectIsInitialized = (state: AuthStore) => state.isInitialized;
