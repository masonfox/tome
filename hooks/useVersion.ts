import { useQuery } from "@tanstack/react-query";

/**
 * Version data returned from the API
 */
export interface VersionData {
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
 * Custom hook for fetching version information
 * 
 * Checks current app version and latest release from GitHub.
 * Data is cached for 24 hours to minimize API requests.
 * 
 * @returns Query result with version data, loading state, and error handling
 */
export function useVersion() {
  return useQuery<VersionData>({
    queryKey: ['version'],
    queryFn: async () => {
      const response = await fetch('/api/version');
      if (!response.ok) {
        throw new Error('Failed to fetch version information');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - matches API cache
    refetchOnWindowFocus: false, // Don't refetch when user returns to tab
    retry: 1, // Only retry once on failure to avoid hammering the API
  });
}
