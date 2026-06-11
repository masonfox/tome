import { NextRequest, NextResponse } from 'next/server';
import { koreaderMappingRepository } from '@/lib/repositories/koreader-mapping.repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger().child({ module: 'koreader-mappings-api' });

/**
 * GET /api/koreader/mappings/[id]
 * 
 * Get a single mapping by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid mapping ID' },
        { status: 400 }
      );
    }

    const mapping = await koreaderMappingRepository.findById(id);
    if (!mapping) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(mapping);
  } catch (error) {
    logger.error({ error, id: params.id }, 'Failed to fetch mapping');
    return NextResponse.json(
      { error: 'Failed to fetch mapping' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/koreader/mappings/[id]
 * 
 * Update a mapping
 * 
 * Body: {
 *   bookId?: number,
 *   mappingSource?: 'auto_path' | 'manual',
 *   deviceName?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid mapping ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate mappingSource if provided
    if (body.mappingSource && !['auto_path', 'manual'].includes(body.mappingSource)) {
      return NextResponse.json(
        { error: 'Invalid mappingSource. Must be "auto_path" or "manual"' },
        { status: 400 }
      );
    }

    const mapping = await koreaderMappingRepository.update(id, body);
    if (!mapping) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }

    logger.info({ mappingId: id }, 'Updated mapping');

    return NextResponse.json(mapping);
  } catch (error) {
    logger.error({ error, id: params.id }, 'Failed to update mapping');
    return NextResponse.json(
      { error: 'Failed to update mapping' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/koreader/mappings/[id]
 * 
 * Delete a mapping
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid mapping ID' },
        { status: 400 }
      );
    }

    const deleted = await koreaderMappingRepository.delete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }

    logger.info({ mappingId: id }, 'Deleted mapping');

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error, id: params.id }, 'Failed to delete mapping');
    return NextResponse.json(
      { error: 'Failed to delete mapping' },
      { status: 500 }
    );
  }
}
