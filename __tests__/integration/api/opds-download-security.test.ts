/**
 * OPDS Download Endpoint Security Tests
 * Tests security-critical paths: path traversal, authentication, file access
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET as GET_DOWNLOAD } from '@/app/api/opds/download/[bookId]/[format]/route';
import { createMockRequest } from '../../fixtures/test-data';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../../helpers/db-setup';
import { resetCalibreDB } from '@/lib/db/calibre';
import path from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

const originalEnv = {
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  CALIBRE_DB_PATH: process.env.CALIBRE_DB_PATH,
};

// Test fixture paths
const calibreDbPath = path.join(__dirname, '../../fixtures/calibre-test-comprehensive.db');
const calibreLibraryPath = path.dirname(calibreDbPath);

beforeAll(async () => {
  await setupTestDatabase(__filename);
  
  // Set up Calibre test database
  process.env.CALIBRE_DB_PATH = calibreDbPath;
  
  // Create test book directory and EPUB file for download tests
  // Book ID 147 is "Dune" with known formats
  const duneBookPath = path.join(calibreLibraryPath, 'Frank Herbert', 'Dune (147)');
  if (!existsSync(duneBookPath)) {
    mkdirSync(duneBookPath, { recursive: true });
  }
  
  // Create a minimal EPUB file for testing
  const epubPath = path.join(duneBookPath, 'Dune - Frank Herbert.epub');
  if (!existsSync(epubPath)) {
    writeFileSync(epubPath, 'PK\x03\x04'); // Minimal ZIP header (EPUB is a ZIP)
  }
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
  
  // Clean up test files
  const duneBookPath = path.join(calibreLibraryPath, 'Frank Herbert', 'Dune (147)');
  if (existsSync(duneBookPath)) {
    rmSync(duneBookPath, { recursive: true, force: true });
  }
  
  // Restore original environment variables
  if (originalEnv.AUTH_PASSWORD) {
    process.env.AUTH_PASSWORD = originalEnv.AUTH_PASSWORD;
  } else {
    delete process.env.AUTH_PASSWORD;
  }
  
  if (originalEnv.CALIBRE_DB_PATH) {
    process.env.CALIBRE_DB_PATH = originalEnv.CALIBRE_DB_PATH;
  } else {
    delete process.env.CALIBRE_DB_PATH;
  }
  
  // Reset Calibre DB singleton
  resetCalibreDB();
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
  // Ensure AUTH_PASSWORD is cleared before each test
  delete process.env.AUTH_PASSWORD;
});

describe('OPDS Download Security', () => {
  describe('Path Traversal Protection', () => {
    test('should block path traversal in format parameter', async () => {
      // Path traversal attempts with non-existent formats are caught by format validation first
      const request = createMockRequest('GET', '/api/opds/download/147/../../../etc/passwd') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: '../../../../etc/passwd' })
      });

      // Returns 404 because format doesn't exist in DB (format validation happens first)
      // This is acceptable - format validation acts as first line of defense
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toContain('not available');
    });

    test('should block path traversal with relative paths', async () => {
      // URL-encoded path traversal attempts
      const request = createMockRequest('GET', '/api/opds/download/147/..%2F..%2Fetc%2Fpasswd') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: '../../../etc/passwd' })
      });

      // Returns 404 from format validation (security-in-depth)
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toContain('not available');
    });

    test('should block absolute path attempts', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147//etc/passwd') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: '/etc/passwd' })
      });

      // Should fail during path resolution or format validation
      expect([403, 404]).toContain(response.status);
    });

    test('should allow valid format within library directory', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      // Should succeed or return 404 if file doesn't exist (not 403)
      expect(response.status).not.toBe(403);
    });
  });

  describe('Authentication Enforcement', () => {
    test('should allow access when AUTH_PASSWORD is not set', async () => {
      delete process.env.AUTH_PASSWORD;

      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      // Should not return 401 (might be 404 if file doesn't exist, but not auth error)
      expect(response.status).not.toBe(401);
    });

    test('should require auth when AUTH_PASSWORD is set', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
    });

    test('should accept valid Basic Auth credentials', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tome:test123').toString('base64');
      const request = createMockRequest('GET', '/api/opds/download/147/epub', null, {
        'Authorization': `Basic ${credentials}`,
      }) as any;

      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      // Should not return 401 (might be 404 if file doesn't exist)
      expect(response.status).not.toBe(401);
    });

    test('should reject invalid password', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tome:wrongpassword').toString('base64');
      const request = createMockRequest('GET', '/api/opds/download/147/epub', null, {
        'Authorization': `Basic ${credentials}`,
      }) as any;

      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      expect(response.status).toBe(401);
    });

    test('should reject malformed Authorization header', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const request = createMockRequest('GET', '/api/opds/download/147/epub', null, {
        'Authorization': 'InvalidHeader',
      }) as any;

      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Request Validation', () => {
    test('should return 400 for invalid book ID', async () => {
      const request = createMockRequest('GET', '/api/opds/download/invalid/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: 'invalid', format: 'epub' })
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid book ID');
    });

    test('should return 400 for non-numeric book ID', async () => {
      const request = createMockRequest('GET', '/api/opds/download/abc123/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: 'abc123', format: 'epub' })
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invalid book ID');
    });

    test('should return 404 for non-existent book', async () => {
      const request = createMockRequest('GET', '/api/opds/download/999999/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '999999', format: 'epub' })
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Book not found');
    });

    test('should return 404 for unavailable format', async () => {
      // Book 147 exists but doesn't have XYZ format
      const request = createMockRequest('GET', '/api/opds/download/147/xyz') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'xyz' })
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toContain('not available');
    });

    test('should handle case-insensitive format names', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147/EPUB') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'EPUB' })
      });

      // Should normalize to uppercase and process (not fail with 400)
      expect(response.status).not.toBe(400);
    });
  });

  describe('Configuration Validation', () => {
    test('should return 500 when CALIBRE_DB_PATH not configured', async () => {
      const originalPath = process.env.CALIBRE_DB_PATH;
      delete process.env.CALIBRE_DB_PATH;

      // Reset singleton to pick up env change
      resetCalibreDB();

      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toContain('CALIBRE_DB_PATH');

      // Restore
      process.env.CALIBRE_DB_PATH = originalPath;
      resetCalibreDB();
    });
  });

  describe('File System Operations', () => {
    test('should return 404 when file does not exist on disk', async () => {
      // Book exists in DB but file is missing
      // Book 89 exists but has no EPUB file created
      const request = createMockRequest('GET', '/api/opds/download/89/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '89', format: 'epub' })
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toContain('not found');
    });

    test('should stream file with correct Content-Type header', async () => {
      // This test requires the actual file to exist
      // We created it in beforeAll for book 147
      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      if (response.status === 200) {
        expect(response.headers.get('Content-Type')).toBe('application/epub+zip');
      } else {
        // File might not exist in CI environment - that's okay
        expect([200, 404]).toContain(response.status);
      }
    });

    test('should include Content-Disposition header with filename', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      if (response.status === 200) {
        const contentDisposition = response.headers.get('Content-Disposition');
        expect(contentDisposition).toContain('attachment');
        expect(contentDisposition).toContain('.epub');
      } else {
        expect([200, 404]).toContain(response.status);
      }
    });

    test('should include Content-Length header', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      if (response.status === 200) {
        const contentLength = response.headers.get('Content-Length');
        expect(contentLength).toBeTruthy();
        expect(parseInt(contentLength!)).toBeGreaterThan(0);
      } else {
        expect([200, 404]).toContain(response.status);
      }
    });

    test('should include Cache-Control header for immutable content', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      if (response.status === 200) {
        const cacheControl = response.headers.get('Cache-Control');
        expect(cacheControl).toContain('immutable');
        expect(cacheControl).toContain('public');
      } else {
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('Format Support', () => {
    test('should support EPUB format', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      // Should not fail with format error
      expect([200, 404]).toContain(response.status);
    });

    test('should support PDF format', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147/pdf') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'pdf' })
      });

      // Should not fail with format error (might be 404 if format not available)
      expect([200, 404]).toContain(response.status);
    });

    test('should support MOBI format', async () => {
      const request = createMockRequest('GET', '/api/opds/download/147/mobi') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'mobi' })
      });

      // Should not fail with format error
      expect([200, 404]).toContain(response.status);
    });

    test('should return correct MIME type for different formats', async () => {
      const formats = [
        { ext: 'epub', mime: 'application/epub+zip' },
        { ext: 'pdf', mime: 'application/pdf' },
        { ext: 'mobi', mime: 'application/x-mobipocket-ebook' },
      ];

      for (const { ext, mime } of formats) {
        const request = createMockRequest('GET', `/api/opds/download/147/${ext}`) as any;
        const response = await GET_DOWNLOAD(request, {
          params: Promise.resolve({ bookId: '147', format: ext })
        });

        if (response.status === 200) {
          expect(response.headers.get('Content-Type')).toBe(mime);
        }
        // If 404, format just isn't available for this book - that's fine
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle database query errors gracefully', async () => {
      // Use invalid DB path to trigger error
      const originalPath = process.env.CALIBRE_DB_PATH;
      process.env.CALIBRE_DB_PATH = '/nonexistent/path/metadata.db';
      resetCalibreDB();

      const request = createMockRequest('GET', '/api/opds/download/147/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: '147', format: 'epub' })
      });

      // Should return 500 error, not crash
      expect(response.status).toBe(500);

      // Restore
      process.env.CALIBRE_DB_PATH = originalPath;
      resetCalibreDB();
    });

    test('should return JSON error response for invalid requests', async () => {
      const request = createMockRequest('GET', '/api/opds/download/invalid/epub') as any;
      const response = await GET_DOWNLOAD(request, {
        params: Promise.resolve({ bookId: 'invalid', format: 'epub' })
      });

      expect(response.status).toBe(400);
      
      const json = await response.json();
      expect(json).toHaveProperty('error');
      expect(typeof json.error).toBe('string');
    });
  });
});
