import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Alert, Modal, TextInput, Select, Loader } from '@mantine/core';
import { projectsService, type ProjectListItem } from '../../services/projects.service';
import { adminService } from '../../services/admin.service';
import { useAuthStore, selectUser } from '../../store/auth.store';
import { useToast } from '../../hooks';
import type { ProjectMemberWithUser, ProjectMemberRole, ApiError, User } from '@hazop/types';

/**
 * Role display labels for project members.
 */
const ROLE_LABELS: Record<ProjectMemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

/**
 * Role badge colors for project members.
 */
const ROLE_COLORS: Record<ProjectMemberRole, string> = {
  owner: 'bg-purple-100 text-purple-800',
  lead: 'bg-blue-100 text-blue-800',
  member: 'bg-slate-100 text-slate-800',
  viewer: 'bg-slate-100 text-slate-600',
};

/**
 * Role options for adding a member (owner cannot be assigned via UI).
 */
const MEMBER_ROLE_OPTIONS = [
  { value: 'lead', label: 'Lead - Can manage analysis and team' },
  { value: 'member', label: 'Member - Can contribute to analysis' },
  { value: 'viewer', label: 'Viewer - Read-only access' },
];

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
 * Props for the TeamMemberPanel component.
 */
interface TeamMemberPanelProps {
  /** The project to manage team for */
  project: ProjectListItem;
  /** Callback when member list changes */
  onMembersChange?: () => void;
}

/**
 * Team member management panel component.
 *
 * Features:
 * - Display list of project members
 * - Add new members by email
 * - Remove existing members (owner and lead only)
 * - Role assignment on add
 */
export function TeamMemberPanel({ project, onMembersChange }: TeamMemberPanelProps) {
  const currentUser = useAuthStore(selectUser);
  const toast = useToast();

  // Members state
  const [members, setMembers] = useState<ProjectMemberWithUser[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Determine user's role in project
  const userRole = project.memberRole || (project.createdById === currentUser?.id ? 'owner' : null);
  const canManageMembers = userRole === 'owner' || userRole === 'lead';
  const isAdmin = currentUser?.role === 'administrator';

  // Add member modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectMemberRole>('member');
  const [searchResult, setSearchResult] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<ApiError | null>(null);

  // Remove member state
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  /**
   * Fetch project members.
   */
  const fetchMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    setError(null);

    const result = await projectsService.listMembers(project.id);

    if (result.success && result.data) {
      setMembers(result.data.members);
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to load members' });
    }

    setIsLoadingMembers(false);
  }, [project.id]);

  /**
   * Load members on mount.
   */
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  /**
   * Search for a user by email.
   */
  const handleSearchUser = async () => {
    if (!searchEmail.trim()) {
      setSearchError('Please enter an email address');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    // Use admin service to search for user by email
    // This requires admin privileges
    const result = await adminService.listUsers(
      { search: searchEmail.trim() },
      {},
      { limit: 10 }
    );

    if (result.success && result.data) {
      // Find exact email match
      const exactMatch = result.data.data.find(
        (u) => u.email.toLowerCase() === searchEmail.trim().toLowerCase()
      );

      if (exactMatch) {
        // Check if user is already a member
        const alreadyMember = members.some((m) => m.userId === exactMatch.id);
        if (alreadyMember) {
          setSearchError('This user is already a member of the project');
        } else {
          setSearchResult(exactMatch);
        }
      } else {
        setSearchError('No user found with this email address');
      }
    } else {
      // Handle permission error specifically
      if (result.error?.code === 'FORBIDDEN' || result.error?.code === 'AUTHENTICATION_ERROR') {
        setSearchError('User search requires administrator privileges');
      } else {
        setSearchError(result.error?.message || 'Failed to search for user');
      }
    }

    setIsSearching(false);
  };

  /**
   * Add the selected user as a member.
   */
  const handleAddMember = async () => {
    if (!searchResult) {
      return;
    }

    setIsAdding(true);
    setAddError(null);

    const result = await projectsService.addMember(project.id, searchResult.id, selectedRole);

    if (result.success) {
      // Refresh member list
      await fetchMembers();
      // Reset modal state
      handleCloseAddModal();
      // Notify parent
      onMembersChange?.();
      // Show success toast
      toast.success(`${searchResult.name} has been added to the project`, {
        title: 'Member Added',
      });
    } else {
      const error = result.error || { code: 'UNKNOWN', message: 'Failed to add member' };
      setAddError(error);
      toast.error(error, { title: 'Failed to Add Member' });
    }

    setIsAdding(false);
  };

  /**
   * Remove a member from the project.
   */
  const handleRemoveMember = async (userId: string) => {
    // Don't allow removing the owner
    const memberToRemove = members.find((m) => m.userId === userId);
    if (memberToRemove?.role === 'owner') {
      const error = { code: 'FORBIDDEN', message: 'Cannot remove the project owner' };
      setError(error);
      toast.error(error);
      return;
    }

    setRemovingUserId(userId);
    setError(null);

    const result = await projectsService.removeMember(project.id, userId);

    if (result.success) {
      // Refresh member list
      await fetchMembers();
      // Notify parent
      onMembersChange?.();
      // Show success toast
      toast.success(
        memberToRemove
          ? `${memberToRemove.userName} has been removed from the project`
          : 'Member has been removed',
        { title: 'Member Removed' }
      );
    } else {
      const error = result.error || { code: 'UNKNOWN', message: 'Failed to remove member' };
      setError(error);
      toast.error(error, { title: 'Failed to Remove Member' });
    }

    setRemovingUserId(null);
  };

  /**
   * Open the add member modal.
   */
  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setSearchEmail('');
    setSelectedRole('member');
    setSearchResult(null);
    setSearchError(null);
    setAddError(null);
  };

  /**
   * Close the add member modal.
   */
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setSearchEmail('');
    setSelectedRole('member');
    setSearchResult(null);
    setSearchError(null);
    setAddError(null);
  };

  // Loading state
  if (isLoadingMembers) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader size="md" color="blue" />
          <p className="mt-4 text-sm text-slate-500">Loading team members...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (members.length === 0 && !error) {
    return (
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
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-semibold text-slate-900">No team members</h3>
        <p className="mt-1 text-sm text-slate-500">
          Add team members to collaborate on this project.
        </p>
        {canManageMembers && (
          <Button
            onClick={handleOpenAddModal}
            className="mt-4"
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
            Add Member
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header with add button */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Team Members
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManageMembers && (
          <Button
            onClick={handleOpenAddModal}
            size="sm"
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
            Add Member
          </Button>
        )}
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

      {/* Members table */}
      <div className="border border-slate-200 rounded overflow-hidden">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr className="bg-slate-50">
              <Table.Th className="font-medium text-slate-700">Name</Table.Th>
              <Table.Th className="font-medium text-slate-700">Email</Table.Th>
              <Table.Th className="font-medium text-slate-700">Role</Table.Th>
              <Table.Th className="font-medium text-slate-700">Joined</Table.Th>
              {canManageMembers && (
                <Table.Th className="font-medium text-slate-700 text-right">Actions</Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {members.map((member) => (
              <Table.Tr key={member.id}>
                <Table.Td className="font-medium text-slate-900">
                  {member.userName}
                  {member.userId === currentUser?.id && (
                    <span className="ml-2 text-xs text-slate-400">(you)</span>
                  )}
                </Table.Td>
                <Table.Td className="text-slate-600">{member.userEmail}</Table.Td>
                <Table.Td>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[member.role]}`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                </Table.Td>
                <Table.Td className="text-slate-500 text-sm">
                  {formatDate(member.joinedAt)}
                </Table.Td>
                {canManageMembers && (
                  <Table.Td className="text-right">
                    {member.role !== 'owner' && member.userId !== currentUser?.id && (
                      <Button
                        variant="subtle"
                        size="xs"
                        color="red"
                        onClick={() => handleRemoveMember(member.userId)}
                        loading={removingUserId === member.userId}
                        styles={{
                          root: {
                            borderRadius: '4px',
                          },
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>

      {/* Add Member Modal */}
      <Modal
        opened={isAddModalOpen}
        onClose={handleCloseAddModal}
        title={<span className="font-semibold text-slate-900">Add Team Member</span>}
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
              Search for a user by their email address to add them to the project.
            </p>
            {!isAdmin && (
              <p className="text-xs text-amber-600 mt-2">
                Note: User search requires administrator privileges.
              </p>
            )}
          </div>

          {addError && (
            <Alert
              color="red"
              variant="light"
              className="mb-4"
              styles={{
                root: { borderRadius: '4px' },
              }}
              onClose={() => setAddError(null)}
              withCloseButton
            >
              {addError.message}
            </Alert>
          )}

          {/* Email search */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <TextInput
                placeholder="Enter user email"
                value={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.value);
                  setSearchResult(null);
                  setSearchError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchUser();
                  }
                }}
                className="flex-1"
                styles={{
                  input: {
                    borderRadius: '4px',
                    '&:focus': {
                      borderColor: '#1e40af',
                    },
                  },
                }}
              />
              <Button
                onClick={handleSearchUser}
                loading={isSearching}
                disabled={!searchEmail.trim()}
                variant="outline"
                styles={{
                  root: {
                    borderRadius: '4px',
                    borderColor: '#1e40af',
                    color: '#1e40af',
                    '&:hover': {
                      backgroundColor: '#eff6ff',
                    },
                  },
                }}
              >
                Search
              </Button>
            </div>
            {searchError && <p className="text-sm text-red-600 mt-2">{searchError}</p>}
          </div>

          {/* Search result */}
          {searchResult && (
            <div className="mb-4 p-4 bg-slate-50 rounded border border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{searchResult.name}</p>
                  <p className="text-sm text-slate-500">{searchResult.email}</p>
                  {searchResult.organization && (
                    <p className="text-xs text-slate-400 mt-1">{searchResult.organization}</p>
                  )}
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Found
                </span>
              </div>
            </div>
          )}

          {/* Role selection */}
          {searchResult && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Project Role <span className="text-red-500">*</span>
              </label>
              <Select
                data={MEMBER_ROLE_OPTIONS}
                value={selectedRole}
                onChange={(value) => setSelectedRole((value as ProjectMemberRole) || 'member')}
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
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="subtle"
              color="gray"
              onClick={handleCloseAddModal}
              disabled={isAdding}
              styles={{
                root: {
                  borderRadius: '4px',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              loading={isAdding}
              disabled={!searchResult}
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
              Add Member
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
