"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ReadingGoalWidget } from "./ReadingGoalWidget";
import { CreateGoalPrompt } from "./CreateGoalPrompt";
import { ReadingGoalForm } from "./ReadingGoalForm";
import { YearSelector } from "./YearSelector";
import { ReadingGoalChart } from "./ReadingGoalChart";
import { CompletedBooksSection } from "./CompletedBooksSection";
import { GoalsOnboarding } from "./GoalsOnboarding";
import type { ReadingGoalWithProgress, MonthlyBreakdown } from "@/lib/services/reading-goals.service";
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
  const [monthlyData, setMonthlyData] = useState<MonthlyBreakdown[]>([]);
  const [completedBooks, setCompletedBooks] = useState<any[]>([]);
  const [booksCount, setBooksCount] = useState(0);
  const [availableYears, setAvailableYears] = useState<number[]>(
    Array.from(new Set(allGoals.map(g => g.year))).sort((a, b) => b - a)
  );
  const [loading, setLoading] = useState(false);
  const [booksLoading, setBooksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync with props when they change (after server refresh)
  useEffect(() => {
    const years = Array.from(new Set(allGoals.map(g => g.year))).sort((a, b) => b - a);
    setAvailableYears(years);
  }, [allGoals]);

  useEffect(() => {
    setCurrentGoalData(initialGoalData);
  }, [initialGoalData]);

  // Fetch monthly data and books when selected year changes
  useEffect(() => {
    fetchMonthlyData(selectedYear);
    fetchCompletedBooks(selectedYear);
  }, [selectedYear]);

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
    
    // Refresh both the current goal data and trigger server refresh
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reading-goals?year=${selectedYear}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch goal data: ${response.statusText}`);
      }
      const data = await response.json();

      if (data.success) {
        setCurrentGoalData(data.data);
      } else {
        setCurrentGoalData(null);
      }
      
      // Refresh server component to update allGoals prop
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load goal data";
      setError(errorMessage);
      // Still refresh to get server data
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromOnboarding = async (year: number, booksGoal: number) => {
    const response = await fetch("/api/reading-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, booksGoal }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || "Failed to create goal");
    }

    // Update state with new goal
    setSelectedYear(year);
    setCurrentGoalData(data.data);
    
    // Refresh server component to update allGoals prop
    router.refresh();
  };

  const fetchMonthlyData = async (year: number) => {
    try {
      const response = await fetch(`/api/reading-goals/monthly?year=${year}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch monthly data: ${response.statusText}`);
      }
      const data = await response.json();

      if (data.success) {
        setMonthlyData(data.data.monthlyData);
      } else {
        setMonthlyData([]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load monthly data";
      setError(errorMessage);
      setMonthlyData([]);
    }
  };

  const fetchCompletedBooks = async (year: number) => {
    setBooksLoading(true);
    try {
      const response = await fetch(`/api/reading-goals/books?year=${year}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch completed books: ${response.statusText}`);
      }
      const data = await response.json();

      if (data.success) {
        setCompletedBooks(data.data.books);
        setBooksCount(data.data.count);
      } else {
        setCompletedBooks([]);
        setBooksCount(0);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load completed books";
      setError(errorMessage);
      setCompletedBooks([]);
      setBooksCount(0);
    } finally {
      setBooksLoading(false);
    }
  };

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    setLoading(true);
    setBooksLoading(true);
    setError(null);

    try {
      // Fetch goal data, monthly data, and completed books
      const [goalResponse, monthlyResponse, booksResponse] = await Promise.all([
        fetch(`/api/reading-goals?year=${year}`),
        fetch(`/api/reading-goals/monthly?year=${year}`),
        fetch(`/api/reading-goals/books?year=${year}`)
      ]);

      // Handle each response independently to avoid clearing all data on partial failure
      let hasError = false;
      
      // Process goal data
      if (goalResponse.ok) {
        const goalData = await goalResponse.json();
        if (goalData.success) {
          setCurrentGoalData(goalData.data);
        } else {
          setCurrentGoalData(null);
        }
      } else {
        hasError = true;
        setCurrentGoalData(null);
      }

      // Process monthly data
      if (monthlyResponse.ok) {
        const monthlyDataResponse = await monthlyResponse.json();
        if (monthlyDataResponse.success) {
          setMonthlyData(monthlyDataResponse.data.monthlyData);
        } else {
          setMonthlyData([]);
        }
      } else {
        hasError = true;
        setMonthlyData([]);
      }

      // Process books data
      if (booksResponse.ok) {
        const booksData = await booksResponse.json();
        if (booksData.success) {
          setCompletedBooks(booksData.data.books);
          setBooksCount(booksData.data.count);
        } else {
          setCompletedBooks([]);
          setBooksCount(0);
        }
      } else {
        hasError = true;
        setCompletedBooks([]);
        setBooksCount(0);
      }

      // Only set error message if there were failures
      if (hasError) {
        setError("Some data failed to load");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load data";
      setError(errorMessage);
      // Don't clear existing data on network errors
    } finally {
      setLoading(false);
      setBooksLoading(false);
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

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-sm p-4 mb-4">
          <p className="text-sm text-red-800 dark:text-red-400 font-medium">{error}</p>
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
      {currentGoalData && monthlyData.length > 0 && selectedYear <= new Date().getFullYear() && (
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
