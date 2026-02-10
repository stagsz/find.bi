import { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal, TextInput, Textarea, Select, Button, Alert, NumberInput } from '@mantine/core';
import type { EquipmentType, ApiError, AnalysisNodeWithCreator } from '@hazop/types';
import { EQUIPMENT_TYPES, EQUIPMENT_TYPE_LABELS } from '@hazop/types';
import { nodesService, type UpdateNodePayload } from '../../services/nodes.service';

/**
 * Props for the NodeEditModal component.
 */
interface NodeEditModalProps {
  /** Whether the modal is open */
  isOpen: boolean;

  /** Callback when the modal is closed */
  onClose: () => void;

  /** The node being edited */
  node: AnalysisNodeWithCreator | null;

  /** Callback when the node is successfully updated */
  onNodeUpdated: (node: AnalysisNodeWithCreator) => void;
}

/**
 * Equipment type options for the Select dropdown.
 */
const EQUIPMENT_TYPE_OPTIONS = EQUIPMENT_TYPES.map((type) => ({
  value: type,
  label: EQUIPMENT_TYPE_LABELS[type],
}));

/**
 * NodeEditModal component for editing existing analysis nodes on a P&ID.
 *
 * Features:
 * - Modal form with fields for node ID, description, equipment type, and position
 * - Pre-populated with current node data
 * - Form validation (node ID is required)
 * - Only sends changed fields to API
 * - Loading state during submission
 * - Error handling with user-friendly messages
 *
 * Usage:
 * - Displayed when a user clicks on an existing node to edit it
 * - All fields can be modified including position coordinates
 */
export function NodeEditModal({
  isOpen,
  onClose,
  node,
  onNodeUpdated,
}: NodeEditModalProps) {
  // Form state
  const [nodeId, setNodeId] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('other');
  const [x, setX] = useState<number>(0);
  const [y, setY] = useState<number>(0);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Initialize form state from node data when modal opens.
   */
  useEffect(() => {
    if (isOpen && node) {
      setNodeId(node.nodeId);
      setDescription(node.description);
      setEquipmentType(node.equipmentType);
      setX(node.x);
      setY(node.y);
      setError(null);
    }
  }, [isOpen, node]);

  /**
   * Check if the form is valid for submission.
   */
  const isFormValid = useMemo(() => {
    return nodeId.trim().length > 0;
  }, [nodeId]);

  /**
   * Check if any field has changed from the original node data.
   */
  const hasChanges = useMemo(() => {
    if (!node) return false;
    return (
      nodeId.trim() !== node.nodeId ||
      description.trim() !== node.description ||
      equipmentType !== node.equipmentType ||
      x !== node.x ||
      y !== node.y
    );
  }, [node, nodeId, description, equipmentType, x, y]);

  /**
   * Build update payload with only changed fields.
   */
  const buildUpdatePayload = useCallback((): UpdateNodePayload => {
    if (!node) return {};

    const payload: UpdateNodePayload = {};

    const trimmedNodeId = nodeId.trim();
    const trimmedDescription = description.trim();

    if (trimmedNodeId !== node.nodeId) {
      payload.nodeId = trimmedNodeId;
    }
    if (trimmedDescription !== node.description) {
      payload.description = trimmedDescription;
    }
    if (equipmentType !== node.equipmentType) {
      payload.equipmentType = equipmentType;
    }
    if (x !== node.x) {
      payload.x = x;
    }
    if (y !== node.y) {
      payload.y = y;
    }

    return payload;
  }, [node, nodeId, description, equipmentType, x, y]);

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(async () => {
    if (!isFormValid || !hasChanges || !node) return;

    setIsSubmitting(true);
    setError(null);

    const payload = buildUpdatePayload();

    const result = await nodesService.updateNode(node.id, payload);

    setIsSubmitting(false);

    if (result.success && result.data) {
      onNodeUpdated(result.data.node);
      onClose();
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to update node' });
    }
  }, [isFormValid, hasChanges, node, buildUpdatePayload, onNodeUpdated, onClose]);

  /**
   * Handle modal close (reset error state).
   */
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  /**
   * Handle Enter key to submit form.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && isFormValid && hasChanges && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [isFormValid, hasChanges, isSubmitting, handleSubmit]
  );

  // Don't render if no node is provided
  if (!node) return null;

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        <span className="font-semibold text-slate-900">
          Edit Analysis Node
        </span>
      }
      centered
      closeOnClickOutside={!isSubmitting}
      closeOnEscape={!isSubmitting}
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
      <div className="mt-4" onKeyDown={handleKeyDown}>
        <div className="mb-4">
          <p className="text-sm text-slate-600">
            Edit the properties of this analysis node.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Created by {node.createdByName} ({node.createdByEmail})
          </p>
        </div>

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

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Node ID <span className="text-red-500">*</span>
          </label>
          <TextInput
            placeholder="e.g., P-101, V-200, R-300"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            disabled={isSubmitting}
            autoFocus
            styles={{
              input: {
                borderRadius: '4px',
                fontFamily: 'monospace',
                '&:focus': {
                  borderColor: '#1e40af',
                },
              },
            }}
          />
          <p className="text-xs text-slate-400 mt-1">
            Unique identifier for this equipment/component
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Equipment Type <span className="text-red-500">*</span>
          </label>
          <Select
            value={equipmentType}
            onChange={(value) => value && setEquipmentType(value as EquipmentType)}
            data={EQUIPMENT_TYPE_OPTIONS}
            disabled={isSubmitting}
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

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <Textarea
            placeholder="Enter a description of this node (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            minRows={2}
            maxRows={4}
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
            Position on P&ID
          </label>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">X (%)</label>
              <NumberInput
                value={x}
                onChange={(value) => setX(typeof value === 'number' ? value : 0)}
                min={0}
                max={100}
                step={0.1}
                decimalScale={1}
                disabled={isSubmitting}
                styles={{
                  input: {
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    '&:focus': {
                      borderColor: '#1e40af',
                    },
                  },
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Y (%)</label>
              <NumberInput
                value={y}
                onChange={(value) => setY(typeof value === 'number' ? value : 0)}
                min={0}
                max={100}
                step={0.1}
                decimalScale={1}
                disabled={isSubmitting}
                styles={{
                  input: {
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    '&:focus': {
                      borderColor: '#1e40af',
                    },
                  },
                }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Position as percentage of diagram dimensions
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="subtle"
            color="gray"
            onClick={handleClose}
            disabled={isSubmitting}
            styles={{
              root: {
                borderRadius: '4px',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!isFormValid || !hasChanges}
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
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
