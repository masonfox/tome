/**
 * Tests for GET /api/providers/[providerId]/metadata/[externalId]
 * 
 * Verifies that the metadata fetch endpoint correctly retrieves
 * complete book metadata including description, tags, and publisher.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/providers/[providerId]/metadata/[externalId]/route";
import { createMockRequest } from "@/__tests__/fixtures/test-data";
import { providerService } from "@/lib/services/provider.service";
import type { BookMetadata } from "@/lib/providers/base/IMetadataProvider";
import type { NextRequest } from "next/server";

// Mock the provider service
vi.mock("@/lib/services/provider.service", () => ({
  providerService: {
    fetchMetadata: vi.fn(),
  },
}));

describe("GET /api/providers/[providerId]/metadata/[externalId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Success Cases", () => {
    it("should fetch complete metadata from Hardcover", async () => {
      // Arrange
      const mockMetadata: BookMetadata = {
        title: "Dune",
        authors: ["Frank Herbert"],
        isbn: "9780441172719",
        description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides...",
        tags: ["Science Fiction", "Fantasy", "Space Opera"],
        publisher: "Ace Books",
        pubDate: new Date("1965-06-01"),
        totalPages: 688,
        coverImageUrl: "https://example.com/cover.jpg",
      };

      vi.mocked(providerService.fetchMetadata).mockResolvedValue(mockMetadata);

      const request = createMockRequest(
        "GET",
        "/api/providers/hardcover/metadata/312460"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "hardcover", externalId: "312460" })
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Dune");
      expect(data.data.authors).toEqual(["Frank Herbert"]);
      expect(data.data.description).toBe("Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides...");
      expect(data.data.tags).toEqual(["Science Fiction", "Fantasy", "Space Opera"]);
      expect(data.data.publisher).toBe("Ace Books");
      expect(data.data.pubDate).toBe("1965-06-01T00:00:00.000Z"); // JSON serializes Date to string
      expect(providerService.fetchMetadata).toHaveBeenCalledWith("hardcover", "312460");
    });

    it("should fetch complete metadata from OpenLibrary", async () => {
      // Arrange
      const mockMetadata: BookMetadata = {
        title: "Fantastic Mr Fox",
        authors: ["Roald Dahl"],
        isbn: "9780142410349",
        description: "Three farmers plot to kill Mr Fox, but he outsmarts them...",
        tags: ["Children's Literature", "Fiction", "Animals"],
        publisher: "Puffin Books",
        pubDate: new Date("1970-01-01"),
        totalPages: 96,
        coverImageUrl: "https://covers.openlibrary.org/b/id/123.jpg",
      };

      vi.mocked(providerService.fetchMetadata).mockResolvedValue(mockMetadata);

      const request = createMockRequest(
        "GET",
        "/api/providers/openlibrary/metadata/OL45804W"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "openlibrary", externalId: "OL45804W" })
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Fantastic Mr Fox");
      expect(data.data.authors).toEqual(["Roald Dahl"]);
      expect(data.data.description).toBe("Three farmers plot to kill Mr Fox, but he outsmarts them...");
      expect(data.data.tags).toEqual(["Children's Literature", "Fiction", "Animals"]);
      expect(data.data.publisher).toBe("Puffin Books");
      expect(data.data.pubDate).toBe("1970-01-01T00:00:00.000Z"); // JSON serializes Date to string
      expect(providerService.fetchMetadata).toHaveBeenCalledWith("openlibrary", "OL45804W");
    });

    it("should handle metadata with missing optional fields", async () => {
      // Arrange
      const mockMetadata: BookMetadata = {
        title: "Some Book",
        authors: ["Author Name"],
        isbn: "1234567890",
        description: undefined,
        tags: undefined,
        publisher: undefined,
        pubDate: undefined,
        totalPages: undefined,
        coverImageUrl: undefined,
      };

      vi.mocked(providerService.fetchMetadata).mockResolvedValue(mockMetadata);

      const request = createMockRequest(
        "GET",
        "/api/providers/hardcover/metadata/999"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "hardcover", externalId: "999" })
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.description).toBeUndefined();
      expect(data.data.tags).toBeUndefined();
      expect(data.data.publisher).toBeUndefined();
    });
  });

  describe("Validation", () => {
    it("should reject request with missing provider ID", async () => {
      // Arrange
      const request = createMockRequest(
        "GET",
        "/api/providers//metadata/123"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "", externalId: "123" })
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Provider ID and external ID are required");
    });

    it("should reject request with missing external ID", async () => {
      // Arrange
      const request = createMockRequest(
        "GET",
        "/api/providers/hardcover/metadata/"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "hardcover", externalId: "" })
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Provider ID and external ID are required");
    });
  });

  describe("Error Handling", () => {
    it("should handle circuit breaker open error", async () => {
      // Arrange
      vi.mocked(providerService.fetchMetadata).mockRejectedValue(
        new Error("Circuit breaker is OPEN - provider unavailable")
      );

      const request = createMockRequest(
        "GET",
        "/api/providers/hardcover/metadata/123"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "hardcover", externalId: "123" })
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Provider temporarily unavailable");
      expect(data.message).toContain("Circuit breaker");
    });

    it("should handle metadata not found error", async () => {
      // Arrange
      vi.mocked(providerService.fetchMetadata).mockRejectedValue(
        new Error("Metadata not found for ID: 99999")
      );

      const request = createMockRequest(
        "GET",
        "/api/providers/hardcover/metadata/99999"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "hardcover", externalId: "99999" })
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Metadata not found");
    });

    it("should handle generic error", async () => {
      // Arrange
      vi.mocked(providerService.fetchMetadata).mockRejectedValue(
        new Error("Network error")
      );

      const request = createMockRequest(
        "GET",
        "/api/providers/hardcover/metadata/123"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "hardcover", externalId: "123" })
      });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Metadata fetch failed");
    });
  });

  describe("Provider-Specific ID Formats", () => {
    it("should handle Hardcover numeric IDs", async () => {
      // Arrange
      const mockMetadata: BookMetadata = {
        title: "Book",
        authors: ["Author"],
        isbn: undefined,
        description: undefined,
        tags: undefined,
        publisher: undefined,
        pubDate: undefined,
        totalPages: undefined,
        coverImageUrl: undefined,
      };

      vi.mocked(providerService.fetchMetadata).mockResolvedValue(mockMetadata);

      const request = createMockRequest(
        "GET",
        "/api/providers/hardcover/metadata/312460"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "hardcover", externalId: "312460" })
      });

      // Assert
      expect(response.status).toBe(200);
      expect(providerService.fetchMetadata).toHaveBeenCalledWith("hardcover", "312460");
    });

    it("should handle OpenLibrary work IDs with prefix", async () => {
      // Arrange
      const mockMetadata: BookMetadata = {
        title: "Book",
        authors: ["Author"],
        isbn: undefined,
        description: undefined,
        tags: undefined,
        publisher: undefined,
        pubDate: undefined,
        totalPages: undefined,
        coverImageUrl: undefined,
      };

      vi.mocked(providerService.fetchMetadata).mockResolvedValue(mockMetadata);

      const request = createMockRequest(
        "GET",
        "/api/providers/openlibrary/metadata/OL45804W"
      );

      // Act
      const response = await GET(request as NextRequest, {
        params: Promise.resolve({ providerId: "openlibrary", externalId: "OL45804W" })
      });

      // Assert
      expect(response.status).toBe(200);
      expect(providerService.fetchMetadata).toHaveBeenCalledWith("openlibrary", "OL45804W");
    });
  });
});
