import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Button, Alert, Loader, Tabs } from '@mantine/core';
import { useAuthStore, selectUser } from '../store/auth.store';
import { authService } from '../services/auth.service';
import { projectsService } from '../services/projects.service';
import { analysesService } from '../services/analyses.service';
import { reportsService } from '../services/reports.service';
import { ReportRequestForm, ReportProgressIndicator } from '../components/reports';
import type {
  ReportWithDetails,
  ReportTemplateWithCreator,
  ReportFormat,
  ReportStatus,
  ApiError,
  HazopsAnalysisWithDetails,
} from '@hazop/types';
import { REPORT_STATUS_LABELS } from '@hazop/types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Status colors for reports.
 */
const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  generating: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

/**
 * Format icons (simple SVG representations).
 */
const FORMAT_ICONS: Record<ReportFormat, string> = {
  pdf: 'PDF',
  word: 'DOC',
  excel: 'XLS',
  powerpoint: 'PPT',
};

/**
 * Polling interval for status updates (ms).
 */
const POLL_INTERVAL = 3000;

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
  const colors: Record<ReportFormat, string> = {
    pdf: 'bg-red-50 text-red-700 border-red-200',
    word: 'bg-blue-50 text-blue-700 border-blue-200',
    excel: 'bg-green-50 text-green-700 border-green-200',
    powerpoint: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${colors[format]}`}>
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
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[status]}`}>
      {REPORT_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Active report card with progress.
 */
interface ActiveReportCardProps {
  report: ReportWithDetails;
  progress?: number;
  onRefresh: () => void;
}

function ActiveReportCard({ report, progress, onRefresh }: ActiveReportCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium text-slate-900">{report.name}</h3>
          <p className="text-sm text-slate-500">Analysis: {report.analysisName}</p>
        </div>
        <div className="flex items-center gap-2">
          <FormatBadge format={report.format} />
          <StatusBadge status={report.status} />
        </div>
      </div>

      {/* Progress indicator for pending/generating states */}
      {(report.status === 'pending' || report.status === 'generating') && (
        <ReportProgressIndicator
          status={report.status}
          progress={progress}
          size="sm"
          showMessage={true}
          className="mt-3"
        />
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
        <span className="text-xs text-slate-500">
          Requested {formatDate(report.requestedAt)}
        </span>
        <Button variant="subtle" size="xs" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

/**
 * Report generation center page.
 *
 * Provides a comprehensive interface for:
 * - Generating new reports from HazOps analyses
 * - Viewing active report generation jobs
 * - Browsing and downloading completed reports
 */
export function ReportGenerationCenterPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const currentUser = useAuthStore(selectUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Project state
  const [projectName, setProjectName] = useState<string>('');
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<string | null>('generate');

  // Generate tab state
  const [analyses, setAnalyses] = useState<HazopsAnalysisWithDetails[]>([]);
  const [templates, setTemplates] = useState<ReportTemplateWithCreator[]>([]);

  // Reports state
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<ApiError | null>(null);

  // Active reports with progress tracking
  const [activeReports, setActiveReports] = useState<Map<string, number>>(new Map());

  // General error
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Fetch project details.
   */
  const fetchProject = useCallback(async () => {
    if (!projectId) return;

    setIsLoadingProject(true);
    const result = await projectsService.getProject(projectId);

    if (result.success && result.data) {
      setProjectName(result.data.project.name);
    } else {
      setError(result.error || { code: 'NOT_FOUND', message: 'Failed to load project' });
    }
    setIsLoadingProject(false);
  }, [projectId]);

  /**
   * Fetch analyses for the project.
   */
  const fetchAnalyses = useCallback(async () => {
    if (!projectId) return;

    const result = await analysesService.listAnalyses(projectId, {}, {}, { limit: 100 });

    if (result.success && result.data) {
      // Filter to only show approved analyses that can have reports generated
      const allAnalyses = result.data.data;
      setAnalyses(allAnalyses.filter(a => a.status === 'approved' || a.status === 'in_review'));
    }
  }, [projectId]);

  /**
   * Fetch available templates.
   */
  const fetchTemplates = useCallback(async () => {
    const result = await reportsService.listTemplates({ isActive: true }, { limit: 100 });

    if (result.success && result.data) {
      setTemplates(result.data.data);
    }
  }, []);

  /**
   * Fetch reports for the project.
   */
  const fetchReports = useCallback(async () => {
    if (!projectId) return;

    setIsLoadingReports(true);
    setReportsError(null);

    const result = await reportsService.listReports(
      projectId,
      {},
      { sortBy: 'requested_at', sortOrder: 'desc' },
      { limit: 50 }
    );

    if (result.success && result.data) {
      setReports(result.data.data);

      // Track active reports for progress polling
      const active = new Map<string, number>();
      result.data.data.forEach(report => {
        if (report.status === 'pending' || report.status === 'generating') {
          active.set(report.id, 0);
        }
      });
      setActiveReports(active);
    } else {
      setReportsError(result.error || { code: 'INTERNAL_ERROR', message: 'Failed to load reports' });
    }

    setIsLoadingReports(false);
  }, [projectId]);

  /**
   * Poll status for active reports.
   */
  const pollActiveReports = useCallback(async () => {
    if (activeReports.size === 0) return;

    const updatedReports = [...reports];
    const updatedActive = new Map(activeReports);
    let hasChanges = false;

    for (const reportId of activeReports.keys()) {
      const result = await reportsService.getReportStatus(reportId);

      if (result.success && result.data) {
        const status = result.data;
        const reportIndex = updatedReports.findIndex(r => r.id === reportId);

        if (reportIndex !== -1) {
          // Update progress
          if (status.progress !== undefined) {
            updatedActive.set(reportId, status.progress);
          }

          // Update status if changed
          if (updatedReports[reportIndex].status !== status.status) {
            updatedReports[reportIndex] = {
              ...updatedReports[reportIndex],
              status: status.status,
              generatedAt: status.completedAt,
              errorMessage: status.errorMessage,
            };
            hasChanges = true;

            // Remove from active if completed or failed
            if (status.status === 'completed' || status.status === 'failed') {
              updatedActive.delete(reportId);
            }
          }
        }
      }
    }

    if (hasChanges) {
      setReports(updatedReports);
    }
    setActiveReports(updatedActive);
  }, [activeReports, reports]);

  /**
   * Handle report generation request from the form.
   */
  const handleReportRequested = useCallback(async () => {
    // Refresh reports list
    await fetchReports();
    // Switch to active tab
    setActiveTab('active');
  }, [fetchReports]);

  /**
   * Handle report download.
   */
  const handleDownload = async (reportId: string) => {
    const result = await reportsService.downloadReport(reportId);

    if (result.success && result.data) {
      // Open download URL in new tab
      window.open(result.data.downloadUrl, '_blank');
    }
  };

  /**
   * Handle logout.
   */
  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  /**
   * Get active reports list.
   */
  const activeReportsList = reports.filter(
    r => r.status === 'pending' || r.status === 'generating'
  );

  /**
   * Get completed reports list.
   */
  const completedReportsList = reports.filter(
    r => r.status === 'completed' || r.status === 'failed'
  );

  // Load initial data
  useEffect(() => {
    fetchProject();
    fetchAnalyses();
    fetchTemplates();
    fetchReports();
  }, [fetchProject, fetchAnalyses, fetchTemplates, fetchReports]);

  // Poll active reports
  useEffect(() => {
    if (activeReports.size === 0) return;

    const interval = setInterval(pollActiveReports, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [activeReports.size, pollActiveReports]);

  // Loading state
  if (isLoadingProject) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader size="lg" color="blue" />
          <p className="mt-4 text-slate-600">Loading report center...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                HazOp Assistant
              </Link>
              <div className="flex items-center gap-4">
                <Link to="/profile" className="text-sm text-slate-600 hover:text-slate-900">
                  {currentUser?.name}
                </Link>
                <Button
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={handleLogout}
                  loading={isLoading}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert color="red" title="Error" mb="md">
            {error.message}
          </Alert>
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Back to Project
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                HazOp Assistant
              </Link>
              <span className="text-slate-400">/</span>
              <Link
                to={`/projects/${projectId}`}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                {projectName}
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm text-slate-900 font-medium">Reports</span>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/profile" className="text-sm text-slate-600 hover:text-slate-900">
                {currentUser?.name} ({currentUser?.role.replace('_', ' ')})
              </Link>
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                onClick={handleLogout}
                loading={isLoading}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Report Generation Center</h1>
          <p className="text-slate-500 mt-1">
            Generate and manage reports for {projectName}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="generate">Generate Report</Tabs.Tab>
            <Tabs.Tab value="active">
              Active ({activeReportsList.length})
            </Tabs.Tab>
            <Tabs.Tab value="history">
              Report History ({completedReportsList.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* Generate Report Tab */}
          <Tabs.Panel value="generate" pt="md">
            {projectId && (
              <ReportRequestForm
                projectId={projectId}
                analyses={analyses}
                templates={templates}
                onReportRequested={handleReportRequested}
              />
            )}
          </Tabs.Panel>

          {/* Active Reports Tab */}
          <Tabs.Panel value="active" pt="md">
            {activeReportsList.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded p-8 text-center">
                <div className="text-slate-400 mb-4">
                  <svg
                    className="w-12 h-12 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Active Reports</h3>
                <p className="text-slate-500 mb-4">
                  Generate a new report to see it here while it's being processed.
                </p>
                <Button variant="outline" onClick={() => setActiveTab('generate')}>
                  Generate Report
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeReportsList.map(report => (
                  <ActiveReportCard
                    key={report.id}
                    report={report}
                    progress={activeReports.get(report.id)}
                    onRefresh={fetchReports}
                  />
                ))}
              </div>
            )}
          </Tabs.Panel>

          {/* Report History Tab */}
          <Tabs.Panel value="history" pt="md">
            {isLoadingReports ? (
              <div className="text-center py-8">
                <Loader size="md" color="blue" />
                <p className="mt-2 text-slate-600">Loading reports...</p>
              </div>
            ) : reportsError ? (
              <Alert color="red" title="Error">
                {reportsError.message}
              </Alert>
            ) : completedReportsList.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded p-8 text-center">
                <div className="text-slate-400 mb-4">
                  <svg
                    className="w-12 h-12 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Reports Yet</h3>
                <p className="text-slate-500 mb-4">
                  Generated reports will appear here once they're completed.
                </p>
                <Button variant="outline" onClick={() => setActiveTab('generate')}>
                  Generate Your First Report
                </Button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Analysis</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600">Format</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Size</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Generated</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">By</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedReportsList.map(report => (
                      <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900">{report.name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {report.analysisName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <FormatBadge format={report.format} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={report.status} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatFileSize(report.fileSize)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {formatDate(report.generatedAt)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {report.generatedByName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {report.status === 'completed' ? (
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={() => handleDownload(report.id)}
                            >
                              Download
                            </Button>
                          ) : report.status === 'failed' ? (
                            <span className="text-xs text-red-600" title={report.errorMessage || 'Unknown error'}>
                              Failed
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tabs.Panel>
        </Tabs>
      </main>
    </div>
  );
}
