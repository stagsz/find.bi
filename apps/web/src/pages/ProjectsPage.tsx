import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, TextInput, Select, Table, Alert, Pagination, Modal, Textarea } from '@mantine/core';
import { useAuthStore, selectUser } from '../store/auth.store';
import { authService } from '../services/auth.service';
import {
  projectsService,
  type ListProjectsFilters,
  type ListProjectsSortOptions,
  type ProjectListItem,
} from '../services/projects.service';
import type { ProjectStatus, ProjectMemberRole, ApiError } from '@hazop/types';

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
 * Status filter options for the dropdown.
 */
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
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
 * Projects list page with status filters.
 *
 * Features:
 * - Paginated project list in a data table
 * - Search by name or description
 * - Filter by project status
 * - Sort by various fields
 * - View project details
 */
export function ProjectsPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore(selectUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Project list state
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
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

  // Create project modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<ApiError | null>(null);

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
   * Fetch projects from the API.
   */
  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setError(null);

    const filters: ListProjectsFilters = {};
    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    if (statusFilter) {
      filters.status = statusFilter as ProjectStatus;
    }

    const [sortBy, sortOrder] = sortValue.split(':') as [
      ListProjectsSortOptions['sortBy'],
      ListProjectsSortOptions['sortOrder'],
    ];

    const result = await projectsService.listProjects(filters, { sortBy, sortOrder }, { page, limit });

    if (result.success && result.data) {
      setProjects(result.data.data);
      setTotalPages(result.data.meta.totalPages);
      setTotal(result.data.meta.total);
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to load projects' });
    }

    setIsLoadingProjects(false);
  }, [page, debouncedSearch, statusFilter, sortValue]);

  /**
   * Load projects on mount and when filters/pagination change.
   */
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /**
   * Handle logout.
   */
  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
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
   * Reset filters.
   */
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setSortValue('created_at:desc');
    setPage(1);
  };

  /**
   * Open the create project modal.
   */
  const handleOpenCreateModal = () => {
    setNewProjectName('');
    setNewProjectDescription('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  /**
   * Close the create project modal.
   */
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewProjectName('');
    setNewProjectDescription('');
    setCreateError(null);
  };

  /**
   * Submit the create project form.
   */
  const handleCreateProject = async () => {
    // Validate name
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      setCreateError({ code: 'VALIDATION_ERROR', message: 'Project name is required' });
      return;
    }

    setIsCreatingProject(true);
    setCreateError(null);

    const result = await projectsService.createProject(
      trimmedName,
      newProjectDescription.trim() || undefined
    );

    if (result.success && result.data) {
      handleCloseCreateModal();
      // Refresh the project list to include the new project
      fetchProjects();
    } else {
      setCreateError(result.error || { code: 'UNKNOWN', message: 'Failed to create project' });
    }

    setIsCreatingProject(false);
  };

  /**
   * Get the user's role in the project for display.
   */
  const getUserRole = (project: ProjectListItem): string => {
    if (project.memberRole) {
      return ROLE_LABELS[project.memberRole];
    }
    // If user is creator but has no explicit role, they're the owner
    if (project.createdById === currentUser?.id) {
      return ROLE_LABELS.owner;
    }
    return '-';
  };

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
              <Link
                to="/profile"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
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
          <span className="text-sm text-slate-600">Projects</span>
        </nav>

        <div className="bg-white rounded border border-slate-200">
          {/* Page header */}
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage your HazOps study projects
              </p>
            </div>
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
              New Project
            </Button>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
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
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <div className="px-6 py-4">
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
          <div className="overflow-x-auto">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr className="bg-slate-50">
                  <Table.Th className="font-medium text-slate-700">Name</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Status</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Your Role</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Created By</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Created</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Updated</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoadingProjects ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} className="text-center py-8 text-slate-500">
                      Loading projects...
                    </Table.Td>
                  </Table.Tr>
                ) : projects.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} className="text-center py-8 text-slate-500">
                      No projects found
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  projects.map((project) => (
                    <Table.Tr key={project.id}>
                      <Table.Td>
                        <div>
                          <div className="font-medium text-slate-900">{project.name}</div>
                          {project.description && (
                            <div className="text-sm text-slate-500 truncate max-w-[300px]">
                              {project.description}
                            </div>
                          )}
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[project.status]}`}
                        >
                          {STATUS_LABELS[project.status]}
                        </span>
                      </Table.Td>
                      <Table.Td>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {getUserRole(project)}
                        </span>
                      </Table.Td>
                      <Table.Td className="text-slate-600">
                        <div>
                          <div className="text-sm">{project.createdByName}</div>
                          <div className="text-xs text-slate-400">{project.createdByEmail}</div>
                        </div>
                      </Table.Td>
                      <Table.Td className="text-slate-500 text-sm">
                        {formatDate(project.createdAt)}
                      </Table.Td>
                      <Table.Td className="text-slate-500 text-sm">
                        {formatDate(project.updatedAt)}
                      </Table.Td>
                      <Table.Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="subtle"
                            size="xs"
                            color="blue"
                            onClick={() => navigate(`/projects/${project.id}`)}
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
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} projects
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
        </div>
      </main>

      {/* Create Project Modal */}
      <Modal
        opened={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title={
          <span className="font-semibold text-slate-900">
            New Project
          </span>
        }
        centered
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
          <div className="mb-4">
            <p className="text-sm text-slate-600">
              Create a new HazOps study project. You can add team members and upload P&ID documents after creation.
            </p>
          </div>

          {createError && (
            <Alert
              color="red"
              variant="light"
              className="mb-4"
              styles={{
                root: { borderRadius: '4px' },
              }}
              onClose={() => setCreateError(null)}
              withCloseButton
            >
              {createError.message}
            </Alert>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <TextInput
              placeholder="Enter project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
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

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <Textarea
              placeholder="Enter project description (optional)"
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              minRows={3}
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="subtle"
              color="gray"
              onClick={handleCloseCreateModal}
              disabled={isCreatingProject}
              styles={{
                root: {
                  borderRadius: '4px',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              loading={isCreatingProject}
              disabled={!newProjectName.trim()}
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
              Create Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
