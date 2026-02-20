import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button, Alert, Loader, Tooltip } from '@mantine/core';
import { documentsService } from '../../services/documents.service';
import { nodesService } from '../../services/nodes.service';
import { NodeCreationForm } from './NodeCreationForm';
import { NodeEditModal } from './NodeEditModal';
import type { PIDDocumentWithUploader, AnalysisNodeWithCreator, ApiError } from '@hazop/types';
import { EQUIPMENT_TYPE_LABELS } from '@hazop/types';

/**
 * Equipment type badge colors.
 */
const EQUIPMENT_COLORS: Record<string, string> = {
  pump: 'bg-blue-100 text-blue-800',
  valve: 'bg-green-100 text-green-800',
  reactor: 'bg-red-100 text-red-800',
  heat_exchanger: 'bg-amber-100 text-amber-800',
  pipe: 'bg-slate-100 text-slate-800',
  tank: 'bg-violet-100 text-violet-800',
  other: 'bg-slate-100 text-slate-600',
};

/**
 * Marker colors matching equipment types.
 */
const MARKER_COLORS: Record<string, string> = {
  pump: '#3b82f6',
  valve: '#22c55e',
  reactor: '#ef4444',
  heat_exchanger: '#f59e0b',
  pipe: '#6b7280',
  tank: '#8b5cf6',
  other: '#64748b',
};

interface DocumentNodesModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal closes */
  onClose: () => void;
  /** The document to manage nodes for */
  document: PIDDocumentWithUploader;
}

/**
 * Modal for managing analysis nodes on a P&ID document.
 *
 * Features:
 * - P&ID image preview with click-to-place node markers
 * - Node list with edit and delete per row
 * - Add Node button for PDFs or manual placement
 */
export function DocumentNodesModal({ isOpen, onClose, document }: DocumentNodesModalProps) {
  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);

  // Nodes state
  const [nodes, setNodes] = useState<AnalysisNodeWithCreator[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState<ApiError | null>(null);

  // Node creation state
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [pendingX, setPendingX] = useState(50);
  const [pendingY, setPendingY] = useState(50);

  // Node edit state
  const [editNode, setEditNode] = useState<AnalysisNodeWithCreator | null>(null);

  // Delete state
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);

  // Highlighted node in list
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const isPdf = document.mimeType === 'application/pdf';

  // Fetch image URL when modal opens
  useEffect(() => {
    if (!isOpen || isPdf) return;

    let cancelled = false;
    setImageLoading(true);
    setImageError(null);
    setImageUrl(null);
    setImageReady(false);

    documentsService.getDownloadUrl(document.id).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setImageUrl(result.data.url);
      } else {
        setImageError('Failed to load document preview');
        setImageLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [isOpen, document.id, isPdf]);

  // Fetch nodes when modal opens
  const fetchNodes = useCallback(async () => {
    setNodesLoading(true);
    setNodesError(null);
    const result = await nodesService.listNodes(document.id, {}, { sortBy: 'node_id', sortOrder: 'asc' }, { limit: 100 });
    if (!result.success) {
      setNodesError(result.error);
    } else if (result.data) {
      setNodes(result.data.data);
    }
    setNodesLoading(false);
  }, [document.id]);

  useEffect(() => {
    if (isOpen) {
      fetchNodes();
    }
  }, [isOpen, fetchNodes]);

  // Reset image state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setImageUrl(null);
      setImageReady(false);
      setImageError(null);
      setNodes([]);
    }
  }, [isOpen]);

  /**
   * Handle click on the P&ID image to place a new node.
   */
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current || !imageReady) return;
    // Don't open form if clicking on an existing marker
    if ((e.target as HTMLElement).dataset.nodeMarker) return;

    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPendingX(Math.max(0, Math.min(100, Math.round(x * 10) / 10)));
    setPendingY(Math.max(0, Math.min(100, Math.round(y * 10) / 10)));
    setAddNodeOpen(true);
  }, [imageReady]);

  const handleNodeCreated = (node: AnalysisNodeWithCreator) => {
    setNodes((prev) => [...prev, node].sort((a, b) => a.nodeId.localeCompare(b.nodeId)));
  };

  const handleNodeUpdated = (updated: AnalysisNodeWithCreator) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleDeleteNode = async (nodeId: string) => {
    setDeletingNodeId(nodeId);
    const result = await nodesService.deleteNode(nodeId);
    if (result.success) {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    }
    setDeletingNodeId(null);
  };

  return (
    <>
      <Modal
        opened={isOpen}
        onClose={onClose}
        title={
          <span className="font-semibold text-slate-900 truncate max-w-[500px]">
            Manage Nodes — {document.filename}
          </span>
        }
        size="90vw"
        styles={{
          content: { borderRadius: '4px', height: '85vh', display: 'flex', flexDirection: 'column' },
          header: { borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', flexShrink: 0 },
          body: { flex: 1, overflow: 'hidden', padding: '16px' },
        }}
      >
        <div className="flex gap-4 h-full overflow-hidden">
          {/* ── Left: P&ID Viewer ── */}
          <div className="flex-1 flex flex-col border border-slate-200 rounded overflow-hidden bg-slate-100 min-w-0">
            <div className="flex-shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              {isPdf
                ? 'PDF preview not available — use Add Node to add nodes manually'
                : imageReady
                ? 'Click anywhere on the diagram to place a new node'
                : 'Loading diagram…'}
            </div>

            <div className="flex-1 relative overflow-auto">
              {/* PDF placeholder */}
              {isPdf && (
                <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-16 h-16 text-red-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z"
                      clipRule="evenodd"
                    />
                    <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                  </svg>
                  <p className="text-sm text-slate-600 text-center">
                    PDF preview is not available in the browser.
                    <br />
                    Nodes are positioned by percentage coordinates (0–100%).
                  </p>
                  <Button
                    onClick={() => { setPendingX(50); setPendingY(50); setAddNodeOpen(true); }}
                    styles={{ root: { borderRadius: '4px', backgroundColor: '#1e40af' } }}
                  >
                    + Add Node
                  </Button>
                </div>
              )}

              {/* Image loading */}
              {!isPdf && imageLoading && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader size="md" color="blue" />
                    <p className="mt-2 text-sm text-slate-500">Loading diagram…</p>
                  </div>
                </div>
              )}

              {/* Image error */}
              {!isPdf && imageError && (
                <div className="h-full flex items-center justify-center p-6">
                  <Alert color="red" variant="light" styles={{ root: { borderRadius: '4px' } }}>
                    {imageError}
                  </Alert>
                </div>
              )}

              {/* Image with node markers */}
              {!isPdf && imageUrl && !imageError && (
                <div
                  className="relative inline-block cursor-crosshair"
                  style={{ minWidth: '100%', minHeight: '100%' }}
                  onClick={handleImageClick}
                >
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt={document.filename}
                    className="block max-w-full"
                    draggable={false}
                    onLoad={() => { setImageReady(true); setImageLoading(false); }}
                    onError={() => { setImageError('Failed to load image'); setImageLoading(false); }}
                  />

                  {/* Node markers */}
                  {imageReady && nodes.map((node) => (
                    <Tooltip
                      key={node.id}
                      label={`${node.nodeId} — ${EQUIPMENT_TYPE_LABELS[node.equipmentType]}`}
                      position="top"
                      withArrow
                    >
                      <div
                        data-node-marker="true"
                        onClick={(e) => { e.stopPropagation(); setEditNode(node); }}
                        style={{
                          position: 'absolute',
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: hoveredNodeId === node.id ? '#fff' : (MARKER_COLORS[node.equipmentType] ?? '#64748b'),
                          border: `3px solid ${MARKER_COLORS[node.equipmentType] ?? '#64748b'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 700,
                          color: hoveredNodeId === node.id ? (MARKER_COLORS[node.equipmentType] ?? '#64748b') : '#fff',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                          zIndex: 10,
                          transition: 'background-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        {node.nodeId.slice(0, 3)}
                      </div>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Node List ── */}
          <div className="w-72 flex-shrink-0 flex flex-col border border-slate-200 rounded overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                Nodes
                {nodes.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-slate-500">({nodes.length})</span>
                )}
              </span>
              {!isPdf && (
                <Button
                  size="xs"
                  onClick={() => { setPendingX(50); setPendingY(50); setAddNodeOpen(true); }}
                  styles={{ root: { borderRadius: '4px', backgroundColor: '#1e40af' } }}
                >
                  + Add Node
                </Button>
              )}
            </div>

            {/* Node list body */}
            <div className="flex-1 overflow-auto">
              {nodesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader size="sm" color="blue" />
                </div>
              )}

              {nodesError && (
                <div className="p-3">
                  <Alert color="red" variant="light" styles={{ root: { borderRadius: '4px' } }}>
                    {nodesError.message}
                  </Alert>
                </div>
              )}

              {!nodesLoading && !nodesError && nodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-8 h-8 text-slate-300 mb-2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                  </svg>
                  <p className="text-sm text-slate-500">No nodes yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isPdf ? 'Click + Add Node to begin' : 'Click on the diagram to place a node'}
                  </p>
                </div>
              )}

              {!nodesLoading && nodes.map((node) => (
                <div
                  key={node.id}
                  className={`px-3 py-2.5 border-b border-slate-100 flex items-start justify-between gap-2 transition-colors ${
                    hoveredNodeId === node.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {/* Colored dot */}
                    <div
                      className="flex-shrink-0 w-3 h-3 rounded-full mt-1"
                      style={{ backgroundColor: MARKER_COLORS[node.equipmentType] ?? '#64748b' }}
                    />
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-sm text-slate-900 truncate">
                        {node.nodeId}
                      </div>
                      <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ${EQUIPMENT_COLORS[node.equipmentType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {EQUIPMENT_TYPE_LABELS[node.equipmentType]}
                      </span>
                      {node.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{node.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex gap-1">
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                      onClick={() => setEditNode(node)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
                      onClick={() => handleDeleteNode(node.id)}
                      disabled={deletingNodeId === node.id}
                    >
                      {deletingNodeId === node.id ? '…' : 'Del'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            {!isPdf && imageReady && nodes.length === 0 && (
              <div className="flex-shrink-0 px-3 py-2 bg-blue-50 border-t border-blue-100">
                <p className="text-xs text-blue-700">
                  Click anywhere on the diagram to place your first node.
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Node Creation Modal */}
      <NodeCreationForm
        isOpen={addNodeOpen}
        onClose={() => setAddNodeOpen(false)}
        documentId={document.id}
        initialX={pendingX}
        initialY={pendingY}
        onNodeCreated={handleNodeCreated}
      />

      {/* Node Edit Modal */}
      <NodeEditModal
        isOpen={!!editNode}
        onClose={() => setEditNode(null)}
        node={editNode}
        onNodeUpdated={handleNodeUpdated}
      />
    </>
  );
}
