/**
 * Security tests for OPDS endpoints
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GET as GET_DOWNLOAD } from '@/app/api/opds/download/[bookId]/[format]/route';
import { GET as GET_SEARCH } from '@/app/api/opds/search/route';
import { createMockRequest } from '../fixtures/test-data';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../helpers/db-setup';
import { resetCalibreDB } from '@/lib/db/calibre';
import path from 'path';

beforeAll(async () => {
  await setupTestDatabase(__filename);
  
  // Set up Calibre test database
  const calibreDbPath = path.join(__dirname, '../fixtures/calibre-test-comprehensive.db');
  process.env.CALIBRE_DB_PATH = calibreDbPath;
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
  
  // Clean up Calibre DB
  delete process.env.CALIBRE_DB_PATH;
  resetCalibreDB();
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
  delete process.env.AUTH_PASSWORD; // Disable auth for security tests
});

describe('OPDS Security Tests', () => {
  describe('Path Traversal Protection', () => {
    test('should block path traversal attempts in download endpoint', async () => {
      // Various path traversal attempts
      const attacks = [
        { bookId: '1/../../../etc/passwd', format: 'epub' },
        { bookId: '1', format: '../../../etc/passwd' },
        { bookId: '../../etc/passwd', format: 'epub' },
      ];

      for (const attack of attacks) {
        const request = createMockRequest(
          'GET',
          `/api/opds/download/${attack.bookId}/${attack.format}`
        ) as any;

        const response = await GET_DOWNLOAD(request, {
          params: Promise.resolve(attack),
        });

        // Should either return 400 (invalid ID) or 403 (security check failed)
        expect([400, 403, 404]).toContain(response.status);
      }
    });

    test('should validate book ID is numeric', async () => {
      const request = createMockRequest('GET', '/api/opds/download/../etc/passwd/epub') as any;

      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '../etc/passwd', format: 'epub' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('SQL Injection Protection', () => {
    test('should safely handle SQL injection attempts in search', async () => {
      const attacks = [
        "'; DROP TABLE books; --",
        "' OR '1'='1",
        "'; DELETE FROM books WHERE '1'='1",
        "UNION SELECT * FROM books",
        "1' AND 1=1--",
      ];

      for (const attack of attacks) {
        const request = createMockRequest(
          'GET',
          `/api/opds/search?q=${encodeURIComponent(attack)}`
        ) as any;

        const response = await GET_SEARCH(request);

        // Should return 200 with empty or safe results, not 500
        expect(response.status).toBe(200);

        const xml = await response.text();
        // Should still be valid XML
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      }
    });

    test('should handle special characters in search safely', async () => {
      const specialChars = [
        '<script>alert("xss")</script>',
        '&<>"\'',
        '%00',
        '\x00',
      ];

      for (const chars of specialChars) {
        const request = createMockRequest(
          'GET',
          `/api/opds/search?q=${encodeURIComponent(chars)}`
        ) as any;

        const response = await GET_SEARCH(request);

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Parameter Validation', () => {
    test('should handle negative offset gracefully', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=test&offset=-10') as any;

      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);

      const xml = await response.text();
      // Should treat negative offset as 0
      expect(xml).toContain('<opensearch:startIndex>0</opensearch:startIndex>');
    });

    test('should enforce maximum limit', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=test&limit=10000') as any;

      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);

      const xml = await response.text();
      // Should cap at OPDS_MAX_PAGE_SIZE (200)
      expect(xml).toContain('<opensearch:itemsPerPage>200</opensearch:itemsPerPage>');
    });

    test('should handle very long search queries', async () => {
      const longQuery = 'a'.repeat(10000);
      const request = createMockRequest(
        'GET',
        `/api/opds/search?q=${encodeURIComponent(longQuery)}`
      ) as any;

      const response = await GET_SEARCH(request);

      // Should handle gracefully without crashing
      expect([200, 400, 414]).toContain(response.status);
    });

    test('should handle malformed pagination parameters', async () => {
      const tests = [
        { offset: 'abc', limit: '50' },
        { offset: '0', limit: 'xyz' },
        { offset: 'NaN', limit: 'Infinity' },
      ];

      for (const params of tests) {
        const request = createMockRequest(
          'GET',
          `/api/opds/search?q=test&offset=${params.offset}&limit=${params.limit}`
        ) as any;

        const response = await GET_SEARCH(request);

        // Should return 200 with default values
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Authentication Security', () => {
    test('should not expose password in logs or responses', async () => {
      process.env.AUTH_PASSWORD = 'supersecret123';

      const request = createMockRequest('GET', '/api/opds') as any;
      const GET_ROOT = (await import('@/app/api/opds/route')).GET;
      const response = await GET_ROOT(request);

      expect(response.status).toBe(401);

      const text = await response.text();
      expect(text).not.toContain('supersecret123');
    });

    test('should reject malformed Basic Auth headers', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const malformedHeaders = [
        'Basic',                    // Missing credentials
        'Basic invalid!!!',         // Invalid base64
        'Bearer token',             // Wrong auth type
        'Basic ' + Buffer.from('nocolon').toString('base64'), // No colon separator
      ];

      const GET_ROOT = (await import('@/app/api/opds/route')).GET;

      for (const authHeader of malformedHeaders) {
        const request = createMockRequest('GET', '/api/opds', null, {
          'Authorization': authHeader,
        }) as any;

        const response = await GET_ROOT(request);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Resource Limits', () => {
    test('should not allow excessive pagination offset', async () => {
      const request = createMockRequest(
        'GET',
        '/api/opds/search?q=test&offset=999999999999'
      ) as any;

      const response = await GET_SEARCH(request);

      // Should handle gracefully without memory issues
      expect(response.status).toBe(200);
    });

    test('should handle concurrent requests safely', async () => {
      const GET_BOOKS = (await import('@/app/api/opds/books/route')).GET;

      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        GET_BOOKS(createMockRequest('GET', '/api/opds/books') as any)
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('MIME Type Validation', () => {
    test('should only accept valid format types', async () => {
      const invalidFormats = [
        'exe',
        'sh',
        'bat',
        'php',
        '../../../etc/passwd',
      ];

      for (const format of invalidFormats) {
        const request = createMockRequest(
          'GET',
          `/api/opds/download/1/${format}`
        ) as any;

        const response = await GET_DOWNLOAD(request, {
          params: Promise.resolve({ bookId: '1', format }),
        });

        // Should return 404 (format not available) or 400/403 (security)
        expect([400, 403, 404]).toContain(response.status);
      }
    });
  });
});
