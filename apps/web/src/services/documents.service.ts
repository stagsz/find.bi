import type {
  PIDDocumentWithUploader,
  PIDDocumentStatus,
  ApiResult,
  PaginationMeta,
} from '@hazop/types';
import { api } from './api.client';

/**
 * Response type for uploading a document.
 */
export interface UploadDocumentResponse {
  document: PIDDocumentWithUploader;
}

/**
 * Response type for getting a single document.
 */
export interface GetDocumentResponse {
  document: PIDDocumentWithUploader;
}

/**
 * Response type for listing documents.
 */
export interface ListDocumentsResponse {
  data: PIDDocumentWithUploader[];
  meta: PaginationMeta;
}

/**
 * Response type for downloading a document.
 */
export interface DownloadDocumentResponse {
  url: string;
  expiresIn: number;
  filename: string;
  mimeType: string;
}

/**
 * Filter options for listing documents.
 */
export interface ListDocumentsFilters {
  search?: string;
  status?: PIDDocumentStatus;
}

/**
 * Sort options for listing documents.
 */
export interface ListDocumentsSortOptions {
  sortBy?: 'created_at' | 'updated_at' | 'filename' | 'file_size' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination options for listing documents.
 */
export interface ListDocumentsPagination {
  page?: number;
  limit?: number;
}

/**
 * Build query string from filter, sort, and pagination options.
 */
function buildQueryString(
  filters: ListDocumentsFilters,
  sort: ListDocumentsSortOptions,
  pagination: ListDocumentsPagination
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
 * Documents service for handling P&ID document-related API operations.
 *
 * This service provides methods for:
 * - Uploading P&ID documents
 * - Listing documents with search/filter/pagination
 * - Getting document details
 * - Deleting documents
 * - Getting download URLs
 */
export const documentsService = {
  /**
   * Upload a P&ID document to a project.
   *
   * @param projectId - The ID of the project to upload the document to
   * @param file - The file to upload
   * @returns Promise resolving to the API result with uploaded document
   */
  async uploadDocument(
    projectId: string,
    file: File
  ): Promise<ApiResult<UploadDocumentResponse>> {
    const formData = new FormData();
    formData.append('file', file);

    return api.upload<UploadDocumentResponse>(
      `/projects/${projectId}/documents`,
      formData,
      // Increase timeout for large files (5 minutes)
      { timeout: 300000 }
    );
  },

  /**
   * List documents for a project with optional filtering, sorting, and pagination.
   *
   * @param projectId - The ID of the project
   * @param filters - Filter options (search, status)
   * @param sort - Sort options (sortBy, sortOrder)
   * @param pagination - Pagination options (page, limit)
   * @returns Promise resolving to the API result with document list and metadata
   */
  async listDocuments(
    projectId: string,
    filters: ListDocumentsFilters = {},
    sort: ListDocumentsSortOptions = {},
    pagination: ListDocumentsPagination = {}
  ): Promise<ApiResult<ListDocumentsResponse>> {
    const queryString = buildQueryString(filters, sort, pagination);
    const result = await api.get<ListDocumentsResponse>(
      `/projects/${projectId}/documents${queryString}`
    );

    // The API returns { success, data: Document[], meta } but we need { data: Document[], meta }
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          data: result.data as unknown as PIDDocumentWithUploader[],
          meta: result.meta!,
        },
      };
    }

    return result as ApiResult<ListDocumentsResponse>;
  },

  /**
   * Get a single document by ID.
   *
   * @param documentId - The ID of the document to retrieve
   * @returns Promise resolving to the API result with document details
   */
  async getDocument(documentId: string): Promise<ApiResult<GetDocumentResponse>> {
    return api.get<GetDocumentResponse>(`/documents/${documentId}`);
  },

  /**
   * Delete a document.
   *
   * @param documentId - The ID of the document to delete
   * @returns Promise resolving to the API result
   */
  async deleteDocument(documentId: string): Promise<ApiResult<{ message: string }>> {
    return api.delete<{ message: string }>(`/documents/${documentId}`);
  },

  /**
   * Get a signed download URL for a document.
   *
   * @param documentId - The ID of the document to download
   * @param expiresIn - URL expiration time in seconds (1-604800, default 3600)
   * @returns Promise resolving to the API result with download URL
   */
  async getDownloadUrl(
    documentId: string,
    expiresIn?: number
  ): Promise<ApiResult<DownloadDocumentResponse>> {
    const query = expiresIn ? `?expiresIn=${expiresIn}` : '';
    return api.get<DownloadDocumentResponse>(`/documents/${documentId}/download${query}`);
  },
};
