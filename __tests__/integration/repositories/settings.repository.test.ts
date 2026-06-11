/**
 * Settings Repository Tests
 * 
 * Tests key-value store operations for application settings
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { settingsRepository } from "@/lib/repositories/settings.repository";
import {
  setupTestDatabase,
  clearTestDatabase,
  teardownTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("SettingsRepository", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("get", () => {
    test("should return null when setting does not exist", async () => {
      const result = await settingsRepository.get("nonexistent_key");
      expect(result).toBeNull();
    });

    test("should get existing setting value", async () => {
      await settingsRepository.set("test_key", "test_value");
      const result = await settingsRepository.get("test_key");
      expect(result).toBe("test_value");
    });
  });

  describe("getBoolean", () => {
    test("should return false for non-existent setting", async () => {
      const result = await settingsRepository.getBoolean("nonexistent");
      expect(result).toBe(false);
    });

    test("should return true for 'true' string value", async () => {
      await settingsRepository.set("bool_key", "true");
      const result = await settingsRepository.getBoolean("bool_key");
      expect(result).toBe(true);
    });

    test("should return false for 'false' string value", async () => {
      await settingsRepository.set("bool_key", "false");
      const result = await settingsRepository.getBoolean("bool_key");
      expect(result).toBe(false);
    });

    test("should return false for any other string value", async () => {
      await settingsRepository.set("bool_key", "maybe");
      const result = await settingsRepository.getBoolean("bool_key");
      expect(result).toBe(false);
    });
  });

  describe("getNumber", () => {
    test("should return null for non-existent setting", async () => {
      const result = await settingsRepository.getNumber("nonexistent");
      expect(result).toBeNull();
    });

    test("should return number for valid numeric string", async () => {
      await settingsRepository.set("num_key", "42");
      const result = await settingsRepository.getNumber("num_key");
      expect(result).toBe(42);
    });

    test("should return null for non-numeric string", async () => {
      await settingsRepository.set("num_key", "not-a-number");
      const result = await settingsRepository.getNumber("num_key");
      expect(result).toBeNull();
    });

    test("should handle negative numbers", async () => {
      await settingsRepository.set("num_key", "-100");
      const result = await settingsRepository.getNumber("num_key");
      expect(result).toBe(-100);
    });
  });

  describe("set", () => {
    test("should create new setting", async () => {
      await settingsRepository.set("new_key", "new_value");
      const result = await settingsRepository.get("new_key");
      expect(result).toBe("new_value");
    });

    test("should update existing setting", async () => {
      await settingsRepository.set("update_key", "old_value");
      await settingsRepository.set("update_key", "new_value");
      const result = await settingsRepository.get("update_key");
      expect(result).toBe("new_value");
    });

    test("should accept boolean value", async () => {
      await settingsRepository.set("bool_key", true);
      const result = await settingsRepository.get("bool_key");
      expect(result).toBe("true");
    });

    test("should accept number value", async () => {
      await settingsRepository.set("num_key", 123);
      const result = await settingsRepository.get("num_key");
      expect(result).toBe("123");
    });

    test("should update updatedAt timestamp on update", async () => {
      await settingsRepository.set("time_key", "value1");
      
      const settings1 = await settingsRepository.getAll();
      const setting1 = settings1.find(s => s.key === "time_key");
      
      // Wait for at least 1 second to ensure timestamp difference (SQLite stores seconds)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      await settingsRepository.set("time_key", "value2");
      
      const settings2 = await settingsRepository.getAll();
      const setting2 = settings2.find(s => s.key === "time_key");
      
      expect(setting2!.updatedAt.getTime()).toBeGreaterThan(setting1!.updatedAt.getTime());
    });
  });

  describe("getAll", () => {
    test("should return empty array when no settings exist", async () => {
      const result = await settingsRepository.getAll();
      expect(result).toEqual([]);
    });

    test("should return all settings", async () => {
      await settingsRepository.set("key1", "value1");
      await settingsRepository.set("key2", "value2");
      await settingsRepository.set("key3", "value3");

      const result = await settingsRepository.getAll();
      expect(result).toHaveLength(3);
      
      const keys = result.map(s => s.key);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });
  });

  describe("delete", () => {
    test("should delete existing setting and return true", async () => {
      await settingsRepository.set("delete_key", "value");
      const result = await settingsRepository.delete("delete_key");
      expect(result).toBe(true);

      const value = await settingsRepository.get("delete_key");
      expect(value).toBeNull();
    });

    test("should return false when deleting non-existent setting", async () => {
      const result = await settingsRepository.delete("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("getMany", () => {
    test("should return empty map for empty keys array", async () => {
      const result = await settingsRepository.getMany([]);
      expect(result.size).toBe(0);
    });

    test("should return map of existing settings", async () => {
      await settingsRepository.set("key1", "value1");
      await settingsRepository.set("key2", "value2");
      await settingsRepository.set("key3", "value3");

      const result = await settingsRepository.getMany(["key1", "key3"]);
      expect(result.size).toBe(2);
      expect(result.get("key1")).toBe("value1");
      expect(result.get("key3")).toBe("value3");
      expect(result.has("key2")).toBe(false);
    });

    test("should only return existing keys", async () => {
      await settingsRepository.set("exists", "value");

      const result = await settingsRepository.getMany(["exists", "nonexistent"]);
      expect(result.size).toBe(1);
      expect(result.get("exists")).toBe("value");
      expect(result.has("nonexistent")).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    test("should handle KoReader proxy settings workflow", async () => {
      // Initial setup - proxy disabled
      await settingsRepository.set("koreader_proxy_enabled", false);
      await settingsRepository.set("koreader_upstream_url", "https://sync.koreader.rocks");
      await settingsRepository.set("koreader_auto_progress_log", true);
      await settingsRepository.set("koreader_proxy_port", 7200);

      // Read settings
      const enabled = await settingsRepository.getBoolean("koreader_proxy_enabled");
      const upstream = await settingsRepository.get("koreader_upstream_url");
      const autoProgress = await settingsRepository.getBoolean("koreader_auto_progress_log");
      const port = await settingsRepository.getNumber("koreader_proxy_port");

      expect(enabled).toBe(false);
      expect(upstream).toBe("https://sync.koreader.rocks");
      expect(autoProgress).toBe(true);
      expect(port).toBe(7200);

      // Enable proxy
      await settingsRepository.set("koreader_proxy_enabled", true);
      const nowEnabled = await settingsRepository.getBoolean("koreader_proxy_enabled");
      expect(nowEnabled).toBe(true);
    });

    test("should handle bulk settings retrieval", async () => {
      await settingsRepository.set("setting_a", "alpha");
      await settingsRepository.set("setting_b", "beta");
      await settingsRepository.set("setting_c", "gamma");

      const bulk = await settingsRepository.getMany([
        "setting_a",
        "setting_b",
        "setting_c",
      ]);

      expect(bulk.size).toBe(3);
      expect(bulk.get("setting_a")).toBe("alpha");
      expect(bulk.get("setting_b")).toBe("beta");
      expect(bulk.get("setting_c")).toBe("gamma");
    });
  });
});
