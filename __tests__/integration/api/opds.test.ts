/**
 * Integration tests for OPDS API endpoints
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET as GET_ROOT } from '@/app/api/opds/route';
import { GET as GET_BOOKS } from '@/app/api/opds/books/route';
import { GET as GET_SEARCH } from '@/app/api/opds/search/route';
import { GET as GET_DOWNLOAD } from '@/app/api/opds/download/[bookId]/[format]/route';
import { createMockRequest } from '../../fixtures/test-data';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../../helpers/db-setup';

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

const originalEnv = process.env.AUTH_PASSWORD;

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
  // Restore original auth password
  if (originalEnv) {
    process.env.AUTH_PASSWORD = originalEnv;
  } else {
    delete process.env.AUTH_PASSWORD;
  }
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe('OPDS API Integration', () => {
  describe('Authentication', () => {
    test('should allow access when AUTH_PASSWORD is not set', async () => {
      delete process.env.AUTH_PASSWORD;

      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      expect(response.status).toBe(200);
    });

    test('should return 401 without auth when AUTH_PASSWORD is set', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
    });

    test('should accept valid Basic Auth credentials', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tome:test123').toString('base64');
      const request = createMockRequest('GET', '/api/opds', null, {
        'Authorization': `Basic ${credentials}`,
      }) as any;

      const response = await GET_ROOT(request);

      expect(response.status).toBe(200);
    });

    test('should reject invalid password', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tome:wrongpassword').toString('base64');
      const request = createMockRequest('GET', '/api/opds', null, {
        'Authorization': `Basic ${credentials}`,
      }) as any;

      const response = await GET_ROOT(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Root Catalog', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD; // Disable auth for these tests
    });

    test('should return navigation feed XML', async () => {
      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/atom+xml');

      const xml = await response.text();

      // Check XML structure
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('xmlns="http://www.w3.org/2005/Atom"');
      expect(xml).toContain('<title>Tome Library</title>');
      expect(xml).toContain('<id>urn:tome:root</id>');
    });

    test('should include links to All Books and Search', async () => {
      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      const xml = await response.text();

      expect(xml).toContain('All Books');
      expect(xml).toContain('/api/opds/books');
      expect(xml).toContain('/api/opds/search');
    });
  });

  describe('Books Feed', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should return acquisition feed XML', async () => {
      const request = createMockRequest('GET', '/api/opds/books') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/atom+xml');

      const xml = await response.text();

      expect(xml).toContain('xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"');
      expect(xml).toContain('<opensearch:totalResults>');
      expect(xml).toContain('<opensearch:itemsPerPage>');
    });

    test('should respect pagination parameters', async () => {
      const request = createMockRequest('GET', '/api/opds/books?offset=10&limit=5') as any;
      const response = await GET_BOOKS(request);

      const xml = await response.text();

      expect(xml).toContain('<opensearch:startIndex>10</opensearch:startIndex>');
      expect(xml).toContain('<opensearch:itemsPerPage>5</opensearch:itemsPerPage>');
    });

    test('should include pagination links when applicable', async () => {
      const request = createMockRequest('GET', '/api/opds/books?offset=50&limit=50') as any;
      const response = await GET_BOOKS(request);

      const xml = await response.text();

      // Should have self link
      expect(xml).toContain('rel="self"');

      // Should have start link
      expect(xml).toContain('rel="start"');
    });

    test('should enforce maximum page size', async () => {
      const request = createMockRequest('GET', '/api/opds/books?limit=1000') as any;
      const response = await GET_BOOKS(request);

      const xml = await response.text();

      // Should be capped at 200 (OPDS_MAX_PAGE_SIZE)
      expect(xml).toContain('<opensearch:itemsPerPage>200</opensearch:itemsPerPage>');
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should return 400 without search query', async () => {
      const request = createMockRequest('GET', '/api/opds/search') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(400);
    });

    test('should return acquisition feed for valid search', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=test') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);

      const xml = await response.text();

      expect(xml).toContain('Search results for "test"');
      expect(xml).toContain('xmlns:opensearch');
    });

    test('should handle empty search results', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=nonexistentbook12345') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);

      const xml = await response.text();

      expect(xml).toContain('<opensearch:totalResults>0</opensearch:totalResults>');
    });

    test('should support pagination in search results', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=test&offset=0&limit=10') as any;
      const response = await GET_SEARCH(request);

      const xml = await response.text();

      expect(xml).toContain('<opensearch:itemsPerPage>10</opensearch:itemsPerPage>');
    });
  });

  describe('Download Endpoint', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should return 400 for invalid book ID', async () => {
      const request = createMockRequest('GET', '/api/opds/download/invalid/epub') as any;
      const response = await GET_DOWNLOAD(request, { params: Promise.resolve({ bookId: 'invalid', format: 'epub' }) });

      expect(response.status).toBe(400);
    });

    test('should return 404 for non-existent book', async () => {
      const request = createMockRequest('GET', '/api/opds/download/999999/epub') as any;
      const response = await GET_DOWNLOAD(request, { params: Promise.resolve({ bookId: '999999', format: 'epub' }) });

      expect(response.status).toBe(404);
    });

    test('should return 404 for unavailable format', async () => {
      // Assuming book 1 exists but doesn't have MOBI format
      const request = createMockRequest('GET', '/api/opds/download/1/xyz') as any;
      const response = await GET_DOWNLOAD(request, { params: Promise.resolve({ bookId: '1', format: 'xyz' }) });

      expect(response.status).toBe(404);
    });
  });
});
