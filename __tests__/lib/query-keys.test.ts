import { describe, test, expect } from 'vitest';
import { queryKeys, type AnalyticsDays } from '@/lib/query-keys';

describe('queryKeys', () => {
  describe('book keys', () => {
    test('should generate base key for all books', () => {
      expect(queryKeys.book.base()).toEqual(['book']);
    });

    test('should generate detail key with book ID', () => {
      expect(queryKeys.book.detail(123)).toEqual(['book', 123]);
    });

    test('should generate available tags key', () => {
      expect(queryKeys.book.availableTags()).toEqual(['availableTags']);
    });

    test('should generate available shelves key', () => {
      expect(queryKeys.book.availableShelves()).toEqual(['availableShelves']);
    });

    test('should generate book shelves key with book ID', () => {
      expect(queryKeys.book.shelves(456)).toEqual(['bookShelves', 456]);
    });
  });

  describe('library keys', () => {
    test('should generate library books key', () => {
      expect(queryKeys.library.books()).toEqual(['library-books']);
    });
  });

  describe('sessions keys', () => {
    test('should generate sessions by book key', () => {
      expect(queryKeys.sessions.byBook(123)).toEqual(['sessions', 123]);
    });

    test('should generate session progress key', () => {
      expect(queryKeys.sessions.progress(789)).toEqual(['session-progress', 789]);
    });
  });

  describe('progress keys', () => {
    test('should generate progress by book key', () => {
      expect(queryKeys.progress.byBook(123)).toEqual(['progress', 123]);
    });
  });

  describe('streak keys', () => {
    test('should generate base streak key', () => {
      expect(queryKeys.streak.base()).toEqual(['streak']);
    });

    test('should generate streak settings key', () => {
      expect(queryKeys.streak.settings()).toEqual(['streak', 'settings']);
    });

    test('should generate streak analytics key with numeric days', () => {
      expect(queryKeys.streak.analytics(7)).toEqual(['streak', 'analytics', 7]);
      expect(queryKeys.streak.analytics(30)).toEqual(['streak', 'analytics', 30]);
      expect(queryKeys.streak.analytics(90)).toEqual(['streak', 'analytics', 90]);
      expect(queryKeys.streak.analytics(180)).toEqual(['streak', 'analytics', 180]);
      expect(queryKeys.streak.analytics(365)).toEqual(['streak', 'analytics', 365]);
    });

    test('should generate streak analytics key with string periods', () => {
      expect(queryKeys.streak.analytics('this-year')).toEqual(['streak', 'analytics', 'this-year']);
      expect(queryKeys.streak.analytics('all-time')).toEqual(['streak', 'analytics', 'all-time']);
    });

    test('should generate streak heatmap key', () => {
      expect(queryKeys.streak.heatmap(7)).toEqual(['streak', 'analytics', 'heatmap', 7]);
      expect(queryKeys.streak.heatmap(30)).toEqual(['streak', 'analytics', 'heatmap', 30]);
      expect(queryKeys.streak.heatmap(90)).toEqual(['streak', 'analytics', 'heatmap', 90]);
      expect(queryKeys.streak.heatmap(180)).toEqual(['streak', 'analytics', 'heatmap', 180]);
      expect(queryKeys.streak.heatmap(365)).toEqual(['streak', 'analytics', 'heatmap', 365]);
    });
  });

  describe('goals keys', () => {
    test('should generate base goals key', () => {
      expect(queryKeys.goals.base()).toEqual(['goals']);
    });

    test('should generate reading goal by year key', () => {
      expect(queryKeys.goals.byYear(2024)).toEqual(['reading-goal', 2024]);
    });

    test('should generate monthly breakdown key', () => {
      expect(queryKeys.goals.monthlyBreakdown(2024)).toEqual(['monthly-breakdown', 2024]);
    });

    test('should generate completed books key', () => {
      expect(queryKeys.goals.completedBooks(2024)).toEqual(['completed-books', 2024]);
    });
  });

  describe('shelf keys', () => {
    test('should generate base shelf key', () => {
      expect(queryKeys.shelf.base()).toEqual(['shelf']);
    });

    test('should generate shelf by ID key', () => {
      expect(queryKeys.shelf.byId(42)).toEqual(['shelf', 42]);
    });

    test('should generate shelf detail with default options', () => {
      expect(queryKeys.shelf.detail(42, {})).toEqual([
        'shelf',
        42,
        'books',
        {},
      ]);
    });

    test('should generate shelf detail with sorting options', () => {
      expect(queryKeys.shelf.detail(42, { orderBy: 'title', direction: 'asc' })).toEqual([
        'shelf',
        42,
        'books',
        { orderBy: 'title', direction: 'asc' },
      ]);

      expect(queryKeys.shelf.detail(42, { orderBy: 'authors', direction: 'desc' })).toEqual([
        'shelf',
        42,
        'books',
        { orderBy: 'authors', direction: 'desc' },
      ]);
    });
  });

  describe('series keys', () => {
    test('should generate all series key', () => {
      expect(queryKeys.series.all()).toEqual(['series']);
    });

    test('should generate series detail by name', () => {
      expect(queryKeys.series.detail('The Lord of the Rings')).toEqual([
        'series',
        'The Lord of the Rings',
      ]);
    });
  });

  describe('readNext keys', () => {
    test('should generate base read next key', () => {
      expect(queryKeys.readNext.base()).toEqual(['read-next-books']);
    });

    test('should generate read next books key without search', () => {
      expect(queryKeys.readNext.books()).toEqual(['read-next-books', undefined]);
    });

    test('should generate read next books key with search', () => {
      expect(queryKeys.readNext.books('tolkien')).toEqual(['read-next-books', 'tolkien']);
    });
  });

  describe('journal keys', () => {
    test('should generate journal entries key with timezone', () => {
      expect(queryKeys.journal.entries('America/New_York')).toEqual([
        'journal-entries',
        'America/New_York',
      ]);
    });

    test('should generate journal archive key with timezone', () => {
      expect(queryKeys.journal.archive('Europe/London')).toEqual([
        'journal-archive',
        'Europe/London',
      ]);
    });
  });

  describe('tags keys', () => {
    test('should generate base tags key', () => {
      expect(queryKeys.tags.base()).toEqual(['tags']);
    });

    test('should generate tag books key', () => {
      expect(queryKeys.tags.books(123)).toEqual(['tag-books', 123]);
    });
  });

  describe('dashboard keys', () => {
    test('should generate dashboard all key', () => {
      expect(queryKeys.dashboard.all()).toEqual(['dashboard']);
    });
  });

  describe('stats keys', () => {
    test('should generate stats all key', () => {
      expect(queryKeys.stats.all()).toEqual(['stats']);
    });
  });

  describe('version keys', () => {
    test('should generate version info key', () => {
      expect(queryKeys.version.info()).toEqual(['version']);
    });
  });

  describe('type safety', () => {
    test('should maintain const types for all keys', () => {
      // Ensure keys are readonly arrays (const assertions)
      const bookBase = queryKeys.book.base();
      const bookDetail = queryKeys.book.detail(1);
      const streakAnalytics = queryKeys.streak.analytics(7);

      // TypeScript will enforce these are readonly at compile time
      // At runtime, we can verify they're arrays
      expect(Array.isArray(bookBase)).toBe(true);
      expect(Array.isArray(bookDetail)).toBe(true);
      expect(Array.isArray(streakAnalytics)).toBe(true);
    });

    test('should handle all valid AnalyticsDays values', () => {
      const validDays: AnalyticsDays[] = [7, 30, 90, 180, 365, 'this-year', 'all-time'];

      validDays.forEach((days) => {
        const key = queryKeys.streak.analytics(days);
        expect(key).toEqual(['streak', 'analytics', days]);
      });
    });
  });

  describe('key collision prevention', () => {
    test('should generate unique keys for different entities', () => {
      // Book detail vs sessions by book should be different
      expect(queryKeys.book.detail(123)).not.toEqual(queryKeys.sessions.byBook(123));

      // Streak analytics vs heatmap should be different
      expect(queryKeys.streak.analytics(7)).not.toEqual(queryKeys.streak.heatmap(7));

      // Different search terms should generate different keys
      expect(queryKeys.readNext.books('search1')).not.toEqual(
        queryKeys.readNext.books('search2')
      );
    });

    test('should allow wildcard invalidation via base keys', () => {
      // Base keys should be prefixes of specific keys
      const bookBase = queryKeys.book.base();
      const bookDetail = queryKeys.book.detail(123);

      expect(bookDetail[0]).toBe(bookBase[0]);

      const streakBase = queryKeys.streak.base();
      const streakAnalytics = queryKeys.streak.analytics(7);

      expect(streakAnalytics[0]).toBe(streakBase[0]);
    });
  });

  describe('hierarchical structure', () => {
    test('should maintain consistent hierarchy for book queries', () => {
      // All book queries should start with 'book'
      expect(queryKeys.book.base()[0]).toBe('book');
      expect(queryKeys.book.detail(1)[0]).toBe('book');
    });

    test('should maintain consistent hierarchy for streak queries', () => {
      // All streak queries should start with 'streak'
      expect(queryKeys.streak.base()[0]).toBe('streak');
      expect(queryKeys.streak.settings()[0]).toBe('streak');
      expect(queryKeys.streak.analytics(7)[0]).toBe('streak');
      expect(queryKeys.streak.heatmap(7)[0]).toBe('streak');
    });

    test('should maintain consistent hierarchy for shelf queries', () => {
      // All shelf queries should start with 'shelf'
      expect(queryKeys.shelf.base()[0]).toBe('shelf');
      expect(queryKeys.shelf.byId(1)[0]).toBe('shelf');
      expect(queryKeys.shelf.detail(1, {})[0]).toBe('shelf');
    });

    test('should differentiate between analytics and heatmap queries', () => {
      const analytics = queryKeys.streak.analytics(7);
      const heatmap = queryKeys.streak.heatmap(7);

      // Both should start with 'streak' and 'analytics'
      expect(analytics[0]).toBe('streak');
      expect(analytics[1]).toBe('analytics');

      expect(heatmap[0]).toBe('streak');
      expect(heatmap[1]).toBe('analytics');

      // But heatmap should have 'heatmap' as third element
      expect(heatmap[2]).toBe('heatmap');
    });
  });

  describe('edge cases', () => {
    test('should handle zero as valid ID', () => {
      expect(queryKeys.book.detail(0)).toEqual(['book', 0]);
      expect(queryKeys.shelf.byId(0)).toEqual(['shelf', 0]);
    });

    test('should handle negative IDs', () => {
      expect(queryKeys.book.detail(-1)).toEqual(['book', -1]);
      expect(queryKeys.sessions.byBook(-999)).toEqual(['sessions', -999]);
    });

    test('should handle empty strings', () => {
      expect(queryKeys.series.detail('')).toEqual(['series', '']);
      expect(queryKeys.readNext.books('')).toEqual(['read-next-books', '']);
    });

    test('should handle special characters in series names', () => {
      expect(queryKeys.series.detail('The Hitchhiker\'s Guide')).toEqual([
        'series',
        'The Hitchhiker\'s Guide',
      ]);

      expect(queryKeys.series.detail('Series (2024)')).toEqual(['series', 'Series (2024)']);
    });

    test('should handle large year values', () => {
      expect(queryKeys.goals.byYear(9999)).toEqual(['reading-goal', 9999]);
      expect(queryKeys.goals.monthlyBreakdown(2100)).toEqual(['monthly-breakdown', 2100]);
    });
  });
});
