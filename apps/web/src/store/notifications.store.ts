import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Storage key for persisted notification state.
 */
const NOTIFICATIONS_STORAGE_KEY = 'hazop-notifications';

/**
 * Notification type categories.
 */
export type NotificationType =
  | 'analysis_update'
  | 'report_complete'
  | 'collaboration_invite'
  | 'project_update'
  | 'system';

/**
 * Notification priority levels.
 */
export type NotificationPriority = 'low' | 'medium' | 'high';

/**
 * A single notification item.
 */
export interface Notification {
  /** Unique identifier */
  id: string;
  /** Notification type category */
  type: NotificationType;
  /** Short title */
  title: string;
  /** Detailed message */
  message: string;
  /** Priority level */
  priority: NotificationPriority;
  /** Whether the notification has been read */
  isRead: boolean;
  /** Timestamp when notification was created */
  createdAt: string;
  /** Optional link to navigate to */
  link?: string;
  /** Optional related entity ID (project, analysis, etc.) */
  entityId?: string;
}

/**
 * Notification state interface.
 */
interface NotificationState {
  /** List of notifications */
  notifications: Notification[];
  /** Whether the notification dropdown is open */
  isOpen: boolean;
}

/**
 * Notification store actions interface.
 */
interface NotificationActions {
  /** Add a new notification */
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  /** Mark a notification as read */
  markAsRead: (id: string) => void;
  /** Mark all notifications as read */
  markAllAsRead: () => void;
  /** Remove a notification */
  removeNotification: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
  /** Toggle dropdown open state */
  toggleOpen: () => void;
  /** Set dropdown open state */
  setOpen: (isOpen: boolean) => void;
  /** Get unread count */
  getUnreadCount: () => number;
}

/**
 * Complete notification store type.
 */
export type NotificationStore = NotificationState & NotificationActions;

/**
 * Generate a unique ID for notifications.
 */
function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Initial notification state.
 */
const initialState: NotificationState = {
  notifications: [],
  isOpen: false,
};

/**
 * Notification store for managing system alerts and updates.
 *
 * Features:
 * - Persists notifications to localStorage
 * - Supports multiple notification types
 * - Track read/unread state
 * - Limits stored notifications to prevent memory issues
 *
 * @example
 * ```tsx
 * // In a component
 * const { notifications, addNotification, markAsRead } = useNotificationStore();
 *
 * // Add a notification
 * addNotification({
 *   type: 'report_complete',
 *   title: 'Report Ready',
 *   message: 'Your HazOp report has been generated.',
 *   priority: 'medium',
 *   link: '/projects/123/reports',
 * });
 * ```
 */
export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,

      // Actions
      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: generateId(),
          createdAt: new Date().toISOString(),
          isRead: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50), // Limit to 50 notifications
        }));
      },

      markAsRead: (id: string) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        }));
      },

      removeNotification: (id: string) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      toggleOpen: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      setOpen: (isOpen: boolean) => {
        set({ isOpen });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.isRead).length;
      },
    }),
    {
      name: NOTIFICATIONS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist notifications, not UI state
      partialize: (state) => ({
        notifications: state.notifications,
      }),
    }
  )
);

/**
 * Selector for getting all notifications.
 */
export const selectNotifications = (state: NotificationStore) => state.notifications;

/**
 * Selector for getting unread notifications.
 */
export const selectUnreadNotifications = (state: NotificationStore) =>
  state.notifications.filter((n) => !n.isRead);

/**
 * Selector for getting unread count.
 */
export const selectUnreadCount = (state: NotificationStore) =>
  state.notifications.filter((n) => !n.isRead).length;

/**
 * Selector for getting dropdown open state.
 */
export const selectIsOpen = (state: NotificationStore) => state.isOpen;
