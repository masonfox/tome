import { describe, test, expect } from "bun:test";
import { toast } from "@/utils/toast";

describe("Toast Utility", () => {
  test("toast object has required methods", () => {
    expect(toast).toBeDefined();
    expect(typeof toast.success).toBe("function");
    expect(typeof toast.error).toBe("function");
    expect(typeof toast.info).toBe("function");
    expect(typeof toast.warning).toBe("function");
    expect(typeof toast.loading).toBe("function");
    expect(typeof toast.promise).toBe("function");
    expect(typeof toast.dismiss).toBe("function");
  });

  test("toast functions return values", () => {
    // These will return toast IDs or undefined depending on environment
    // Just verify they execute without throwing
    expect(() => toast.success("Test success")).not.toThrow();
    expect(() => toast.error("Test error")).not.toThrow();
    expect(() => toast.info("Test info")).not.toThrow();
    expect(() => toast.warning("Test warning")).not.toThrow();
    expect(() => toast.loading("Test loading")).not.toThrow();

    // Clean up - also verify dismiss doesn't throw
    expect(() => toast.dismiss()).not.toThrow();
  });
});
