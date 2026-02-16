import { vi } from "vitest";

/**
 * Shared mock setup for SessionService tests
 * This eliminates duplication across session test files
 */

// Mock external dependencies
vi.mock("@/lib/services/streak.service", () => ({
  streakService: {
    rebuildStreak: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(() => {}),
}));

vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: vi.fn(() => {}),
  },
}));

// Note: ProgressService mock removed as circular dependency was fixed in production code
// (ProgressService now uses direct repository calls instead of creating new SessionService)
