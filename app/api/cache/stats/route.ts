import { NextResponse } from "next/server";
import {
  getCoverCacheStats,
  getBookPathCacheStats,
  type CacheStats,
} from "@/lib/covers/cache";

/**
 * GET /api/cache/stats
 *
 * Returns statistics about all server-side caches.
 *
 * Response format:
 * {
 *   coverCache: {
 *     size: number,           // Current number of items in cache
 *     maxSize: number,        // Maximum allowed items
 *     maxAgeMs: number,       // Cache TTL in milliseconds
 *     utilizationPercent: number  // size/maxSize * 100
 *   },
 *   bookPathCache: {
 *     size: number,
 *     maxSize: number,
 *     maxAgeMs: number,
 *     utilizationPercent: number
 *   },
 *   timestamp: string        // ISO 8601 timestamp
 * }
 */
export async function GET() {
  try {
    const coverStats = getCoverCacheStats();
    const pathStats = getBookPathCacheStats();

    const response = {
      coverCache: {
        ...coverStats,
        utilizationPercent:
          coverStats.maxSize > 0
            ? Number(((coverStats.size / coverStats.maxSize) * 100).toFixed(2))
            : 0,
      },
      bookPathCache: {
        ...pathStats,
        utilizationPercent:
          pathStats.maxSize > 0
            ? Number(((pathStats.size / pathStats.maxSize) * 100).toFixed(2))
            : 0,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Cache Stats] Error fetching cache statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch cache statistics" },
      { status: 500 }
    );
  }
}
