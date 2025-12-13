"use client";

import { BottomSheet } from "./BottomSheet";
import { JournalArchiveTree } from "./JournalArchiveTree";
import type { ArchiveNode } from "@/lib/utils/archive-builder";

interface JournalArchiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  archiveData: ArchiveNode[];
  currentDateRange: string | null;
  onNavigate: (dateKey: string) => void;
  loading: boolean;
}

export function JournalArchiveDrawer({
  isOpen,
  onClose,
  archiveData,
  currentDateRange,
  onNavigate,
  loading,
}: JournalArchiveDrawerProps) {
  // Wrap navigate handler to close drawer after navigation
  const handleNavigate = (dateKey: string) => {
    onNavigate(dateKey);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="max-h-[calc(80vh-8rem)] overflow-y-auto">
        <JournalArchiveTree
          archiveData={archiveData}
          currentDateRange={currentDateRange}
          onNavigate={handleNavigate}
          loading={loading}
        />
      </div>
    </BottomSheet>
  );
}
