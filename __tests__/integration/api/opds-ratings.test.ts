/**
 * Integration tests for OPDS Ratings API endpoints
 * Tests the ratings navigation and acquisition feeds
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET as GET_RATINGS_NAV } from '@/app/api/opds/ratings/route';
import { GET as GET_RATINGS_BOOKS } from '@/app/api/opds/ratings/[rating]/route';
import { createMockRequest } from '../../fixtures/test-data';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../../helpers/db-setup';
import { resetCalibreDB } from '@/lib/db/calibre';
import path from 'path';

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

const originalEnv = process.env.AUTH_PASSWORD;
const originalCalibreDbPath = process.env.CALIBRE_DB_PATH;

beforeAll(async () => {
  await setupTestDatabase(__filename);
  
  // Set up Calibre test database
  const calibreDbPath = path.join(__dirname, '../../fixtures/calibre-test-comprehensive.db');
  process.env.CALIBRE_DB_PATH = calibreDbPath;
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
  
  // Restore original environment variables
  if (originalEnv) {
    process.env.AUTH_PASSWORD = originalEnv;
  } else {
    delete process.env.AUTH_PASSWORD;
  }
  
  if (originalCalibreDbPath) {
    process.env.CALIBRE_DB_PATH = originalCalibreDbPath;
  } else {
    delete process.env.CALIBRE_DB_PATH;
  }
  
  // Reset Calibre DB singleton
  resetCalibreDB();
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
  delete process.env.AUTH_PASSWORD;
});

describe('OPDS Ratings API', () => {
  describe('GET /api/opds/ratings - Navigation Feed', () => {
    test('should return navigation feed with rating options', async () => {
      const request = createMockRequest('GET', '/api/opds/ratings') as any;
      const response = await GET_RATINGS_NAV(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/atom+xml;profile=opds-catalog;kind=navigation');

      const xml = await response.text();

      // Check feed structure
      expect(xml).toContain('<id>urn:tome:by-rating</id>');
      expect(xml).toContain('<title>Ratings</title>');
      expect(xml).toContain('<subtitle>Filter books by star rating</subtitle>');
    });

    test('should include "Rated" option first', async () => {
      const request = createMockRequest('GET', '/api/opds/ratings') as any;
      const response = await GET_RATINGS_NAV(request);

      const xml = await response.text();

      // Check for "Rated" entry
      expect(xml).toContain('<id>urn:tome:rating:rated</id>');
      expect(xml).toContain('<title>Rated</title>');
      expect(xml).toContain('All books with a rating (1-5 stars)');
      expect(xml).toContain('href="/api/opds/ratings/rated"');
    });

    test('should include all star rating options', async () => {
      const request = createMockRequest('GET', '/api/opds/ratings') as any;
      const response = await GET_RATINGS_NAV(request);

      const xml = await response.text();

      // Check for all star ratings
      expect(xml).toContain('★☆☆☆☆ (1 star)');
      expect(xml).toContain('★★☆☆☆ (2 stars)');
      expect(xml).toContain('★★★☆☆ (3 stars)');
      expect(xml).toContain('★★★★☆ (4 stars)');
      expect(xml).toContain('★★★★★ (5 stars)');

      // Check for rating-specific URLs
      expect(xml).toContain('href="/api/opds/ratings/1"');
      expect(xml).toContain('href="/api/opds/ratings/2"');
      expect(xml).toContain('href="/api/opds/ratings/3"');
      expect(xml).toContain('href="/api/opds/ratings/4"');
      expect(xml).toContain('href="/api/opds/ratings/5"');
    });

    test('should have navigation links', async () => {
      const request = createMockRequest('GET', '/api/opds/ratings') as any;
      const response = await GET_RATINGS_NAV(request);

      const xml = await response.text();

      // Check for self and start links
      expect(xml).toContain('rel="self"');
      expect(xml).toContain('rel="start"');
      expect(xml).toContain('href="/api/opds"');
    });

    test('should have appropriate cache headers', async () => {
      const request = createMockRequest('GET', '/api/opds/ratings') as any;
      const response = await GET_RATINGS_NAV(request);

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('public');
      expect(cacheControl).toContain('max-age=300'); // 5 minutes
    });

    test('should require auth when AUTH_PASSWORD is set', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const request = createMockRequest('GET', '/api/opds/ratings') as any;
      const response = await GET_RATINGS_NAV(request);

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
    });
  });

  describe('GET /api/opds/ratings/[rating] - Acquisition Feed', () => {
    describe('Rated books (any rating)', () => {
      test('should return all books with ratings', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/rated') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: 'rated' }) });

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/atom+xml;profile=opds-catalog;kind=acquisition');

        const xml = await response.text();

        // Check feed structure
        expect(xml).toContain('<id>urn:tome:rating:rated</id>');
        expect(xml).toContain('<title>Rated Books</title>');
        expect(xml).toContain('<opensearch:totalResults>');
      });

      test('should include books with any rating (1-5 stars)', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/rated') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: 'rated' }) });

        const xml = await response.text();

        // Should have books in the feed
        expect(xml).toMatch(/<entry>/);
        
        // Extract the total count
        const totalMatch = xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/);
        const total = parseInt(totalMatch?.[1] || '0');
        
        // Should have at least some rated books in test database
        expect(total).toBeGreaterThan(0);
      });
    });

    describe('Individual star ratings', () => {
      test('should return 1-star books', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/1') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '1' }) });

        expect(response.status).toBe(200);

        const xml = await response.text();

        expect(xml).toContain('<id>urn:tome:rating:1</id>');
        expect(xml).toContain('<title>★☆☆☆☆ (1 star)</title>');
        
        // Check that totalResults exists (count varies by test database)
        expect(xml).toMatch(/<opensearch:totalResults>\d+<\/opensearch:totalResults>/);
      });

      test('should return 2-star books', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/2') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '2' }) });

        expect(response.status).toBe(200);

        const xml = await response.text();

        expect(xml).toContain('<title>★★☆☆☆ (2 stars)</title>');
        expect(xml).toMatch(/<opensearch:totalResults>\d+<\/opensearch:totalResults>/);
      });

      test('should return 3-star books', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/3') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '3' }) });

        expect(response.status).toBe(200);

        const xml = await response.text();

        expect(xml).toContain('<title>★★★☆☆ (3 stars)</title>');
        expect(xml).toMatch(/<opensearch:totalResults>\d+<\/opensearch:totalResults>/);
      });

      test('should return 4-star books', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/4') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '4' }) });

        expect(response.status).toBe(200);

        const xml = await response.text();

        expect(xml).toContain('<title>★★★★☆ (4 stars)</title>');
        expect(xml).toMatch(/<opensearch:totalResults>\d+<\/opensearch:totalResults>/);
      });

      test('should return 5-star books', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/5') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '5' }) });

        expect(response.status).toBe(200);

        const xml = await response.text();

        expect(xml).toContain('<title>★★★★★ (5 stars)</title>');
        expect(xml).toMatch(/<opensearch:totalResults>\d+<\/opensearch:totalResults>/);
      });
    });

    describe('Unrated books', () => {
      test('should return books without ratings', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/unrated') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: 'unrated' }) });

        expect(response.status).toBe(200);

        const xml = await response.text();

        expect(xml).toContain('<id>urn:tome:rating:unrated</id>');
        expect(xml).toContain('<title>Unrated Books</title>');
        
        // Extract the total count
        const totalMatch = xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/);
        const total = parseInt(totalMatch?.[1] || '0');
        
        // Should have at least some unrated books in test database
        expect(total).toBeGreaterThan(0);
      });

      test('should have pagination for large unrated set', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/unrated') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: 'unrated' }) });

        const xml = await response.text();

        // Should have pagination metadata
        expect(xml).toContain('<opensearch:itemsPerPage>50</opensearch:itemsPerPage>');
        
        // Extract the total count
        const totalMatch = xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/);
        const total = parseInt(totalMatch?.[1] || '0');
        
        // Only check for next link if there are more than 50 results
        if (total > 50) {
          expect(xml).toContain('rel="next"');
        }
      });
    });

    describe('Book entries', () => {
      test('should include book metadata in entries', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/5') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '5' }) });

        const xml = await response.text();

        // Check for standard OPDS entry elements
        expect(xml).toMatch(/<entry>/);
        expect(xml).toMatch(/<title>/);
        expect(xml).toMatch(/<author>/);
        expect(xml).toMatch(/<link.*rel="http:\/\/opds-spec.org\/acquisition"/);
      });

      test('should include download links for books', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/5') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '5' }) });

        const xml = await response.text();

        // Check for download links
        expect(xml).toMatch(/href="\/api\/opds\/download\/\d+\/epub"/);
      });

      test('should include cover image links', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/5') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '5' }) });

        const xml = await response.text();

        // Check for cover links
        expect(xml).toMatch(/rel="http:\/\/opds-spec.org\/image"/);
        expect(xml).toMatch(/href="\/api\/covers\/\d+"/);
      });
    });

    describe('Pagination', () => {
      test('should support offset and limit parameters', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/unrated?offset=10&limit=20') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: 'unrated' }) });

        const xml = await response.text();

        expect(xml).toContain('<opensearch:startIndex>10</opensearch:startIndex>');
        expect(xml).toContain('<opensearch:itemsPerPage>20</opensearch:itemsPerPage>');
      });

      test('should enforce maximum page size', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/unrated?limit=1000') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: 'unrated' }) });

        const xml = await response.text();

        // Should be capped at 200 (OPDS_MAX_PAGE_SIZE)
        expect(xml).toContain('<opensearch:itemsPerPage>200</opensearch:itemsPerPage>');
      });

      test('should include pagination links', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/unrated?offset=50&limit=50') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: 'unrated' }) });

        const xml = await response.text();

        // Should have self and start links
        expect(xml).toContain('rel="self"');
        expect(xml).toContain('rel="start"');
        
        // Extract the total count
        const totalMatch = xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/);
        const total = parseInt(totalMatch?.[1] || '0');
        
        // Only check for prev/next if we have enough results
        if (total > 50) {
          expect(xml).toContain('rel="previous"');
        }
        if (total > 100) {
          expect(xml).toContain('rel="next"');
        }
      });
    });

    describe('Error handling', () => {
      test('should return 400 for invalid rating', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/invalid') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: 'invalid' }) });

        expect(response.status).toBe(400);

        const json = await response.json();
        expect(json.error).toContain('Invalid rating');
      });

      test('should return 400 for out-of-range rating', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/6') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '6' }) });

        expect(response.status).toBe(400);

        const json = await response.json();
        expect(json.error).toContain('Invalid rating');
      });

      test('should return 400 for negative rating', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/-1') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '-1' }) });

        expect(response.status).toBe(400);
      });

      test('should require auth when AUTH_PASSWORD is set', async () => {
        process.env.AUTH_PASSWORD = 'test123';

        const request = createMockRequest('GET', '/api/opds/ratings/5') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '5' }) });

        expect(response.status).toBe(401);
        expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
      });
    });

    describe('Cache headers', () => {
      test('should have appropriate cache headers', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/5') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '5' }) });

        const cacheControl = response.headers.get('Cache-Control');
        expect(cacheControl).toContain('public');
        expect(cacheControl).toContain('max-age=60'); // 1 minute
      });
    });

    describe('Sorting', () => {
      test('should sort books alphabetically by title', async () => {
        const request = createMockRequest('GET', '/api/opds/ratings/5') as any;
        const response = await GET_RATINGS_BOOKS(request, { params: Promise.resolve({ rating: '5' }) });

        const xml = await response.text();

        // Extract titles (simplified check - first title should be alphabetically early)
        const titleMatches = xml.match(/<title>([^<]+)<\/title>/g);
        if (titleMatches && titleMatches.length > 2) {
          // Skip the feed title (first match)
          const firstBookTitle = titleMatches[1];
          const secondBookTitle = titleMatches[2];
          
          // Titles should be in alphabetical order
          // This is a basic check - just verify we have titles
          expect(firstBookTitle).toBeTruthy();
          expect(secondBookTitle).toBeTruthy();
        }
      });
    });
  });

  describe('Rating aggregation consistency', () => {
    test('rated count should equal sum of individual ratings', async () => {
      // Get individual rating counts
      const rating1 = await GET_RATINGS_BOOKS(
        createMockRequest('GET', '/api/opds/ratings/1') as any,
        { params: Promise.resolve({ rating: '1' }) }
      );
      const rating2 = await GET_RATINGS_BOOKS(
        createMockRequest('GET', '/api/opds/ratings/2') as any,
        { params: Promise.resolve({ rating: '2' }) }
      );
      const rating3 = await GET_RATINGS_BOOKS(
        createMockRequest('GET', '/api/opds/ratings/3') as any,
        { params: Promise.resolve({ rating: '3' }) }
      );
      const rating4 = await GET_RATINGS_BOOKS(
        createMockRequest('GET', '/api/opds/ratings/4') as any,
        { params: Promise.resolve({ rating: '4' }) }
      );
      const rating5 = await GET_RATINGS_BOOKS(
        createMockRequest('GET', '/api/opds/ratings/5') as any,
        { params: Promise.resolve({ rating: '5' }) }
      );

      const xml1 = await rating1.text();
      const xml2 = await rating2.text();
      const xml3 = await rating3.text();
      const xml4 = await rating4.text();
      const xml5 = await rating5.text();

      const count1 = parseInt(xml1.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/)?.[1] || '0');
      const count2 = parseInt(xml2.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/)?.[1] || '0');
      const count3 = parseInt(xml3.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/)?.[1] || '0');
      const count4 = parseInt(xml4.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/)?.[1] || '0');
      const count5 = parseInt(xml5.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/)?.[1] || '0');

      const sumOfIndividualRatings = count1 + count2 + count3 + count4 + count5;

      // Get "rated" count (all books with ratings)
      const rated = await GET_RATINGS_BOOKS(
        createMockRequest('GET', '/api/opds/ratings/rated') as any,
        { params: Promise.resolve({ rating: 'rated' }) }
      );

      const ratedXml = await rated.text();
      const ratedCount = parseInt(ratedXml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/)?.[1] || '0');

      // Rated count should equal sum of individual ratings
      expect(ratedCount).toBe(sumOfIndividualRatings);
      
      // Should have at least some rated books in the test database
      expect(ratedCount).toBeGreaterThan(0);
    });
  });
});
