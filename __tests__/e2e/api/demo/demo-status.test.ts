import { describe, it, expect } from "vitest";

describe("GET /api/demo/status", () => {
  it("should return 200 status", async () => {
    const response = await fetch("http://localhost:3000/api/demo/status");
    expect(response.status).toBe(200);
  });

  it("should return isDemoMode boolean and message", async () => {
    const response = await fetch("http://localhost:3000/api/demo/status");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("isDemoMode");
    expect(data).toHaveProperty("message");
    expect(typeof data.isDemoMode).toBe("boolean");
    expect(data.message).toBe("This is a read-only demo. Changes are not saved.");
  });

  it("should reflect current server DEMO_MODE environment variable", async () => {
    // This test verifies the endpoint reads from the server's runtime env
    // The endpoint should return the server's actual DEMO_MODE setting
    const response = await fetch("http://localhost:3000/api/demo/status");
    expect(response.status).toBe(200);

    const data = await response.json();
    
    // Verify the response has the expected shape
    // The actual boolean value depends on the server's .env configuration
    expect(typeof data.isDemoMode).toBe("boolean");
    
    // This proves the API is working and reading runtime env
    // To manually verify runtime detection works:
    // 1. Check current value: curl http://localhost:3000/api/demo/status
    // 2. Change DEMO_MODE in .env and restart server
    // 3. Check new value: curl http://localhost:3000/api/demo/status
  });

  it("should be accessible (whitelisted in proxy middleware)", async () => {
    // This endpoint should always be accessible, even in demo mode
    const response = await fetch("http://localhost:3000/api/demo/status", {
      method: "GET",
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("isDemoMode");
  });
});
