import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Button, Alert, Loader } from '@mantine/core';
import { useAuthStore, selectUser } from '../store/auth.store';
import { authService } from '../services/auth.service';
import { analysesService } from '../services/analyses.service';
import { documentsService } from '../services/documents.service';
import { nodesService } from '../services/nodes.service';
import { PIDViewer } from '../components/documents/PIDViewer';
import { NodeOverlay } from '../components/documents/NodeOverlay';
import { GuideWordSelector, DeviationInputForm, CausesInput, ConsequencesInput, SafeguardsInput } from '../components/analyses';
import type {
  ApiError,
  HazopsAnalysisWithDetails,
  PIDDocumentWithUploader,
  AnalysisNodeWithCreator,
  AnalysisEntry,
  GuideWord,
} from '@hazop/types';
import {
  GUIDE_WORD_LABELS,
  ANALYSIS_STATUS_LABELS,
} from '@hazop/types';

/**
 * Analysis status badge colors.
 */
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-800',
  in_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

/**
 * Minimum width for the left pane in pixels.
 */
const MIN_LEFT_PANE_WIDTH = 300;

/**
 * Maximum width for the left pane as percentage of container width.
 */
const MAX_LEFT_PANE_PERCENT = 0.75;

/**
 * Default left pane width as percentage.
 */
const DEFAULT_LEFT_PANE_PERCENT = 0.5;

/**
 * Analysis workspace page with split-pane layout.
 *
 * Features:
 * - Split-pane layout with resizable divider
 * - Left pane: P&ID viewer with node overlay
 * - Right pane: Analysis panel with guide word selection
 * - Node selection via clicking on P&ID
 * - Responsive to container size
 */
export function AnalysisWorkspacePage() {
  const navigate = useNavigate();
  const { projectId, analysisId } = useParams<{ projectId: string; analysisId: string }>();
  const currentUser = useAuthStore(selectUser);
  const isAuthLoading = useAuthStore((state) => state.isLoading);

  // Container ref for calculating pane widths
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  // Analysis, document, and nodes state
  const [analysis, setAnalysis] = useState<HazopsAnalysisWithDetails | null>(null);
  const [document, setDocument] = useState<PIDDocumentWithUploader | null>(null);
  const [nodes, setNodes] = useState<AnalysisNodeWithCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Node selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedGuideWord, setSelectedGuideWord] = useState<GuideWord | null>(null);

  // Current entry state (for editing causes, consequences, and safeguards after entry creation)
  const [currentEntry, setCurrentEntry] = useState<AnalysisEntry | null>(null);
  const [entryCauses, setEntryCauses] = useState<string[]>([]);
  const [entryConsequences, setEntryConsequences] = useState<string[]>([]);
  const [entrySafeguards, setEntrySafeguards] = useState<string[]>([]);

  // Split-pane state
  const [leftPaneWidth, setLeftPaneWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // P&ID viewer state (needed for node overlay coordination)
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerPosition, setViewerPosition] = useState({ x: 0, y: 0 });
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });

  /**
   * Fetch analysis, document, and nodes data.
   */
  const fetchData = useCallback(async () => {
    if (!analysisId) {
      setError({ code: 'NOT_FOUND', message: 'Analysis ID is required' });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Fetch analysis details
    const analysisResult = await analysesService.getAnalysis(analysisId);
    if (!analysisResult.success || !analysisResult.data) {
      setError(analysisResult.error || { code: 'NOT_FOUND', message: 'Failed to load analysis' });
      setIsLoading(false);
      return;
    }

    const analysisData = analysisResult.data.analysis;
    setAnalysis(analysisData);

    // Fetch the P&ID document
    const documentResult = await documentsService.getDocument(analysisData.documentId);
    if (!documentResult.success || !documentResult.data) {
      setError(documentResult.error || { code: 'NOT_FOUND', message: 'Failed to load document' });
      setIsLoading(false);
      return;
    }

    setDocument(documentResult.data.document);

    // Fetch nodes for the document
    const nodesResult = await nodesService.listNodes(analysisData.documentId, {}, {}, { limit: 1000 });
    if (nodesResult.success && nodesResult.data) {
      setNodes(nodesResult.data.data);
    }

    setIsLoading(false);
  }, [analysisId]);

  /**
   * Load data on mount.
   */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Initialize left pane width on mount and resize.
   */
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        setLeftPaneWidth(containerWidth * DEFAULT_LEFT_PANE_PERCENT);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  /**
   * Handle divider drag start.
   */
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  /**
   * Handle divider drag.
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const maxWidth = containerRect.width * MAX_LEFT_PANE_PERCENT;

      setLeftPaneWidth(Math.max(MIN_LEFT_PANE_WIDTH, Math.min(newWidth, maxWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  /**
   * Handle logout.
   */
  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  /**
   * Handle node click on P&ID.
   */
  const handleNodeClick = useCallback((node: AnalysisNodeWithCreator) => {
    setSelectedNodeId(node.id);
    // Reset guide word and current entry when changing nodes
    setSelectedGuideWord(null);
    setCurrentEntry(null);
    setEntryCauses([]);
    setEntryConsequences([]);
    setEntrySafeguards([]);
  }, []);

  /**
   * Handle successful creation of an analysis entry.
   * After an entry is created, show the CausesInput, ConsequencesInput, and SafeguardsInput for editing.
   */
  const handleEntryCreated = useCallback((entry: AnalysisEntry) => {
    // Set the current entry so we can show CausesInput, ConsequencesInput, and SafeguardsInput
    setCurrentEntry(entry);
    setEntryCauses(entry.causes || []);
    setEntryConsequences(entry.consequences || []);
    setEntrySafeguards(entry.safeguards || []);
  }, []);

  /**
   * Handle changes to entry causes.
   * Updates the entry on the server when causes change.
   */
  const handleCausesChange = useCallback(
    async (causes: string[]) => {
      if (!currentEntry) return;

      // Optimistically update local state
      setEntryCauses(causes);

      // Update entry on the server
      const result = await analysesService.updateAnalysisEntry(currentEntry.id, { causes });

      if (result.success && result.data) {
        // Update current entry with server response
        setCurrentEntry(result.data.entry);
      } else {
        // Revert on error - restore previous causes
        setEntryCauses(currentEntry.causes || []);
        console.error('Failed to update causes:', result.error);
      }
    },
    [currentEntry]
  );

  /**
   * Handle changes to entry consequences.
   * Updates the entry on the server when consequences change.
   */
  const handleConsequencesChange = useCallback(
    async (consequences: string[]) => {
      if (!currentEntry) return;

      // Optimistically update local state
      setEntryConsequences(consequences);

      // Update entry on the server
      const result = await analysesService.updateAnalysisEntry(currentEntry.id, { consequences });

      if (result.success && result.data) {
        // Update current entry with server response
        setCurrentEntry(result.data.entry);
      } else {
        // Revert on error - restore previous consequences
        setEntryConsequences(currentEntry.consequences || []);
        console.error('Failed to update consequences:', result.error);
      }
    },
    [currentEntry]
  );

  /**
   * Clear the current entry and allow creating a new one.
   */
  const handleClearEntry = useCallback(() => {
    setCurrentEntry(null);
    setEntryCauses([]);
    setEntryConsequences([]);
    setEntrySafeguards([]);
    setSelectedGuideWord(null);
  }, []);

  /**
   * Handle changes to entry safeguards.
   * Updates the entry on the server when safeguards change.
   */
  const handleSafeguardsChange = useCallback(
    async (safeguards: string[]) => {
      if (!currentEntry) return;

      // Optimistically update local state
      setEntrySafeguards(safeguards);

      // Update entry on the server
      const result = await analysesService.updateAnalysisEntry(currentEntry.id, { safeguards });

      if (result.success && result.data) {
        // Update current entry with server response
        setCurrentEntry(result.data.entry);
      } else {
        // Revert on error - restore previous safeguards
        setEntrySafeguards(currentEntry.safeguards || []);
        console.error('Failed to update safeguards:', result.error);
      }
    },
    [currentEntry]
  );

  /**
   * Get the selected node object.
   */
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader size="lg" color="blue" />
          <p className="mt-4 text-slate-600">Loading analysis workspace...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !analysis || !document) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
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
                  loading={isAuthLoading}
                  styles={{ root: { borderRadius: '4px' } }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Error content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <nav className="mb-6">
            <Link to="/" className="text-sm text-blue-700 hover:text-blue-800">
              Dashboard
            </Link>
            <span className="text-sm text-slate-400 mx-2">/</span>
            <Link to="/projects" className="text-sm text-blue-700 hover:text-blue-800">
              Projects
            </Link>
            {projectId && (
              <>
                <span className="text-sm text-slate-400 mx-2">/</span>
                <Link to={`/projects/${projectId}`} className="text-sm text-blue-700 hover:text-blue-800">
                  Project
                </Link>
              </>
            )}
            <span className="text-sm text-slate-400 mx-2">/</span>
            <span className="text-sm text-slate-600">Analysis</span>
          </nav>

          <div className="bg-white rounded border border-slate-200 p-6">
            <Alert
              color="red"
              variant="light"
              title="Error Loading Analysis"
              styles={{ root: { borderRadius: '4px' } }}
            >
              {error?.message || 'The requested analysis could not be loaded.'}
            </Alert>
            <div className="mt-4">
              <Button
                variant="subtle"
                color="blue"
                onClick={() => navigate(projectId ? `/projects/${projectId}` : '/projects')}
                styles={{ root: { borderRadius: '4px' } }}
              >
                Back to Project
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between items-center h-14">
            {/* Left: Breadcrumb and analysis info */}
            <div className="flex items-center gap-4">
              <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                HazOp
              </Link>
              <span className="text-slate-300">/</span>
              <Link
                to={`/projects/${projectId}`}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Project
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-medium text-slate-900">{analysis.name}</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[analysis.status]}`}
              >
                {ANALYSIS_STATUS_LABELS[analysis.status]}
              </span>
            </div>

            {/* Right: User and actions */}
            <div className="flex items-center gap-4">
              <Link to="/profile" className="text-sm text-slate-600 hover:text-slate-900">
                {currentUser?.name}
              </Link>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={handleLogout}
                loading={isAuthLoading}
                styles={{ root: { borderRadius: '4px' } }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main split-pane workspace */}
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden"
        style={{ cursor: isDragging ? 'col-resize' : undefined }}
      >
        {/* Left pane: P&ID Viewer */}
        <div
          className="flex-shrink-0 bg-white border-r border-slate-200 flex flex-col"
          style={{ width: leftPaneWidth ?? '50%' }}
        >
          {/* P&ID Viewer Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">P&ID Document</h2>
              <span className="text-xs text-slate-500">{document.filename}</span>
            </div>
          </div>

          {/* P&ID Viewer Content */}
          <div className="flex-1 relative overflow-hidden">
            <PIDViewerWithOverlay
              document={document}
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              onViewerStateChange={(zoom, position, natural) => {
                setViewerZoom(zoom);
                setViewerPosition(position);
                setNaturalDimensions(natural);
              }}
            />
          </div>
        </div>

        {/* Divider */}
        <div
          ref={dividerRef}
          className={`flex-shrink-0 w-1 bg-slate-200 hover:bg-blue-400 cursor-col-resize transition-colors ${
            isDragging ? 'bg-blue-500' : ''
          }`}
          onMouseDown={handleDividerMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panes"
        />

        {/* Right pane: Analysis Panel */}
        <div className="flex-1 flex flex-col min-w-[300px] bg-white">
          {/* Analysis Panel Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">Analysis Entry</h2>
          </div>

          {/* Analysis Panel Content */}
          <div className="flex-1 overflow-auto p-4">
            {/* Node Selection Status */}
            {!selectedNode ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6 text-slate-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-slate-900 mb-1">No Node Selected</h3>
                <p className="text-sm text-slate-500">
                  Click on a node marker on the P&ID to begin analysis.
                </p>
                {nodes.length === 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    No nodes defined on this P&ID yet.{' '}
                    <Link
                      to={`/projects/${projectId}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Add nodes
                    </Link>{' '}
                    in the project documents section.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Selected Node Info */}
                <div className="bg-slate-50 rounded border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Selected Node
                    </span>
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => setSelectedNodeId(null)}
                      styles={{ root: { borderRadius: '4px' } }}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="text-lg font-semibold text-slate-900">{selectedNode.nodeId}</div>
                  {selectedNode.description && (
                    <p className="text-sm text-slate-600 mt-1">{selectedNode.description}</p>
                  )}
                </div>

                {/* Guide Word Selection */}
                <GuideWordSelector
                  value={selectedGuideWord}
                  onChange={setSelectedGuideWord}
                  disabled={analysis.status !== 'draft'}
                />

                {/* Deviation Input Form - shown when guide word selected but no entry created yet */}
                {selectedGuideWord && !currentEntry && (
                  <DeviationInputForm
                    analysisId={analysis.id}
                    nodeId={selectedNode.id}
                    nodeIdentifier={selectedNode.nodeId}
                    nodeEquipmentType={selectedNode.equipmentType}
                    guideWord={selectedGuideWord}
                    disabled={analysis.status !== 'draft'}
                    onEntryCreated={handleEntryCreated}
                    onClear={() => setSelectedGuideWord(null)}
                  />
                )}

                {/* Causes Input - shown after an entry is created */}
                {currentEntry && selectedGuideWord && (
                  <div className="space-y-4">
                    {/* Entry Summary */}
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-green-700 uppercase tracking-wide">
                            Entry Created
                          </span>
                          <div className="text-sm font-medium text-slate-900 mt-1">
                            {currentEntry.parameter}: {currentEntry.deviation}
                          </div>
                        </div>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          onClick={handleClearEntry}
                          styles={{ root: { borderRadius: '4px' } }}
                        >
                          New Entry
                        </Button>
                      </div>
                    </div>

                    {/* Causes Input */}
                    <CausesInput
                      nodeIdentifier={selectedNode.nodeId}
                      equipmentType={selectedNode.equipmentType}
                      guideWord={selectedGuideWord}
                      value={entryCauses}
                      onChange={handleCausesChange}
                      disabled={analysis.status !== 'draft'}
                    />

                    {/* Consequences Input - shown after causes are selected */}
                    {entryCauses.length > 0 && (
                      <ConsequencesInput
                        nodeIdentifier={selectedNode.nodeId}
                        equipmentType={selectedNode.equipmentType}
                        guideWord={selectedGuideWord}
                        value={entryConsequences}
                        onChange={handleConsequencesChange}
                        disabled={analysis.status !== 'draft'}
                      />
                    )}

                    {/* Safeguards Input - shown after consequences are selected */}
                    {entryConsequences.length > 0 && (
                      <SafeguardsInput
                        nodeIdentifier={selectedNode.nodeId}
                        equipmentType={selectedNode.equipmentType}
                        guideWord={selectedGuideWord}
                        value={entrySafeguards}
                        onChange={handleSafeguardsChange}
                        disabled={analysis.status !== 'draft'}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Props for PIDViewerWithOverlay component.
 */
interface PIDViewerWithOverlayProps {
  document: PIDDocumentWithUploader;
  nodes: AnalysisNodeWithCreator[];
  selectedNodeId: string | null;
  onNodeClick: (node: AnalysisNodeWithCreator) => void;
  onViewerStateChange: (
    zoom: number,
    position: { x: number; y: number },
    naturalDimensions: { width: number; height: number }
  ) => void;
}

/**
 * Combined P&ID Viewer with Node Overlay.
 * This component coordinates the viewer state with the node overlay positioning.
 */
function PIDViewerWithOverlay({
  document,
  nodes,
  selectedNodeId,
  onNodeClick,
  onViewerStateChange,
}: PIDViewerWithOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Viewer state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Image dimensions
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Zoom constraints
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.25;

  /**
   * Fetch the document download URL.
   */
  useEffect(() => {
    let isMounted = true;

    const fetchUrl = async () => {
      setIsLoading(true);
      setError(null);

      // PDF viewing not yet supported
      const isPdf = document.mimeType === 'application/pdf';
      if (isPdf) {
        setError({
          code: 'PDF_NOT_SUPPORTED',
          message: 'PDF preview is not yet available. Please download the document to view it.',
        });
        setIsLoading(false);
        return;
      }

      const result = await documentsService.getDownloadUrl(document.id);
      if (!isMounted) return;

      if (result.success && result.data) {
        setImageUrl(result.data.url);
      } else {
        setError(result.error || { code: 'UNKNOWN', message: 'Failed to load document' });
      }

      setIsLoading(false);
    };

    fetchUrl();
    return () => { isMounted = false; };
  }, [document.id, document.mimeType]);

  /**
   * Handle image load to get natural dimensions.
   */
  const handleImageLoad = useCallback(() => {
    if (imageRef.current && containerRef.current) {
      const imgWidth = imageRef.current.naturalWidth;
      const imgHeight = imageRef.current.naturalHeight;
      setNaturalWidth(imgWidth);
      setNaturalHeight(imgHeight);

      // Calculate initial zoom to fit
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const scaleX = containerWidth / imgWidth;
      const scaleY = containerHeight / imgHeight;
      const initialZoom = Math.min(scaleX, scaleY, 1);

      setZoom(initialZoom);
      setPosition({ x: 0, y: 0 });
      onViewerStateChange(initialZoom, { x: 0, y: 0 }, { width: imgWidth, height: imgHeight });
    }
    setIsLoading(false);
  }, [onViewerStateChange]);

  /**
   * Handle image error.
   */
  const handleImageError = useCallback(() => {
    setError({ code: 'LOAD_ERROR', message: 'Failed to load the image.' });
    setIsLoading(false);
  }, []);

  /**
   * Zoom handlers.
   */
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.min(prev + ZOOM_STEP, MAX_ZOOM);
      onViewerStateChange(newZoom, position, { width: naturalWidth, height: naturalHeight });
      return newZoom;
    });
  }, [position, naturalWidth, naturalHeight, onViewerStateChange]);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
      onViewerStateChange(newZoom, position, { width: naturalWidth, height: naturalHeight });
      return newZoom;
    });
  }, [position, naturalWidth, naturalHeight, onViewerStateChange]);

  const handleFitToScreen = useCallback(() => {
    if (containerRef.current && naturalWidth && naturalHeight) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const scaleX = containerWidth / naturalWidth;
      const scaleY = containerHeight / naturalHeight;
      const fitZoom = Math.min(scaleX, scaleY);

      setZoom(fitZoom);
      setPosition({ x: 0, y: 0 });
      onViewerStateChange(fitZoom, { x: 0, y: 0 }, { width: naturalWidth, height: naturalHeight });
    }
  }, [naturalWidth, naturalHeight, onViewerStateChange]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    onViewerStateChange(1, { x: 0, y: 0 }, { width: naturalWidth, height: naturalHeight });
  }, [naturalWidth, naturalHeight, onViewerStateChange]);

  /**
   * Handle mouse wheel zoom.
   */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((prev) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(prev + delta, MAX_ZOOM));
      onViewerStateChange(newZoom, position, { width: naturalWidth, height: naturalHeight });
      return newZoom;
    });
  }, [position, naturalWidth, naturalHeight, onViewerStateChange]);

  /**
   * Handle mouse drag for panning.
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const newPosition = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
    setPosition(newPosition);
    onViewerStateChange(zoom, newPosition, { width: naturalWidth, height: naturalHeight });
  }, [isDragging, dragStart, zoom, naturalWidth, naturalHeight, onViewerStateChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Handle keyboard shortcuts.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        handleZoomIn();
        break;
      case '-':
        e.preventDefault();
        handleZoomOut();
        break;
      case '0':
        e.preventDefault();
        handleResetZoom();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        handleFitToScreen();
        break;
    }
  }, [handleZoomIn, handleZoomOut, handleResetZoom, handleFitToScreen]);

  const zoomPercentage = Math.round(zoom * 100);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Button
            variant="subtle"
            size="xs"
            color="gray"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM || isLoading || !!error}
            title="Zoom out (-)"
            styles={{ root: { borderRadius: '4px' } }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
            </svg>
          </Button>

          <span className="text-sm text-slate-600 min-w-[50px] text-center font-mono">
            {zoomPercentage}%
          </span>

          <Button
            variant="subtle"
            size="xs"
            color="gray"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM || isLoading || !!error}
            title="Zoom in (+)"
            styles={{ root: { borderRadius: '4px' } }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
          </Button>

          <div className="w-px h-4 bg-slate-300 mx-1" />

          <Button
            variant="subtle"
            size="xs"
            color="gray"
            onClick={handleFitToScreen}
            disabled={isLoading || !!error || !naturalWidth}
            title="Fit to screen (F)"
            styles={{ root: { borderRadius: '4px' } }}
          >
            Fit
          </Button>

          <Button
            variant="subtle"
            size="xs"
            color="gray"
            onClick={handleResetZoom}
            disabled={isLoading || !!error}
            title="Reset zoom (0)"
            styles={{ root: { borderRadius: '4px' } }}
          >
            100%
          </Button>
        </div>

        <span className="text-xs text-slate-500">
          {nodes.length} node{nodes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Viewer area */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden bg-slate-100 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="application"
        aria-label="P&ID viewer with node markers"
      >
        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <Loader size="md" color="blue" />
              <p className="mt-2 text-sm text-slate-500">Loading document...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <Alert
              color={error.code === 'PDF_NOT_SUPPORTED' ? 'blue' : 'red'}
              variant="light"
              title={error.code === 'PDF_NOT_SUPPORTED' ? 'PDF Preview' : 'Error'}
              styles={{ root: { borderRadius: '4px', maxWidth: '400px' } }}
            >
              {error.message}
            </Alert>
          </div>
        )}

        {/* Image */}
        {imageUrl && !error && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              width: '100%',
              height: '100%',
              transform: `translate(${position.x}px, ${position.y}px)`,
            }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt={document.filename}
              className="select-none"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                maxWidth: 'none',
                maxHeight: 'none',
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
              draggable={false}
            />
          </div>
        )}

        {/* Node overlay */}
        {imageUrl && !error && naturalWidth > 0 && naturalHeight > 0 && (
          <NodeOverlay
            nodes={nodes}
            naturalWidth={naturalWidth}
            naturalHeight={naturalHeight}
            zoom={zoom}
            position={position}
            selectedNodeId={selectedNodeId}
            onNodeClick={onNodeClick}
            interactive={true}
            showLabels={false}
          />
        )}

        {/* Help hint */}
        {!isLoading && !error && imageUrl && (
          <div className="absolute bottom-3 left-3 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded">
            Scroll to zoom • Drag to pan • Click node to select
          </div>
        )}
      </div>
    </div>
  );
}
