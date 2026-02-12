import { useNavigate } from 'react-router-dom';
import { Menu } from '@mantine/core';
import {
  IconBell,
  IconCheck,
  IconTrash,
  IconFileReport,
  IconUsers,
  IconAnalyze,
  IconFolder,
  IconAlertCircle,
} from '@tabler/icons-react';
import {
  useNotificationStore,
  selectNotifications,
  selectUnreadCount,
  type Notification,
  type NotificationType,
} from '../../store';

/**
 * Get the icon component for a notification type.
 */
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'analysis_update':
      return IconAnalyze;
    case 'report_complete':
      return IconFileReport;
    case 'collaboration_invite':
      return IconUsers;
    case 'project_update':
      return IconFolder;
    case 'system':
    default:
      return IconAlertCircle;
  }
}

/**
 * Get the color for a notification type.
 */
function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'analysis_update':
      return 'text-blue-400';
    case 'report_complete':
      return 'text-green-400';
    case 'collaboration_invite':
      return 'text-purple-400';
    case 'project_update':
      return 'text-amber-400';
    case 'system':
    default:
      return 'text-slate-400';
  }
}

/**
 * Format a timestamp for display.
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Single notification item props.
 */
interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
  onNavigate: (link: string) => void;
}

/**
 * Single notification item component.
 */
function NotificationItem({
  notification,
  onRead,
  onRemove,
  onNavigate,
}: NotificationItemProps) {
  const Icon = getNotificationIcon(notification.type);
  const colorClass = getNotificationColor(notification.type);

  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
    if (notification.link) {
      onNavigate(notification.link);
    }
  };

  return (
    <div
      className={`px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-700 ${
        !notification.isRead ? 'bg-slate-750' : ''
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${colorClass}`}>
          <Icon size={18} stroke={1.5} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                notification.isRead ? 'text-slate-300' : 'text-white'
              }`}
            >
              {notification.title}
            </span>
            {!notification.isRead && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
            )}
          </div>
          <p
            className={`text-xs mt-0.5 line-clamp-2 ${
              notification.isRead ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {notification.message}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">
            {formatTime(notification.createdAt)}
          </span>
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(notification.id);
          }}
          className="flex-shrink-0 p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-600 transition-colors"
          aria-label="Remove notification"
        >
          <IconTrash size={14} stroke={1.5} />
        </button>
      </div>
    </div>
  );
}

/**
 * Notification dropdown component.
 *
 * Displays system alerts and updates with:
 * - Unread count badge
 * - Notification list with type icons
 * - Mark as read functionality
 * - Clear all option
 * - Navigation to related entities
 *
 * Features:
 * - Accessible keyboard navigation via Mantine Menu
 * - Consistent styling with UserMenuDropdown
 * - Professional, clean design
 */
export function NotificationDropdown() {
  const navigate = useNavigate();
  const notifications = useNotificationStore(selectNotifications);
  const unreadCount = useNotificationStore(selectUnreadCount);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const clearAll = useNotificationStore((state) => state.clearAll);

  const handleNavigate = (link: string) => {
    navigate(link);
  };

  return (
    <Menu
      position="bottom-end"
      offset={8}
      width={360}
      shadow="md"
      styles={{
        dropdown: {
          backgroundColor: '#1e293b', // slate-800
          borderColor: '#334155', // slate-700
          padding: 0,
          maxHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Menu.Target>
        <button
          className="relative flex items-center justify-center w-10 h-10 rounded text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <IconBell size={20} stroke={1.5} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-medium rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </Menu.Target>

      <Menu.Dropdown>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white">Notifications</h3>
          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={clearAll}
                className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Notification list */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <IconBell size={32} stroke={1.5} className="text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">No notifications</p>
              <p className="text-xs text-slate-500 mt-1">
                You're all caught up
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onRemove={removeNotification}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with unread summary */}
        {notifications.length > 0 && unreadCount > 0 && (
          <div className="flex items-center justify-center px-4 py-2 border-t border-slate-700">
            <span className="text-xs text-slate-400">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
