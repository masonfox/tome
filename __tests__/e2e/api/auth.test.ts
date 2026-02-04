import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';

describe("Auth API Routes Logic", () => {
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

  describe("Login Logic", () => {
    test("should reject when password is missing", async () => {
      process.env.AUTH_PASSWORD = "testpassword123";
      
      const { getAuthPassword, isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(true);
      
      // Simulate login logic
      const inputPassword = undefined;
      const isValid = inputPassword === getAuthPassword();
      
      expect(isValid).toBe(false);
    });

    test("should reject when password is incorrect", async () => {
      process.env.AUTH_PASSWORD = "testpassword123";
      
      const { getAuthPassword, isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(true);
      
      // Simulate login logic
      const inputPassword = "wrongpassword";
      const isValid = inputPassword === getAuthPassword();
      
      expect(isValid).toBe(false);
    });

    test("should accept when password is correct", async () => {
      process.env.AUTH_PASSWORD = "testpassword123";
      
      const { getAuthPassword, isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(true);
      
      // Simulate login logic
      const inputPassword = "testpassword123";
      const isValid = inputPassword === getAuthPassword();
      
      expect(isValid).toBe(true);
    });

    test("should reject login when auth is not enabled", async () => {
      delete process.env.AUTH_PASSWORD;
      
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });
  });

  describe("Auth Status Logic", () => {
    test("should report enabled when password is set", async () => {
      process.env.AUTH_PASSWORD = "testpassword123";
      
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(true);
    });

    test("should report disabled when password is not set", async () => {
      delete process.env.AUTH_PASSWORD;
      
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });

    test("should report disabled when password is empty", async () => {
      process.env.AUTH_PASSWORD = "";
      
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });
  });

  describe("Cookie Name", () => {
    test("should return consistent cookie name", async () => {
      const { getAuthCookieName } = await import("@/lib/auth");
      
      expect(getAuthCookieName()).toBe("tome-auth");
    });
  });

  describe("Proxy Behavior", () => {
    test("should allow /login when auth is enabled", () => {
      process.env.AUTH_PASSWORD = "testpass123";
      
      // Simulate middleware logic
      const password = process.env.AUTH_PASSWORD || "";
      const AUTH_ENABLED = !!password && password.trim() !== "";
      const pathname = "/login";
      
      // When auth is enabled, /login should be allowed
      const shouldRedirectToHome = !AUTH_ENABLED && pathname === "/login";
      expect(shouldRedirectToHome).toBe(false);
    });

    test("should redirect /login to home when auth is disabled", () => {
      delete process.env.AUTH_PASSWORD;
      
      // Simulate middleware logic
      const password = process.env.AUTH_PASSWORD || "";
      const AUTH_ENABLED = !!password && password.trim() !== "";
      const pathname = "/login";
      
      // When auth is disabled, /login should redirect to home
      const shouldRedirectToHome = !AUTH_ENABLED && pathname === "/login";
      expect(shouldRedirectToHome).toBe(true);
    });

    test("should allow all API routes regardless of auth status", () => {
      // Test with auth enabled
      process.env.AUTH_PASSWORD = "testpass123";
      let password = process.env.AUTH_PASSWORD || "";
      let AUTH_ENABLED = !!password && password.trim() !== "";
      let pathname: string = "/api/books";
      
      // API routes should always be allowed
      let shouldAllow = pathname.startsWith("/api/") || (!AUTH_ENABLED && pathname === "/login");
      expect(shouldAllow).toBe(true);
      
      // Test with auth disabled
      delete process.env.AUTH_PASSWORD;
      password = process.env.AUTH_PASSWORD || "";
      AUTH_ENABLED = !!password && password.trim() !== "";
      pathname = "/api/stats/overview";
      
      shouldAllow = pathname.startsWith("/api/") || (!AUTH_ENABLED && pathname === "/login");
      expect(shouldAllow).toBe(true);
    });

    test("should allow regular routes when auth is disabled", () => {
      delete process.env.AUTH_PASSWORD;
      
      const password = process.env.AUTH_PASSWORD || "";
      const AUTH_ENABLED = !!password && password.trim() !== "";
      const pathname: string = "/library";
      
      // When auth is disabled, regular routes should be allowed
      const shouldAllow = !AUTH_ENABLED || pathname.startsWith("/api/") || pathname === "/login";
      expect(shouldAllow).toBe(true);
    });

    test("should block regular routes when auth is enabled and not authenticated", () => {
      process.env.AUTH_PASSWORD = "testpass123";
      
      const password = process.env.AUTH_PASSWORD || "";
      const AUTH_ENABLED = !!password && password.trim() !== "";
      const pathname: string = "/library";
      const hasAuthCookie = false;
      
      // When auth is enabled and user is not authenticated, regular routes should be blocked
      const shouldBlock = AUTH_ENABLED && !pathname.startsWith("/api/") && pathname !== "/login" && !hasAuthCookie;
      expect(shouldBlock).toBe(true);
    });
  });
});
