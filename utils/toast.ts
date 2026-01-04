import { toast as sonnerToast } from "sonner";

/**
 * Toast notification utility
 * Provides typed helper functions for common toast types
 */
export const toast = {
  /**
   * Show a success toast notification
   * @param message - The message to display
   */
  success: (message: string) => {
    return sonnerToast.success(message, {
      duration: 3000,
    });
  },

  /**
   * Show an error toast notification
   * @param message - The error message to display
   */
  error: (message: string) => {
    return sonnerToast.error(message, {
      duration: 4000,
    });
  },

  /**
   * Show an info toast notification
   * @param message - The info message to display
   */
  info: (message: string) => {
    return sonnerToast.info(message, {
      duration: 3000,
    });
  },

  /**
   * Show a warning toast notification
   * @param message - The warning message to display
   */
  warning: (message: string) => {
    return sonnerToast.warning(message, {
      duration: 3500,
    });
  },

  /**
   * Show a loading toast notification
   * @param message - The loading message to display
   * @returns The toast ID that can be used to dismiss or update the toast
   */
  loading: (message: string) => {
    return sonnerToast.loading(message);
  },

  /**
   * Show a promise toast that updates based on promise state
   * @param promise - The promise to track
   * @param messages - Success and error messages
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },

  /**
   * Dismiss a specific toast by ID
   * @param toastId - The ID of the toast to dismiss
   */
  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },
};
