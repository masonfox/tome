/**
 * Unit tests for OPDS authentication
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { NextRequest } from 'next/server';

describe('OPDS Auth', () => {
  const originalEnv = process.env.AUTH_PASSWORD;

  afterEach(() => {
    // Restore original env
    if (originalEnv) {
      process.env.AUTH_PASSWORD = originalEnv;
    } else {
      delete process.env.AUTH_PASSWORD;
    }
  });

  describe('validateOPDSAuth', () => {
    test('should allow access when AUTH_PASSWORD is not set', () => {
      delete process.env.AUTH_PASSWORD;

      const request = new NextRequest('http://localhost/api/opds');
      const result = validateOPDSAuth(request);

      expect(result).toBe(true);
    });

    test('should reject request without Authorization header when password is set', () => {
      process.env.AUTH_PASSWORD = 'test123';

      const request = new NextRequest('http://localhost/api/opds');
      const result = validateOPDSAuth(request);

      expect(result).toBe(false);
    });

    test('should accept valid Basic Auth credentials', () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tome:test123').toString('base64');
      const request = new NextRequest('http://localhost/api/opds', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const result = validateOPDSAuth(request);

      expect(result).toBe(true);
    });

    test('should reject invalid password', () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tome:wrongpassword').toString('base64');
      const request = new NextRequest('http://localhost/api/opds', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const result = validateOPDSAuth(request);

      expect(result).toBe(false);
    });

    test('should reject invalid username', () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('wronguser:test123').toString('base64');
      const request = new NextRequest('http://localhost/api/opds', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const result = validateOPDSAuth(request);

      expect(result).toBe(false);
    });

    test('should reject malformed Authorization header', () => {
      process.env.AUTH_PASSWORD = 'test123';

      const request = new NextRequest('http://localhost/api/opds', {
        headers: {
          'Authorization': 'NotBasic invalidcredentials',
        },
      });

      const result = validateOPDSAuth(request);

      expect(result).toBe(false);
    });

    test('should reject invalid base64 encoding', () => {
      process.env.AUTH_PASSWORD = 'test123';

      const request = new NextRequest('http://localhost/api/opds', {
        headers: {
          'Authorization': 'Basic invalid!!!base64',
        },
      });

      const result = validateOPDSAuth(request);

      expect(result).toBe(false);
    });

    test('should reject credentials without colon separator', () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tometest123').toString('base64');
      const request = new NextRequest('http://localhost/api/opds', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const result = validateOPDSAuth(request);

      expect(result).toBe(false);
    });

    test('should handle credentials with special characters', () => {
      process.env.AUTH_PASSWORD = 'p@ssw0rd!#$%';

      const credentials = Buffer.from('tome:p@ssw0rd!#$%').toString('base64');
      const request = new NextRequest('http://localhost/api/opds', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const result = validateOPDSAuth(request);

      expect(result).toBe(true);
    });

    test('should handle password with colon', () => {
      process.env.AUTH_PASSWORD = 'pass:word';

      const credentials = Buffer.from('tome:pass:word').toString('base64');
      const request = new NextRequest('http://localhost/api/opds', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const result = validateOPDSAuth(request);

      expect(result).toBe(true);
    });
  });

  describe('createUnauthorizedResponse', () => {
    test('should return 401 status', () => {
      const response = createUnauthorizedResponse();
      expect(response.status).toBe(401);
    });

    test('should include WWW-Authenticate header', () => {
      const response = createUnauthorizedResponse();
      const authHeader = response.headers.get('WWW-Authenticate');

      expect(authHeader).toBe('Basic realm="Tome OPDS"');
    });

    test('should return plain text content type', () => {
      const response = createUnauthorizedResponse();
      const contentType = response.headers.get('Content-Type');

      expect(contentType).toBe('text/plain');
    });
  });
});
