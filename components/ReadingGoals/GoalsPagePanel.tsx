"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReadingGoalWidget } from "./ReadingGoalWidget";
import { ReadingGoalWidgetSkeleton } from "./ReadingGoalWidgetSkeleton";
import { ReadingGoalForm } from "./ReadingGoalForm";
import { YearSelector } from "@/components/Utilities/YearSelector";
import { MonthSelector } from "@/components/Utilities/MonthSelector";
import { MonthSelectorSkeleton } from "@/components/Utilities/MonthSelectorSkeleton";
import { ReadingGoalChart } from "./ReadingGoalChart";
import { ReadingGoalChartSkeleton } from "./ReadingGoalChartSkeleton";
import { CompletedBooksSection } from "@/components/Books/CompletedBooksSection";
import { GoalsOnboarding } from "./GoalsOnboarding";
import { Button } from "@/components/Utilities/Button";
import BaseModal from "@/components/Modals/BaseModal";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useReadingGoals } from "@/hooks/useReadingGoals";
import type { ReadingGoalWithProgress, MonthlyBreakdown } from "@/lib/services/reading-goals.service";
import type { ReadingGoal } from "@/lib/db/schema";

interface GoalsPagePanelProps {
  initialGoalData: ReadingGoalWithProgress | null;
  allGoals: ReadingGoal[];
}

export function GoalsPagePanel({ initialGoalData, allGoals }: GoalsPagePanelProps) {
  const queryClient = useQueryClient();
  const { createGoalAsync, updateGoalAsync } = useReadingGoals();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedYear, setSelectedYear] = useState(initialGoalData?.goal.year || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [booksGoal, setBooksGoal] = useState<number | "">(""); 
  const [saving, setSaving] = useState(false);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from(new Set([...allGoals.map(g => g.year), currentYear])).sort((a, b) => b - a);
    return years;
  }, [allGoals]);

  // Goal data query
  const { data: currentGoalData, isPending: goalLoading, error: goalError } = useQuery({
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
    initialData: selectedYear === initialGoalData?.goal.year ? initialGoalData : undefined,
    staleTime: 30000, // 30 seconds
  });

  // Monthly breakdown query
  const { data: monthlyData = [], isPending: monthlyLoading } = useQuery({
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
    isPending: booksLoading 
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

  // Calculate months with books from monthly data
  const monthsWithBooks = useMemo(() => {
    return monthlyData
      .filter(m => m.count > 0)
      .map(m => m.month);
  }, [monthlyData]);

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

  const currentYear = new Date().getFullYear();
  const year = modalMode === "edit" && currentGoalData?.goal ? currentGoalData.goal.year : selectedYear;
  const isPastYear = year < currentYear;
  const canEdit = !isPastYear || modalMode === "create";

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setBooksGoal("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = () => {
    setModalMode("edit");
    setBooksGoal(currentGoalData?.goal?.booksGoal ?? "");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setBooksGoal("");
  };

  const handleSubmit = async () => {
    // Validation
    if (booksGoal === "" || typeof booksGoal !== "number") {
      toast.error("Please enter a goal");
      return;
    }

    if (booksGoal < 1 || booksGoal > 9999) {
      toast.error("Goal must be between 1 and 9999 books");
      return;
    }

    if (!Number.isInteger(booksGoal)) {
      toast.error("Goal must be a whole number");
      return;
    }

    // Year validation - only allow current year or past years for new goals (no future years)
    if (modalMode === "create" && year > currentYear) {
      toast.error("Goals can only be created for the current year or past years");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        await createGoalAsync({ year, booksGoal });
      } else if (currentGoalData?.goal) {
        await updateGoalAsync({ id: currentGoalData.goal.id, data: { booksGoal } });
      }
      // Invalidate all queries for the current year
      queryClient.invalidateQueries({ queryKey: ['reading-goal', selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['monthly-breakdown', selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['completed-books', selectedYear] });
      setIsModalOpen(false);
      setBooksGoal("");
    } catch (error) {
      // Error already handled by mutation
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFromOnboarding = async (year: number, booksGoal: number) => {
    await createGoalMutation.mutateAsync({ year, booksGoal });
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedMonth(null); // Reset month filter when year changes
  };

  const handleMonthClick = (month: number) => {
    // Only set if month has books
    const monthData = monthlyData.find(m => m.month === month);
    const hasBooks = monthData ? monthData.count > 0 : false;
    if (hasBooks) {
      setSelectedMonth(month);
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

  const error = goalError ? (goalError instanceof Error ? goalError.message : "Failed to load data") : null;
  const loading = goalLoading;

  return (
    <div className="space-y-8 rounded-md">
      {/* Year Selector */}
      {availableYears.length > 0 && (
        <div className="flex items-center justify-center sm:justify-start">
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
          <Button
            onClick={handleOpenCreateModal}
            variant="primary"
            size="md"
          >
            Create Goal for {selectedYear}
          </Button>
        </div>
      )}

      {/* Edit/Create Goal Modal */}
      <BaseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalMode === "create" ? "Create Reading Goal" : "Edit Reading Goal"}
        subtitle={modalMode === "create" 
          ? `How many books do you want to read in ${selectedYear}?`
          : `Update your reading goal for ${selectedYear}`}
        actions={
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleCloseModal}
              variant="ghost"
              size="md"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canEdit || saving}
              variant="primary"
              size="md"
              icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {modalMode === "create" ? "Create Goal" : "Update Goal"}
            </Button>
          </div>
        }
        size="md"
        allowBackdropClose={false}
      >
        <ReadingGoalForm
          mode={modalMode}
          existingGoal={modalMode === "edit" ? currentGoalData?.goal : undefined}
          selectedYear={selectedYear}
          booksGoal={booksGoal}
          onBooksGoalChange={setBooksGoal}
          disabled={saving}
        />
      </BaseModal>

      {/* Monthly Chart - Only show for past and current years */}
      {selectedYear <= new Date().getFullYear() && (
        goalLoading || monthlyLoading ? (
          <div>
            <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4 text-center sm:text-left">
              {selectedYear < new Date().getFullYear() 
                ? "Monthly Breakdown" 
                : "Monthly Progress"}
            </h2>
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
              <ReadingGoalChartSkeleton />
            </div>
          </div>
        ) : currentGoalData && monthlyData.length > 0 ? (
          <div>
            <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-4 text-center sm:text-left">
              {selectedYear < new Date().getFullYear() 
                ? "Monthly Breakdown" 
                : "Monthly Progress"}
            </h2>
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
              <ReadingGoalChart
                monthlyData={monthlyData}
                onMonthClick={handleMonthClick}
                selectedMonth={selectedMonth}
              />
            </div>
          </div>
        ) : null
      )}

      {/* Completed Books Section - Only show for past and current years */}
      {selectedYear <= new Date().getFullYear() && (
        goalLoading || booksLoading ? (
          <CompletedBooksSection
            year={selectedYear}
            books={[]}
            count={0}
            loading={true}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            monthSelector={
              <MonthSelector
                year={selectedYear}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                minYear={availableYears[availableYears.length - 1]}
                maxYear={availableYears[0]}
                onYearChange={handleYearChange}
                monthsWithBooks={monthsWithBooks}
                loading={monthlyLoading}
              />
            }
          />
        ) : currentGoalData ? (
          <CompletedBooksSection
            year={selectedYear}
            books={completedBooks}
            count={booksCount}
            loading={false}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            monthSelector={
              <MonthSelector
                year={selectedYear}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                minYear={availableYears[availableYears.length - 1]}
                maxYear={availableYears[0]}
                onYearChange={handleYearChange}
                monthsWithBooks={monthsWithBooks}
                loading={monthlyLoading}
              />
            }
          />
        ) : null
      )}
    </div>
  );
}
