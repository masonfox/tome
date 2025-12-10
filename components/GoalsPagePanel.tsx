"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ReadingGoalWidget } from "./ReadingGoalWidget";
import { CreateGoalPrompt } from "./CreateGoalPrompt";
import { ReadingGoalForm } from "./ReadingGoalForm";
import { YearSelector } from "./YearSelector";
import type { ReadingGoalWithProgress } from "@/lib/services/reading-goals.service";
import type { ReadingGoal } from "@/lib/db/schema";

interface GoalsPagePanelProps {
  initialGoalData: ReadingGoalWithProgress | null;
  allGoals: ReadingGoal[];
}

export function GoalsPagePanel({ initialGoalData, allGoals }: GoalsPagePanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedYear, setSelectedYear] = useState(initialGoalData?.goal.year || new Date().getFullYear());
  const [currentGoalData, setCurrentGoalData] = useState<ReadingGoalWithProgress | null>(initialGoalData);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Extract unique years from goals, sorted descending
  const availableYears = Array.from(new Set(allGoals.map(g => g.year))).sort((a, b) => b - a);

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

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    setLoading(true);

    try {
      const response = await fetch(`/api/reading-goals?year=${year}`);
      const data = await response.json();

      if (data.success) {
        setCurrentGoalData(data.data);
      } else {
        setCurrentGoalData(null);
      }
    } catch (error) {
      console.error("Failed to fetch goal data:", error);
      setCurrentGoalData(null);
    } finally {
      setLoading(false);
    }
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
    <div className="space-y-8 rounded-md">
      {/* Year Selector */}
      {availableYears.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-[var(--heading-text)]">
            Reading Goals
          </h2>
          <YearSelector
            years={availableYears}
            selectedYear={selectedYear}
            onYearChange={handleYearChange}
          />
        </div>
      )}

      {/* Current Goal Display */}
      {loading ? (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-16 text-center">
          <p className="text-[var(--subheading-text)] font-medium">Loading...</p>
        </div>
      ) : currentGoalData ? (
        <ReadingGoalWidget 
          goalData={currentGoalData}
          onEditClick={handleOpenEditModal}
        />
      ) : availableYears.length === 0 ? (
        <CreateGoalPrompt onCreateClick={handleOpenCreateModal} />
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-12 text-center">
          <p className="text-[var(--subheading-text)] font-medium mb-4">
            No goal set for {selectedYear}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-sm hover:bg-[var(--light-accent)] transition-colors font-semibold text-sm"
          >
            Create Goal for {selectedYear}
          </button>
        </div>
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
