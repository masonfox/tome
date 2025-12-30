/**
 * Tests for SyncOrchestrator
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { SyncOrchestrator } from "@/lib/services/integrations/sync-orchestrator";
import type { ICalibreService } from "@/lib/services/calibre.service";

describe("SyncOrchestrator", () => {
  let mockCalibreService: ICalibreService;
  let orchestrator: SyncOrchestrator;

  beforeEach(() => {
    mockCalibreService = {
      updateRating: mock(() => Promise.resolve()),
    } as any;

    orchestrator = new SyncOrchestrator(mockCalibreService);
  });

  describe("syncRating", () => {
    test("should successfully sync rating to Calibre", async () => {
      const result = await orchestrator.syncRating(123, 5);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].service).toBe("calibre");
      expect(result.results[0].success).toBe(true);
      expect(mockCalibreService.updateRating).toHaveBeenCalledWith(123, 5);
    });

    test("should handle Calibre sync failure", async () => {
      mockCalibreService.updateRating = mock(() => Promise.reject(new Error("Calibre error")));

      const result = await orchestrator.syncRating(123, 5);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Calibre error");
      expect(result.results[0].service).toBe("calibre");
      expect(result.results[0].success).toBe(false);
    });

    test("should handle null rating (remove rating)", async () => {
      const result = await orchestrator.syncRating(123, null);

      expect(result.success).toBe(true);
      expect(mockCalibreService.updateRating).toHaveBeenCalledWith(123, null);
    });

    test("should respect timeout configuration", async () => {
      const slowOrchestrator = new SyncOrchestrator(mockCalibreService, {
        timeout: 100,
      });

      mockCalibreService.updateRating = mock(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      const result = await slowOrchestrator.syncRating(123, 5);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("timeout");
    });

    test("should use best-effort mode by default (continue on errors)", async () => {
      mockCalibreService.updateRating = mock(() => Promise.reject(new Error("Calibre error")));

      const result = await orchestrator.syncRating(123, 5);

      // Should complete even with error
      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });

    test("should fail fast when configured", async () => {
      const failFastOrchestrator = new SyncOrchestrator(mockCalibreService, {
        failFast: true,
      });

      mockCalibreService.updateRating = mock(() => Promise.reject(new Error("Calibre error")));

      const result = await failFastOrchestrator.syncRating(123, 5);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("Multiple Services (Future)", () => {
    test("should be extensible for multiple sync targets", () => {
      // This test documents the future extensibility
      // When Goodreads/StoryGraph sync is added, we can add them as additional promises

      const result = orchestrator.syncRating(123, 5);

      expect(result).toBeInstanceOf(Promise);
      // Future: expect multiple services in results
    });
  });

  describe("Configuration", () => {
    test("should use custom timeout", async () => {
      const customOrchestrator = new SyncOrchestrator(mockCalibreService, {
        timeout: 10000,
      });

      const startTime = Date.now();
      mockCalibreService.updateRating = mock(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      await customOrchestrator.syncRating(123, 5);
      const duration = Date.now() - startTime;

      // Should complete within timeout
      expect(duration).toBeLessThan(10000);
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    test("should handle default configuration", () => {
      const defaultOrchestrator = new SyncOrchestrator();

      expect(defaultOrchestrator).toBeInstanceOf(SyncOrchestrator);
    });
  });

  describe("Error Handling", () => {
    test("should aggregate multiple service errors", async () => {
      mockCalibreService.updateRating = mock(() => Promise.reject(new Error("Service down")));

      const result = await orchestrator.syncRating(123, 5);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.results.every((r) => !r.success)).toBe(true);
    });

    test("should provide detailed error information", async () => {
      const specificError = new Error("Connection timeout to Calibre");
      mockCalibreService.updateRating = mock(() => Promise.reject(specificError));

      const result = await orchestrator.syncRating(123, 5);

      expect(result.errors[0]).toBe(specificError);
      expect(result.results[0].error).toBe(specificError);
    });
  });
});
