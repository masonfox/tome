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
    // These will return toast IDs or undefined
    const successResult = toast.success("Test success");
    const errorResult = toast.error("Test error");
    const infoResult = toast.info("Test info");
    const warningResult = toast.warning("Test warning");
    const loadingResult = toast.loading("Test loading");

    // Just verify they execute without throwing
    expect(successResult).toBeDefined();
    expect(errorResult).toBeDefined();
    expect(infoResult).toBeDefined();
    expect(warningResult).toBeDefined();
    expect(loadingResult).toBeDefined();

    // Clean up
    toast.dismiss();
  });
});
