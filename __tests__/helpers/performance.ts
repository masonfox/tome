/**
 * Test Performance Monitoring
 *
 * Tracks and reports slow tests to help identify performance bottlenecks.
 */

interface TestTiming {
  name: string;
  duration: number;
  file: string;
}

const testTimings: TestTiming[] = [];
const SLOW_TEST_THRESHOLD_MS = 1000; // 1 second

/**
 * Enable performance monitoring for tests
 * Call this in beforeEach() to track individual test durations
 *
 * @param testFilePath - Path to the test file (use __filename)
 */
export function enablePerformanceMonitoring(testFilePath: string) {
  const startTimes = new Map<string, number>();

  // Track test start time
  beforeEach(() => {
    const testName = expect.getState().currentTestName || 'unknown';
    startTimes.set(testName, performance.now());
  });

  // Calculate and log duration after each test
  afterEach(() => {
    const testName = expect.getState().currentTestName || 'unknown';
    const startTime = startTimes.get(testName);

    if (startTime !== undefined) {
      const duration = performance.now() - startTime;

      // Record timing
      testTimings.push({
        name: testName,
        duration,
        file: testFilePath,
      });

      // Warn about slow tests
      if (duration > SLOW_TEST_THRESHOLD_MS) {
        console.warn(
          `⚠️  Slow test detected: "${testName}" took ${duration.toFixed(2)}ms ` +
          `(threshold: ${SLOW_TEST_THRESHOLD_MS}ms)`
        );
      }

      startTimes.delete(testName);
    }
  });
}

/**
 * Get performance summary for all tests
 * Useful for CI reporting or post-test analysis
 */
export function getPerformanceSummary(): {
  totalTests: number;
  slowTests: TestTiming[];
  averageDuration: number;
  totalDuration: number;
  slowestTest: TestTiming | null;
} {
  const slowTests = testTimings.filter(t => t.duration > SLOW_TEST_THRESHOLD_MS);
  const totalDuration = testTimings.reduce((sum, t) => sum + t.duration, 0);
  const averageDuration = testTimings.length > 0 ? totalDuration / testTimings.length : 0;
  const slowestTest = testTimings.length > 0
    ? testTimings.reduce((slowest, current) =>
        current.duration > slowest.duration ? current : slowest
      )
    : null;

  return {
    totalTests: testTimings.length,
    slowTests,
    averageDuration,
    totalDuration,
    slowestTest,
  };
}

/**
 * Print performance summary to console
 * Call this in afterAll() of your main test file or test runner
 */
export function printPerformanceSummary(): void {
  const summary = getPerformanceSummary();

  console.log('\n📊 Test Performance Summary');
  console.log('═'.repeat(60));
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Total Duration: ${summary.totalDuration.toFixed(2)}ms`);
  console.log(`Average Duration: ${summary.averageDuration.toFixed(2)}ms`);

  if (summary.slowestTest) {
    console.log(`\nSlowest Test: "${summary.slowestTest.name}"`);
    console.log(`  Duration: ${summary.slowestTest.duration.toFixed(2)}ms`);
    console.log(`  File: ${summary.slowestTest.file}`);
  }

  if (summary.slowTests.length > 0) {
    console.log(`\n⚠️  Slow Tests (>${SLOW_TEST_THRESHOLD_MS}ms): ${summary.slowTests.length}`);

    // Sort by duration descending and show top 10
    const topSlowTests = summary.slowTests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    topSlowTests.forEach((test, index) => {
      console.log(
        `  ${index + 1}. ${test.duration.toFixed(2)}ms - ${test.name} ` +
        `(${test.file.split('/').pop()})`
      );
    });

    if (summary.slowTests.length > 10) {
      console.log(`  ... and ${summary.slowTests.length - 10} more`);
    }
  } else {
    console.log(`\n✅ No slow tests detected (all < ${SLOW_TEST_THRESHOLD_MS}ms)`);
  }

  console.log('═'.repeat(60));
}

/**
 * Clear all recorded timings
 * Useful for resetting between test runs
 */
export function clearPerformanceData(): void {
  testTimings.length = 0;
}

/**
 * Set custom slow test threshold
 * @param thresholdMs - Threshold in milliseconds
 */
export function setSlowTestThreshold(thresholdMs: number): void {
  if (thresholdMs <= 0) {
    throw new Error('Slow test threshold must be greater than 0');
  }
  Object.defineProperty(exports, 'SLOW_TEST_THRESHOLD_MS', {
    value: thresholdMs,
    writable: false,
  });
}

/**
 * Export test timings as JSON for external analysis
 * @returns JSON string of all test timings
 */
export function exportTimingsAsJSON(): string {
  return JSON.stringify({
    summary: getPerformanceSummary(),
    allTimings: testTimings,
    timestamp: new Date().toISOString(),
  }, null, 2);
}
