/**
 * Toast notification hook for consistent success/error feedback.
 *
 * Uses Mantine notifications under the hood with a simplified API
 * tailored for HazOp Assistant's common use cases.
 */
import { notifications } from '@mantine/notifications';
import type { ApiError } from '@hazop/types';

/**
 * Toast notification options.
 */
interface ToastOptions {
  /** Optional title for the notification */
  title?: string;
  /** Auto-close delay in milliseconds (default: 4000) */
  autoClose?: number | false;
}

/**
 * Toast notification actions returned by the hook.
 */
interface ToastActions {
  /** Show a success toast */
  success: (message: string, options?: ToastOptions) => void;
  /** Show an error toast */
  error: (messageOrError: string | ApiError, options?: ToastOptions) => void;
  /** Show an info toast */
  info: (message: string, options?: ToastOptions) => void;
  /** Show a warning toast */
  warning: (message: string, options?: ToastOptions) => void;
  /** Dismiss all toasts */
  dismissAll: () => void;
}

/**
 * Hook for showing toast notifications throughout the application.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const toast = useToast();
 *
 *   const handleSave = async () => {
 *     const result = await saveData();
 *     if (result.success) {
 *       toast.success('Data saved successfully');
 *     } else {
 *       toast.error(result.error);
 *     }
 *   };
 * }
 * ```
 */
export function useToast(): ToastActions {
  /**
   * Show a success toast notification.
   */
  const success = (message: string, options?: ToastOptions) => {
    notifications.show({
      title: options?.title ?? 'Success',
      message,
      color: 'green',
      autoClose: options?.autoClose ?? 4000,
      styles: {
        root: { borderRadius: '4px' },
        title: { fontWeight: 600 },
      },
    });
  };

  /**
   * Show an error toast notification.
   * Accepts either a string message or an ApiError object.
   */
  const error = (messageOrError: string | ApiError, options?: ToastOptions) => {
    const message =
      typeof messageOrError === 'string' ? messageOrError : messageOrError.message;

    notifications.show({
      title: options?.title ?? 'Error',
      message,
      color: 'red',
      autoClose: options?.autoClose ?? 6000,
      styles: {
        root: { borderRadius: '4px' },
        title: { fontWeight: 600 },
      },
    });
  };

  /**
   * Show an info toast notification.
   */
  const info = (message: string, options?: ToastOptions) => {
    notifications.show({
      title: options?.title ?? 'Info',
      message,
      color: 'blue',
      autoClose: options?.autoClose ?? 4000,
      styles: {
        root: { borderRadius: '4px' },
        title: { fontWeight: 600 },
      },
    });
  };

  /**
   * Show a warning toast notification.
   */
  const warning = (message: string, options?: ToastOptions) => {
    notifications.show({
      title: options?.title ?? 'Warning',
      message,
      color: 'yellow',
      autoClose: options?.autoClose ?? 5000,
      styles: {
        root: { borderRadius: '4px' },
        title: { fontWeight: 600 },
      },
    });
  };

  /**
   * Dismiss all currently visible toasts.
   */
  const dismissAll = () => {
    notifications.cleanQueue();
  };

  return {
    success,
    error,
    info,
    warning,
    dismissAll,
  };
}
