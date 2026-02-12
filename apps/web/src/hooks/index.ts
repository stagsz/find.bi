/**
 * Custom React hooks for the HazOp Assistant application.
 * @module hooks
 */

// Real-time collaboration
export {
  useWebSocket,
  getAnalysisRoomName,
  type CursorPosition,
  type UserPresence,
  type EntryUpdatePayload,
  type EntryCreatedPayload,
  type EntryDeletedPayload,
  type RiskUpdatePayload,
  type ConflictEntrySnapshot,
  type ConflictDetectedPayload,
  type ConflictResolvedPayload,
  type SocketError,
  type ConnectionStatus,
  type WebSocketState,
  type WebSocketActions,
  type WebSocketEventHandlers,
} from './useWebSocket';
