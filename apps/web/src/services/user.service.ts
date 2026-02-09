import type { User, UpdateUserPayload, ApiResult } from '@hazop/types';
import { api } from './api.client';
import { useAuthStore } from '../store/auth.store';

/**
 * Response type for user profile operations.
 */
interface UserProfileResponse {
  user: User;
}

/**
 * User service for handling user profile operations.
 *
 * This service wraps the API client and manages the auth store state
 * for profile retrieval and updates.
 */
export const userService = {
  /**
   * Get the current user's profile.
   *
   * @returns Promise resolving to the API result with user data
   */
  async getProfile(): Promise<ApiResult<UserProfileResponse>> {
    const store = useAuthStore.getState();
    store.setLoading(true);
    store.setError(null);

    const result = await api.get<UserProfileResponse>('/users/me');

    store.setLoading(false);

    if (!result.success) {
      store.setError(result.error);
    }

    return result;
  },

  /**
   * Update the current user's profile.
   *
   * @param data - Profile update data (name, email, organization)
   * @returns Promise resolving to the API result with updated user
   */
  async updateProfile(data: UpdateUserPayload): Promise<ApiResult<UserProfileResponse>> {
    const store = useAuthStore.getState();
    store.setLoading(true);
    store.setError(null);

    const result = await api.put<UserProfileResponse>('/users/me', data);

    if (result.success) {
      // Update the user in the auth store with the new profile data
      const currentTokens = store.tokens;
      if (currentTokens) {
        store.setAuth(result.data.user, currentTokens);
      }
    } else {
      store.setError(result.error);
    }

    store.setLoading(false);

    return result;
  },
};
