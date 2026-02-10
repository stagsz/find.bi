import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, TextInput, Textarea, Select, Alert, Loader } from '@mantine/core';
import { documentsService, type ListDocumentsResponse } from '../../services/documents.service';
import { analysesService } from '../../services/analyses.service';
import type { ApiError, PIDDocumentWithUploader } from '@hazop/types';

/**
 * Props for NewAnalysisModal component.
 */
interface NewAnalysisModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Project ID to create analysis for */
  projectId: string;
  /** Callback when analysis is successfully created */
  onAnalysisCreated: () => void;
}

/**
 * Modal for creating a new HazOps analysis session.
 *
 * Allows the user to:
 * - Select a P&ID document (only processed documents are shown)
 * - Enter an analysis name (required)
 * - Enter an optional description
 *
 * The analysis will be created in draft status with the current user as lead analyst.
 */
export function NewAnalysisModal({
  opened,
  onClose,
  projectId,
  onAnalysisCreated,
}: NewAnalysisModalProps) {
  // Form state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [analysisName, setAnalysisName] = useState('');
  const [analysisDescription, setAnalysisDescription] = useState('');

  // Documents state
  const [documents, setDocuments] = useState<PIDDocumentWithUploader[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState<ApiError | null>(null);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  /**
   * Fetch processed documents for the project.
   */
  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    setDocumentsError(null);

    const result = await documentsService.listDocuments(
      projectId,
      { status: 'processed' },
      { sortBy: 'filename', sortOrder: 'asc' },
      { page: 1, limit: 100 }
    );

    if (result.success && result.data) {
      setDocuments(result.data.data);
    } else {
      setDocumentsError(result.error || { code: 'UNKNOWN', message: 'Failed to load documents' });
    }

    setIsLoadingDocuments(false);
  }, [projectId]);

  /**
   * Load documents when modal opens.
   */
  useEffect(() => {
    if (opened) {
      fetchDocuments();
    }
  }, [opened, fetchDocuments]);

  /**
   * Reset form when modal closes.
   */
  const handleClose = () => {
    setSelectedDocumentId(null);
    setAnalysisName('');
    setAnalysisDescription('');
    setSubmitError(null);
    onClose();
  };

  /**
   * Handle form submission.
   */
  const handleSubmit = async () => {
    if (!selectedDocumentId || !analysisName.trim()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await analysesService.createAnalysis(projectId, {
      documentId: selectedDocumentId,
      name: analysisName.trim(),
      description: analysisDescription.trim() || undefined,
    });

    if (result.success) {
      handleClose();
      onAnalysisCreated();
    } else {
      setSubmitError(result.error || { code: 'UNKNOWN', message: 'Failed to create analysis' });
    }

    setIsSubmitting(false);
  };

  /**
   * Handle Enter key to submit form.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && selectedDocumentId && analysisName.trim() && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Prepare document options for Select
  const documentOptions = documents.map((doc) => ({
    value: doc.id,
    label: doc.filename,
  }));

  const isFormValid = selectedDocumentId && analysisName.trim();
  const hasNoDocuments = !isLoadingDocuments && documents.length === 0 && !documentsError;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <span className="font-semibold text-slate-900">
          New Analysis Session
        </span>
      }
      centered
      size="md"
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
            Create a new HazOps analysis session. Select a processed P&ID document to analyze and provide a name for the session.
          </p>
        </div>

        {/* Error alerts */}
        {documentsError && (
          <Alert
            color="red"
            variant="light"
            className="mb-4"
            styles={{
              root: { borderRadius: '4px' },
            }}
            onClose={() => setDocumentsError(null)}
            withCloseButton
          >
            {documentsError.message}
          </Alert>
        )}

        {submitError && (
          <Alert
            color="red"
            variant="light"
            className="mb-4"
            styles={{
              root: { borderRadius: '4px' },
            }}
            onClose={() => setSubmitError(null)}
            withCloseButton
          >
            {submitError.message}
          </Alert>
        )}

        {/* No documents warning */}
        {hasNoDocuments && (
          <Alert
            color="yellow"
            variant="light"
            className="mb-4"
            styles={{
              root: { borderRadius: '4px' },
            }}
          >
            No processed P&ID documents available. Upload and process documents in the Documents tab before creating an analysis.
          </Alert>
        )}

        {/* P&ID Document Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            P&ID Document <span className="text-red-500">*</span>
          </label>
          {isLoadingDocuments ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader size="xs" />
              Loading documents...
            </div>
          ) : (
            <Select
              placeholder="Select a P&ID document"
              data={documentOptions}
              value={selectedDocumentId}
              onChange={setSelectedDocumentId}
              disabled={documents.length === 0 || isSubmitting}
              searchable
              nothingFoundMessage="No documents found"
              styles={{
                input: {
                  borderRadius: '4px',
                  '&:focus': {
                    borderColor: '#1e40af',
                  },
                },
              }}
            />
          )}
          <p className="mt-1 text-xs text-slate-500">
            Only processed documents are shown
          </p>
        </div>

        {/* Analysis Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Analysis Name <span className="text-red-500">*</span>
          </label>
          <TextInput
            placeholder="Enter analysis name"
            value={analysisName}
            onChange={(e) => setAnalysisName(e.target.value)}
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
          <p className="mt-1 text-xs text-slate-500">
            A descriptive name for this analysis session
          </p>
        </div>

        {/* Description (Optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <Textarea
            placeholder="Enter analysis description (optional)"
            value={analysisDescription}
            onChange={(e) => setAnalysisDescription(e.target.value)}
            disabled={isSubmitting}
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
          <p className="mt-1 text-xs text-slate-500">
            Optional notes about the scope or methodology of this analysis
          </p>
        </div>

        {/* Actions */}
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
            disabled={!isFormValid || isLoadingDocuments}
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
    </Modal>
  );
}
