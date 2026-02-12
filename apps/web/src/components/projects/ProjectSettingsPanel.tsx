import { useState, useEffect } from 'react';
import { Button, TextInput, Textarea, Select, Alert } from '@mantine/core';
import { projectsService, type ProjectListItem } from '../../services/projects.service';
import { useAuthStore, selectUser } from '../../store/auth.store';
import { useToast } from '../../hooks';
import type { ProjectStatus, ApiError } from '@hazop/types';

/**
 * Status display labels.
 */
const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  review: 'Review',
  completed: 'Completed',
  archived: 'Archived',
};

/**
 * Status descriptions for the dropdown.
 */
const STATUS_DESCRIPTIONS: Record<ProjectStatus, string> = {
  planning: 'Initial setup, P&ID upload',
  active: 'Analysis in progress',
  review: 'Analysis complete, awaiting approval',
  completed: 'Approved and finalized',
  archived: 'Historical record',
};

/**
 * Status options for the select dropdown.
 */
const STATUS_OPTIONS = [
  { value: 'planning', label: `${STATUS_LABELS.planning} - ${STATUS_DESCRIPTIONS.planning}` },
  { value: 'active', label: `${STATUS_LABELS.active} - ${STATUS_DESCRIPTIONS.active}` },
  { value: 'review', label: `${STATUS_LABELS.review} - ${STATUS_DESCRIPTIONS.review}` },
  { value: 'completed', label: `${STATUS_LABELS.completed} - ${STATUS_DESCRIPTIONS.completed}` },
  { value: 'archived', label: `${STATUS_LABELS.archived} - ${STATUS_DESCRIPTIONS.archived}` },
];

/**
 * Props for the ProjectSettingsPanel component.
 */
interface ProjectSettingsPanelProps {
  /** The project to edit settings for */
  project: ProjectListItem;
  /** Callback when project settings are updated */
  onProjectUpdate?: () => void;
}

/**
 * Project settings panel component.
 *
 * Features:
 * - Edit project name
 * - Edit project description
 * - Change project status
 * - Save changes with validation
 */
export function ProjectSettingsPanel({ project, onProjectUpdate }: ProjectSettingsPanelProps) {
  const currentUser = useAuthStore(selectUser);
  const toast = useToast();

  // Form state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [status, setStatus] = useState<ProjectStatus>(project.status);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Determine user's role in project
  const userRole = project.memberRole || (project.createdById === currentUser?.id ? 'owner' : null);
  const canEditSettings = userRole === 'owner' || userRole === 'lead';

  // Check if form has changes
  const hasChanges =
    name !== project.name ||
    description !== (project.description || '') ||
    status !== project.status;

  // Validation
  const nameError = name.trim().length === 0 ? 'Project name is required' : null;
  const isValid = !nameError;

  /**
   * Reset form when project changes.
   */
  useEffect(() => {
    setName(project.name);
    setDescription(project.description || '');
    setStatus(project.status);
    setError(null);
  }, [project.id, project.name, project.description, project.status]);

  /**
   * Handle form submission.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || !hasChanges) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await projectsService.updateProject(project.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
    });

    if (result.success) {
      onProjectUpdate?.();
      toast.success('Project settings updated successfully', { title: 'Settings Saved' });
    } else {
      const err = result.error || { code: 'UNKNOWN', message: 'Failed to update project' };
      setError(err);
      toast.error(err, { title: 'Update Failed' });
    }

    setIsSaving(false);
  };

  /**
   * Reset form to original values.
   */
  const handleReset = () => {
    setName(project.name);
    setDescription(project.description || '');
    setStatus(project.status);
    setError(null);
  };

  // Read-only state for viewers
  if (!canEditSettings) {
    return (
      <div>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Project Settings
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            View project configuration (read-only)
          </p>
        </div>

        <div className="border border-slate-200 rounded p-6 bg-slate-50">
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
              <dd className="mt-1 text-sm text-slate-900">
                {STATUS_LABELS[project.status]}
                <span className="text-slate-500 ml-1">
                  ({STATUS_DESCRIPTIONS[project.status]})
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-xs text-slate-500">
            Only project owners and leads can modify settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Project Settings
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Update project name, description, and status
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <Alert
          color="red"
          variant="light"
          className="mb-4"
          styles={{
            root: { borderRadius: '4px' },
          }}
          onClose={() => setError(null)}
          withCloseButton
        >
          {error.message}
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="border border-slate-200 rounded p-6">
        {/* Name field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Project Name <span className="text-red-500">*</span>
          </label>
          <TextInput
            placeholder="Enter project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
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

        {/* Description field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <Textarea
            placeholder="Enter project description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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

        {/* Status field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Status
          </label>
          <Select
            data={STATUS_OPTIONS}
            value={status}
            onChange={(value) => setStatus((value as ProjectStatus) || 'planning')}
            styles={{
              input: {
                borderRadius: '4px',
                '&:focus': {
                  borderColor: '#1e40af',
                },
              },
            }}
          />
          <p className="text-xs text-slate-500 mt-2">
            Changing the status affects project visibility and workflow.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="subtle"
            color="gray"
            onClick={handleReset}
            disabled={isSaving || !hasChanges}
            styles={{
              root: {
                borderRadius: '4px',
              },
            }}
          >
            Reset
          </Button>
          <Button
            type="submit"
            loading={isSaving}
            disabled={!isValid || !hasChanges}
            styles={{
              root: {
                borderRadius: '4px',
                backgroundColor: '#1e40af',
                '&:hover': {
                  backgroundColor: '#1e3a8a',
                },
                '&:disabled': {
                  backgroundColor: '#94a3b8',
                },
              },
            }}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
