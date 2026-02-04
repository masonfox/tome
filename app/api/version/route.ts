import { getLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import packageJson from "@/package.json";

/**
 * Version API Route
 * 
 * Provides current application version and checks for new releases on GitHub.
 * Caches GitHub API responses for 24 hours to respect rate limits (60/hour unauthenticated).
 * 
 * For pre-1.0 versions, notifies users of minor version updates (e.g., 0.4.0 → 0.5.0).
 * Post-1.0, would typically only notify for major versions.
 */

interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

interface VersionResponse {
  currentVersion: string;
  latestVersion: string | null;
  hasNewVersion: boolean;
  isMinorOrMajor: boolean;
  latestReleaseUrl: string | null;
  latestReleaseName: string | null;
  publishedAt: string | null;
  error?: string;
}

/**
 * Parse semantic version string into components
 * Handles both "v0.4.0" and "0.4.0" formats
 */
function parseVersion(version: string): VersionInfo | null {
  try {
    // Remove 'v' prefix if present
    const clean = version.replace(/^v/, '');
    const parts = clean.split('.');
    
    if (parts.length !== 3) {
      return null;
    }
    
    const [major, minor, patch] = parts.map(Number);
    
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
      return null;
    }
    
    return { major, minor, patch };
  } catch (error) {
    getLogger().error({ err: error, version }, "Failed to parse version");
    return null;
  }
}

/**
 * Compare two versions to determine if an update is available
 * For pre-1.0 versions, treats minor version changes as significant
 */
function compareVersions(current: string, latest: string): {
  hasUpdate: boolean;
  isMinorOrMajor: boolean;
} {
  const curr = parseVersion(current);
  const lat = parseVersion(latest);
  
  if (!curr || !lat) {
    return { hasUpdate: false, isMinorOrMajor: false };
  }
  
  // Major version increase (e.g., 0.x.x → 1.x.x)
  if (lat.major > curr.major) {
    return { hasUpdate: true, isMinorOrMajor: true };
  }
  
  // Minor version increase (e.g., 0.4.x → 0.5.x)
  // Important for pre-1.0 development!
  if (lat.major === curr.major && lat.minor > curr.minor) {
    return { hasUpdate: true, isMinorOrMajor: true };
  }
  
  // Patch version increase (e.g., 0.4.0 → 0.4.1)
  // TODO: after 1.0.0 release, return this to falses; don't notify on patch
  if (lat.major === curr.major && lat.minor === curr.minor && lat.patch > curr.patch) {
    return { hasUpdate: true, isMinorOrMajor: true };
  }
  
  return { hasUpdate: false, isMinorOrMajor: false };
}

/**
 * Fetch latest release information from GitHub
 * Cached for 24 hours to respect rate limits
 */
async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/masonfox/tome/releases/latest',
      {
        next: { revalidate: 86400 }, // 24 hours in seconds
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Tome-App',
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        getLogger().warn("No releases found on GitHub");
        return null;
      }
      if (response.status === 403) {
        getLogger().warn("GitHub API rate limit exceeded");
        return null;
      }
      throw new Error(`GitHub API returned ${response.status}`);
    }
    
    const data: GitHubRelease = await response.json();
    
    // Skip draft and prerelease versions
    if (data.draft || data.prerelease) {
      return null;
    }
    
    return data;
  } catch (error) {
    getLogger().error({ err: error }, "Failed to fetch latest release from GitHub");
    return null;
  }
}

export async function GET() {
  try {
    const currentVersion = packageJson.version;
    
    // Fetch latest release from GitHub
    const latestRelease = await fetchLatestRelease();
    
    // If GitHub fetch failed, return current version only
    if (!latestRelease) {
      const response: VersionResponse = {
        currentVersion,
        latestVersion: null,
        hasNewVersion: false,
        isMinorOrMajor: false,
        latestReleaseUrl: null,
        latestReleaseName: null,
        publishedAt: null,
        error: "Unable to check for updates",
      };
      return NextResponse.json(response);
    }
    
    // Compare versions
    const latestVersion = latestRelease.tag_name;
    const { hasUpdate, isMinorOrMajor } = compareVersions(currentVersion, latestVersion);
    
    const response: VersionResponse = {
      currentVersion,
      latestVersion,
      hasNewVersion: hasUpdate && isMinorOrMajor,
      isMinorOrMajor,
      latestReleaseUrl: latestRelease.html_url,
      latestReleaseName: latestRelease.name,
      publishedAt: latestRelease.published_at,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    getLogger().error({ err: error }, "Error in version API");
    
    // Even on error, return current version
    const response: VersionResponse = {
      currentVersion: packageJson.version,
      latestVersion: null,
      hasNewVersion: false,
      isMinorOrMajor: false,
      latestReleaseUrl: null,
      latestReleaseName: null,
      publishedAt: null,
      error: "Failed to check for updates",
    };
    
    return NextResponse.json(response, { status: 200 });
  }
}
