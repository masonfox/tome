import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BaseApiClient, ApiError } from "@/lib/api";

describe("BaseApiClient", () => {
  let client: BaseApiClient;

  beforeEach(() => {
    // Create a fresh client instance for each test (with retries disabled for predictable test behavior)
    client = new BaseApiClient({
      retry: {
        maxRetries: 0,
      },
    });
  });

  describe("GET requests", () => {
    test("handles successful JSON response", async () => {
      const mockData = { id: 1, name: "Test Book" };
      
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockData),
        } as Response)
      ) as any;

      const result = await client["get"]<typeof mockData>("/api/test");
      
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
      ) as any;
    });

    test("handles 204 No Content response", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 204,
          headers: new Headers(),
        } as Response)
      ) as any;

      const result = await client["get"]("/api/test");
      
      // 204 returns empty object, not undefined
      expect(result).toEqual({});
    });
  });

  describe("POST requests", () => {
    test("sends JSON body and receives JSON response", async () => {
      const requestBody = { title: "New Book" };
      const mockResponse = { id: 123, ...requestBody };
      
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        } as Response)
      ) as any;

      const result = await client["post"]<typeof requestBody, typeof mockResponse>(
        "/api/books",
        requestBody
      ) as any;
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
      ) as any;
    });

    test("handles POST with no request body", async () => {
      const mockResponse = { success: true };
      
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        } as Response)
      ) as any;

      const result = await client["post"]("/api/trigger");
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/trigger",
        expect.objectContaining({
          method: "POST",
          body: undefined,
        })
      ) as any;
    });
  });

  describe("PATCH requests", () => {
    test("sends partial update and receives response", async () => {
      const updateData = { rating: 5 };
      
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ success: true }),
        } as Response)
      ) as any;

      const result = await client["patch"]("/api/books/123", updateData);
      
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(updateData),
        })
      ) as any;
    });
  });

  describe("PUT requests", () => {
    test("should make PUT request with correct method", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ success: true }),
        } as Response)
      ) as any;

      await client["put"]("/test", { data: "value" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          method: "PUT",
        })
      ) as any;
    });

    test("should include body data in PUT request", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ success: true }),
        } as Response)
      ) as any;

      const data = { bookIds: [1, 2, 3] };
      await client["put"]("/test", data);
      
      expect(global.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          body: JSON.stringify(data),
        })
      ) as any;
    });

    test("should handle PUT errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ error: "Not found" }),
        } as Response)
      ) as any;

      await expect(client["put"]("/test", {})).rejects.toThrow(ApiError);
    });
  });

  describe("DELETE requests", () => {
    test("deletes resource and handles response", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ deleted: true }),
        } as Response)
      ) as any;

      const result = await client["delete"]("/api/books/123");
      
      expect(result).toEqual({ deleted: true });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123",
        expect.objectContaining({
          method: "DELETE",
        })
      ) as any;
    });

    test("handles 204 No Content on delete", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 204,
          headers: new Headers(),
        } as Response)
      ) as any;

      const result = await client["delete"]("/api/books/123");
      
      // 204 returns empty object, not undefined
      expect(result).toEqual({});
    });
  });

  describe("Error handling", () => {
    test("throws ApiError on 404 Not Found", async () => {
      const errorBody = { error: "Book not found" };
      
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(errorBody),
        } as Response)
      ) as any;

      try {
        await client["get"]("/api/books/999");
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
        expect((error as ApiError).endpoint).toBe("/api/books/999");
        // Message comes from errorBody.error
        expect((error as ApiError).message).toBe("Book not found");
        expect((error as ApiError).details).toEqual(errorBody);
      }
    });

    test("throws ApiError on 400 Bad Request with validation errors", async () => {
      const errorBody = { 
        error: "Validation failed", 
        fields: { rating: "Must be between 1 and 5" } 
      };
      
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(errorBody),
        } as Response)
      ) as any;

      try {
        await client["patch"]("/api/books/123", { rating: 10 });
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(400);
        expect((error as ApiError).details).toEqual(errorBody);
      }
    });

    test("throws ApiError on 500 Internal Server Error", async () => {
      const errorBody = { error: "Database connection failed" };
      
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(errorBody),
        } as Response)
      ) as any;

      try {
        await client["get"]("/api/books");
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(500);
      }
    });

    test("handles error response with plain text body", async () => {
      const textError = "Service temporarily unavailable";
      
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          headers: new Headers({ "content-type": "text/plain" }),
          text: () => Promise.resolve(textError),
        } as Response)
      ) as any;

      try {
        await client["get"]("/api/health");
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(503);
        // Plain text error is stored in details
        expect((error as ApiError).details).toBe(textError);
        // Message falls back to status message since there's no "error" property
        expect((error as ApiError).message).toContain("503");
      }
    });

    test("handles network errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network request failed"))
      ) as any;

      try {
        await client["get"]("/api/books");
        expect(false).toBe(true);
      } catch (error) {
        // Should throw the original error, not wrapped in ApiError
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Network request failed");
      }
    });

    test("handles timeout errors", async () => {
      // Mock an AbortError
      global.fetch = vi.fn(() =>
        Promise.reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }))
      ) as any;

      try {
        await client["get"]("/api/slow");
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(408);
        expect((error as ApiError).message).toContain("timeout");
      }
    });
  });

  describe("Response parsing", () => {
    test("handles non-JSON response gracefully", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/html" }),
          json: () => Promise.reject(new Error("Unexpected token")),
          text: () => Promise.resolve("<html>Not JSON</html>"),
        } as Response)
      ) as any;

      try {
        await client["get"]("/api/legacy");
        expect(false).toBe(true);
      } catch (error) {
        // Should handle JSON parse errors gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });

    test("handles empty response body", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(null),
        } as Response)
      ) as any;

      const result = await client["get"]("/api/empty");
      
      expect(result).toBeNull();
    });
  });

  describe("Request headers", () => {
    test("includes Content-Type header in all requests", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        } as Response)
      ) as any;

      await client["get"]("/api/test");
      
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });
});

describe("ApiError", () => {
  test("creates error with all properties", () => {
    const details = { field: "title", message: "Required" };
    const error = new ApiError(
      "Validation failed",
      400,
      "/api/books",
      details
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Validation failed");
    expect(error.statusCode).toBe(400);
    expect(error.endpoint).toBe("/api/books");
    expect(error.details).toEqual(details);
    expect(error.name).toBe("ApiError");
  });

  test("creates error without details", () => {
    const error = new ApiError("Not found", 404, "/api/books/999");

    expect(error.statusCode).toBe(404);
    expect(error.endpoint).toBe("/api/books/999");
    expect(error.details).toBeUndefined();
  });

  test("has proper stack trace", () => {
    const error = new ApiError("Test error", 500, "/api/test");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ApiError");
  });
});
