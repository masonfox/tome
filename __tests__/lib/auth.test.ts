import { test, expect, describe, beforeEach, afterEach } from "bun:test";

describe("Authentication Utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe("isAuthEnabled", () => {
    test("should return false when AUTH_PASSWORD is not set", async () => {
      delete process.env.AUTH_PASSWORD;
      
      // Re-import to get fresh module with new env
      delete require.cache[require.resolve("@/lib/auth")];
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });

    test("should return false when AUTH_PASSWORD is empty string", async () => {
      process.env.AUTH_PASSWORD = "";
      
      delete require.cache[require.resolve("@/lib/auth")];
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });

    test("should return false when AUTH_PASSWORD is whitespace only", async () => {
      process.env.AUTH_PASSWORD = "   ";
      
      delete require.cache[require.resolve("@/lib/auth")];
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(false);
    });

    test("should return true when AUTH_PASSWORD is set", async () => {
      process.env.AUTH_PASSWORD = "mypassword123";
      
      delete require.cache[require.resolve("@/lib/auth")];
      const { isAuthEnabled } = await import("@/lib/auth");
      
      expect(isAuthEnabled()).toBe(true);
    });
  });

  describe("getAuthPassword", () => {
    test("should return empty string when AUTH_PASSWORD is not set", async () => {
      delete process.env.AUTH_PASSWORD;
      
      delete require.cache[require.resolve("@/lib/auth")];
      const { getAuthPassword } = await import("@/lib/auth");
      
      expect(getAuthPassword()).toBe("");
    });

    test("should return the password when AUTH_PASSWORD is set", async () => {
      process.env.AUTH_PASSWORD = "testpass123";
      
      delete require.cache[require.resolve("@/lib/auth")];
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
});
