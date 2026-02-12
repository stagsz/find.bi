import { useState, useRef, useCallback } from 'react';
import { Button, Alert, Progress } from '@mantine/core';
import { documentsService } from '../../services/documents.service';
import { useToast } from '../../hooks';
import type { PIDDocumentWithUploader, ApiError } from '@hazop/types';

/**
 * Maximum file size in bytes (50MB).
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Valid file extensions for P&ID uploads.
 */
const VALID_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.dwg'];

/**
 * Valid MIME types for P&ID uploads.
 */
const VALID_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/acad',
  'application/x-acad',
  'application/dwg',
  'image/vnd.dwg',
  'application/octet-stream', // DWG fallback
];

/**
 * Get file extension from filename.
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate a file for upload.
 * Returns null if valid, error message if invalid.
 */
function validateFile(file: File): string | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds the 50MB limit. Selected file is ${formatFileSize(file.size)}.`;
  }

  // Check file extension
  const extension = getFileExtension(file.name);
  if (!VALID_EXTENSIONS.includes(extension)) {
    return `Invalid file type. Supported formats: PDF, PNG, JPG, DWG.`;
  }

  // Check MIME type (with fallback for DWG)
  const isDwg = extension === '.dwg';
  if (!isDwg && !VALID_MIME_TYPES.includes(file.type)) {
    return `Invalid file type. Supported formats: PDF, PNG, JPG, DWG.`;
  }

  return null;
}

/**
 * Props for the PIDUpload component.
 */
interface PIDUploadProps {
  /** The ID of the project to upload documents to */
  projectId: string;
  /** Callback when a document is successfully uploaded */
  onUploadComplete?: (document: PIDDocumentWithUploader) => void;
  /** Whether uploads are disabled (e.g., user has viewer role) */
  disabled?: boolean;
}

/**
 * P&ID Upload component with drag-and-drop functionality.
 *
 * Features:
 * - Drag-and-drop zone with visual feedback
 * - Click to browse files
 * - File validation (type and size)
 * - Upload progress indication
 * - Error/success messaging
 * - File preview before upload
 */
export function PIDUpload({ projectId, onUploadComplete, disabled = false }: PIDUploadProps) {
  const toast = useToast();

  // Drag state
  const [isDragActive, setIsDragActive] = useState(false);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<ApiError | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection (from both drop and input).
   */
  const handleFileSelection = useCallback((files: FileList | null) => {
    // Reset state
    setValidationError(null);
    setUploadError(null);

    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    // Validate file
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }, []);

  /**
   * Handle drag enter.
   */
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  /**
   * Handle drag leave.
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  /**
   * Handle drag over.
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  /**
   * Handle file drop.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) {
        return;
      }

      handleFileSelection(e.dataTransfer.files);
    },
    [disabled, handleFileSelection]
  );

  /**
   * Handle click on drop zone.
   */
  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  /**
   * Handle file input change.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelection(e.target.files);
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    },
    [handleFileSelection]
  );

  /**
   * Handle file upload.
   */
  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const result = await documentsService.uploadDocument(projectId, selectedFile);

    if (result.success && result.data) {
      setSelectedFile(null);
      toast.success('Document uploaded successfully', { title: 'Upload Complete' });
      onUploadComplete?.(result.data.document);
    } else {
      const error = result.error || { code: 'UNKNOWN', message: 'Failed to upload document' };
      setUploadError(error);
      toast.error(error, { title: 'Upload Failed' });
    }

    setIsUploading(false);
  };

  /**
   * Handle removing the selected file.
   */
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setValidationError(null);
    setUploadError(null);
  };

  return (
    <div className="space-y-4">
      {/* Error messages */}
      {(validationError || uploadError) && (
        <Alert
          color="red"
          variant="light"
          onClose={() => {
            setValidationError(null);
            setUploadError(null);
          }}
          withCloseButton
          styles={{
            root: { borderRadius: '4px' },
          }}
        >
          {validationError || uploadError?.message}
        </Alert>
      )}

      {/* Drop zone */}
      <div
        className={`
          relative border-2 border-dashed rounded transition-colors
          ${disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'cursor-pointer'}
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
          ${selectedFile ? 'py-4 px-6' : 'py-12 px-6'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={!selectedFile ? handleClick : undefined}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && !selectedFile && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="Upload P&ID document"
        aria-disabled={disabled}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={VALID_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
          aria-hidden="true"
        />

        {selectedFile ? (
          /* Selected file preview */
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* File icon */}
              <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-slate-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </div>
              {/* File info */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile();
                }}
                disabled={isUploading}
                styles={{
                  root: { borderRadius: '4px' },
                }}
              >
                Remove
              </Button>
              <Button
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                loading={isUploading}
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
                Upload
              </Button>
            </div>
          </div>
        ) : (
          /* Drop zone placeholder */
          <div className="text-center">
            {/* Upload icon */}
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
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            {/* Text */}
            <p className="mt-4 text-sm text-slate-600">
              {disabled ? (
                'You do not have permission to upload documents.'
              ) : isDragActive ? (
                <span className="font-medium text-blue-700">Drop file here</span>
              ) : (
                <>
                  <span className="font-medium text-blue-700">Click to upload</span> or drag and
                  drop
                </>
              )}
            </p>
            {!disabled && (
              <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG, or DWG up to 50MB</p>
            )}
          </div>
        )}

        {/* Upload progress indicator */}
        {isUploading && (
          <div className="mt-4">
            <Progress value={100} animated size="xs" color="blue" />
          </div>
        )}
      </div>
    </div>
  );
}
