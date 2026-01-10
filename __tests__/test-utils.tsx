import { ReactElement, ReactNode } from 'react';
import { render, renderHook as originalRenderHook, RenderOptions, RenderHookOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect } from 'vitest';

/**
 * Creates a new QueryClient instance configured for testing
 * - Disables retries to make tests fail fast
 * - Disables caching for predictable test behavior
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry failed queries in tests
        gcTime: 0, // Don't cache query results in tests
      },
      mutations: {
        retry: false, // Don't retry failed mutations in tests
      },
    },
  });
}

interface AllTheProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * Wrapper component that provides all necessary providers for testing
 */
function AllTheProviders({ children, queryClient }: AllTheProvidersProps) {
  const client = queryClient || createTestQueryClient();
  
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Custom render function that wraps components with necessary providers
 * 
 * Usage:
 * ```tsx
 * import { renderWithQueryClient } from '../test-utils';
 * 
 * test('my test', () => {
 *   const { getByText } = renderWithQueryClient(<MyComponent />);
 *   // ... test assertions
 * });
 * ```
 */
export function renderWithQueryClient(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Custom renderHook function that wraps hooks with necessary providers
 * 
 * Usage:
 * ```tsx
 * import { renderHook } from '../test-utils';
 * 
 * test('my hook test', () => {
 *   const { result } = renderHook(() => useMyHook());
 *   // ... test assertions
 * });
 * ```
 */
export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'> & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options || {};
  
  return originalRenderHook(callback, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render and renderHook with our custom versions
export { renderWithQueryClient as render };

/**
 * Convert Date or ISO string to YYYY-MM-DD format for test fixtures
 * Uses UTC date parts to match database storage (calendar days in UTC)
 * 
 * @param date - Date object or ISO string
 * @returns YYYY-MM-DD string
 * 
 * @example
 * ```typescript
 * progressDate: toProgressDate(new Date("2024-11-15T10:30:00.000Z")) // "2024-11-15"
 * progressDate: toProgressDate("2024-11-15T10:30:00.000Z") // "2024-11-15"
 * ```
 */
export function toProgressDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert Date or ISO string to YYYY-MM-DD format for session dates
 * Alias for toProgressDate - both calendar days use same format
 * 
 * @param date - Date object or ISO string
 * @returns YYYY-MM-DD string
 * 
 * @example
 * ```typescript
 * startedDate: toSessionDate(new Date("2024-01-01")) // "2024-01-01"
 * completedDate: toSessionDate("2024-01-15") // "2024-01-15"
 * ```
 */
export function toSessionDate(date: Date | string): string {
  return toProgressDate(date);
}

/**
 * Generate consecutive date strings for testing
 * Useful for creating test fixtures with sequential dates
 * 
 * @param startDate - Starting date in YYYY-MM-DD format
 * @param count - Number of consecutive dates to generate
 * @returns Array of date strings
 * 
 * @example
 * ```typescript
 * generateDateSequence("2024-11-01", 5)
 * // ["2024-11-01", "2024-11-02", "2024-11-03", "2024-11-04", "2024-11-05"]
 * ```
 */
export function generateDateSequence(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const date = new Date(startDate + 'T00:00:00Z');
  
  for (let i = 0; i < count; i++) {
    dates.push(toProgressDate(date));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  
  return dates;
}

/**
 * Generate weekly date strings (7-day intervals)
 * Useful for testing weekly patterns in journal archives and streaks
 * 
 * @param startDate - Starting date in YYYY-MM-DD format
 * @param weeks - Number of weeks to generate
 * @returns Array of date strings separated by 7 days
 * 
 * @example
 * ```typescript
 * generateWeeklyDates("2024-11-01", 5)
 * // ["2024-11-01", "2024-11-08", "2024-11-15", "2024-11-22", "2024-11-29"]
 * ```
 */
export function generateWeeklyDates(startDate: string, weeks: number): string[] {
  const dates: string[] = [];
  const date = new Date(startDate + 'T00:00:00Z');
  
  for (let i = 0; i < weeks; i++) {
    dates.push(toProgressDate(date));
    date.setUTCDate(date.getUTCDate() + 7);
  }
  
  return dates;
}

/**
 * Format any date value to YYYY-MM-DD string for assertions
 * Handles Date objects, strings, null, and undefined
 * 
 * @param date - Date value to format
 * @returns Formatted date string or null
 * 
 * @example
 * ```typescript
 * toDateString(new Date("2024-11-15")) // "2024-11-15"
 * toDateString("2024-11-15") // "2024-11-15"
 * toDateString(null) // null
 * ```
 */
export function toDateString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return typeof date === 'string' ? date : toProgressDate(date);
}

/**
 * Compare database date (string or Date) with expected date string
 * Useful for assertions where database might return Date or string
 * 
 * @param actual - Actual date from database (Date or string)
 * @param expected - Expected date string in YYYY-MM-DD format
 * 
 * @example
 * ```typescript
 * expectDateToMatch(session.completedDate, "2024-11-15");
 * ```
 */
export function expectDateToMatch(actual: Date | string | null | undefined, expected: string) {
  const actualStr = toDateString(actual);
  expect(actualStr).toBe(expected);
}

/**
 * Create multiple progress logs with sequential dates
 * Useful for bulk test data creation with consistent patterns
 * 
 * @param repository - Progress repository instance
 * @param options - Configuration for progress sequence
 * @returns Array of created progress logs
 * 
 * @example
 * ```typescript
 * await createProgressSequence(progressRepository, {
 *   bookId: book.id,
 *   sessionId: session.id,
 *   startDate: "2024-01-15",
 *   startPage: 50,
 *   pageIncrement: 10,
 *   count: 12,
 *   totalPages: 300,
 * });
 * ```
 */
export async function createProgressSequence(
  repository: any, // progressRepository type
  options: {
    bookId: number;
    sessionId?: number; // Optional - may not be needed for all progress logs
    startDate: string;
    startPage: number;
    pageIncrement: number;
    count: number;
    totalPages?: number;
  }
) {
  const logs = [];
  const dates = generateDateSequence(options.startDate, options.count);
  
  for (let i = 0; i < options.count; i++) {
    const currentPage = options.startPage + (i * options.pageIncrement);
    const currentPercentage = options.totalPages 
      ? parseFloat(((currentPage / options.totalPages) * 100).toFixed(2))
      : 0;
    
    const logData: any = {
      bookId: options.bookId,
      currentPage,
      currentPercentage,
      pagesRead: options.pageIncrement,
      progressDate: dates[i],
    };
    
    if (options.sessionId !== undefined) {
      logData.sessionId = options.sessionId;
    }
    
    const log = await repository.create(logData);
    logs.push(log);
  }
  
  return logs;
}

/**
 * Create a test book with active reading session
 * Common setup pattern for many tests
 * 
 * @param bookRepository - Book repository instance
 * @param sessionRepository - Session repository instance
 * @param bookOverrides - Optional book property overrides
 * @param sessionOverrides - Optional session property overrides
 * @returns Object with created book and session
 * 
 * @example
 * ```typescript
 * const { book, session } = await createTestBookWithSession(
 *   bookRepository,
 *   sessionRepository,
 *   { title: "My Book", totalPages: 400 },
 *   { status: "reading", startedDate: "2024-01-01" }
 * );
 * ```
 */
export async function createTestBookWithSession(
  bookRepository: any,
  sessionRepository: any,
  bookOverrides?: Partial<any>,
  sessionOverrides?: Partial<any>
) {
  const book = await bookRepository.create({
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    tags: [],
    path: "Test Author/Test Book (1)",
    orphaned: false,
    ...bookOverrides,
  });
  
  const session = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 1,
    status: "to-read",
    isActive: true,
    userId: null,
    ...sessionOverrides,
  });
  
  return { book, session };
}
