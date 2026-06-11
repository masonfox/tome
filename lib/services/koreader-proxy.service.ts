import { NextRequest, NextResponse } from 'next/server';
import { settingsRepository } from '@/lib/repositories/settings.repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger().child({ module: 'koreader-proxy' });

/**
 * KoReader Proxy Service
 * 
 * Forwards KoReader sync requests to upstream server (e.g., sync.koreader.rocks)
 * while intercepting and processing progress updates for Tome.
 */
export class KoReaderProxyService {
  /**
   * Forward a request to the upstream KoReader sync server
   * 
   * @param request - The incoming Next.js request
   * @param path - Array of path segments (e.g., ['syncs', 'progress'])
   * @returns NextResponse with upstream server's response or error
   */
  async forwardRequest(request: NextRequest, path: string[]): Promise<NextResponse> {
    // Get upstream URL from settings
    const upstreamUrl = await settingsRepository.get('koreader_upstream_url') || 'https://sync.koreader.rocks';
    
    const targetUrl = `${upstreamUrl}/${path.join('/')}`;
    
    logger.info({ targetUrl, method: request.method }, 'Forwarding request to upstream');
    
    try {
      // Build forwarded request headers
      const headers = new Headers();
      request.headers.forEach((value, key) => {
        // Skip host header (will be set by fetch to target host)
        if (key.toLowerCase() !== 'host') {
          headers.set(key, value);
        }
      });
      
      // Get body if present (skip for GET/HEAD)
      let body: BodyInit | null = null;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.text();
      }
      
      // Forward to upstream with timeout
      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      // Get response body
      const responseBody = await upstreamResponse.text();
      
      logger.info({ 
        targetUrl, 
        method: request.method, 
        status: upstreamResponse.status 
      }, 'Upstream request completed');
      
      // Build response with upstream headers and status
      return new NextResponse(responseBody, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: upstreamResponse.headers,
      });
      
    } catch (error) {
      logger.error({ error, targetUrl }, 'Upstream request failed');
      
      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ 
          error: 'Upstream server timeout',
          upstream: upstreamUrl 
        }, { status: 504 });
      }
      
      // Handle other errors (network, connection refused, etc.)
      return NextResponse.json({ 
        error: 'Upstream sync server unreachable',
        upstream: upstreamUrl,
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 502 });
    }
  }
}

export const koReaderProxyService = new KoReaderProxyService();
