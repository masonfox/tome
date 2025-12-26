"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReadingGoalWidget } from "./ReadingGoalWidget";
import { ReadingGoalWidgetSkeleton } from "./ReadingGoalWidgetSkeleton";
import { ReadingGoalForm } from "./ReadingGoalForm";
import { YearSelector } from "./YearSelector";
import { ReadingGoalChart } from "./ReadingGoalChart";
import { ReadingGoalChartSkeleton } from "./ReadingGoalChartSkeleton";
import { CompletedBooksSection } from "./CompletedBooksSection";
import { GoalsOnboarding } from "./GoalsOnboarding";
import type { ReadingGoalWithProgress, MonthlyBreakdown } from "@/lib/services/reading-goals.service";
import type { ReadingGoal } from "@/lib/db/schema";

interface GoalsPagePanelProps {
  initialGoalData: ReadingGoalWithProgress | null;
  allGoals: ReadingGoal[];
}

export function GoalsPagePanel({ initialGoalData, allGoals }: GoalsPagePanelProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedYear, setSelectedYear] = useState(initialGoalData?.goal.year || new Date().getFullYear());
  const [mounted, setMounted] = useState(false);

  const availableYears = useMemo(() => 
    Array.from(new Set(allGoals.map(g => g.year))).sort((a, b) => b - a),
    [allGoals]
  );

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Goal data query
  const { data: currentGoalData, isLoading: goalLoading, error: goalError } = useQuery({
    queryKey: ['reading-goal', selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/reading-goals?year=${selectedYear}`);
      // 404 is expected when no goal exists for the year - return null instead of throwing
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch goal data: ${response.statusText}`);
      }
      const data = await response.json();
      return data.success ? data.data as ReadingGoalWithProgress : null;
    },
    staleTime: 30000, // 30 seconds
  });

  // Monthly breakdown query
  const { data: monthlyData = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthly-breakdown', selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/reading-goals/monthly?year=${selectedYear}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch monthly data: ${response.statusText}`);
      }
      const data = await response.json();
      return data.success ? data.data.monthlyData as MonthlyBreakdown[] : [];
    },
    staleTime: 30000, // 30 seconds
  });

  // Completed books query
  const { 
    data: booksData, 
    isLoading: booksLoading 
  } = useQuery({
    queryKey: ['completed-books', selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/reading-goals/books?year=${selectedYear}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch completed books: ${response.statusText}`);
      }
      const data = await response.json();
      return data.success ? { books: data.data.books, count: data.data.count } : { books: [], count: 0 };
    },
    staleTime: 30000, // 30 seconds
    enabled: selectedYear <= new Date().getFullYear(),
  });

  const completedBooks = booksData?.books || [];
  const booksCount = booksData?.count || 0;

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async ({ year, booksGoal }: { year: number; booksGoal: number }) => {
      const response = await fetch("/api/reading-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, booksGoal }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to create goal");
      }

      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reading-goal', variables.year] });
      queryClient.invalidateQueries({ queryKey: ['monthly-breakdown', variables.year] });
      queryClient.invalidateQueries({ queryKey: ['completed-books', variables.year] });
      setSelectedYear(variables.year);
    },
  });

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

  const handleSuccess = async () => {
    setIsModalOpen(false);
    // Invalidate all queries for the current year
    queryClient.invalidateQueries({ queryKey: ['reading-goal', selectedYear] });
    queryClient.invalidateQueries({ queryKey: ['monthly-breakdown', selectedYear] });
    queryClient.invalidateQueries({ queryKey: ['completed-books', selectedYear] });
  };

  const handleCreateFromOnboarding = async (year: number, booksGoal: number) => {
    await createGoalMutation.mutateAsync({ year, booksGoal });
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
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

  const error = goalError ? (goalError instanceof Error ? goalError.message : "Failed to load data") : null;
  const loading = goalLoading;

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

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-sm p-4 mb-4">
          <p className="text-sm text-red-800 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Current Goal Display */}
      {loading ? (
        <ReadingGoalWidgetSkeleton />
      ) : currentGoalData ? (
        <ReadingGoalWidget 
          goalData={currentGoalData}
          onEditClick={handleOpenEditModal}
        />
      ) : availableYears.length === 0 ? (
        <GoalsOnboarding onCreateGoal={handleCreateFromOnboarding} />
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

      {/* Modal Overlay - Rendered via Portal to document.body */}
      {mounted && isModalOpen && createPortal(
        <div 
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-fade-in"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm shadow-lg p-6 max-w-md w-full animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <ReadingGoalForm
              mode={modalMode}
              existingGoal={modalMode === "edit" ? currentGoalData?.goal : undefined}
              onSuccess={handleSuccess}
              onCancel={handleCloseModal}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Monthly Chart - Only show for past and current years */}
      {currentGoalData && selectedYear <= new Date().getFullYear() && (
        monthlyLoading ? (
          <ReadingGoalChartSkeleton />
        ) : monthlyData.length > 0 ? (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm p-6">
            <h3 className="text-base font-serif font-bold text-[var(--heading-text)] mb-4">
              {selectedYear < new Date().getFullYear() 
                ? "Monthly Breakdown" 
                : "Monthly Progress"}
            </h3>
            <ReadingGoalChart
              monthlyData={monthlyData}
            />
          </div>
        ) : null
      )}

      {/* Completed Books Section - Only show for past and current years */}
      {currentGoalData && selectedYear <= new Date().getFullYear() && (
        <CompletedBooksSection
          year={selectedYear}
          books={completedBooks}
          count={booksCount}
          loading={booksLoading}
        />
      )}
    </div>
  );
}
