import { NextResponse } from "next/server";
import { seriesService } from "@/lib/services/series.service";

/**
 * GET /api/series/:name
 * Get all books in a specific series
 */
export async function GET(
  _request: Request,
  { params }: { params: { name: string } }
) {
  const { getLogger } = require("@/lib/logger");
  const logger = getLogger();

  try {
    // Decode URL-encoded series name
    const seriesName = decodeURIComponent(params.name);
    
    logger.debug({ seriesName }, "[API /api/series/:name] Fetching books for series");
    
    // Get series info first to verify it exists
    const seriesInfo = await seriesService.getSeriesByName(seriesName);
    
    if (!seriesInfo) {
      logger.debug({ seriesName }, "[API /api/series/:name] Series not found");
      return NextResponse.json(
        { error: "Series not found" },
        { status: 404 }
      );
    }
    
    // Get books in the series
    const books = await seriesService.getBooksBySeries(seriesName);
    
    logger.debug(
      { seriesName, bookCount: books.length },
      "[API /api/series/:name] Returning series books"
    );
    
    return NextResponse.json({
      series: seriesInfo,
      books,
    });
  } catch (error) {
    logger.error({ err: error, seriesName: params.name }, "[API /api/series/:name] Failed to fetch series books");
    return NextResponse.json(
      { error: "Failed to fetch series books" },
      { status: 500 }
    );
  }
}
