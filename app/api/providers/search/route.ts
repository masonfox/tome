/**
 * POST /api/providers/search
 * 
 * Federated metadata search across multiple providers.
 * Searches Hardcover and OpenLibrary in parallel.
 * 
 * See: specs/003-non-calibre-books/spec.md (T076)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchService } from "@/lib/services/search.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ module: "api-providers-search" });

// Request validation schema
const SearchRequestSchema = z.object({
  query: z.string().min(1, "Query cannot be empty").max(500, "Query too long"),
});

/**
 * POST /api/providers/search
 * 
 * Performs federated search across all enabled providers.
 * 
 * Request body:
 * {
 *   "query": "harry potter"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "query": "harry potter",
 *     "results": [
 *       {
 *         "provider": "hardcover",
 *         "results": [...],
 *         "status": "success",
 *         "duration": 1234
 *       },
 *       {
 *         "provider": "openlibrary",
 *         "results": [...],
 *         "status": "success",
 *         "duration": 2345
 *       }
 *     ],
 *     "totalResults": 50,
 *     "successfulProviders": 2,
 *     "failedProviders": 0
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = SearchRequestSchema.safeParse(body);
    if (!validation.success) {
      logger.warn({ errors: validation.error.issues }, "Invalid search request");
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { query } = validation.data;

    logger.info({ query }, "API: Federated search request");

    // Perform federated search
    const searchResults = await searchService.federatedSearch(query);

    logger.info(
      {
        query,
        totalResults: searchResults.totalResults,
        successfulProviders: searchResults.successfulProviders,
        failedProviders: searchResults.failedProviders,
      },
      "API: Federated search complete"
    );

    return NextResponse.json({
      success: true,
      data: searchResults,
    });
  } catch (error: any) {
    logger.error({ err: error }, "API: Federated search failed");
    return NextResponse.json(
      {
        success: false,
        error: "Search failed",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
