import { NextRequest, NextResponse } from 'next/server';
import { koreaderMappingRepository } from '@/lib/repositories/koreader-mapping.repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger().child({ module: 'koreader-mappings-api' });

/**
 * GET /api/koreader/mappings
 * 
 * Returns all document-to-book mappings, optionally filtered by bookId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookIdParam = searchParams.get('bookId');

    if (bookIdParam) {
      const bookId = parseInt(bookIdParam, 10);
      if (isNaN(bookId)) {
        return NextResponse.json(
          { error: 'Invalid bookId parameter' },
          { status: 400 }
        );
      }

      const mappings = await koreaderMappingRepository.findByBookId(bookId);
      return NextResponse.json(mappings);
    }

    const mappings = await koreaderMappingRepository.findAll();
    return NextResponse.json(mappings);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch mappings');
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/koreader/mappings
 * 
 * Create a new document-to-book mapping
 * 
 * Body: {
 *   documentHash: string,
 *   bookId: number,
 *   mappingSource: 'auto_path' | 'manual',
 *   deviceName?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.documentHash || !body.bookId || !body.mappingSource) {
      return NextResponse.json(
        { error: 'Missing required fields: documentHash, bookId, mappingSource' },
        { status: 400 }
      );
    }

    // Validate mappingSource
    if (!['auto_path', 'manual'].includes(body.mappingSource)) {
      return NextResponse.json(
        { error: 'Invalid mappingSource. Must be "auto_path" or "manual"' },
        { status: 400 }
      );
    }

    // Check if mapping already exists
    const existing = await koreaderMappingRepository.findByDocumentHash(body.documentHash);
    if (existing) {
      return NextResponse.json(
        { error: 'Mapping already exists for this document hash' },
        { status: 409 }
      );
    }

    const mapping = await koreaderMappingRepository.create({
      documentHash: body.documentHash,
      bookId: body.bookId,
      mappingSource: body.mappingSource,
      deviceName: body.deviceName || null,
    });

    logger.info({ mappingId: mapping.id, bookId: mapping.bookId }, 'Created mapping');

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'Failed to create mapping');
    return NextResponse.json(
      { error: 'Failed to create mapping' },
      { status: 500 }
    );
  }
}
