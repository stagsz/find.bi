import { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal, TextInput, Textarea, Select, Button, Alert } from '@mantine/core';
import type { EquipmentType, ApiError, AnalysisNodeWithCreator } from '@hazop/types';
import { EQUIPMENT_TYPES, EQUIPMENT_TYPE_LABELS } from '@hazop/types';
import { nodesService, type CreateNodePayload } from '../../services/nodes.service';

/**
 * Props for the NodeCreationForm component.
 */
interface NodeCreationFormProps {
  /** Whether the modal is open */
  isOpen: boolean;

  /** Callback when the modal is closed */
  onClose: () => void;

  /** ID of the document to add the node to */
  documentId: string;

  /** Initial X coordinate (percentage 0-100) */
  initialX: number;

  /** Initial Y coordinate (percentage 0-100) */
  initialY: number;

  /** Callback when a node is successfully created */
  onNodeCreated: (node: AnalysisNodeWithCreator) => void;
}

/**
 * Equipment type options for the Select dropdown.
 */
const EQUIPMENT_TYPE_OPTIONS = EQUIPMENT_TYPES.map((type) => ({
  value: type,
  label: EQUIPMENT_TYPE_LABELS[type],
}));

/**
 * NodeCreationForm component for creating new analysis nodes on a P&ID.
 *
 * Features:
 * - Modal form with fields for node ID, description, and equipment type
 * - Pre-populated position coordinates from click location
 * - Form validation (node ID is required)
 * - Loading state during submission
 * - Error handling with user-friendly messages
 *
 * Usage:
 * - Displayed when a user clicks on the P&ID canvas to add a new node
 * - The x/y coordinates are passed from the canvas click location
 */
export function NodeCreationForm({
  isOpen,
  onClose,
  documentId,
  initialX,
  initialY,
  onNodeCreated,
}: NodeCreationFormProps) {
  // Form state
  const [nodeId, setNodeId] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('other');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Reset form state when modal opens.
   */
  useEffect(() => {
    if (isOpen) {
      setNodeId('');
      setDescription('');
      setEquipmentType('other');
      setError(null);
    }
  }, [isOpen]);

  /**
   * Check if the form is valid for submission.
   */
  const isFormValid = useMemo(() => {
    return nodeId.trim().length > 0;
  }, [nodeId]);

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    setError(null);

    const payload: CreateNodePayload = {
      nodeId: nodeId.trim(),
      description: description.trim(),
      equipmentType,
      x: initialX,
      y: initialY,
    };

    const result = await nodesService.createNode(documentId, payload);

    setIsSubmitting(false);

    if (result.success && result.data) {
      onNodeCreated(result.data.node);
      onClose();
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to create node' });
    }
  }, [isFormValid, nodeId, description, equipmentType, initialX, initialY, documentId, onNodeCreated, onClose]);

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
      if (e.key === 'Enter' && !e.shiftKey && isFormValid && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [isFormValid, isSubmitting, handleSubmit]
  );

  /**
   * Format coordinate for display.
   */
  const formatCoordinate = (value: number) => {
    return value.toFixed(1);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        <span className="font-semibold text-slate-900">
          Add Analysis Node
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
            Create a new analysis node at the selected location on the P&ID diagram.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Position: ({formatCoordinate(initialX)}%, {formatCoordinate(initialY)}%)
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

        <div className="mb-6">
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
            disabled={!isFormValid}
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
            Add Node
          </Button>
        </div>
      </div>
    </Modal>
  );
}
