import type { ApiResult, ApiError } from '@hazop/types';
import { useAuthStore } from '../store/auth.store';

/**
 * API base URL - configurable via environment variable.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Default request timeout in milliseconds.
 */
const REQUEST_TIMEOUT = 30000;

/**
 * HTTP methods supported by the API client.
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Request options for API calls.
 */
interface RequestOptions {
  /** HTTP method */
  method?: HttpMethod;

  /** Request body (will be JSON stringified) */
  body?: unknown;

  /** Additional headers */
  headers?: Record<string, string>;

  /** Whether to include auth token (defaults to true) */
  authenticated?: boolean;

  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Create an AbortController with timeout.
 */
function createTimeoutController(timeout: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
}

/**
 * Build request headers.
 */
function buildHeaders(options: RequestOptions, accessToken: string | null): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  });

  if (options.authenticated !== false && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return headers;
}

/**
 * Parse API error from response.
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const data = await response.json();
    if (data.error) {
      return data.error as ApiError;
    }
    return {
      code: 'INTERNAL_ERROR',
      message: data.message || 'An unexpected error occurred',
    };
  } catch {
    return {
      code: 'INTERNAL_ERROR',
      message: `HTTP ${response.status}: ${response.statusText}`,
    };
  }
}

/**
 * Core fetch wrapper for API requests.
 *
 * Features:
 * - Automatic JSON serialization/parsing
 * - Auth token injection
 * - Request timeout handling
 * - Standardized error handling
 * - Token refresh on 401 (when refresh token available)
 *
 * @param endpoint - API endpoint path (e.g., '/auth/login')
 * @param options - Request options
 * @returns Promise resolving to ApiResult<T>
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const { method = 'GET', body, authenticated = true, timeout = REQUEST_TIMEOUT } = options;

  const accessToken = authenticated ? useAuthStore.getState().getAccessToken() : null;

  const controller = createTimeoutController(timeout);
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(options, accessToken),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    // Handle 401 Unauthorized - attempt token refresh
    if (response.status === 401 && authenticated) {
      const refreshResult = await attemptTokenRefresh();
      if (refreshResult) {
        // Retry the original request with new token
        const retryResponse = await fetch(url, {
          method,
          headers: buildHeaders(options, useAuthStore.getState().getAccessToken()),
          body: body ? JSON.stringify(body) : undefined,
          signal: createTimeoutController(timeout).signal,
        });

        if (retryResponse.ok) {
          const data = await retryResponse.json();
          return data as ApiResult<T>;
        }
        // Retry also failed, clear auth and return error
        useAuthStore.getState().clearAuth();
        return {
          success: false,
          error: await parseErrorResponse(retryResponse),
        };
      }
      // Refresh failed, clear auth
      useAuthStore.getState().clearAuth();
      return {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Session expired. Please log in again.',
        },
      };
    }

    // Handle other error responses
    if (!response.ok) {
      return {
        success: false,
        error: await parseErrorResponse(response),
      };
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { success: true, data: null as T };
    }

    // Parse successful response
    const data = await response.json();
    return data as ApiResult<T>;
  } catch (error) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Request timed out. Please try again.',
        },
      };
    }

    // Handle network errors
    return {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unable to connect to the server. Please check your connection.',
      },
    };
  }
}

/**
 * Attempt to refresh the access token using the refresh token.
 * @returns true if refresh succeeded, false otherwise
 */
async function attemptTokenRefresh(): Promise<boolean> {
  const tokens = useAuthStore.getState().tokens;
  if (!tokens?.refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    if (result.success && result.data) {
      useAuthStore.getState().setAccessToken(result.data.accessToken, result.data.expiresIn);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Convenience methods for common HTTP verbs.
 */
export const api = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  /**
   * Upload a file using multipart/form-data.
   *
   * @param endpoint - API endpoint path (e.g., '/projects/:id/documents')
   * @param formData - FormData containing the file
   * @param options - Request options (excluding method and body)
   * @returns Promise resolving to ApiResult<T>
   */
  upload: <T>(
    endpoint: string,
    formData: FormData,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ) => uploadFile<T>(endpoint, formData, options),
};

/**
 * Upload a file using multipart/form-data.
 * Does not set Content-Type header (browser sets it with boundary).
 */
async function uploadFile<T>(
  endpoint: string,
  formData: FormData,
  options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<ApiResult<T>> {
  const { authenticated = true, timeout = REQUEST_TIMEOUT } = options;

  const accessToken = authenticated ? useAuthStore.getState().getAccessToken() : null;

  const controller = createTimeoutController(timeout);
  const url = `${API_BASE_URL}${endpoint}`;

  // Build headers without Content-Type (browser sets it for FormData)
  const headers = new Headers({
    Accept: 'application/json',
    ...options.headers,
  });

  if (authenticated && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    // Handle 401 Unauthorized - attempt token refresh
    if (response.status === 401 && authenticated) {
      const refreshResult = await attemptTokenRefresh();
      if (refreshResult) {
        // Retry the original request with new token
        const retryHeaders = new Headers({
          Accept: 'application/json',
          ...options.headers,
        });
        retryHeaders.set('Authorization', `Bearer ${useAuthStore.getState().getAccessToken()}`);

        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: retryHeaders,
          body: formData,
          signal: createTimeoutController(timeout).signal,
        });

        if (retryResponse.ok) {
          const data = await retryResponse.json();
          return data as ApiResult<T>;
        }
        // Retry also failed, clear auth and return error
        useAuthStore.getState().clearAuth();
        return {
          success: false,
          error: await parseErrorResponse(retryResponse),
        };
      }
      // Refresh failed, clear auth
      useAuthStore.getState().clearAuth();
      return {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Session expired. Please log in again.',
        },
      };
    }

    // Handle other error responses
    if (!response.ok) {
      return {
        success: false,
        error: await parseErrorResponse(response),
      };
    }

    // Parse successful response
    const data = await response.json();
    return data as ApiResult<T>;
  } catch (error) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Request timed out. Please try again.',
        },
      };
    }

    // Handle network errors
    return {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unable to connect to the server. Please check your connection.',
      },
    };
  }
}
