import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from "@/app/api/version/route";
import packageJson from "@/package.json";

/**
 * Version API Tests
 * Tests the /api/version endpoint that provides current version and checks for updates
 *
 * Covers:
 * - Returns current version from package.json
 * - Fetches and parses GitHub release data
 * - Correctly identifies minor and major version updates
 * - Handles GitHub API failures gracefully
 * - Skips draft and prerelease versions
 * - Parses semantic version strings correctly
 */

describe("Version API - GET /api/version", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Mock fetch for GitHub API calls
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  test("returns current version from package.json", async () => {
    // Mock GitHub API to return no releases (404)
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.currentVersion).toBe(packageJson.version);
  });

  test("successfully fetches and compares with GitHub latest release", async () => {
    const mockRelease = {
      tag_name: "v0.5.0",
      name: "Tome v0.5.0 - New Features",
      html_url: "https://github.com/masonfox/tome/releases/tag/v0.5.0",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.currentVersion).toBe(packageJson.version);
    expect(data.latestVersion).toBe("v0.5.0");
    expect(data.latestReleaseUrl).toBe(mockRelease.html_url);
    expect(data.latestReleaseName).toBe(mockRelease.name);
    expect(data.publishedAt).toBe(mockRelease.published_at);
  });

  test("identifies minor version update correctly (0.4.0 -> 0.5.0)", async () => {
    const mockRelease = {
      tag_name: "v0.5.0",
      name: "Tome v0.5.0",
      html_url: "https://github.com/masonfox/tome/releases/tag/v0.5.0",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    // Assuming current version is 0.4.0, this should be detected as an update
    expect(data.hasNewVersion).toBe(true);
    expect(data.isMinorOrMajor).toBe(true);
  });

  test("does not notify for patch version updates (0.4.0 -> 0.4.1)", async () => {
    const mockRelease = {
      tag_name: "v0.4.1",
      name: "Tome v0.4.1",
      html_url: "https://github.com/masonfox/tome/releases/tag/v0.4.1",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    // Patch updates should not trigger notification in pre-1.0
    expect(data.hasNewVersion).toBe(false);
    expect(data.isMinorOrMajor).toBe(false);
  });

  test("identifies major version update correctly (0.x.x -> 1.x.x)", async () => {
    const mockRelease = {
      tag_name: "v1.0.0",
      name: "Tome v1.0.0 - Major Release",
      html_url: "https://github.com/masonfox/tome/releases/tag/v1.0.0",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.hasNewVersion).toBe(true);
    expect(data.isMinorOrMajor).toBe(true);
  });

  test("does not notify when versions are the same", async () => {
    const mockRelease = {
      tag_name: `v${packageJson.version}`,
      name: `Tome v${packageJson.version}`,
      html_url: `https://github.com/masonfox/tome/releases/tag/v${packageJson.version}`,
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.hasNewVersion).toBe(false);
    expect(data.isMinorOrMajor).toBe(false);
  });

  test("skips draft releases", async () => {
    const mockRelease = {
      tag_name: "v0.5.0",
      name: "Tome v0.5.0 (Draft)",
      html_url: "https://github.com/masonfox/tome/releases/tag/v0.5.0",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: true,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.latestVersion).toBeNull();
    expect(data.hasNewVersion).toBe(false);
    expect(data.error).toBe("Unable to check for updates");
  });

  test("skips prerelease versions", async () => {
    const mockRelease = {
      tag_name: "v0.5.0-beta.1",
      name: "Tome v0.5.0 Beta 1",
      html_url: "https://github.com/masonfox/tome/releases/tag/v0.5.0-beta.1",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: true,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.latestVersion).toBeNull();
    expect(data.hasNewVersion).toBe(false);
  });

  test("handles GitHub API rate limit (403)", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.currentVersion).toBe(packageJson.version);
    expect(data.latestVersion).toBeNull();
    expect(data.hasNewVersion).toBe(false);
    expect(data.error).toBe("Unable to check for updates");
  });

  test("handles GitHub API not found (404)", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.currentVersion).toBe(packageJson.version);
    expect(data.latestVersion).toBeNull();
    expect(data.error).toBe("Unable to check for updates");
  });

  test("handles network errors gracefully", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    const response = await GET();
    const data = await response.json();

    expect(data.currentVersion).toBe(packageJson.version);
    expect(data.latestVersion).toBeNull();
    expect(data.hasNewVersion).toBe(false);
    expect(data.error).toBe("Unable to check for updates");
    expect(response.status).toBe(200); // Should still return 200 with partial data
  });

  test("handles GitHub API server error (500)", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.currentVersion).toBe(packageJson.version);
    expect(data.latestVersion).toBeNull();
    expect(data.error).toBe("Unable to check for updates");
  });

  test("handles malformed version strings gracefully", async () => {
    const mockRelease = {
      tag_name: "invalid-version",
      name: "Bad Release",
      html_url: "https://github.com/masonfox/tome/releases/tag/invalid",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    // Should not crash, just not detect an update
    expect(data.currentVersion).toBe(packageJson.version);
    expect(data.hasNewVersion).toBe(false);
  });

  test("parses version with 'v' prefix correctly", async () => {
    const mockRelease = {
      tag_name: "v0.5.0", // With 'v' prefix
      name: "Tome v0.5.0",
      html_url: "https://github.com/masonfox/tome/releases/tag/v0.5.0",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.latestVersion).toBe("v0.5.0");
    // Version comparison should still work with 'v' prefix
  });

  test("parses version without 'v' prefix correctly", async () => {
    const mockRelease = {
      tag_name: "0.5.0", // Without 'v' prefix
      name: "Tome 0.5.0",
      html_url: "https://github.com/masonfox/tome/releases/tag/0.5.0",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.latestVersion).toBe("0.5.0");
  });

  test("includes proper User-Agent header in GitHub request", async () => {
    const mockRelease = {
      tag_name: "v0.5.0",
      name: "Tome v0.5.0",
      html_url: "https://github.com/masonfox/tome/releases/tag/v0.5.0",
      published_at: "2026-01-10T12:00:00Z",
      prerelease: false,
      draft: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRelease,
    });

    await GET();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/masonfox/tome/releases/latest',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'Tome-App',
        }),
      })
    );
  });
});
