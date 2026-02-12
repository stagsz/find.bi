import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Button, Alert, Tabs, Loader } from '@mantine/core';
import { useAuthStore, selectUser } from '../store/auth.store';
import { authService } from '../services/auth.service';
import { projectsService, type ProjectListItem } from '../services/projects.service';
import { TeamMemberPanel } from '../components/projects/TeamMemberPanel';
import { ProjectSettingsPanel } from '../components/projects/ProjectSettingsPanel';
import { PIDUpload, DocumentList } from '../components/documents';
import { AnalysesTab } from '../components/analyses';
import { ErrorBoundary } from '../components/errors';
import type { ProjectStatus, ProjectMemberRole, ApiError, PIDDocumentWithUploader } from '@hazop/types';

/**
 * Project status display labels.
 */
const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  review: 'Review',
  completed: 'Completed',
  archived: 'Archived',
};

/**
 * Project status badge colors.
 */
const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  review: 'bg-amber-100 text-amber-800',
  completed: 'bg-slate-100 text-slate-800',
  archived: 'bg-red-100 text-red-800',
};

/**
 * Project member role display labels.
 */
const ROLE_LABELS: Record<ProjectMemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

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
 * Format date with time for display.
 */
const formatDateTime = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Props for the DocumentsTab component.
 */
interface DocumentsTabProps {
  project: ProjectListItem;
  currentUser: { id: string; role: string } | null;
  onDocumentUpload?: () => void;
}

/**
 * Documents tab component for the project detail page.
 * Shows the P&ID upload component and document list.
 */
function DocumentsTab({ project, currentUser, onDocumentUpload }: DocumentsTabProps) {
  // Track document list refresh key
  const [refreshKey, setRefreshKey] = useState(0);

  // Determine user's role in project
  const userRole = project.memberRole || (project.createdById === currentUser?.id ? 'owner' : null);

  // Only viewers cannot upload/delete
  const canModify =
    userRole === 'owner' || userRole === 'lead' || userRole === 'member';

  /**
   * Handle document upload completion.
   */
  const handleUploadComplete = (_document: PIDDocumentWithUploader) => {
    // Refresh project data (which could include document count)
    onDocumentUpload?.();
    // Refresh the document list
    setRefreshKey((prev) => prev + 1);
  };

  /**
   * Handle document deletion.
   */
  const handleDocumentDelete = () => {
    // Refresh project data
    onDocumentUpload?.();
  };

  return (
    <div>
      {/* Upload section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">
          Upload P&ID Document
        </h2>
        <PIDUpload
          projectId={project.id}
          onUploadComplete={handleUploadComplete}
          disabled={!canModify}
        />
      </div>

      {/* Documents list */}
      <DocumentList
        projectId={project.id}
        canDelete={canModify}
        onDocumentDelete={handleDocumentDelete}
        refreshKey={refreshKey}
      />
    </div>
  );
}

/**
 * Project detail page with tabs for Overview, Documents, Analysis, and Team.
 *
 * Features:
 * - Overview tab: project details and metadata
 * - Documents tab: placeholder for P&ID documents (future)
 * - Analysis tab: placeholder for HazOps analyses (future)
 * - Team tab: placeholder for team management (future)
 */
export function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const currentUser = useAuthStore(selectUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Project state
  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  /**
   * Fetch project details from the API.
   */
  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setError({ code: 'NOT_FOUND', message: 'Project ID is required' });
      setIsLoadingProject(false);
      return;
    }

    setIsLoadingProject(true);
    setError(null);

    const result = await projectsService.getProject(projectId);

    if (result.success && result.data) {
      setProject(result.data.project);
    } else {
      setError(result.error || { code: 'NOT_FOUND', message: 'Failed to load project' });
    }

    setIsLoadingProject(false);
  }, [projectId]);

  /**
   * Load project on mount and when projectId changes.
   */
  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  /**
   * Handle logout.
   */
  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  /**
   * Get the user's role in the project for display.
   */
  const getUserRole = (proj: ProjectListItem): string => {
    if (proj.memberRole) {
      return ROLE_LABELS[proj.memberRole];
    }
    // If user is creator but has no explicit role, they're the owner
    if (proj.createdById === currentUser?.id) {
      return ROLE_LABELS.owner;
    }
    return '-';
  };

  // Loading state
  if (isLoadingProject) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader size="lg" color="blue" />
          <p className="mt-4 text-slate-600">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state (project not found)
  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div>
                <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                  HazOp Assistant
                </Link>
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
                  styles={{
                    root: {
                      borderRadius: '4px',
                    },
                  }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="mb-6">
            <Link to="/" className="text-sm text-blue-700 hover:text-blue-800">
              Dashboard
            </Link>
            <span className="text-sm text-slate-400 mx-2">/</span>
            <Link to="/projects" className="text-sm text-blue-700 hover:text-blue-800">
              Projects
            </Link>
            <span className="text-sm text-slate-400 mx-2">/</span>
            <span className="text-sm text-slate-600">Not Found</span>
          </nav>

          <div className="bg-white rounded border border-slate-200 p-6">
            <Alert
              color="red"
              variant="light"
              title="Project Not Found"
              styles={{
                root: { borderRadius: '4px' },
              }}
            >
              {error?.message || 'The requested project could not be found.'}
            </Alert>
            <div className="mt-4">
              <Button
                variant="subtle"
                color="blue"
                onClick={() => navigate('/projects')}
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Back to Projects
              </Button>
            </div>
          </div>
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
            <div>
              <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                HazOp Assistant
              </Link>
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
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link to="/" className="text-sm text-blue-700 hover:text-blue-800">
            Dashboard
          </Link>
          <span className="text-sm text-slate-400 mx-2">/</span>
          <Link to="/projects" className="text-sm text-blue-700 hover:text-blue-800">
            Projects
          </Link>
          <span className="text-sm text-slate-400 mx-2">/</span>
          <span className="text-sm text-slate-600">{project.name}</span>
        </nav>

        <div className="bg-white rounded border border-slate-200">
          {/* Page header */}
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[project.status]}`}
                  >
                    {STATUS_LABELS[project.status]}
                  </span>
                </div>
                {project.description && (
                  <p className="text-sm text-slate-500 mt-1">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                  {getUserRole(project)}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            styles={{
              root: {
                borderRadius: 0,
              },
              list: {
                borderBottom: '1px solid #e2e8f0',
                paddingLeft: '24px',
              },
              tab: {
                fontWeight: 500,
                color: '#64748b',
                borderRadius: 0,
                '&:hover': {
                  backgroundColor: 'transparent',
                  color: '#334155',
                },
                '&[data-active]': {
                  color: '#1e40af',
                  borderBottomColor: '#1e40af',
                },
              },
              panel: {
                padding: '24px',
              },
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="documents">Documents</Tabs.Tab>
              <Tabs.Tab value="analysis">Analysis</Tabs.Tab>
              <Tabs.Tab value="team">Team</Tabs.Tab>
              <Tabs.Tab value="settings">Settings</Tabs.Tab>
            </Tabs.List>

            {/* Overview Tab */}
            <Tabs.Panel value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Project Details */}
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide">
                    Project Details
                  </h2>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Name</dt>
                      <dd className="mt-1 text-sm text-slate-900">{project.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Description</dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        {project.description || <span className="text-slate-400">No description</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Status</dt>
                      <dd className="mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[project.status]}`}
                        >
                          {STATUS_LABELS[project.status]}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Organization</dt>
                      <dd className="mt-1 text-sm text-slate-900">{project.organization}</dd>
                    </div>
                  </dl>
                </div>

                {/* Metadata */}
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide">
                    Metadata
                  </h2>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Created By</dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        {project.createdByName}
                        <span className="text-slate-400 ml-1">({project.createdByEmail})</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Created</dt>
                      <dd className="mt-1 text-sm text-slate-900">{formatDateTime(project.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Last Updated</dt>
                      <dd className="mt-1 text-sm text-slate-900">{formatDateTime(project.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-slate-500">Your Role</dt>
                      <dd className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {getUserRole(project)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </Tabs.Panel>

            {/* Documents Tab */}
            <Tabs.Panel value="documents">
              <ErrorBoundary
                fallbackVariant="section"
                fallbackTitle="Failed to load documents"
              >
                <DocumentsTab
                  project={project}
                  currentUser={currentUser}
                  onDocumentUpload={fetchProject}
                />
              </ErrorBoundary>
            </Tabs.Panel>

            {/* Analysis Tab */}
            <Tabs.Panel value="analysis">
              <ErrorBoundary
                fallbackVariant="section"
                fallbackTitle="Failed to load analyses"
              >
                <AnalysesTab projectId={project.id} />
              </ErrorBoundary>
            </Tabs.Panel>

            {/* Team Tab */}
            <Tabs.Panel value="team">
              <ErrorBoundary
                fallbackVariant="section"
                fallbackTitle="Failed to load team members"
              >
                <TeamMemberPanel project={project} onMembersChange={fetchProject} />
              </ErrorBoundary>
            </Tabs.Panel>

            {/* Settings Tab */}
            <Tabs.Panel value="settings">
              <ErrorBoundary
                fallbackVariant="section"
                fallbackTitle="Failed to load settings"
              >
                <ProjectSettingsPanel project={project} onProjectUpdate={fetchProject} />
              </ErrorBoundary>
            </Tabs.Panel>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
