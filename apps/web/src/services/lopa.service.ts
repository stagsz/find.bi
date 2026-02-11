/**
 * LOPA (Layers of Protection Analysis) service.
 *
 * Provides API methods for:
 * - Creating LOPA analyses for analysis entries
 * - Getting LOPA analyses by entry ID
 */

import type {
  LOPAAnalysis,
  InitiatingEventCategory,
  IPLType,
  SafetyIntegrityLevel,
  ApiResult,
} from '@hazop/types';
import { api } from './api.client';

/**
 * IPL input for creating LOPA analysis.
 */
export interface CreateIPLInput {
  type: IPLType;
  name: string;
  description: string;
  pfd: number;
  independentOfInitiator: boolean;
  independentOfOtherIPLs: boolean;
  sil?: SafetyIntegrityLevel;
  notes?: string;
}

/**
 * Payload for creating a LOPA analysis.
 */
export interface CreateLOPAPayload {
  scenarioDescription: string;
  consequence: string;
  initiatingEventCategory: InitiatingEventCategory;
  initiatingEventDescription: string;
  initiatingEventFrequency: number;
  ipls: CreateIPLInput[];
  targetFrequency: number;
  notes?: string;
}

/**
 * Response type for creating a LOPA analysis.
 */
export interface CreateLOPAResponse {
  lopa: LOPAAnalysis;
}

/**
 * Response type for getting a LOPA analysis.
 */
export interface GetLOPAResponse {
  lopa: LOPAAnalysis;
}

/**
 * LOPA service for handling LOPA-related API operations.
 */
export const lopaService = {
  /**
   * Create a LOPA analysis for an analysis entry.
   *
   * @param entryId - The ID of the analysis entry
   * @param data - LOPA creation payload
   * @returns Promise resolving to the API result with created LOPA
   */
  async createLOPA(
    entryId: string,
    data: CreateLOPAPayload
  ): Promise<ApiResult<CreateLOPAResponse>> {
    return api.post<CreateLOPAResponse>(`/entries/${entryId}/lopa`, data);
  },

  /**
   * Get the LOPA analysis for an analysis entry.
   *
   * @param entryId - The ID of the analysis entry
   * @returns Promise resolving to the API result with LOPA analysis
   */
  async getLOPA(entryId: string): Promise<ApiResult<GetLOPAResponse>> {
    return api.get<GetLOPAResponse>(`/entries/${entryId}/lopa`);
  },
};
