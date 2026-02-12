import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, TextInput, Select, Table, Alert, Pagination } from '@mantine/core';
import {
  analysesService,
  type ListAnalysesFilters,
  type ListAnalysesSortOptions,
  type AnalysisListItem,
} from '../../services/analyses.service';
import {
  complianceService,
  type AnalysisComplianceStatus,
} from '../../services/compliance.service';
import type { AnalysisStatus, ApiError, ComplianceStatus } from '@hazop/types';
import { ANALYSIS_STATUS_LABELS } from '@hazop/types';
import { NewAnalysisModal } from './NewAnalysisModal';
import { ComplianceStatusCompact } from '../compliance';
import { TableRowSkeleton } from '../skeletons';

/**
 * Analysis status badge colors.
 */
const STATUS_COLORS: Record<AnalysisStatus, string> = {
  draft: 'bg-blue-100 text-blue-800',
  in_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

/**
 * Status filter options for the dropdown.
 */
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

/**
 * Sort options for the table.
 */
const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
  { value: 'updated_at:desc', label: 'Recently Updated' },
  { value: 'name:asc', label: 'Name (A-Z)' },
  { value: 'name:desc', label: 'Name (Z-A)' },
  { value: 'status:asc', label: 'Status (A-Z)' },
];

/**
 * Props for the AnalysesTab component.
 */
interface AnalysesTabProps {
  projectId: string;
}

/**
 * Analyses tab component for the project detail page.
 * Shows a list of HazOps analyses for the project with status indicators.
 *
 * Features:
 * - Paginated analysis list in a data table
 * - Search by name or description
 * - Filter by analysis status
 * - Sort by various fields
 * - View analysis details
 */
export function AnalysesTab({ projectId }: AnalysesTabProps) {
  const navigate = useNavigate();

  // Analysis list state
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(true);
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

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Compliance status cache (analysisId -> status)
  const [complianceStatuses, setComplianceStatuses] = useState<
    Record<string, { status: ComplianceStatus; percentage: number } | null>
  >({});

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
   * Fetch analyses from the API.
   */
  const fetchAnalyses = useCallback(async () => {
    setIsLoadingAnalyses(true);
    setError(null);

    const filters: ListAnalysesFilters = {};
    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    if (statusFilter) {
      filters.status = statusFilter as AnalysisStatus;
    }

    const [sortBy, sortOrder] = sortValue.split(':') as [
      ListAnalysesSortOptions['sortBy'],
      ListAnalysesSortOptions['sortOrder'],
    ];

    const result = await analysesService.listAnalyses(projectId, filters, { sortBy, sortOrder }, { page, limit });

    if (result.success && result.data) {
      setAnalyses(result.data.data);
      setTotalPages(result.data.meta.totalPages);
      setTotal(result.data.meta.total);
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to load analyses' });
    }

    setIsLoadingAnalyses(false);
  }, [projectId, page, debouncedSearch, statusFilter, sortValue]);

  /**
   * Load analyses on mount and when filters/pagination change.
   */
  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  /**
   * Fetch compliance status for visible analyses.
   * Only fetches for analyses that have entries (entryCount > 0).
   */
  useEffect(() => {
    const fetchComplianceStatuses = async () => {
      // Only fetch for analyses with entries that we haven't cached yet
      const analysesToFetch = analyses.filter(
        (a) => a.entryCount > 0 && complianceStatuses[a.id] === undefined
      );

      if (analysesToFetch.length === 0) return;

      // Initialize as null (loading) for these analyses
      setComplianceStatuses((prev) => {
        const next = { ...prev };
        analysesToFetch.forEach((a) => {
          if (next[a.id] === undefined) {
            next[a.id] = null;
          }
        });
        return next;
      });

      // Fetch compliance status for each analysis (in parallel, limited to 5 at a time)
      const batchSize = 5;
      for (let i = 0; i < analysesToFetch.length; i += batchSize) {
        const batch = analysesToFetch.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (analysis) => {
            const result = await complianceService.getAnalysisCompliance(analysis.id);
            if (result.success && result.data?.data) {
              return {
                id: analysis.id,
                status: result.data.data.overallStatus,
                percentage: result.data.data.overallPercentage,
              };
            }
            return { id: analysis.id, status: null, percentage: 0 };
          })
        );

        setComplianceStatuses((prev) => {
          const next = { ...prev };
          results.forEach((r) => {
            if (r.status !== null) {
              next[r.id] = { status: r.status, percentage: r.percentage };
            }
          });
          return next;
        });
      }
    };

    fetchComplianceStatuses();
  }, [analyses]);

  /**
   * Format date for display.
   */
  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
   * Handle opening the create analysis modal.
   */
  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  /**
   * Handle closing the create analysis modal.
   */
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  /**
   * Handle successful analysis creation.
   */
  const handleAnalysisCreated = () => {
    fetchAnalyses();
  };

  // Empty state when no analyses exist
  if (!isLoadingAnalyses && analyses.length === 0 && !debouncedSearch && !statusFilter) {
    return (
      <>
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-slate-400">
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
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">No analyses yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create a new HazOps analysis to begin your hazard study.
          </p>
          <div className="mt-6">
            <Button
              onClick={handleOpenCreateModal}
              styles={{
                root: {
                  borderRadius: '4px',
                  backgroundColor: '#1e40af',
                  '&:hover': {
                    backgroundColor: '#1e3a8a',
                  },
                },
              }}
            >
              Create Analysis
            </Button>
          </div>
        </div>

        {/* Create Analysis Modal */}
        <NewAnalysisModal
          opened={isCreateModalOpen}
          onClose={handleCloseCreateModal}
          projectId={projectId}
          onAnalysisCreated={handleAnalysisCreated}
        />
      </>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <TextInput
              placeholder="Search by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              placeholder="Filter by status"
              data={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value || '');
                setPage(1);
              }}
              clearable={false}
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

          <div className="w-[180px]">
            <Select
              placeholder="Sort by"
              data={SORT_OPTIONS}
              value={sortValue}
              onChange={(value) => {
                setSortValue(value || 'created_at:desc');
                setPage(1);
              }}
              clearable={false}
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

          <Button
            variant="subtle"
            color="gray"
            onClick={handleResetFilters}
            styles={{
              root: {
                borderRadius: '4px',
              },
            }}
          >
            Reset
          </Button>

          <div className="ml-auto">
            <Button
              onClick={handleOpenCreateModal}
              styles={{
                root: {
                  borderRadius: '4px',
                  backgroundColor: '#1e40af',
                  '&:hover': {
                    backgroundColor: '#1e3a8a',
                  },
                },
              }}
            >
              Create Analysis
            </Button>
          </div>
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

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr className="bg-slate-50">
              <Table.Th className="font-medium text-slate-700">Name</Table.Th>
              <Table.Th className="font-medium text-slate-700">Status</Table.Th>
              <Table.Th className="font-medium text-slate-700">Compliance</Table.Th>
              <Table.Th className="font-medium text-slate-700">Document</Table.Th>
              <Table.Th className="font-medium text-slate-700">Lead Analyst</Table.Th>
              <Table.Th className="font-medium text-slate-700">Entries</Table.Th>
              <Table.Th className="font-medium text-slate-700">Updated</Table.Th>
              <Table.Th className="font-medium text-slate-700 text-right">Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoadingAnalyses ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton
                  key={index}
                  columns={8}
                  showActions
                  columnWidths={['wide', 'medium', 'medium', 'medium', 'medium', 'narrow', 'medium', 'medium']}
                />
              ))
            ) : analyses.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8} className="text-center py-8 text-slate-500">
                  No analyses found
                </Table.Td>
              </Table.Tr>
            ) : (
              analyses.map((analysis) => (
                <Table.Tr key={analysis.id}>
                  <Table.Td>
                    <div>
                      <div className="font-medium text-slate-900">{analysis.name}</div>
                      {analysis.description && (
                        <div className="text-sm text-slate-500 truncate max-w-[300px]">
                          {analysis.description}
                        </div>
                      )}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[analysis.status]}`}
                    >
                      {ANALYSIS_STATUS_LABELS[analysis.status]}
                    </span>
                  </Table.Td>
                  <Table.Td>
                    {analysis.entryCount === 0 ? (
                      <span className="text-xs text-slate-400">No entries</span>
                    ) : complianceStatuses[analysis.id] === undefined ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : complianceStatuses[analysis.id] === null ? (
                      <span className="text-xs text-slate-400">Loading...</span>
                    ) : (
                      <ComplianceStatusCompact
                        status={complianceStatuses[analysis.id]!.status}
                        percentage={complianceStatuses[analysis.id]!.percentage}
                        size="sm"
                      />
                    )}
                  </Table.Td>
                  <Table.Td className="text-slate-600">
                    <div className="text-sm truncate max-w-[150px]">{analysis.documentName}</div>
                  </Table.Td>
                  <Table.Td className="text-slate-600">
                    <div>
                      <div className="text-sm">{analysis.leadAnalystName}</div>
                      <div className="text-xs text-slate-400">{analysis.leadAnalystEmail}</div>
                    </div>
                  </Table.Td>
                  <Table.Td className="text-slate-600">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {analysis.entryCount} {analysis.entryCount === 1 ? 'entry' : 'entries'}
                    </span>
                  </Table.Td>
                  <Table.Td className="text-slate-500 text-sm">
                    {formatDate(analysis.updatedAt)}
                  </Table.Td>
                  <Table.Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="subtle"
                        size="xs"
                        color="blue"
                        onClick={() => navigate(`/projects/${projectId}/analyses/${analysis.id}`)}
                        styles={{
                          root: {
                            borderRadius: '4px',
                          },
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} analyses
          </div>
          <Pagination
            value={page}
            onChange={setPage}
            total={totalPages}
            boundaries={1}
            siblings={1}
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

      {/* Create Analysis Modal */}
      <NewAnalysisModal
        opened={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        projectId={projectId}
        onAnalysisCreated={handleAnalysisCreated}
      />
    </div>
  );
}
