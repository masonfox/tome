import { NextRequest } from 'next/server';
import { koReaderProxyService } from '@/lib/services/koreader-proxy.service';
import { koReaderProgressService } from '@/lib/services/koreader-progress.service';
import { settingsRepository } from '@/lib/repositories/settings.repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger().child({ module: 'koreader-api' });

/**
 * KoReader Sync Proxy Route
 * 
 * Catch-all route that intercepts KoReader sync requests, forwards them to
 * upstream server, and asynchronously processes progress updates for Tome.
 * 
 * Route: /api/koreader/[...path]
 * Examples:
 * - PUT /api/koreader/syncs/progress
 * - GET /api/koreader/users/auth
 * - GET /api/koreader/syncs/progress/:document
 */

async function handleProxyRequest(
  request: NextRequest,
  params: { path: string[] }
): Promise<Response> {
  // Check if proxy is enabled
  const enabled = await settingsRepository.getBoolean('koreader_proxy_enabled');
  if (!enabled) {
    logger.warn('KoReader proxy request received but proxy is disabled');
    return Response.json(
      { error: 'KoReader sync proxy is disabled' },
      { status: 503 }
    );
  }

  const pathString = params.path.join('/');
  logger.info({ path: pathString, method: request.method }, 'KoReader proxy request');

  // Special handling for progress updates (PUT /syncs/progress)
  if (request.method === 'PUT' && pathString === 'syncs/progress') {
    try {
      // Clone and parse request body
      const body = await request.text();
      const progressData = JSON.parse(body);

      logger.info({ documentHash: progressData.document }, 'Intercepting progress update');

      // Process progress asynchronously (fire-and-forget)
      // This runs in the background and won't block the proxy response
      koReaderProgressService.processProgressUpdate({
        documentHash: progressData.document,
        percentage: progressData.percentage,
        progress: progressData.progress,
        device: progressData.device,
        username: request.headers.get('x-auth-user') || undefined,
      }).catch(err => {
        logger.error({ error: err }, 'Background progress processing failed');
      });

      // Create new request with same body for forwarding to upstream
      // (original request body has been consumed)
      const forwardRequest = new NextRequest(request.url, {
        method: request.method,
        headers: request.headers,
        body,
      });

      return koReaderProxyService.forwardRequest(forwardRequest, params.path);
    } catch (error) {
      logger.error({ error }, 'Failed to parse progress update');
      // Still forward to upstream even if parsing fails
      return koReaderProxyService.forwardRequest(request, params.path);
    }
  }

  // Forward all other requests unchanged
  return koReaderProxyService.forwardRequest(request, params.path);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params);
}
