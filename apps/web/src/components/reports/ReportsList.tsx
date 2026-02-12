import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, TextInput, Select, Table, Alert, Pagination } from '@mantine/core';
import { reportsService } from '../../services/reports.service';
import type {
  ReportWithDetails,
  ReportFormat,
  ReportStatus,
  ApiError,
} from '@hazop/types';
import { REPORT_STATUS_LABELS, REPORT_FORMAT_LABELS } from '@hazop/types';
import { TableRowSkeleton } from '../skeletons';

// ============================================================================
// Constants
// ============================================================================

/**
 * Status badge colors for reports.
 */
const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  generating: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

/**
 * Format badge colors for reports.
 */
const FORMAT_COLORS: Record<ReportFormat, string> = {
  pdf: 'bg-red-50 text-red-700 border-red-200',
  word: 'bg-blue-50 text-blue-700 border-blue-200',
  excel: 'bg-green-50 text-green-700 border-green-200',
  powerpoint: 'bg-orange-50 text-orange-700 border-orange-200',
};

/**
 * Format icons (simple text representations).
 */
const FORMAT_ICONS: Record<ReportFormat, string> = {
  pdf: 'PDF',
  word: 'DOC',
  excel: 'XLS',
  powerpoint: 'PPT',
};

/**
 * Status filter options.
 */
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'generating', label: 'Generating' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

/**
 * Format filter options.
 */
const FORMAT_OPTIONS = [
  { value: '', label: 'All Formats' },
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'powerpoint', label: 'PowerPoint' },
];

/**
 * Sort options.
 */
const SORT_OPTIONS = [
  { value: 'requested_at:desc', label: 'Newest First' },
  { value: 'requested_at:asc', label: 'Oldest First' },
  { value: 'name:asc', label: 'Name (A-Z)' },
  { value: 'name:desc', label: 'Name (Z-A)' },
  { value: 'generated_at:desc', label: 'Recently Generated' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for display.
 */
function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Format badge component.
 */
interface FormatBadgeProps {
  format: ReportFormat;
}

function FormatBadge({ format }: FormatBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${FORMAT_COLORS[format]}`}
    >
      {FORMAT_ICONS[format]}
    </span>
  );
}

/**
 * Status badge component.
 */
interface StatusBadgeProps {
  status: ReportStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[status]}`}
    >
      {REPORT_STATUS_LABELS[status]}
    </span>
  );
}

// ============================================================================
// Props
// ============================================================================

/**
 * Props for the ReportsList component.
 */
export interface ReportsListProps {
  /** The ID of the project to list reports for */
  projectId: string;
  /** Optional callback when a report is downloaded */
  onDownload?: (reportId: string) => void;
  /** Optional callback when a report is selected for preview */
  onPreview?: (report: ReportWithDetails) => void;
  /** Key to trigger a refresh of the reports list */
  refreshKey?: number;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Reports list component with filtering, sorting, pagination, and download links.
 *
 * Features:
 * - Paginated report list in a data table
 * - Search by report name
 * - Filter by status and format
 * - Sort by various fields
 * - Download links for completed reports
 * - Error display for failed reports
 */
export function ReportsList({
  projectId,
  onDownload,
  onPreview,
  refreshKey = 0,
}: ReportsListProps) {
  // Report list state
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
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
  const [formatFilter, setFormatFilter] = useState<string>('');

  // Sort state
  const [sortValue, setSortValue] = useState('requested_at:desc');

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
      'requested_at' | 'generated_at' | 'name' | 'status',
      'asc' | 'desc',
    ];
    return { sortBy, sortOrder };
  }, [sortValue]);

  /**
   * Fetch reports from the API.
   */
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const filters: {
      search?: string;
      status?: ReportStatus;
      format?: ReportFormat;
    } = {};

    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    if (statusFilter) {
      filters.status = statusFilter as ReportStatus;
    }
    if (formatFilter) {
      filters.format = formatFilter as ReportFormat;
    }

    const result = await reportsService.listReports(
      projectId,
      filters,
      sortOptions,
      { page, limit }
    );

    if (result.success && result.data) {
      setReports(result.data.data);
      setTotalPages(result.data.meta.totalPages);
      setTotal(result.data.meta.total);
    } else {
      setError(
        result.error || { code: 'UNKNOWN', message: 'Failed to load reports' }
      );
    }

    setIsLoading(false);
  }, [projectId, page, debouncedSearch, statusFilter, formatFilter, sortOptions]);

  /**
   * Load reports on mount and when filters/pagination change.
   */
  useEffect(() => {
    fetchReports();
  }, [fetchReports, refreshKey]);

  /**
   * Reset all filters.
   */
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setFormatFilter('');
    setSortValue('requested_at:desc');
    setPage(1);
  };

  /**
   * Handle report download.
   */
  const handleDownload = async (report: ReportWithDetails) => {
    if (report.status !== 'completed') return;

    setDownloadingId(report.id);

    const result = await reportsService.downloadReport(report.id);

    if (result.success && result.data) {
      window.open(result.data.downloadUrl, '_blank');
      onDownload?.(report.id);
    } else {
      setError(
        result.error || { code: 'UNKNOWN', message: 'Failed to get download URL' }
      );
    }

    setDownloadingId(null);
  };

  /**
   * Handle report preview click.
   */
  const handlePreview = (report: ReportWithDetails) => {
    onPreview?.(report);
  };

  /**
   * Check if there are any active filters.
   */
  const hasActiveFilters =
    searchQuery ||
    statusFilter ||
    formatFilter ||
    sortValue !== 'requested_at:desc';

  return (
    <div>
      {/* Header with title */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Reports
        </h2>
        {total > 0 && (
          <span className="text-sm text-slate-500">
            {total} report{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px] max-w-[250px]">
            <TextInput
              placeholder="Search by name..."
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

          <div className="w-[130px]">
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

          <div className="w-[130px]">
            <Select
              placeholder="Format"
              data={FORMAT_OPTIONS}
              value={formatFilter}
              onChange={(value) => {
                setFormatFilter(value || '');
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

          <div className="w-[160px]">
            <Select
              placeholder="Sort by"
              data={SORT_OPTIONS}
              value={sortValue}
              onChange={(value) => {
                setSortValue(value || 'requested_at:desc');
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
                  <Table.Th className="font-medium text-slate-700">Name</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Analysis</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-center">Format</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-center">Status</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-right">Size</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Generated</Table.Th>
                  <Table.Th className="font-medium text-slate-700">By</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRowSkeleton
                    key={index}
                    columns={8}
                    showActions
                    columnWidths={['wide', 'medium', 'narrow', 'narrow', 'narrow', 'medium', 'medium', 'medium']}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </div>
      ) : reports.length === 0 ? (
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
            {hasActiveFilters
              ? 'No reports match your filters'
              : 'No reports yet'}
          </p>
          {!hasActiveFilters && (
            <p className="text-xs text-slate-400">
              Generate a report to see it here
            </p>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr className="bg-slate-50">
                  <Table.Th className="font-medium text-slate-700">Name</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Analysis</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-center">
                    Format
                  </Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-center">
                    Status
                  </Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-right">
                    Size
                  </Table.Th>
                  <Table.Th className="font-medium text-slate-700">
                    Generated
                  </Table.Th>
                  <Table.Th className="font-medium text-slate-700">By</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-right">
                    Actions
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reports.map((report) => (
                  <Table.Tr key={report.id}>
                    <Table.Td>
                      <div
                        className="font-medium text-slate-900 truncate max-w-[200px] cursor-pointer hover:text-blue-700"
                        onClick={() => handlePreview(report)}
                        title={report.name}
                      >
                        {report.name}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div className="text-slate-700 truncate max-w-[150px]" title={report.analysisName}>
                        {report.analysisName}
                      </div>
                    </Table.Td>
                    <Table.Td className="text-center">
                      <FormatBadge format={report.format} />
                    </Table.Td>
                    <Table.Td className="text-center">
                      <StatusBadge status={report.status} />
                    </Table.Td>
                    <Table.Td className="text-right font-mono text-slate-600 text-sm">
                      {formatFileSize(report.fileSize)}
                    </Table.Td>
                    <Table.Td className="text-slate-600 text-sm">
                      {formatDate(report.generatedAt || report.requestedAt)}
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <div className="text-sm text-slate-600">
                          {report.generatedByName}
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {report.status === 'completed' && (
                          <Button
                            variant="subtle"
                            size="xs"
                            color="blue"
                            onClick={() => handleDownload(report)}
                            loading={downloadingId === report.id}
                            styles={{
                              root: {
                                borderRadius: '4px',
                              },
                            }}
                          >
                            Download
                          </Button>
                        )}
                        {report.status === 'failed' && (
                          <span
                            className="text-xs text-red-600 cursor-help"
                            title={report.errorMessage || 'Unknown error'}
                          >
                            Failed
                          </span>
                        )}
                        {(report.status === 'pending' ||
                          report.status === 'generating') && (
                          <span className="text-xs text-slate-500">
                            Processing...
                          </span>
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
                Showing {(page - 1) * limit + 1} to{' '}
                {Math.min(page * limit, total)} of {total}
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
    </div>
  );
}
