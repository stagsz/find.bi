/**
 * Compliance service for handling compliance validation API operations.
 *
 * This service provides methods for:
 * - Getting project-level compliance status
 * - Getting analysis-level compliance status
 * - Filtering by regulatory standards
 */

import type {
  RegulatoryStandardId,
  ComplianceStatus,
  StandardComplianceSummary,
  ApiResult,
} from '@hazop/types';
import { api } from './api.client';

/**
 * Project compliance status response from the API.
 */
export interface ProjectComplianceStatus {
  /** Project ID */
  projectId: string;

  /** Project name */
  projectName: string;

  /** Number of analyses in the project */
  analysisCount: number;

  /** Total number of analysis entries */
  entryCount: number;

  /** Whether any entries have LOPA analysis */
  hasLOPA: boolean;

  /** Count of entries with LOPA */
  lopaCount: number;

  /** Standards that were checked */
  standardsChecked: RegulatoryStandardId[];

  /** Overall compliance status */
  overallStatus: ComplianceStatus;

  /** Overall compliance percentage (0-100) */
  overallPercentage: number;

  /** Summary per standard */
  summaries: StandardComplianceSummary[];

  /** Timestamp of check */
  checkedAt: string;
}

/**
 * Analysis compliance status response from the API.
 */
export interface AnalysisComplianceStatus {
  /** Analysis ID */
  analysisId: string;

  /** Analysis name */
  analysisName: string;

  /** Project ID */
  projectId: string;

  /** Analysis status (draft, in_progress, etc.) */
  analysisStatus: string;

  /** Number of entries in the analysis */
  entryCount: number;

  /** Whether any entries have LOPA analysis */
  hasLOPA: boolean;

  /** Count of entries with LOPA */
  lopaCount: number;

  /** Standards that were checked */
  standardsChecked: RegulatoryStandardId[];

  /** Overall compliance status */
  overallStatus: ComplianceStatus;

  /** Overall compliance percentage (0-100) */
  overallPercentage: number;

  /** Summary per standard */
  summaries: StandardComplianceSummary[];

  /** Timestamp of check */
  checkedAt: string;
}

/**
 * Response type for project compliance endpoint.
 */
export interface GetProjectComplianceResponse {
  data: ProjectComplianceStatus;
}

/**
 * Response type for analysis compliance endpoint.
 */
export interface GetAnalysisComplianceResponse {
  data: AnalysisComplianceStatus;
}

/**
 * Compliance service for handling compliance-related API operations.
 */
export const complianceService = {
  /**
   * Get compliance status for a project.
   *
   * Validates the project's analysis entries against regulatory standards
   * and returns compliance summaries.
   *
   * @param projectId - The ID of the project
   * @param standards - Optional array of standard IDs to check (defaults to all)
   * @returns Promise resolving to the API result with compliance status
   */
  async getProjectCompliance(
    projectId: string,
    standards?: RegulatoryStandardId[]
  ): Promise<ApiResult<GetProjectComplianceResponse>> {
    const queryParams = standards?.length ? `?standards=${standards.join(',')}` : '';
    return api.get<GetProjectComplianceResponse>(`/projects/${projectId}/compliance${queryParams}`);
  },

  /**
   * Get compliance status for an analysis.
   *
   * Validates the analysis entries against regulatory standards
   * and returns compliance summaries.
   *
   * @param analysisId - The ID of the analysis
   * @param standards - Optional array of standard IDs to check (defaults to all)
   * @returns Promise resolving to the API result with compliance status
   */
  async getAnalysisCompliance(
    analysisId: string,
    standards?: RegulatoryStandardId[]
  ): Promise<ApiResult<GetAnalysisComplianceResponse>> {
    const queryParams = standards?.length ? `?standards=${standards.join(',')}` : '';
    return api.get<GetAnalysisComplianceResponse>(`/analyses/${analysisId}/compliance${queryParams}`);
  },
};
