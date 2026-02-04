import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';

describe("Authentication Utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    // Reset modules to ensure fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe("isAuthEnabled", () => {
    test("should return false when AUTH_PASSWORD is not set", async () => {
      delete process.env.AUTH_PASSWORD;
      
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });

    test("should return false when AUTH_PASSWORD is empty string", async () => {
      process.env.AUTH_PASSWORD = "";
      
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });

    test("should return false when AUTH_PASSWORD is whitespace only", async () => {
      process.env.AUTH_PASSWORD = "   ";
      
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });

    test("should return true when AUTH_PASSWORD is set", async () => {
      process.env.AUTH_PASSWORD = "mypassword123";
      
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(true);
    });
  });

  describe("getAuthPassword", () => {
    test("should return empty string when AUTH_PASSWORD is not set", async () => {
      delete process.env.AUTH_PASSWORD;
      
      const { getAuthPassword } = await import("@/lib/auth");
      
      expect(getAuthPassword()).toBe("");
    });

    test("should return the password when AUTH_PASSWORD is set", async () => {
      process.env.AUTH_PASSWORD = "testpass123";
      
      const { getAuthPassword } = await import("@/lib/auth");
      
      expect(getAuthPassword()).toBe("testpass123");
    });
  });

  describe("getAuthCookieName", () => {
    test("should return the auth cookie name", async () => {
      const { getAuthCookieName } = await import("@/lib/auth");

      expect(getAuthCookieName()).toBe("tome-auth");
    });
  });

  describe("createAuthResponse", () => {
    test("should set secure cookie for HTTPS requests", async () => {
      const { createAuthResponse } = await import("@/lib/auth");

      const mockRequest = {
        url: "https://example.com/api/auth/login",
        headers: new Map(),
      } as any;
      mockRequest.headers.get = () => null;

      const response = createAuthResponse(mockRequest);
      const setCookieHeader = response.headers.get("set-cookie");

      expect(setCookieHeader).toContain("tome-auth=authenticated");
      expect(setCookieHeader).toContain("Secure");
    });

    test("should not set secure cookie for HTTP requests", async () => {
      const { createAuthResponse } = await import("@/lib/auth");

      const mockRequest = {
        url: "http://192.168.1.100:3000/api/auth/login",
        headers: new Map(),
      } as any;
      mockRequest.headers.get = () => null;

      const response = createAuthResponse(mockRequest);
      const setCookieHeader = response.headers.get("set-cookie");

      expect(setCookieHeader).toContain("tome-auth=authenticated");
      expect(setCookieHeader).not.toContain("Secure");
    });

    test("should set secure cookie when x-forwarded-proto is https", async () => {
      const { createAuthResponse } = await import("@/lib/auth");

      const mockRequest = {
        url: "http://internal-server:3000/api/auth/login",
        headers: new Map([["x-forwarded-proto", "https"]]),
      } as any;
      mockRequest.headers.get = (key: string) =>
        key === "x-forwarded-proto" ? "https" : null;

      const response = createAuthResponse(mockRequest);
      const setCookieHeader = response.headers.get("set-cookie");

      expect(setCookieHeader).toContain("tome-auth=authenticated");
      expect(setCookieHeader).toContain("Secure");
    });

    test("should not set secure cookie when x-forwarded-proto is http", async () => {
      const { createAuthResponse } = await import("@/lib/auth");

      const mockRequest = {
        url: "http://internal-server:3000/api/auth/login",
        headers: new Map([["x-forwarded-proto", "http"]]),
      } as any;
      mockRequest.headers.get = (key: string) =>
        key === "x-forwarded-proto" ? "http" : null;

      const response = createAuthResponse(mockRequest);
      const setCookieHeader = response.headers.get("set-cookie");

      expect(setCookieHeader).toContain("tome-auth=authenticated");
      expect(setCookieHeader).not.toContain("Secure");
    });
  });
});
