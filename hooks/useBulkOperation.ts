import { useState } from "react";

/**
 * Generic hook for managing bulk operations with modal confirmation
 * 
 * Extracts common pattern used in read-next and shelves pages for:
 * - Bulk delete/remove operations
 * - Bulk move operations
 * - Bulk copy operations
 * 
 * @example
 * ```tsx
 * const bulkRemove = useBulkOperation({
 *   onExecute: async (bookIds) => {
 *     await removeBooks(bookIds);
 *   },
 *   onSuccess: () => {
 *     setIsSelectMode(false);
 *     setSelectedBookIds(new Set());
 *     toast.success("Books removed");
 *   },
 * });
 * 
 * // Trigger modal
 * <button onClick={bulkRemove.trigger}>Remove Selected</button>
 * 
 * // In modal
 * <ConfirmModal
 *   isOpen={bulkRemove.showModal}
 *   onClose={() => bulkRemove.setShowModal(false)}
 *   onConfirm={() => bulkRemove.execute(Array.from(selectedBookIds))}
 *   loading={bulkRemove.loading}
 * />
 * ```
 */
export function useBulkOperation<T = number>({
  onExecute,
  onSuccess,
  onError,
}: {
  /**
   * Function to execute the bulk operation
   * Should handle its own error toast notifications
   */
  onExecute: (items: T[]) => Promise<void>;
  /**
   * Optional callback after successful execution
   * Use for cleanup (clearing selection, closing modals, etc.)
   */
  onSuccess?: () => void;
  /**
   * Optional callback after failed execution
   * onExecute should handle error toasts, this is for additional cleanup
   */
  onError?: (error: unknown) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  /**
   * Trigger the confirmation modal
   * Call this from the action button (e.g., "Remove Selected")
   */
  const trigger = () => {
    setShowModal(true);
  };

  /**
   * Execute the bulk operation
   * Call this from the modal's confirm button
   * 
   * @param items - Array of items to operate on (e.g., book IDs)
   */
  const execute = async (items: T[]) => {
    if (items.length === 0) {
      setShowModal(false);
      return;
    }

    setLoading(true);
    try {
      await onExecute(items);
      setShowModal(false);
      onSuccess?.();
    } catch (error) {
      // Error toast should be handled by onExecute
      // This catch is for cleanup and optional error callback
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancel and close the modal
   * Convenience method for explicit cancellation
   */
  const cancel = () => {
    setShowModal(false);
  };

  return {
    /** Whether the operation is currently executing */
    loading,
    /** Whether the confirmation modal should be shown */
    showModal,
    /** Manually control modal visibility */
    setShowModal,
    /** Trigger the confirmation modal */
    trigger,
    /** Execute the bulk operation with given items */
    execute,
    /** Cancel and close the modal */
    cancel,
  };
}
