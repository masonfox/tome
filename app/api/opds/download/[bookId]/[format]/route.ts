/**
 * OPDS Download Endpoint
 * Serves ebook files for download with security validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { getBookById, getBookFormats } from '@/lib/db/calibre';
import { getMimeTypeForFormat } from '@/lib/opds/helpers';
import { getLogger } from '@/lib/logger';
import path from 'path';
import { existsSync, createReadStream, statSync } from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ bookId: string; format: string }> }
) {
  try {
    const params = await props.params;

    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Validate and parse bookId
    const bookId = parseInt(params.bookId, 10);
    if (isNaN(bookId)) {
      getLogger().warn({ bookId: params.bookId }, 'Invalid book ID');
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Normalize format to uppercase
    const format = params.format.toUpperCase();

    // Get Calibre library path
    const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;
    if (!CALIBRE_DB_PATH) {
      getLogger().error('CALIBRE_DB_PATH not configured');
      return NextResponse.json(
        { error: 'CALIBRE_DB_PATH not configured' },
        { status: 500 }
      );
    }
    const libraryPath = path.dirname(CALIBRE_DB_PATH);

    // Look up book in Calibre database
    const book = getBookById(bookId);
    if (!book) {
      getLogger().warn({ bookId }, 'Book not found in Calibre database');
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Verify format exists for this book
    const formats = getBookFormats(bookId);
    const formatData = formats.find(f => f.format === format);
    if (!formatData) {
      getLogger().warn({ bookId, format }, 'Format not available for this book');
      return NextResponse.json(
        { error: `Format ${format} not available for this book` },
        { status: 404 }
      );
    }

    // Construct file path
    const fileName = `${formatData.name}.${format.toLowerCase()}`;
    const filePath = path.join(libraryPath, book.path, fileName);

    // SECURITY CHECK: Prevent path traversal attacks
    const resolvedPath = path.resolve(filePath);
    const resolvedLibrary = path.resolve(libraryPath);

    if (!resolvedPath.startsWith(resolvedLibrary)) {
      getLogger().error(
        {
          resolvedPath,
          resolvedLibrary,
          bookId,
          format,
        },
        'OPDS download: Path traversal attempt blocked'
      );
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    // Check file exists
    if (!existsSync(resolvedPath)) {
      getLogger().error({ resolvedPath, bookId, format }, 'OPDS download: File not found');
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get file stats for Content-Length
    const stats = statSync(resolvedPath);
    const fileSize = stats.size;

    // Stream file (don't load entire file into memory)
    const fileStream = createReadStream(resolvedPath);

    // Get MIME type for format
    const mimeType = getMimeTypeForFormat(format);

    // Create readable stream for Next.js response
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        fileStream.on('end', () => {
          controller.close();
        });
        fileStream.on('error', (err) => {
          getLogger().error({ err, resolvedPath }, 'Error streaming file');
          controller.error(err);
        });
      },
    });

    // Return with proper headers
    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${path.basename(resolvedPath)}"`,
        'Content-Length': fileSize.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable', // Books don't change
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS download endpoint error');
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    );
  }
}
