import { NextRequest, NextResponse } from "next/server";
import { bookSourceRepository } from "@/lib/repositories";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ module: "api/books/[id]/sources" });

export const dynamic = 'force-dynamic';

/**
 * GET /api/books/[id]/sources
 * Fetch all source providers for a specific book
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookId = parseInt(id);

    if (isNaN(bookId)) {
      return NextResponse.json(
        { error: "Invalid book ID" },
        { status: 400 }
      );
    }

    const sources = await bookSourceRepository.findByBookId(bookId);

    return NextResponse.json({
      sources: sources.map(s => ({
        id: s.id,
        providerId: s.providerId,
        externalId: s.externalId,
        isPrimary: s.isPrimary,
        lastSynced: s.lastSynced,
        syncEnabled: s.syncEnabled,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch book sources");
    return NextResponse.json(
      { error: "Failed to fetch book sources" },
      { status: 500 }
    );
  }
}
