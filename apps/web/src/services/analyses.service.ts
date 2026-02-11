import type {
  HazopsAnalysisWithDetails,
  HazopsAnalysisWithDetailsAndProgress,
  AnalysisEntry,
  AnalysisStatus,
  GuideWord,
  ApiResult,
  PaginationMeta,
  CreateHazopsAnalysisPayload,
  UpdateHazopsAnalysisPayload,
} from '@hazop/types';
import { api } from './api.client';

/**
 * Analysis item in list response with additional details.
 */
export interface AnalysisListItem extends HazopsAnalysisWithDetails {
  /** Total number of entries in this analysis */
  entryCount: number;
}

/**
 * Response type for listing analyses.
 */
export interface ListAnalysesResponse {
  data: AnalysisListItem[];
  meta: PaginationMeta;
}

/**
 * Response type for getting a single analysis.
 * Includes both details (document name, lead analyst info) and progress metrics.
 */
export interface GetAnalysisResponse {
  analysis: HazopsAnalysisWithDetailsAndProgress;
}

/**
 * Response type for creating an analysis.
 */
export interface CreateAnalysisResponse {
  analysis: HazopsAnalysisWithDetails;
}

/**
 * Response type for completing an analysis.
 */
export interface CompleteAnalysisResponse {
  analysis: HazopsAnalysisWithDetails;
}

/**
 * Response type for creating an analysis entry.
 */
export interface CreateAnalysisEntryResponse {
  entry: AnalysisEntry;
}

/**
 * Response type for updating an analysis entry.
 */
export interface UpdateAnalysisEntryResponse {
  entry: AnalysisEntry;
}

/**
 * Payload for creating an analysis entry.
 */
export interface CreateAnalysisEntryPayload {
  nodeId: string;
  guideWord: GuideWord;
  parameter: string;
  deviation: string;
  causes?: string[];
  consequences?: string[];
  safeguards?: string[];
  recommendations?: string[];
  notes?: string;
}

/**
 * Payload for updating an analysis entry.
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateAnalysisEntryPayload {
  deviation?: string;
  causes?: string[];
  consequences?: string[];
  safeguards?: string[];
  recommendations?: string[];
  notes?: string | null;
}

/**
 * Filter options for listing analyses.
 */
export interface ListAnalysesFilters {
  search?: string;
  status?: AnalysisStatus;
}

/**
 * Sort options for listing analyses.
 */
export interface ListAnalysesSortOptions {
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination options for listing analyses.
 */
export interface ListAnalysesPagination {
  page?: number;
  limit?: number;
}

/**
 * Build query string from filter, sort, and pagination options.
 */
function buildQueryString(
  filters: ListAnalysesFilters,
  sort: ListAnalysesSortOptions,
  pagination: ListAnalysesPagination
): string {
  const params = new URLSearchParams();

  if (pagination.page !== undefined) {
    params.set('page', String(pagination.page));
  }
  if (pagination.limit !== undefined) {
    params.set('limit', String(pagination.limit));
  }
  if (sort.sortBy) {
    params.set('sortBy', sort.sortBy);
  }
  if (sort.sortOrder) {
    params.set('sortOrder', sort.sortOrder);
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.status) {
    params.set('status', filters.status);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Analyses service for handling analysis-related API operations.
 *
 * This service provides methods for:
 * - Listing project analyses with search/filter/pagination
 * - Creating new analyses
 * - Getting analysis details
 * - Updating analyses
 * - Completing analyses
 */
export const analysesService = {
  /**
   * List project analyses with optional filtering, sorting, and pagination.
   *
   * @param projectId - The ID of the project
   * @param filters - Filter options (search, status)
   * @param sort - Sort options (sortBy, sortOrder)
   * @param pagination - Pagination options (page, limit)
   * @returns Promise resolving to the API result with analysis list and metadata
   */
  async listAnalyses(
    projectId: string,
    filters: ListAnalysesFilters = {},
    sort: ListAnalysesSortOptions = {},
    pagination: ListAnalysesPagination = {}
  ): Promise<ApiResult<ListAnalysesResponse>> {
    const queryString = buildQueryString(filters, sort, pagination);
    const result = await api.get<ListAnalysesResponse>(`/projects/${projectId}/analyses${queryString}`);

    // The API returns { success, data: Analysis[], meta } but we need { data: Analysis[], meta }
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          data: result.data as unknown as AnalysisListItem[],
          meta: result.meta!,
        },
      };
    }

    return result as ApiResult<ListAnalysesResponse>;
  },

  /**
   * Get a single analysis by ID.
   *
   * @param analysisId - The ID of the analysis to retrieve
   * @returns Promise resolving to the API result with analysis details
   */
  async getAnalysis(analysisId: string): Promise<ApiResult<GetAnalysisResponse>> {
    return api.get<GetAnalysisResponse>(`/analyses/${analysisId}`);
  },

  /**
   * Create a new analysis.
   *
   * @param projectId - The ID of the project
   * @param data - Create analysis payload
   * @returns Promise resolving to the API result with created analysis
   */
  async createAnalysis(
    projectId: string,
    data: Omit<CreateHazopsAnalysisPayload, 'projectId'>
  ): Promise<ApiResult<CreateAnalysisResponse>> {
    return api.post<CreateAnalysisResponse>(`/projects/${projectId}/analyses`, data);
  },

  /**
   * Update an analysis.
   *
   * @param analysisId - The ID of the analysis to update
   * @param data - Update data (name, description, leadAnalystId)
   * @returns Promise resolving to the API result with updated analysis
   */
  async updateAnalysis(
    analysisId: string,
    data: UpdateHazopsAnalysisPayload
  ): Promise<ApiResult<GetAnalysisResponse>> {
    return api.put<GetAnalysisResponse>(`/analyses/${analysisId}`, data);
  },

  /**
   * Complete an analysis (finalize).
   *
   * @param analysisId - The ID of the analysis to complete
   * @returns Promise resolving to the API result with completed analysis
   */
  async completeAnalysis(analysisId: string): Promise<ApiResult<CompleteAnalysisResponse>> {
    return api.post<CompleteAnalysisResponse>(`/analyses/${analysisId}/complete`);
  },

  /**
   * Create a new analysis entry for a node/guide word combination.
   *
   * @param analysisId - The ID of the analysis
   * @param data - Entry creation data (nodeId, guideWord, parameter, deviation, etc.)
   * @returns Promise resolving to the API result with created entry
   */
  async createAnalysisEntry(
    analysisId: string,
    data: CreateAnalysisEntryPayload
  ): Promise<ApiResult<CreateAnalysisEntryResponse>> {
    return api.post<CreateAnalysisEntryResponse>(`/analyses/${analysisId}/entries`, data);
  },

  /**
   * Update an existing analysis entry.
   *
   * @param entryId - The ID of the entry to update
   * @param data - Update data (deviation, causes, consequences, safeguards, recommendations, notes)
   * @returns Promise resolving to the API result with updated entry
   */
  async updateAnalysisEntry(
    entryId: string,
    data: UpdateAnalysisEntryPayload
  ): Promise<ApiResult<UpdateAnalysisEntryResponse>> {
    return api.put<UpdateAnalysisEntryResponse>(`/entries/${entryId}`, data);
  },
};
