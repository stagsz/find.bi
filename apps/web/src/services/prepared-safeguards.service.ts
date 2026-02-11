/**
 * Prepared Safeguards service for frontend API integration.
 *
 * Provides methods for fetching prepared safeguard answer templates
 * from the backend API. Safeguards are used in HazOps analysis to
 * identify existing protective measures for process deviations.
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
 * Prepared safeguards service for handling prepared safeguard API operations.
 *
 * This service provides methods for:
 * - Listing all prepared safeguards with optional filtering
 * - Getting safeguards by equipment type
 * - Getting safeguards by guide word
 * - Getting safeguards by context (equipment type + guide word)
 * - Searching safeguards by text
 */
export const preparedSafeguardsService = {
  /**
   * List all prepared safeguards with optional filtering.
   *
   * @param options - Filter options (equipmentType, guideWord, commonOnly, search)
   * @returns Promise resolving to the API result with prepared safeguards
   */
  async listSafeguards(options?: {
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
    const endpoint = queryString ? `/prepared-safeguards?${queryString}` : '/prepared-safeguards';

    return api.get<PreparedAnswersResponse>(endpoint, { authenticated: false });
  },

  /**
   * Get prepared safeguards for a specific equipment type.
   *
   * @param equipmentType - The equipment type to filter by
   * @returns Promise resolving to the API result with filtered safeguards
   */
  async getByEquipmentType(
    equipmentType: EquipmentType
  ): Promise<ApiResult<PreparedAnswersFilteredResponse>> {
    return api.get<PreparedAnswersFilteredResponse>(
      `/prepared-safeguards/by-equipment/${equipmentType}`,
      { authenticated: false }
    );
  },

  /**
   * Get prepared safeguards for a specific guide word.
   *
   * @param guideWord - The guide word to filter by
   * @returns Promise resolving to the API result with filtered safeguards
   */
  async getByGuideWord(
    guideWord: GuideWord
  ): Promise<ApiResult<PreparedAnswersFilteredResponse>> {
    return api.get<PreparedAnswersFilteredResponse>(
      `/prepared-safeguards/by-guide-word/${guideWord}`,
      { authenticated: false }
    );
  },

  /**
   * Get prepared safeguards for a specific equipment type and guide word context.
   * This is the primary method for getting context-aware safeguard suggestions.
   *
   * @param equipmentType - The equipment type
   * @param guideWord - The guide word
   * @returns Promise resolving to the API result with filtered safeguards
   */
  async getByContext(
    equipmentType: EquipmentType,
    guideWord: GuideWord
  ): Promise<ApiResult<PreparedAnswersFilteredResponse>> {
    return api.get<PreparedAnswersFilteredResponse>(
      `/prepared-safeguards/context?equipmentType=${equipmentType}&guideWord=${guideWord}`,
      { authenticated: false }
    );
  },

  /**
   * Search prepared safeguards by text.
   *
   * @param searchText - Text to search for
   * @returns Promise resolving to the API result with matching safeguards
   */
  async search(searchText: string): Promise<ApiResult<PreparedAnswersResponse>> {
    return api.get<PreparedAnswersResponse>(
      `/prepared-safeguards/search?q=${encodeURIComponent(searchText)}`,
      { authenticated: false }
    );
  },

  /**
   * Get common/recommended prepared safeguards.
   *
   * @returns Promise resolving to the API result with common safeguards
   */
  async getCommon(): Promise<ApiResult<PreparedAnswersResponse>> {
    return api.get<PreparedAnswersResponse>('/prepared-safeguards/common', { authenticated: false });
  },
};
