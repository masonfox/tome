"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ReadingGoalWidget } from "./ReadingGoalWidget";
import { CreateGoalPrompt } from "./CreateGoalPrompt";
import { ReadingGoalForm } from "./ReadingGoalForm";
import type { ReadingGoalWithProgress } from "@/lib/services/reading-goals.service";

interface GoalsPagePanelProps {
  initialGoalData: ReadingGoalWithProgress | null;
}

export function GoalsPagePanel({ initialGoalData }: GoalsPagePanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const router = useRouter();

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = () => {
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    router.refresh(); // Refresh server component data
  };

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        handleCloseModal();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isModalOpen]);

  return (
    <div className="space-y-10 rounded-md">
      {/* Current Goal Display */}
      {initialGoalData ? (
        <ReadingGoalWidget 
          goalData={initialGoalData}
          onEditClick={handleOpenEditModal}
        />
      ) : (
        <CreateGoalPrompt onCreateClick={handleOpenCreateModal} />
      )}

      {/* Modal Overlay */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm shadow-lg p-6 max-w-md w-full animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <ReadingGoalForm
              mode={modalMode}
              existingGoal={modalMode === "edit" ? initialGoalData?.goal : undefined}
              onSuccess={handleSuccess}
              onCancel={handleCloseModal}
            />
          </div>
        </div>
      )}

      {/* TODO: Year selector will go here in Phase 9 */}
      {/* TODO: Monthly chart will go here in Phase 11 */}
    </div>
  );
}
