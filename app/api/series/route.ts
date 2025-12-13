import { NextResponse } from "next/server";
import { seriesService } from "@/lib/services/series.service";

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/series
 * Get all series in the library
 */
export async function GET() {
  const { getLogger } = require("@/lib/logger");
  const logger = getLogger();

  try {
    logger.debug("[API /api/series] Fetching all series");
    
    const series = await seriesService.getAllSeries();
    
    logger.debug({ count: series.length }, "[API /api/series] Returning series list");
    
    return NextResponse.json(series);
  } catch (error) {
    logger.error({ err: error }, "[API /api/series] Failed to fetch series");
    return NextResponse.json(
      { error: "Failed to fetch series" },
      { status: 500 }
    );
  }
}
