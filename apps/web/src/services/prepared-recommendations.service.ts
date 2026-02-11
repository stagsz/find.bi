/**
 * Prepared Recommendations service for frontend API integration.
 *
 * Provides methods for fetching prepared recommendation answer templates
 * from the backend API. Recommendations are used in HazOps analysis to
 * suggest actions to mitigate process deviations.
 */

import type {
  PreparedAnswersResponse,
  PreparedAnswersFilteredResponse,
  GuideWord,
  EquipmentType,
  ApiResult,
} from '@hazop/types';
import { api } from './api.client';

/**
 * Prepared recommendations service for handling prepared recommendation API operations.
 *
 * This service provides methods for:
 * - Listing all prepared recommendations with optional filtering
 * - Getting recommendations by equipment type
 * - Getting recommendations by guide word
 * - Getting recommendations by context (equipment type + guide word)
 * - Searching recommendations by text
 */
export const preparedRecommendationsService = {
  /**
   * List all prepared recommendations with optional filtering.
   *
   * @param options - Filter options (equipmentType, guideWord, commonOnly, search)
   * @returns Promise resolving to the API result with prepared recommendations
   */
  async listRecommendations(options?: {
    equipmentType?: EquipmentType;
    guideWord?: GuideWord;
    commonOnly?: boolean;
    search?: string;
  }): Promise<ApiResult<PreparedAnswersResponse>> {
    const params = new URLSearchParams();
    if (options?.equipmentType) params.set('equipmentType', options.equipmentType);
    if (options?.guideWord) params.set('guideWord', options.guideWord);
    if (options?.commonOnly) params.set('commonOnly', 'true');
    if (options?.search) params.set('search', options.search);

    const queryString = params.toString();
    const endpoint = queryString ? `/prepared-recommendations?${queryString}` : '/prepared-recommendations';

    return api.get<PreparedAnswersResponse>(endpoint, { authenticated: false });
  },

  /**
   * Get prepared recommendations for a specific equipment type.
   *
   * @param equipmentType - The equipment type to filter by
   * @returns Promise resolving to the API result with filtered recommendations
   */
  async getByEquipmentType(
    equipmentType: EquipmentType
  ): Promise<ApiResult<PreparedAnswersFilteredResponse>> {
    return api.get<PreparedAnswersFilteredResponse>(
      `/prepared-recommendations/by-equipment/${equipmentType}`,
      { authenticated: false }
    );
  },

  /**
   * Get prepared recommendations for a specific guide word.
   *
   * @param guideWord - The guide word to filter by
   * @returns Promise resolving to the API result with filtered recommendations
   */
  async getByGuideWord(
    guideWord: GuideWord
  ): Promise<ApiResult<PreparedAnswersFilteredResponse>> {
    return api.get<PreparedAnswersFilteredResponse>(
      `/prepared-recommendations/by-guide-word/${guideWord}`,
      { authenticated: false }
    );
  },

  /**
   * Get prepared recommendations for a specific equipment type and guide word context.
   * This is the primary method for getting context-aware recommendation suggestions.
   *
   * @param equipmentType - The equipment type
   * @param guideWord - The guide word
   * @returns Promise resolving to the API result with filtered recommendations
   */
  async getByContext(
    equipmentType: EquipmentType,
    guideWord: GuideWord
  ): Promise<ApiResult<PreparedAnswersFilteredResponse>> {
    return api.get<PreparedAnswersFilteredResponse>(
      `/prepared-recommendations/context?equipmentType=${equipmentType}&guideWord=${guideWord}`,
      { authenticated: false }
    );
  },

  /**
   * Search prepared recommendations by text.
   *
   * @param searchText - Text to search for
   * @returns Promise resolving to the API result with matching recommendations
   */
  async search(searchText: string): Promise<ApiResult<PreparedAnswersResponse>> {
    return api.get<PreparedAnswersResponse>(
      `/prepared-recommendations/search?q=${encodeURIComponent(searchText)}`,
      { authenticated: false }
    );
  },

  /**
   * Get common/recommended prepared recommendations.
   *
   * @returns Promise resolving to the API result with common recommendations
   */
  async getCommon(): Promise<ApiResult<PreparedAnswersResponse>> {
    return api.get<PreparedAnswersResponse>('/prepared-recommendations/common', { authenticated: false });
  },
};
