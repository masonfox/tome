import { mock } from "bun:test";

/**
 * Shared mock setup for SessionService tests
 * This eliminates duplication across session test files
 */

// Mock external dependencies
mock.module("@/lib/streaks", () => ({
  rebuildStreak: mock(() => Promise.resolve()),
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(() => {}),
}));

mock.module("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: mock(() => {}),
  },
}));

// Mock ProgressService to avoid circular dependency issues in tests
mock.module("@/lib/services/progress.service", () => ({
  progressService: {
    logProgress: mock(async (bookId: number, data: any) => {
      // Simulate progress logging by creating a progress entry
      // In real code, this would trigger auto-completion
      return {
        progressLog: {
          id: 1,
          bookId,
          sessionId: 1,
          currentPage: data.currentPage,
          currentPercentage: data.currentPercentage,
          progressDate: data.progressDate || new Date(),
          notes: data.notes,
          pagesRead: data.currentPage,
        },
        shouldShowCompletionModal: data.currentPercentage >= 100,
      };
    }),
  },
  ProgressService: class MockProgressService {
    async logProgress(bookId: number, data: any) {
      return {
        progressLog: {
          id: 1,
          bookId,
          sessionId: 1,
          currentPage: data.currentPage,
          currentPercentage: data.currentPercentage,
          progressDate: data.progressDate || new Date(),
          notes: data.notes,
          pagesRead: data.currentPage,
        },
        shouldShowCompletionModal: data.currentPercentage >= 100,
      };
    }
  },
}));
