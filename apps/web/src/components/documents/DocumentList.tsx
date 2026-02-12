import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, TextInput, Select, Table, Alert, Pagination, Modal } from '@mantine/core';
import { documentsService } from '../../services/documents.service';
import type { PIDDocumentWithUploader, PIDDocumentStatus, ApiError } from '@hazop/types';
import { TableRowSkeleton } from '../skeletons';

/**
 * Document status display labels.
 */
const STATUS_LABELS: Record<PIDDocumentStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  processed: 'Processed',
  failed: 'Failed',
};

/**
 * Document status badge colors.
 */
const STATUS_COLORS: Record<PIDDocumentStatus, string> = {
  pending: 'bg-blue-100 text-blue-800',
  processing: 'bg-amber-100 text-amber-800',
  processed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

/**
 * Status filter options for the dropdown.
 */
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'processed', label: 'Processed' },
  { value: 'failed', label: 'Failed' },
];

/**
 * Sort options for the table.
 */
const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
  { value: 'filename:asc', label: 'Name (A-Z)' },
  { value: 'filename:desc', label: 'Name (Z-A)' },
  { value: 'file_size:desc', label: 'Largest First' },
  { value: 'file_size:asc', label: 'Smallest First' },
];

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format date for display.
 */
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get file type icon based on MIME type.
 */
function getFileTypeIcon(mimeType: string): JSX.Element {
  if (mimeType === 'application/pdf') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-8 h-8 text-red-500"
      >
        <path
          fillRule="evenodd"
          d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z"
          clipRule="evenodd"
        />
        <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
      </svg>
    );
  }

  if (mimeType.startsWith('image/')) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-8 h-8 text-blue-500"
      >
        <path
          fillRule="evenodd"
          d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  // DWG or other file types
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-8 h-8 text-slate-500"
    >
      <path
        fillRule="evenodd"
        d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z"
        clipRule="evenodd"
      />
      <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
    </svg>
  );
}

/**
 * Get file extension from filename.
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot + 1).toUpperCase();
}

/**
 * Props for the DocumentList component.
 */
interface DocumentListProps {
  /** The ID of the project to list documents for */
  projectId: string;
  /** Whether to allow delete actions (based on user role) */
  canDelete?: boolean;
  /** Callback when a document is deleted */
  onDocumentDelete?: () => void;
  /** Key to trigger a refresh of the document list */
  refreshKey?: number;
}

/**
 * Document list component with thumbnails, filtering, sorting, and pagination.
 *
 * Features:
 * - Paginated document list in a data table
 * - Search by filename
 * - Filter by document status
 * - Sort by various fields
 * - File type thumbnails
 * - Download and delete actions
 */
export function DocumentList({
  projectId,
  canDelete = false,
  onDocumentDelete,
  refreshKey = 0,
}: DocumentListProps) {
  // Document list state
  const [documents, setDocuments] = useState<PIDDocumentWithUploader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Sort state
  const [sortValue, setSortValue] = useState('created_at:desc');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<PIDDocumentWithUploader | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /**
   * Debounce search query.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Parse sort value into sortBy and sortOrder.
   */
  const sortOptions = useMemo(() => {
    const [sortBy, sortOrder] = sortValue.split(':') as [
      'created_at' | 'updated_at' | 'filename' | 'file_size' | 'status',
      'asc' | 'desc',
    ];
    return { sortBy, sortOrder };
  }, [sortValue]);

  /**
   * Fetch documents from the API.
   */
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const filters: { search?: string; status?: PIDDocumentStatus } = {};
    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    if (statusFilter) {
      filters.status = statusFilter as PIDDocumentStatus;
    }

    const result = await documentsService.listDocuments(
      projectId,
      filters,
      sortOptions,
      { page, limit }
    );

    if (result.success && result.data) {
      setDocuments(result.data.data);
      setTotalPages(result.data.meta.totalPages);
      setTotal(result.data.meta.total);
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to load documents' });
    }

    setIsLoading(false);
  }, [projectId, page, debouncedSearch, statusFilter, sortOptions]);

  /**
   * Load documents on mount and when filters/pagination change.
   */
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshKey]);

  /**
   * Reset filters.
   */
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setSortValue('created_at:desc');
    setPage(1);
  };

  /**
   * Handle document download.
   */
  const handleDownload = async (document: PIDDocumentWithUploader) => {
    setDownloadingId(document.id);

    const result = await documentsService.getDownloadUrl(document.id);

    if (result.success && result.data) {
      // Open the download URL in a new tab
      window.open(result.data.url, '_blank');
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to get download URL' });
    }

    setDownloadingId(null);
  };

  /**
   * Open delete confirmation modal.
   */
  const handleDeleteClick = (document: PIDDocumentWithUploader) => {
    setDocumentToDelete(document);
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  /**
   * Close delete confirmation modal.
   */
  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setDocumentToDelete(null);
    setDeleteError(null);
  };

  /**
   * Confirm and execute document deletion.
   */
  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    const result = await documentsService.deleteDocument(documentToDelete.id);

    if (result.success) {
      handleCloseDeleteModal();
      onDocumentDelete?.();
      fetchDocuments();
    } else {
      setDeleteError(result.error || { code: 'UNKNOWN', message: 'Failed to delete document' });
    }

    setIsDeleting(false);
  };

  /**
   * Check if there are any active filters.
   */
  const hasActiveFilters = searchQuery || statusFilter || sortValue !== 'created_at:desc';

  return (
    <div>
      {/* Header with title */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Documents
        </h2>
        {total > 0 && (
          <span className="text-sm text-slate-500">
            {total} document{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px] max-w-[250px]">
            <TextInput
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
              styles={{
                input: {
                  borderRadius: '4px',
                  '&:focus': {
                    borderColor: '#1e40af',
                  },
                },
              }}
            />
          </div>

          <div className="w-[140px]">
            <Select
              placeholder="Status"
              data={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value || '');
                setPage(1);
              }}
              clearable={false}
              size="sm"
              styles={{
                input: {
                  borderRadius: '4px',
                  '&:focus': {
                    borderColor: '#1e40af',
                  },
                },
              }}
            />
          </div>

          <div className="w-[150px]">
            <Select
              placeholder="Sort by"
              data={SORT_OPTIONS}
              value={sortValue}
              onChange={(value) => {
                setSortValue(value || 'created_at:desc');
                setPage(1);
              }}
              clearable={false}
              size="sm"
              styles={{
                input: {
                  borderRadius: '4px',
                  '&:focus': {
                    borderColor: '#1e40af',
                  },
                },
              }}
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              onClick={handleResetFilters}
              styles={{
                root: {
                  borderRadius: '4px',
                },
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-4">
          <Alert
            color="red"
            variant="light"
            styles={{
              root: { borderRadius: '4px' },
            }}
            onClose={() => setError(null)}
            withCloseButton
          >
            {error.message}
          </Alert>
        </div>
      )}

      {/* Table or empty state */}
      {isLoading ? (
        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <Table striped>
              <Table.Thead>
                <Table.Tr className="bg-slate-50">
                  <Table.Th className="font-medium text-slate-700 w-[60px]">Type</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Filename</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Status</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Size</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Uploaded By</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Uploaded</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRowSkeleton
                    key={index}
                    columns={7}
                    showActions
                    columnWidths={['narrow', 'wide', 'medium', 'narrow', 'medium', 'medium', 'medium']}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-300 rounded">
          <div className="mx-auto h-10 w-10 text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {hasActiveFilters ? 'No documents match your filters' : 'No documents yet'}
          </p>
          {!hasActiveFilters && (
            <p className="text-xs text-slate-400">Upload a P&ID document to get started</p>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr className="bg-slate-50">
                  <Table.Th className="font-medium text-slate-700 w-[60px]">Type</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Filename</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Status</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Size</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Uploaded By</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Uploaded</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {documents.map((doc) => (
                  <Table.Tr key={doc.id}>
                    <Table.Td>
                      <div className="flex items-center justify-center">
                        <div className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded border border-slate-200">
                          {getFileTypeIcon(doc.mimeType)}
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <div className="font-medium text-slate-900 truncate max-w-[250px]">
                          {doc.filename}
                        </div>
                        <div className="text-xs text-slate-400">{getFileExtension(doc.filename)}</div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[doc.status]}`}
                      >
                        {STATUS_LABELS[doc.status]}
                      </span>
                    </Table.Td>
                    <Table.Td className="text-slate-600 text-sm">
                      {formatFileSize(doc.fileSize)}
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <div className="text-sm text-slate-600">{doc.uploadedByName}</div>
                        <div className="text-xs text-slate-400">{doc.uploadedByEmail}</div>
                      </div>
                    </Table.Td>
                    <Table.Td className="text-slate-500 text-sm">
                      {formatDate(doc.uploadedAt)}
                    </Table.Td>
                    <Table.Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="subtle"
                          size="xs"
                          color="blue"
                          onClick={() => handleDownload(doc)}
                          loading={downloadingId === doc.id}
                          styles={{
                            root: {
                              borderRadius: '4px',
                            },
                          }}
                        >
                          Download
                        </Button>
                        {canDelete && (
                          <Button
                            variant="subtle"
                            size="xs"
                            color="red"
                            onClick={() => handleDeleteClick(doc)}
                            styles={{
                              root: {
                                borderRadius: '4px',
                              },
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="text-sm text-slate-500">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
              </div>
              <Pagination
                value={page}
                onChange={setPage}
                total={totalPages}
                boundaries={1}
                siblings={1}
                size="sm"
                styles={{
                  control: {
                    borderRadius: '4px',
                    '&[data-active]': {
                      backgroundColor: '#1e40af',
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={handleCloseDeleteModal}
        title={
          <span className="font-semibold text-slate-900">Delete Document</span>
        }
        centered
        size="sm"
        styles={{
          content: {
            borderRadius: '4px',
          },
          header: {
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px',
          },
        }}
      >
        <div className="mt-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{' '}
            <strong className="text-slate-900">{documentToDelete?.filename}</strong>?
          </p>
          <p className="text-sm text-slate-500 mt-2">
            This action cannot be undone. Any analysis nodes associated with this document will also be deleted.
          </p>

          {deleteError && (
            <Alert
              color="red"
              variant="light"
              className="mt-4"
              styles={{
                root: { borderRadius: '4px' },
              }}
              onClose={() => setDeleteError(null)}
              withCloseButton
            >
              {deleteError.message}
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
            <Button
              variant="subtle"
              color="gray"
              onClick={handleCloseDeleteModal}
              disabled={isDeleting}
              styles={{
                root: {
                  borderRadius: '4px',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleConfirmDelete}
              loading={isDeleting}
              styles={{
                root: {
                  borderRadius: '4px',
                },
              }}
            >
              Delete Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
