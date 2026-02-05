/**
 * OPDS Authentication Middleware
 * HTTP Basic Auth for OPDS endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';

/**
 * Parse HTTP Basic Auth header
 * @param authHeader - Authorization header value
 * @returns Decoded credentials or null if invalid
 */
function parseBasicAuth(authHeader: string | null): { username: string; password: string } | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Basic') {
    return null;
  }

  try {
    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');

    if (colonIndex === -1) {
      return null;
    }

    return {
      username: decoded.substring(0, colonIndex),
      password: decoded.substring(colonIndex + 1),
    };
  } catch (error) {
    getLogger().warn({ err: error }, 'Failed to parse Basic Auth header');
    return null;
  }
}

/**
 * Validate OPDS HTTP Basic Auth credentials
 * @param request - Next.js request object
 * @returns true if authenticated or auth is disabled, false otherwise
 */
export function validateOPDSAuth(request: NextRequest): boolean {
  const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

  // If no password is configured, allow access (auth disabled)
  if (!AUTH_PASSWORD) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  const credentials = parseBasicAuth(authHeader);

  if (!credentials) {
    getLogger().debug('OPDS auth failed: Missing or invalid Authorization header');
    return false;
  }

  // Username must be "tome" (hardcoded as per requirements)
  if (credentials.username !== 'tome') {
    getLogger().warn({ username: credentials.username }, 'OPDS auth failed: Invalid username');
    return false;
  }

  // Password must match AUTH_PASSWORD
  if (credentials.password !== AUTH_PASSWORD) {
    getLogger().warn('OPDS auth failed: Invalid password');
    return false;
  }

  return true;
}

/**
 * Create 401 Unauthorized response with Basic Auth challenge
 * @returns NextResponse with 401 status and WWW-Authenticate header
 */
export function createUnauthorizedResponse(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Tome OPDS"',
      'Content-Type': 'text/plain',
    },
  });
}
