/**
 * Analysis entry summary table component.
 *
 * Displays a tabular view of all analysis entries for the current analysis session.
 * Supports filtering by node, guide word, and risk level, as well as pagination.
 *
 * This component auto-populates the analysis table as entries are created,
 * fulfilling FR4 from the PRD requirements.
 */

import { useState, useEffect, useCallback } from 'react';
import { Table, TextInput, Select, Pagination, Alert, Loader } from '@mantine/core';
import {
  analysesService,
  type ListEntriesFilters,
  type ListEntriesSortOptions,
} from '../../services/analyses.service';
import type { AnalysisEntry, GuideWord, RiskLevel, RiskLevelFilter, ApiError } from '@hazop/types';
import { GUIDE_WORD_LABELS, GUIDE_WORDS, RISK_LEVEL_FILTER_LABELS, RISK_LEVEL_FILTER_OPTIONS } from '@hazop/types';

/**
 * Guide word badge colors.
 */
const GUIDE_WORD_COLORS: Record<GuideWord, string> = {
  no: 'bg-slate-100 text-slate-800',
  more: 'bg-red-100 text-red-800',
  less: 'bg-blue-100 text-blue-800',
  reverse: 'bg-purple-100 text-purple-800',
  early: 'bg-amber-100 text-amber-800',
  late: 'bg-orange-100 text-orange-800',
  other_than: 'bg-pink-100 text-pink-800',
};

/**
 * Risk level badge colors.
 */
const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
};

/**
 * Guide word filter options.
 */
const GUIDE_WORD_OPTIONS = [
  { value: '', label: 'All Guide Words' },
  ...GUIDE_WORDS.map((gw) => ({ value: gw, label: GUIDE_WORD_LABELS[gw] })),
];

/**
 * Risk level filter options (includes 'Not Assessed' option).
 */
const RISK_LEVEL_OPTIONS = [
  { value: '', label: 'All Risk Levels' },
  ...RISK_LEVEL_FILTER_OPTIONS.map((rl) => ({ value: rl, label: RISK_LEVEL_FILTER_LABELS[rl] })),
];

/**
 * Sort options for the table.
 */
const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
  { value: 'parameter:asc', label: 'Parameter (A-Z)' },
  { value: 'guide_word:asc', label: 'Guide Word (A-Z)' },
  { value: 'risk_score:desc', label: 'Highest Risk' },
  { value: 'risk_score:asc', label: 'Lowest Risk' },
];

/**
 * Props for a node lookup map.
 */
interface NodeInfo {
  nodeId: string;
  description: string;
}

/**
 * Animation type for highlighting entries.
 */
type HighlightType = 'created' | 'updated' | 'deleted' | 'risk';

/**
 * Props for the AnalysisEntrySummaryTable component.
 */
interface AnalysisEntrySummaryTableProps {
  /** ID of the analysis to show entries for */
  analysisId: string;

  /** Map of node IDs to node info for display */
  nodeMap: Map<string, NodeInfo>;

  /** Optional callback when an entry is clicked */
  onEntryClick?: (entry: AnalysisEntry) => void;

  /** Optional trigger to refresh the data */
  refreshTrigger?: number;

  /** Optional className for additional styling */
  className?: string;

  /** Map of entry IDs to highlight animation types */
  highlightedEntries?: Map<string, HighlightType>;
}

/**
 * Summary table displaying all analysis entries.
 * Shows node, guide word, deviation, causes, consequences, safeguards,
 * recommendations, and risk level for each entry.
 */
export function AnalysisEntrySummaryTable({
  analysisId,
  nodeMap,
  onEntryClick,
  refreshTrigger = 0,
  className = '',
  highlightedEntries,
}: AnalysisEntrySummaryTableProps) {
  // Entries state
  const [entries, setEntries] = useState<AnalysisEntry[]>([]);
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
  const [guideWordFilter, setGuideWordFilter] = useState<string>('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('');

  // Sort state
  const [sortValue, setSortValue] = useState('created_at:desc');

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
   * Fetch entries from the API.
   */
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const filters: ListEntriesFilters = {};
    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    if (guideWordFilter) {
      filters.guideWord = guideWordFilter as GuideWord;
    }
    if (riskLevelFilter) {
      filters.riskLevel = riskLevelFilter as RiskLevelFilter;
    }

    const [sortBy, sortOrder] = sortValue.split(':') as [
      ListEntriesSortOptions['sortBy'],
      ListEntriesSortOptions['sortOrder'],
    ];

    const result = await analysesService.listAnalysisEntries(
      analysisId,
      filters,
      { sortBy, sortOrder },
      { page, limit }
    );

    if (result.success && result.data) {
      setEntries(result.data.data.entries);
      setTotalPages(result.data.meta.totalPages);
      setTotal(result.data.meta.total);
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to load entries' });
    }

    setIsLoading(false);
  }, [analysisId, page, debouncedSearch, guideWordFilter, riskLevelFilter, sortValue]);

  /**
   * Load entries on mount and when filters/pagination change.
   */
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, refreshTrigger]);

  /**
   * Reset filters.
   */
  const handleResetFilters = () => {
    setSearchQuery('');
    setGuideWordFilter('');
    setRiskLevelFilter('');
    setSortValue('created_at:desc');
    setPage(1);
  };

  /**
   * Format array items for display (show first few, indicate more).
   */
  const formatArrayItems = (items: string[], maxDisplay: number = 2): string => {
    if (!items || items.length === 0) return '-';
    if (items.length <= maxDisplay) return items.join(', ');
    return `${items.slice(0, maxDisplay).join(', ')} +${items.length - maxDisplay} more`;
  };

  /**
   * Get node display name from node map.
   */
  const getNodeDisplay = (nodeId: string): string => {
    const node = nodeMap.get(nodeId);
    return node?.nodeId || 'Unknown Node';
  };

  // Empty state when no entries exist and no filters applied
  if (!isLoading && entries.length === 0 && !debouncedSearch && !guideWordFilter && !riskLevelFilter) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="mx-auto h-10 w-10 text-slate-400 mb-3">
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
              d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-slate-900 mb-1">No analysis entries yet</h3>
        <p className="text-sm text-slate-500">
          Select a node and guide word to create your first analysis entry.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filters */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px] max-w-[200px]">
            <TextInput
              placeholder="Search..."
              size="xs"
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

          <div className="w-[130px]">
            <Select
              placeholder="Guide Word"
              size="xs"
              data={GUIDE_WORD_OPTIONS}
              value={guideWordFilter}
              onChange={(value) => {
                setGuideWordFilter(value || '');
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

          <div className="w-[130px]">
            <Select
              placeholder="Risk Level"
              size="xs"
              data={RISK_LEVEL_OPTIONS}
              value={riskLevelFilter}
              onChange={(value) => {
                setRiskLevelFilter(value || '');
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

          <div className="w-[140px]">
            <Select
              placeholder="Sort by"
              size="xs"
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

          {(debouncedSearch || guideWordFilter || riskLevelFilter) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Reset
            </button>
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

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader size="sm" color="blue" />
          <span className="ml-2 text-sm text-slate-500">Loading entries...</span>
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <div className="overflow-x-auto border border-slate-200 rounded">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr className="bg-slate-50">
                <Table.Th className="font-medium text-slate-700 text-xs">Node</Table.Th>
                <Table.Th className="font-medium text-slate-700 text-xs">Guide Word</Table.Th>
                <Table.Th className="font-medium text-slate-700 text-xs">Parameter</Table.Th>
                <Table.Th className="font-medium text-slate-700 text-xs">Deviation</Table.Th>
                <Table.Th className="font-medium text-slate-700 text-xs">Causes</Table.Th>
                <Table.Th className="font-medium text-slate-700 text-xs">Consequences</Table.Th>
                <Table.Th className="font-medium text-slate-700 text-xs">Safeguards</Table.Th>
                <Table.Th className="font-medium text-slate-700 text-xs">Recommendations</Table.Th>
                <Table.Th className="font-medium text-slate-700 text-xs">Risk</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9} className="text-center py-6 text-slate-500 text-sm">
                    No entries found matching your filters
                  </Table.Td>
                </Table.Tr>
              ) : (
                entries.map((entry) => {
                  const highlightType = highlightedEntries?.get(entry.id);
                  const highlightClass = highlightType
                    ? `animate-highlight-${highlightType}`
                    : '';
                  return (
                  <Table.Tr
                    key={entry.id}
                    className={`${onEntryClick ? 'cursor-pointer' : ''} ${highlightClass}`}
                    onClick={() => onEntryClick?.(entry)}
                  >
                    <Table.Td className="text-xs">
                      <span className="font-medium text-slate-900">
                        {getNodeDisplay(entry.nodeId)}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${GUIDE_WORD_COLORS[entry.guideWord]}`}
                      >
                        {GUIDE_WORD_LABELS[entry.guideWord]}
                      </span>
                    </Table.Td>
                    <Table.Td className="text-xs text-slate-600">
                      {entry.parameter}
                    </Table.Td>
                    <Table.Td className="text-xs text-slate-600 max-w-[150px] truncate">
                      {entry.deviation}
                    </Table.Td>
                    <Table.Td className="text-xs text-slate-600 max-w-[120px]">
                      <span title={entry.causes?.join(', ')}>
                        {formatArrayItems(entry.causes)}
                      </span>
                    </Table.Td>
                    <Table.Td className="text-xs text-slate-600 max-w-[120px]">
                      <span title={entry.consequences?.join(', ')}>
                        {formatArrayItems(entry.consequences)}
                      </span>
                    </Table.Td>
                    <Table.Td className="text-xs text-slate-600 max-w-[120px]">
                      <span title={entry.safeguards?.join(', ')}>
                        {formatArrayItems(entry.safeguards)}
                      </span>
                    </Table.Td>
                    <Table.Td className="text-xs text-slate-600 max-w-[120px]">
                      <span title={entry.recommendations?.join(', ')}>
                        {formatArrayItems(entry.recommendations)}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      {entry.riskRanking ? (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${RISK_LEVEL_COLORS[entry.riskRanking.riskLevel]}`}
                        >
                          {entry.riskRanking.riskScore}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </Table.Td>
                  </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
          </div>
          <Pagination
            value={page}
            onChange={setPage}
            total={totalPages}
            size="xs"
            boundaries={1}
            siblings={0}
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
  );
}
