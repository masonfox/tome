import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { updateStreaks, getStreak, getOrCreateStreak } from "@/lib/streaks";
import Streak from "@/models/Streak";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { mockStreakInitial, createTestDate } from "@/__tests__/fixtures/test-data";
import { startOfDay } from "date-fns";

/**
 * Streak Logic Tests
 * Using real MongoDB (mongodb-memory-server) for accurate testing
 */

describe("updateStreaks", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  test("creates new streak when no existing streak found", async () => {
    // Act
    const result = await updateStreaks();

    // Assert
    expect(result).toBeDefined();
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);

    // Verify it was saved to database
    const found = await Streak.findById(result._id);
    expect(found).toBeDefined();
  });

  test("initializes streak to 1 when currentStreak is 0 on same day", async () => {
    // Arrange - Create streak with 0 values (edge case from getOrCreateStreak)
    const existingStreak = await Streak.create({
      userId: null,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: startOfDay(new Date()),
      streakStartDate: startOfDay(new Date()),
      totalDaysActive: 0,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);
  });

  test("returns unchanged streak when activity on same day with existing streak", async () => {
    // Arrange - Create active streak from today
    await Streak.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: startOfDay(new Date()),
      streakStartDate: createTestDate(5),
      totalDaysActive: 15,
    });

    // Act
    const result = await updateStreaks();

    // Assert - Should return without changes
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(10);
    expect(result.totalDaysActive).toBe(15);
  });

  test("initializes streak when daysDiff is 1 but currentStreak is 0", async () => {
    // Arrange - Streak created yesterday with 0 values
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await Streak.create({
      userId: null,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: yesterday,
      streakStartDate: yesterday,
      totalDaysActive: 0,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.totalDaysActive).toBe(1);
  });

  test("increments streak on consecutive day activity", async () => {
    // Arrange - Active streak from yesterday
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sixDaysAgo = new Date(today);
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    await Streak.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: yesterday,
      streakStartDate: sixDaysAgo,
      totalDaysActive: 15,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(10); // Unchanged, not a new record
    expect(result.totalDaysActive).toBe(16);
  });

  test("updates longestStreak when current exceeds it", async () => {
    // Arrange - Current streak about to exceed longest
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const elevenDaysAgo = new Date(today);
    elevenDaysAgo.setDate(elevenDaysAgo.getDate() - 11);

    await Streak.create({
      userId: null,
      currentStreak: 10,
      longestStreak: 10,
      lastActivityDate: yesterday,
      streakStartDate: elevenDaysAgo,
      totalDaysActive: 20,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(11);
    expect(result.longestStreak).toBe(11); // Should be updated
    expect(result.totalDaysActive).toBe(21);
  });

  test("resets streak to 1 when gap is more than 1 day", async () => {
    // Arrange - Last activity was 3 days ago
    const today = startOfDay(new Date());
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    await Streak.create({
      userId: null,
      currentStreak: 7,
      longestStreak: 10,
      lastActivityDate: threeDaysAgo,
      streakStartDate: tenDaysAgo,
      totalDaysActive: 15,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.currentStreak).toBe(1); // Reset
    expect(result.longestStreak).toBe(10); // Unchanged
    expect(result.totalDaysActive).toBe(16); // Incremented
  });

  test("handles totalDaysActive = 0 on broken streak", async () => {
    // Arrange - Broken streak with no previous activity
    const today = startOfDay(new Date());
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await Streak.create({
      userId: null,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: threeDaysAgo,
      streakStartDate: threeDaysAgo,
      totalDaysActive: 0,
    });

    // Act
    const result = await updateStreaks();

    // Assert
    expect(result.totalDaysActive).toBe(1);
  });
});

describe("getStreak", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  test("returns streak when found", async () => {
    // Arrange
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    await Streak.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: today,
      streakStartDate: fiveDaysAgo,
      totalDaysActive: 15,
    });

    // Act
    const result = await getStreak();

    // Assert
    expect(result).toBeDefined();
    expect(result?.currentStreak).toBe(5);
    expect(result?.longestStreak).toBe(10);
  });

  test("returns null when streak not found", async () => {
    // Act
    const result = await getStreak();

    // Assert
    expect(result).toBeNull();
  });
});

describe("getOrCreateStreak", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  test("returns existing streak if found", async () => {
    // Arrange
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    await Streak.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: today,
      streakStartDate: fiveDaysAgo,
      totalDaysActive: 15,
    });

    // Act
    const result = await getOrCreateStreak();

    // Assert
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(10);
  });

  test("creates new streak with 0 values if not found", async () => {
    // Act
    const result = await getOrCreateStreak();

    // Assert
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.totalDaysActive).toBe(0);

    // Verify it was saved
    const found = await Streak.findById(result._id);
    expect(found).toBeDefined();
  });
});
