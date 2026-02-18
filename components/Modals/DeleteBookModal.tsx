"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import BaseModal from "./BaseModal";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";
import { Button } from "@/components/Utilities/Button";
import { libraryService } from "@/lib/library-service";

interface DeleteBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: number;
  bookTitle: string;
}

const logger = getLogger().child({ component: "DeleteBookModal" });

export default function DeleteBookModal({
  isOpen,
  onClose,
  bookId,
  bookTitle,
}: DeleteBookModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403) {
          toast.error(error.error || "Cannot delete synced books");
          onClose();
          return;
        }
        throw new Error(error.error || "Failed to delete book");
      }

      // Invalidate queries and redirect to library
      libraryService.clearCache(); // Clear LibraryService cache
      await queryClient.invalidateQueries({ queryKey: ['books'] });
      await queryClient.invalidateQueries({ queryKey: ['library-books'] });
      
      toast.success("Book deleted successfully");
      
      // Force router to refresh and then redirect
      router.refresh();
      router.push('/library');
    } catch (error) {
      logger.error({ err: error, bookId }, "Error deleting book");
      toast.error(error instanceof Error ? error.message : "Failed to delete book");
      setIsDeleting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Book"
      size="md"
      actions={
        <>
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="danger"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Book"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[var(--foreground)]">
          Are you sure you want to delete <strong>{bookTitle}</strong>?
        </p>
        
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
          <p className="text-sm text-[var(--foreground)]">
            <strong className="text-red-500">Warning:</strong> This will permanently remove the book 
            and all associated reading history, progress logs, and notes. 
            This action cannot be undone.
          </p>
        </div>
      </div>
    </BaseModal>
  );
}
