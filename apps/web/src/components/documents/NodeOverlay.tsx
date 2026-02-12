import { useState, useCallback, useMemo } from 'react';
import { Tooltip } from '@mantine/core';
import type { AnalysisNodeWithCreator, EquipmentType } from '@hazop/types';
import { EQUIPMENT_TYPE_LABELS } from '@hazop/types';
import { NodePresenceAvatars } from '../collaboration';
import type { UserPresence } from '../../hooks/useWebSocket';

/**
 * Marker size in pixels at zoom level 1.
 * Markers scale with zoom to maintain relative size on the P&ID.
 */
const BASE_MARKER_SIZE = 24;

/**
 * Minimum marker size to ensure visibility at low zoom levels.
 */
const MIN_MARKER_SIZE = 16;

/**
 * Maximum marker size to prevent oversized markers at high zoom.
 */
const MAX_MARKER_SIZE = 40;

/**
 * Colors for equipment types.
 * Using distinct colors for easy identification.
 */
const EQUIPMENT_TYPE_COLORS: Record<EquipmentType, string> = {
  pump: '#3b82f6', // blue
  valve: '#22c55e', // green
  reactor: '#ef4444', // red
  heat_exchanger: '#f59e0b', // amber
  pipe: '#6b7280', // gray
  tank: '#8b5cf6', // violet
  other: '#64748b', // slate
};

/**
 * Icons for equipment types (simple SVG paths).
 */
const EQUIPMENT_TYPE_ICONS: Record<EquipmentType, string> = {
  pump: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z', // circle outline
  valve: 'M12 2L2 12l10 10 10-10L12 2zm0 4.83L17.17 12 12 17.17 6.83 12 12 6.83z', // diamond
  reactor: 'M12 2L2 12l10 10 10-10L12 2zm0 2.83l7.17 7.17L12 19.17 4.83 12 12 4.83z', // diamond outline
  heat_exchanger: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z', // lines (heat transfer)
  pipe: 'M4 10h16v4H4z', // horizontal bar
  tank: 'M6 4h12v16H6V4zm2 2v12h8V6H8z', // rectangle outline
  other: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z', // question mark
};

/**
 * Props for the NodeOverlay component.
 */
interface NodeOverlayProps {
  /** Array of nodes to display on the P&ID */
  nodes: AnalysisNodeWithCreator[];

  /** Natural width of the P&ID image in pixels */
  naturalWidth: number;

  /** Natural height of the P&ID image in pixels */
  naturalHeight: number;

  /** Current zoom level (1 = 100%) */
  zoom: number;

  /** Current pan position in pixels */
  position: { x: number; y: number };

  /** ID of the currently selected node (if any) */
  selectedNodeId?: string | null;

  /** Callback when a node is clicked */
  onNodeClick?: (node: AnalysisNodeWithCreator) => void;

  /** Callback when clicking on empty space (for creating new nodes) */
  onCanvasClick?: (x: number, y: number) => void;

  /** Whether the user can interact with nodes (based on permissions) */
  interactive?: boolean;

  /** Whether to show node labels */
  showLabels?: boolean;

  /** Active users in the collaboration room (for presence indicators) */
  activeUsers?: UserPresence[];

  /** Current user's ID (to exclude from presence display) */
  currentUserId?: string;
}

/**
 * NodeOverlay component displays clickable markers on a P&ID document.
 *
 * Features:
 * - Renders node markers at their percentage-based coordinates
 * - Scales markers appropriately with zoom level
 * - Supports node selection with visual feedback
 * - Shows tooltips with node information on hover
 * - Supports clicking on canvas to create new nodes
 * - Color-coded markers by equipment type
 */
export function NodeOverlay({
  nodes,
  naturalWidth,
  naturalHeight,
  zoom,
  position,
  selectedNodeId,
  onNodeClick,
  onCanvasClick,
  interactive = true,
  showLabels = false,
  activeUsers = [],
  currentUserId,
}: NodeOverlayProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  /**
   * Calculate marker size based on zoom level.
   * Markers scale inversely with zoom to maintain usability.
   */
  const markerSize = useMemo(() => {
    // At zoom 1, use base size. Scale inversely so markers don't get too small or large.
    const scaled = BASE_MARKER_SIZE / Math.sqrt(zoom);
    return Math.max(MIN_MARKER_SIZE, Math.min(MAX_MARKER_SIZE, scaled));
  }, [zoom]);

  /**
   * Convert percentage coordinates to screen coordinates.
   */
  const percentToScreen = useCallback(
    (percentX: number, percentY: number) => {
      // Convert percentage to pixel coordinates on the natural image
      const pixelX = (percentX / 100) * naturalWidth;
      const pixelY = (percentY / 100) * naturalHeight;

      // Apply zoom and center offset (image is centered in container)
      // The image transform is scale(zoom) with origin at center
      // Position offset is applied to the parent container
      const screenX = pixelX * zoom + position.x;
      const screenY = pixelY * zoom + position.y;

      return { x: screenX, y: screenY };
    },
    [naturalWidth, naturalHeight, zoom, position]
  );

  /**
   * Convert screen coordinates to percentage coordinates.
   * Used when clicking on canvas to determine node position.
   */
  const screenToPercent = useCallback(
    (screenX: number, screenY: number) => {
      // Reverse the transform: subtract position, divide by zoom
      const pixelX = (screenX - position.x) / zoom;
      const pixelY = (screenY - position.y) / zoom;

      // Convert pixel to percentage
      const percentX = (pixelX / naturalWidth) * 100;
      const percentY = (pixelY / naturalHeight) * 100;

      return { x: percentX, y: percentY };
    },
    [naturalWidth, naturalHeight, zoom, position]
  );

  /**
   * Handle click on the overlay canvas (not on a node).
   */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onCanvasClick || !interactive) return;

      // Only handle clicks on the overlay itself, not on nodes
      if ((e.target as HTMLElement).dataset.nodeMarker) return;

      // Get click position relative to the overlay container
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert to percentage coordinates
      const { x, y } = screenToPercent(clickX, clickY);

      // Only trigger if within valid range (0-100)
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        onCanvasClick(x, y);
      }
    },
    [onCanvasClick, screenToPercent, interactive]
  );

  /**
   * Handle click on a node marker.
   */
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: AnalysisNodeWithCreator) => {
      e.stopPropagation(); // Prevent canvas click
      if (onNodeClick && interactive) {
        onNodeClick(node);
      }
    },
    [onNodeClick, interactive]
  );

  /**
   * Handle mouse enter on a node marker.
   */
  const handleNodeMouseEnter = useCallback((nodeId: string) => {
    setHoveredNodeId(nodeId);
  }, []);

  /**
   * Handle mouse leave on a node marker.
   */
  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // If no natural dimensions yet, don't render
  if (naturalWidth === 0 || naturalHeight === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'hidden' }}
    >
      {/* Clickable overlay for creating nodes */}
      {onCanvasClick && interactive && (
        <div
          className="absolute inset-0 pointer-events-auto"
          onClick={handleCanvasClick}
          style={{ cursor: 'crosshair' }}
        />
      )}

      {/* Node markers */}
      {nodes.map((node) => {
        const { x: screenX, y: screenY } = percentToScreen(node.x, node.y);
        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNodeId === node.id;
        const color = EQUIPMENT_TYPE_COLORS[node.equipmentType];

        // Calculate if the marker is visible in the viewport
        // Add some margin for markers near edges
        const margin = markerSize;
        const isVisible =
          screenX >= -margin &&
          screenY >= -margin;

        if (!isVisible) return null;

        return (
          <Tooltip
            key={node.id}
            label={
              <div className="text-left">
                <div className="font-semibold">{node.nodeId}</div>
                <div className="text-xs opacity-90">
                  {EQUIPMENT_TYPE_LABELS[node.equipmentType]}
                </div>
                {node.description && (
                  <div className="text-xs mt-1 max-w-48 break-words">
                    {node.description}
                  </div>
                )}
              </div>
            }
            position="top"
            withArrow
            multiline
            disabled={!interactive}
          >
            <div
              data-node-marker="true"
              className={`absolute pointer-events-auto transition-transform duration-100 ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{
                left: screenX,
                top: screenY,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected || isHovered ? 20 : 10,
              }}
              onClick={(e) => handleNodeClick(e, node)}
              onMouseEnter={() => handleNodeMouseEnter(node.id)}
              onMouseLeave={handleNodeMouseLeave}
              role="button"
              tabIndex={interactive ? 0 : -1}
              aria-label={`Node ${node.nodeId}: ${EQUIPMENT_TYPE_LABELS[node.equipmentType]}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onNodeClick && interactive) {
                    onNodeClick(node);
                  }
                }
              }}
            >
              {/* Marker circle */}
              <div
                className="rounded-full flex items-center justify-center shadow-md transition-all duration-100"
                style={{
                  width: markerSize,
                  height: markerSize,
                  backgroundColor: color,
                  border: isSelected
                    ? '3px solid #1e293b'
                    : isHovered
                    ? '2px solid #1e293b'
                    : '2px solid white',
                  transform: isHovered || isSelected ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: isSelected
                    ? '0 0 0 2px rgba(59, 130, 246, 0.5), 0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                    : '0 2px 4px rgba(0, 0, 0, 0.2)',
                }}
              >
                {/* Equipment type icon */}
                <svg
                  viewBox="0 0 24 24"
                  fill="white"
                  className="w-3/5 h-3/5"
                  aria-hidden="true"
                >
                  <path d={EQUIPMENT_TYPE_ICONS[node.equipmentType]} />
                </svg>
              </div>

              {/* Node label (optional) */}
              {showLabels && (
                <div
                  className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 whitespace-nowrap text-xs font-medium bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200"
                  style={{ color }}
                >
                  {node.nodeId}
                </div>
              )}

              {/* Presence avatars for users viewing this node */}
              {activeUsers.length > 0 && (
                <div
                  className="absolute"
                  style={{
                    left: markerSize / 2 + 2,
                    top: -markerSize / 4,
                  }}
                >
                  <NodePresenceAvatars
                    users={activeUsers}
                    nodeId={node.id}
                    currentUserId={currentUserId}
                    size="xs"
                  />
                </div>
              )}
            </div>
          </Tooltip>
        );
      })}

      {/* Legend (shown when there are nodes) */}
      {nodes.length > 0 && (
        <div className="absolute bottom-3 right-3 bg-white/95 rounded shadow-sm border border-slate-200 px-3 py-2 pointer-events-auto">
          <div className="text-xs font-medium text-slate-600 mb-1.5">
            Equipment Types
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {/* Only show legend items for equipment types present in nodes */}
            {Array.from(new Set(nodes.map((n) => n.equipmentType))).map(
              (type) => (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: EQUIPMENT_TYPE_COLORS[type] }}
                  />
                  <span className="text-xs text-slate-600">
                    {EQUIPMENT_TYPE_LABELS[type]}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
