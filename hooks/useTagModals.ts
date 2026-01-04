import { useState, useCallback } from "react";
import type { TagOperationResult } from "@/types/tag-operations";

interface TagToDelete {
  name: string;
  bookCount: number;
}

export interface UseTagModalsReturn {
  // Rename modal state
  renameModalOpen: boolean;
  tagToRename: string;
  renameLoading: boolean;
  renameResult: TagOperationResult | null;
  openRenameModal: (tagName: string) => void;
  closeRenameModal: () => void;
  setRenameLoading: (loading: boolean) => void;
  setRenameResult: (result: TagOperationResult | null) => void;

  // Delete modal state
  deleteModalOpen: boolean;
  tagToDelete: TagToDelete | null;
  deleteLoading: boolean;
  deleteResult: TagOperationResult | null;
  openDeleteModal: (tagName: string, bookCount: number) => void;
  closeDeleteModal: () => void;
  setDeleteLoading: (loading: boolean) => void;
  setDeleteResult: (result: TagOperationResult | null) => void;

  // Merge modal state
  mergeModalOpen: boolean;
  tagsToMerge: string[];
  mergeLoading: boolean;
  mergeResult: TagOperationResult | null;
  openMergeModal: (sourceTags: string[]) => void;
  closeMergeModal: () => void;
  setMergeLoading: (loading: boolean) => void;
  setMergeResult: (result: TagOperationResult | null) => void;

  // Bulk delete modal state
  bulkDeleteModalOpen: boolean;
  tagsToDelete: TagToDelete[];
  bulkDeleteLoading: boolean;
  bulkDeleteResult: TagOperationResult | null;
  openBulkDeleteModal: (tags: TagToDelete[]) => void;
  closeBulkDeleteModal: () => void;
  setBulkDeleteLoading: (loading: boolean) => void;
  setBulkDeleteResult: (result: TagOperationResult | null) => void;
}

/**
 * Custom hook to manage all modal states for the tags page
 * Extracts modal state management to prevent parent re-renders
 */
export function useTagModals(): UseTagModalsReturn {
  // Rename modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [tagToRename, setTagToRename] = useState<string>("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameResult, setRenameResult] = useState<TagOperationResult | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<TagToDelete | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteResult, setDeleteResult] = useState<TagOperationResult | null>(null);

  // Merge modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [tagsToMerge, setTagsToMerge] = useState<string[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeResult, setMergeResult] = useState<TagOperationResult | null>(null);

  // Bulk delete modal state
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [tagsToDelete, setTagsToDelete] = useState<TagToDelete[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<TagOperationResult | null>(null);

  // Rename modal actions
  const openRenameModal = useCallback((tagName: string) => {
    setTagToRename(tagName);
    setRenameResult(null);
    setRenameModalOpen(true);
  }, []);

  const closeRenameModal = useCallback(() => {
    setRenameModalOpen(false);
    setRenameResult(null);
  }, []);

  // Delete modal actions
  const openDeleteModal = useCallback((tagName: string, bookCount: number) => {
    setTagToDelete({ name: tagName, bookCount });
    setDeleteResult(null);
    setDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteResult(null);
  }, []);

  // Merge modal actions
  const openMergeModal = useCallback((sourceTags: string[]) => {
    setTagsToMerge(sourceTags);
    setMergeResult(null);
    setMergeModalOpen(true);
  }, []);

  const closeMergeModal = useCallback(() => {
    setMergeModalOpen(false);
    setMergeResult(null);
  }, []);

  // Bulk delete modal actions
  const openBulkDeleteModal = useCallback((tags: TagToDelete[]) => {
    setTagsToDelete(tags);
    setBulkDeleteResult(null);
    setBulkDeleteModalOpen(true);
  }, []);

  const closeBulkDeleteModal = useCallback(() => {
    setBulkDeleteModalOpen(false);
    setBulkDeleteResult(null);
  }, []);

  return {
    // Rename modal
    renameModalOpen,
    tagToRename,
    renameLoading,
    renameResult,
    openRenameModal,
    closeRenameModal,
    setRenameLoading,
    setRenameResult,

    // Delete modal
    deleteModalOpen,
    tagToDelete,
    deleteLoading,
    deleteResult,
    openDeleteModal,
    closeDeleteModal,
    setDeleteLoading,
    setDeleteResult,

    // Merge modal
    mergeModalOpen,
    tagsToMerge,
    mergeLoading,
    mergeResult,
    openMergeModal,
    closeMergeModal,
    setMergeLoading,
    setMergeResult,

    // Bulk delete modal
    bulkDeleteModalOpen,
    tagsToDelete,
    bulkDeleteLoading,
    bulkDeleteResult,
    openBulkDeleteModal,
    closeBulkDeleteModal,
    setBulkDeleteLoading,
    setBulkDeleteResult,
  };
}
