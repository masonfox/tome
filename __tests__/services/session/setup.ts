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

// Note: ProgressService mock removed as circular dependency was fixed in production code
// (ProgressService now uses direct repository calls instead of creating new SessionService)
