/**
 * Example: How to use performance monitoring in tests
 *
 * This file demonstrates the usage patterns for test performance monitoring.
 * Copy these patterns into your actual test files.
 */

import { beforeEach, afterEach, beforeAll, afterAll, test, expect } from 'bun:test';
import { enablePerformanceMonitoring, printPerformanceSummary } from './performance';

// Example 1: Basic usage - track all tests in a file
beforeEach(() => {
  enablePerformanceMonitoring(__filename);
});

// Example 2: Print summary after all tests complete
afterAll(() => {
  printPerformanceSummary();
});

// Example test
test('example test', async () => {
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(true).toBe(true);
});

/**
 * Example 3: Custom threshold for specific test files
 *
 * Some test files may have legitimately slower tests (e.g., integration tests).
 * You can set a custom threshold:
 */
/*
import { setSlowTestThreshold } from './performance';

beforeAll(() => {
  setSlowTestThreshold(5000); // 5 seconds for integration tests
});
*/

/**
 * Example 4: Export timings for CI reporting
 *
 * In your CI pipeline, you can export timings for trend analysis:
 */
/*
import { exportTimingsAsJSON } from './performance';
import { writeFileSync } from 'fs';

afterAll(() => {
  const timings = exportTimingsAsJSON();
  writeFileSync('./test-performance.json', timings);
});
*/

/**
 * Example 5: Conditional monitoring (only in CI)
 */
/*
if (process.env.CI) {
  beforeEach(() => {
    enablePerformanceMonitoring(__filename);
  });

  afterAll(() => {
    printPerformanceSummary();
  });
}
*/
