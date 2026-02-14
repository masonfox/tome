/**
 * GET /api/providers/[providerId]/metadata/[externalId]
 * 
 * Fetches complete book metadata from a specific provider.
 * Used when user selects a search result to get full details
 * including description, tags, and publisher.
 * 
 * See: specs/003-non-calibre-books/spec.md (T069)
 */

import { NextRequest, NextResponse } from "next/server";
import { providerService } from "@/lib/services/provider.service";
import { getLogger } from "@/lib/logger";
import type { ProviderId } from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "api-providers-metadata" });

/**
 * GET /api/providers/[providerId]/metadata/[externalId]
 * 
 * Fetches complete metadata for a book from a provider.
 * 
 * Path parameters:
 * - providerId: Provider identifier (hardcover, openlibrary, etc.)
 * - externalId: External book ID in the provider's system
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "title": "...",
 *     "authors": [...],
 *     "isbn": "...",
 *     "description": "...",
 *     "tags": [...],
 *     "publisher": "...",
 *     "pubDate": "...",
 *     "totalPages": 123,
 *     "coverImageUrl": "..."
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ providerId: string; externalId: string }> }
) {
  const params = await props.params;
  try {
    const { providerId, externalId } = params;

    if (!providerId || !externalId) {
      return NextResponse.json(
        {
          success: false,
          error: "Provider ID and external ID are required",
        },
        { status: 400 }
      );
    }

    logger.info({ providerId, externalId }, "API: Fetching metadata");

    // Fetch metadata from provider
    const metadata = await providerService.fetchMetadata(
      providerId as ProviderId,
      externalId
    );

    logger.info(
      {
        providerId,
        externalId,
        title: metadata.title,
        hasDescription: !!metadata.description,
        hasTags: !!metadata.tags,
        hasPublisher: !!metadata.publisher,
      },
      "API: Metadata fetch complete"
    );

    return NextResponse.json({
      success: true,
      data: metadata,
    });
  } catch (error: any) {
    logger.error({ err: error }, "API: Metadata fetch failed");
    
    // Handle specific error types
    if (error.message?.includes("Circuit breaker")) {
      return NextResponse.json(
        {
          success: false,
          error: "Provider temporarily unavailable",
          message: error.message,
        },
        { status: 503 }
      );
    }

    if (error.message?.includes("not found")) {
      return NextResponse.json(
        {
          success: false,
          error: "Metadata not found",
          message: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Metadata fetch failed",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
