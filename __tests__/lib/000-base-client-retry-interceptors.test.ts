/**
 * Tests for BaseApiClient retry logic and interceptors
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { BaseApiClient, ApiError, type RequestInterceptor } from "@/lib/api/base-client";

describe("BaseApiClient - Retry Logic", () => {
  let client: BaseApiClient;
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(() => {
    client = new BaseApiClient({
      retry: {
        maxRetries: 3,
        initialBackoffMs: 100,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
      },
    });
    fetchMock = mock(() => Promise.resolve({ ok: true, json: async () => ({ success: true }) }));
    global.fetch = fetchMock as any;
  });

  test("should retry on 500 error", async () => {
    let attempts = 0;
    fetchMock = mock(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({ error: "Internal Server Error" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ success: true }),
      });
    });
    global.fetch = fetchMock as any;

    const response = await client["post"]("/api/test", {});
    expect(response).toEqual({ success: true });
    expect(attempts).toBe(3);
  });

  test("should retry on 503 Service Unavailable", async () => {
    let attempts = 0;
    fetchMock = mock(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve({
          ok: false,
          status: 503,
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({ error: "Service Unavailable" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ success: true }),
      });
    });
    global.fetch = fetchMock as any;

    const response = await client["post"]("/api/test", {});
    expect(response).toEqual({ success: true });
    expect(attempts).toBe(2);
  });

  test("should retry on network errors (statusCode 0)", async () => {
    let attempts = 0;
    fetchMock = mock(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ success: true }),
      });
    });
    global.fetch = fetchMock as any;

    const response = await client["post"]("/api/test", {});
    expect(response).toEqual({ success: true });
    expect(attempts).toBe(2);
  });

  test("should not retry on 4xx errors", async () => {
    let attempts = 0;
    fetchMock = mock(() => {
      attempts++;
      return Promise.resolve({
        ok: false,
        status: 404,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ error: "Not Found" }),
      });
    });
    global.fetch = fetchMock as any;

    try {
      await client["post"]("/api/test", {});
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(404);
      expect(attempts).toBe(1); // No retry
    }
  });

  test("should stop retrying after maxRetries", async () => {
    let attempts = 0;
    fetchMock = mock(() => {
      attempts++;
      return Promise.resolve({
        ok: false,
        status: 500,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ error: "Internal Server Error" }),
      });
    });
    global.fetch = fetchMock as any;

    try {
      await client["post"]("/api/test", {});
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(500);
      expect(attempts).toBe(4); // Initial + 3 retries
    }
  });

  test("should use exponential backoff", async () => {
    const client = new BaseApiClient({
      retry: {
        maxRetries: 3,
        initialBackoffMs: 100,
        useExponentialBackoff: true,
      },
    });

    const startTime = Date.now();
    let attempts = 0;

    fetchMock = mock(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({ error: "Internal Server Error" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ success: true }),
      });
    });
    global.fetch = fetchMock as any;

    await client["post"]("/api/test", {});
    const duration = Date.now() - startTime;

    // Exponential backoff: 100ms + 200ms = 300ms minimum
    // With some tolerance for execution time
    expect(duration).toBeGreaterThan(250);
    expect(attempts).toBe(3);
  });
});

describe("BaseApiClient - Interceptors", () => {
  let client: BaseApiClient;
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(() => {
    // Disable retries for interceptor tests to avoid timeouts
    client = new BaseApiClient({
      retry: {
        maxRetries: 0,
      },
    });
    fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ success: true }),
      })
    );
    global.fetch = fetchMock as any;
  });

  test("should call onRequest interceptor", async () => {
    let requestIntercepted = false;
    const interceptor: RequestInterceptor = {
      onRequest: (config) => {
        requestIntercepted = true;
        config.headers["X-Test-Header"] = "test-value";
        return config;
      },
    };

    client.addInterceptor(interceptor);
    await client["post"]("/api/test", {});

    expect(requestIntercepted).toBe(true);
  });

  test("should call onResponse interceptor", async () => {
    let responseIntercepted = false;
    const interceptor: RequestInterceptor = {
      onResponse: (response) => {
        responseIntercepted = true;
        return response;
      },
    };

    client.addInterceptor(interceptor);
    await client["post"]("/api/test", {});

    expect(responseIntercepted).toBe(true);
  });

  test("should call onError interceptor", async () => {
    let errorIntercepted = false;
    const interceptor: RequestInterceptor = {
      onError: (error) => {
        errorIntercepted = true;
        return error;
      },
    };

    fetchMock = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ error: "Internal Server Error" }),
      })
    );
    global.fetch = fetchMock as any;

    client.addInterceptor(interceptor);

    try {
      await client["post"]("/api/test", {});
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(errorIntercepted).toBe(true);
    }
  });

  test("should call multiple interceptors in order", async () => {
    const callOrder: string[] = [];

    const interceptor1: RequestInterceptor = {
      onRequest: (config) => {
        callOrder.push("interceptor1-request");
        return config;
      },
      onResponse: (response) => {
        callOrder.push("interceptor1-response");
        return response;
      },
    };

    const interceptor2: RequestInterceptor = {
      onRequest: (config) => {
        callOrder.push("interceptor2-request");
        return config;
      },
      onResponse: (response) => {
        callOrder.push("interceptor2-response");
        return response;
      },
    };

    client.addInterceptor(interceptor1);
    client.addInterceptor(interceptor2);

    await client["post"]("/api/test", {});

    expect(callOrder).toEqual([
      "interceptor1-request",
      "interceptor2-request",
      "interceptor1-response",
      "interceptor2-response",
    ]);
  });

  test("should allow interceptor to modify request config", async () => {
    const interceptor: RequestInterceptor = {
      onRequest: (config) => {
        config.headers["X-Request-ID"] = "123456";
        config.headers["Authorization"] = "Bearer token";
        return config;
      },
    };

    client.addInterceptor(interceptor);
    await client["post"]("/api/test", { data: "test" });

    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const requestInit = lastCall[1] as RequestInit;
    expect(requestInit.headers).toHaveProperty("X-Request-ID", "123456");
    expect(requestInit.headers).toHaveProperty("Authorization", "Bearer token");
  });

  test("should allow interceptor to transform response", async () => {
    const interceptor: RequestInterceptor = {
      onResponse: <T>(response: T) => {
        return { ...response, transformed: true } as T;
      },
    };

    client.addInterceptor(interceptor);
    const response = await client["post"]("/api/test", {});

    expect(response).toHaveProperty("transformed", true);
    expect(response).toHaveProperty("success", true);
  });

  test("should clear interceptors", async () => {
    let called = false;
    const interceptor: RequestInterceptor = {
      onRequest: (config) => {
        called = true;
        return config;
      },
    };

    client.addInterceptor(interceptor);
    client.clearInterceptors();

    await client["post"]("/api/test", {});

    expect(called).toBe(false);
  });
});
