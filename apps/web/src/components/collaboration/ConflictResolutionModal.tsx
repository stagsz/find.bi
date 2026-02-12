/**
 * Conflict resolution modal for concurrent edit conflicts.
 *
 * Displays when two users edit the same entry simultaneously, showing
 * a side-by-side comparison of server state vs. user changes with
 * options to accept server, accept client, or merge.
 *
 * @module components/collaboration/ConflictResolutionModal
 */

import { useState, useMemo } from 'react';
import { Modal, Button, Alert } from '@mantine/core';
import type {
  ConflictDetectedPayload,
  ConflictEntrySnapshot,
} from '../../hooks/useWebSocket';

// ============================================================================
// Types
// ============================================================================

type ResolutionStrategy = 'accept_server' | 'accept_client' | 'merge';

interface ConflictResolutionModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Conflict data from WebSocket */
  conflict: ConflictDetectedPayload | null;
  /** Callback when user selects a resolution */
  onResolve: (strategy: ResolutionStrategy, mergedData?: Partial<ConflictEntrySnapshot>) => void;
  /** Callback when user cancels/dismisses */
  onCancel: () => void;
  /** Whether resolution is being submitted */
  isSubmitting?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format array values for display.
 */
function formatArray(items: string[] | null | undefined): string {
  if (!items || items.length === 0) return '(none)';
  return items.join(', ');
}

/**
 * Format a date for display.
 */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

/**
 * Check if a value has changed between server and client.
 */
function hasChanged(serverValue: unknown, clientValue: unknown): boolean {
  if (serverValue === undefined || clientValue === undefined) {
    return false;
  }
  if (Array.isArray(serverValue) && Array.isArray(clientValue)) {
    return JSON.stringify(serverValue) !== JSON.stringify(clientValue);
  }
  return serverValue !== clientValue;
}

/**
 * Get changed field names from client changes.
 */
function getChangedFields(
  serverData: ConflictEntrySnapshot,
  clientChanges: Record<string, unknown>
): string[] {
  const fields: string[] = [];
  const fieldMap: Record<string, keyof ConflictEntrySnapshot> = {
    deviation: 'deviation',
    causes: 'causes',
    consequences: 'consequences',
    safeguards: 'safeguards',
    recommendations: 'recommendations',
    notes: 'notes',
    severity: 'severity',
    likelihood: 'likelihood',
    detectability: 'detectability',
  };

  for (const [clientKey, serverKey] of Object.entries(fieldMap)) {
    if (clientKey in clientChanges && hasChanged(serverData[serverKey], clientChanges[clientKey])) {
      fields.push(clientKey);
    }
  }

  return fields;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Field comparison row showing server vs client values.
 */
function FieldComparison({
  label,
  serverValue,
  clientValue,
  isArray = false,
}: {
  label: string;
  serverValue: unknown;
  clientValue: unknown;
  isArray?: boolean;
}) {
  const changed = hasChanged(serverValue, clientValue);
  const serverDisplay = isArray
    ? formatArray(serverValue as string[])
    : String(serverValue ?? '(none)');
  const clientDisplay = isArray
    ? formatArray(clientValue as string[])
    : String(clientValue ?? '(none)');

  return (
    <div className={`border-b border-slate-200 last:border-b-0 ${changed ? 'bg-amber-50' : ''}`}>
      <div className="px-3 py-2">
        <div className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-2">
          {label}
          {changed && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
              CHANGED
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-sm text-slate-900">
            <div className="text-[10px] text-slate-400 uppercase mb-0.5">Server (current)</div>
            <div className="bg-green-50 border border-green-200 rounded px-2 py-1.5 text-xs break-words">
              {serverDisplay}
            </div>
          </div>
          <div className="text-sm text-slate-900">
            <div className="text-[10px] text-slate-400 uppercase mb-0.5">Your changes</div>
            <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1.5 text-xs break-words">
              {clientDisplay}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Modal for resolving concurrent edit conflicts.
 *
 * Shows a comparison of server state vs. client changes and allows
 * the user to choose how to resolve the conflict.
 *
 * @example
 * ```tsx
 * <ConflictResolutionModal
 *   isOpen={!!pendingConflict}
 *   conflict={pendingConflict}
 *   onResolve={(strategy) => handleResolve(strategy)}
 *   onCancel={() => clearConflict()}
 * />
 * ```
 */
export function ConflictResolutionModal({
  isOpen,
  conflict,
  onResolve,
  onCancel,
  isSubmitting = false,
}: ConflictResolutionModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<ResolutionStrategy | null>(null);

  // Calculate which fields have conflicts
  const changedFields = useMemo(() => {
    if (!conflict) return [];
    return getChangedFields(conflict.serverData, conflict.clientChanges);
  }, [conflict]);

  if (!conflict) {
    return null;
  }

  const { serverData, clientChanges, conflictingUserEmail, conflictedAt, expectedVersion, currentVersion } = conflict;

  const handleResolve = (strategy: ResolutionStrategy) => {
    setSelectedStrategy(strategy);
    onResolve(strategy);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onCancel}
      title={
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="font-semibold text-slate-900">Edit Conflict Detected</span>
        </div>
      }
      size="lg"
      centered
      closeOnClickOutside={!isSubmitting}
      closeOnEscape={!isSubmitting}
      styles={{
        content: { borderRadius: '4px' },
        header: { borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' },
      }}
    >
      <div className="mt-4 space-y-4">
        {/* Conflict summary */}
        <Alert
          color="amber"
          variant="light"
          styles={{ root: { borderRadius: '4px' } }}
        >
          <div className="text-sm">
            <p className="font-medium text-amber-900">
              Another user made changes while you were editing.
            </p>
            <p className="mt-1 text-amber-800">
              <span className="font-medium">{conflictingUserEmail || 'Unknown user'}</span>
              {' '}saved changes at {formatDate(conflictedAt)}. Your changes could not be saved automatically.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Your version: {expectedVersion} → Server version: {currentVersion}
            </p>
          </div>
        </Alert>

        {/* Changed fields summary */}
        <div className="text-sm text-slate-600">
          <span className="font-medium">{changedFields.length}</span> field{changedFields.length !== 1 ? 's' : ''} affected:{' '}
          <span className="text-slate-900">{changedFields.join(', ')}</span>
        </div>

        {/* Field comparisons */}
        <div className="border border-slate-200 rounded overflow-hidden max-h-64 overflow-y-auto">
          {/* Deviation */}
          {'deviation' in clientChanges && (
            <FieldComparison
              label="Deviation"
              serverValue={serverData.deviation}
              clientValue={clientChanges.deviation}
            />
          )}

          {/* Causes */}
          {'causes' in clientChanges && (
            <FieldComparison
              label="Causes"
              serverValue={serverData.causes}
              clientValue={clientChanges.causes}
              isArray
            />
          )}

          {/* Consequences */}
          {'consequences' in clientChanges && (
            <FieldComparison
              label="Consequences"
              serverValue={serverData.consequences}
              clientValue={clientChanges.consequences}
              isArray
            />
          )}

          {/* Safeguards */}
          {'safeguards' in clientChanges && (
            <FieldComparison
              label="Safeguards"
              serverValue={serverData.safeguards}
              clientValue={clientChanges.safeguards}
              isArray
            />
          )}

          {/* Recommendations */}
          {'recommendations' in clientChanges && (
            <FieldComparison
              label="Recommendations"
              serverValue={serverData.recommendations}
              clientValue={clientChanges.recommendations}
              isArray
            />
          )}

          {/* Notes */}
          {'notes' in clientChanges && (
            <FieldComparison
              label="Notes"
              serverValue={serverData.notes}
              clientValue={clientChanges.notes}
            />
          )}

          {/* Risk fields */}
          {'severity' in clientChanges && (
            <FieldComparison
              label="Severity"
              serverValue={serverData.severity}
              clientValue={clientChanges.severity}
            />
          )}

          {'likelihood' in clientChanges && (
            <FieldComparison
              label="Likelihood"
              serverValue={serverData.likelihood}
              clientValue={clientChanges.likelihood}
            />
          )}

          {'detectability' in clientChanges && (
            <FieldComparison
              label="Detectability"
              serverValue={serverData.detectability}
              clientValue={clientChanges.detectability}
            />
          )}
        </div>

        {/* Resolution options */}
        <div className="space-y-3 pt-2">
          <div className="text-sm font-medium text-slate-700">Choose how to resolve:</div>

          {/* Accept server (discard local) */}
          <button
            type="button"
            onClick={() => handleResolve('accept_server')}
            disabled={isSubmitting}
            className={`
              w-full text-left p-3 rounded border transition-colors
              ${selectedStrategy === 'accept_server' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-green-300 hover:bg-green-50/50'}
              ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-green-900">Keep server version</div>
                <div className="text-xs text-green-700 mt-0.5">
                  Discard your changes and use the current saved version
                </div>
              </div>
            </div>
          </button>

          {/* Accept client (overwrite server) */}
          <button
            type="button"
            onClick={() => handleResolve('accept_client')}
            disabled={isSubmitting}
            className={`
              w-full text-left p-3 rounded border transition-colors
              ${selectedStrategy === 'accept_client' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'}
              ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-blue-500 bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-blue-900">Use your version</div>
                <div className="text-xs text-blue-700 mt-0.5">
                  Overwrite the server with your changes (may lose the other user's work)
                </div>
              </div>
            </div>
          </button>

          {/* Merge (manual review needed) - disabled for now */}
          <button
            type="button"
            disabled
            className="w-full text-left p-3 rounded border border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-slate-600">Merge changes</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Manual merge is not yet supported. Coming soon.
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="subtle"
            color="gray"
            onClick={onCancel}
            disabled={isSubmitting}
            styles={{ root: { borderRadius: '4px' } }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConflictResolutionModal;
