import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from './auth.store';
import type { User, TokenPair, ApiError } from '@hazop/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test fixtures
const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  name: 'Test User',
  role: 'analyst',
  organization: 'Test Org',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockTokens: TokenPair = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer',
};

const mockError: ApiError = {
  code: 'AUTHENTICATION_ERROR',
  message: 'Invalid credentials',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      tokens: null,
      isLoading: false,
      isInitialized: false,
      error: null,
    });
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have null user initially', () => {
      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('should have null tokens initially', () => {
      const { tokens } = useAuthStore.getState();
      expect(tokens).toBeNull();
    });

    it('should not be loading initially', () => {
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should not be initialized initially', () => {
      const { isInitialized } = useAuthStore.getState();
      expect(isInitialized).toBe(false);
    });

    it('should have no error initially', () => {
      const { error } = useAuthStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('setAuth', () => {
    it('should set user and tokens', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const { user, tokens } = useAuthStore.getState();
      expect(user).toEqual(mockUser);
      expect(tokens).toEqual(mockTokens);
    });

    it('should clear error when setting auth', () => {
      useAuthStore.setState({ error: mockError });
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const { error } = useAuthStore.getState();
      expect(error).toBeNull();
    });

    it('should set loading to false when setting auth', () => {
      useAuthStore.setState({ isLoading: true });
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });
  });

  describe('setAccessToken', () => {
    it('should update access token when tokens exist', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);
      useAuthStore.getState().setAccessToken('new-access-token', 7200);

      const { tokens } = useAuthStore.getState();
      expect(tokens?.accessToken).toBe('new-access-token');
      expect(tokens?.expiresIn).toBe(7200);
      expect(tokens?.refreshToken).toBe(mockTokens.refreshToken);
    });

    it('should not update if no tokens exist', () => {
      useAuthStore.getState().setAccessToken('new-access-token', 7200);

      const { tokens } = useAuthStore.getState();
      expect(tokens).toBeNull();
    });
  });

  describe('clearAuth', () => {
    it('should clear user and tokens', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);
      useAuthStore.getState().clearAuth();

      const { user, tokens } = useAuthStore.getState();
      expect(user).toBeNull();
      expect(tokens).toBeNull();
    });

    it('should clear error', () => {
      useAuthStore.setState({ error: mockError });
      useAuthStore.getState().clearAuth();

      const { error } = useAuthStore.getState();
      expect(error).toBeNull();
    });

    it('should set loading to false', () => {
      useAuthStore.setState({ isLoading: true });
      useAuthStore.getState().clearAuth();

      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should set loading state to true', () => {
      useAuthStore.getState().setLoading(true);

      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(true);
    });

    it('should set loading state to false', () => {
      useAuthStore.setState({ isLoading: true });
      useAuthStore.getState().setLoading(false);

      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error', () => {
      useAuthStore.getState().setError(mockError);

      const { error } = useAuthStore.getState();
      expect(error).toEqual(mockError);
    });

    it('should clear error when set to null', () => {
      useAuthStore.setState({ error: mockError });
      useAuthStore.getState().setError(null);

      const { error } = useAuthStore.getState();
      expect(error).toBeNull();
    });

    it('should set loading to false when setting error', () => {
      useAuthStore.setState({ isLoading: true });
      useAuthStore.getState().setError(mockError);

      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });
  });

  describe('setInitialized', () => {
    it('should set initialized to true', () => {
      useAuthStore.getState().setInitialized();

      const { isInitialized } = useAuthStore.getState();
      expect(isInitialized).toBe(true);
    });
  });

  describe('getAccessToken', () => {
    it('should return access token when authenticated', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const accessToken = useAuthStore.getState().getAccessToken();
      expect(accessToken).toBe(mockTokens.accessToken);
    });

    it('should return null when not authenticated', () => {
      const accessToken = useAuthStore.getState().getAccessToken();
      expect(accessToken).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user and tokens exist', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const isAuth = useAuthStore.getState().isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it('should return false when user is null', () => {
      useAuthStore.setState({ tokens: mockTokens });

      const isAuth = useAuthStore.getState().isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it('should return false when tokens are null', () => {
      useAuthStore.setState({ user: mockUser });

      const isAuth = useAuthStore.getState().isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it('should return false when both are null', () => {
      const isAuth = useAuthStore.getState().isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has the specified role', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const hasRole = useAuthStore.getState().hasRole('analyst');
      expect(hasRole).toBe(true);
    });

    it('should return false when user does not have the specified role', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const hasRole = useAuthStore.getState().hasRole('administrator');
      expect(hasRole).toBe(false);
    });

    it('should return true when user role is in array of roles', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const hasRole = useAuthStore.getState().hasRole(['analyst', 'lead_analyst']);
      expect(hasRole).toBe(true);
    });

    it('should return false when user role is not in array of roles', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const hasRole = useAuthStore.getState().hasRole(['administrator', 'lead_analyst']);
      expect(hasRole).toBe(false);
    });

    it('should return false when user is null', () => {
      const hasRole = useAuthStore.getState().hasRole('analyst');
      expect(hasRole).toBe(false);
    });
  });

  describe('canAccess', () => {
    it('should return true when user role is equal to minRole', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const canAccess = useAuthStore.getState().canAccess('analyst');
      expect(canAccess).toBe(true);
    });

    it('should return true when user role is higher than minRole', () => {
      const adminUser: User = { ...mockUser, role: 'administrator' };
      useAuthStore.getState().setAuth(adminUser, mockTokens);

      const canAccess = useAuthStore.getState().canAccess('analyst');
      expect(canAccess).toBe(true);
    });

    it('should return false when user role is lower than minRole', () => {
      useAuthStore.getState().setAuth(mockUser, mockTokens);

      const canAccess = useAuthStore.getState().canAccess('lead_analyst');
      expect(canAccess).toBe(false);
    });

    it('should return false when user is null', () => {
      const canAccess = useAuthStore.getState().canAccess('viewer');
      expect(canAccess).toBe(false);
    });

    it('should respect role hierarchy correctly', () => {
      // viewer < analyst < lead_analyst < administrator
      const viewerUser: User = { ...mockUser, role: 'viewer' };
      useAuthStore.getState().setAuth(viewerUser, mockTokens);

      expect(useAuthStore.getState().canAccess('viewer')).toBe(true);
      expect(useAuthStore.getState().canAccess('analyst')).toBe(false);
      expect(useAuthStore.getState().canAccess('lead_analyst')).toBe(false);
      expect(useAuthStore.getState().canAccess('administrator')).toBe(false);
    });
  });
});
