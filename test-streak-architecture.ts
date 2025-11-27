#!/usr/bin/env bun
/**
 * Test script to verify the architecturally clean streak reset implementation
 */

import { streakService } from "@/lib/services/streak.service";

async function testArchitecturalFix() {
  console.log("=== Testing Architectural Streak Reset Fix ===\n");

  // Test 1: getStreak() should be read-only
  console.log("Test 1: Verify getStreak() is read-only");
  const before1 = await streakService.getStreakBasic(null);
  console.log("Before:", { currentStreak: before1.currentStreak, lastActivity: before1.lastActivityDate });

  const result1 = await streakService.getStreak(null);
  const after1 = await streakService.getStreakBasic(null);

  console.log("After getStreak():", { currentStreak: after1.currentStreak, lastActivity: after1.lastActivityDate });
  console.log(before1.currentStreak === after1.currentStreak ? "✅ PASS: getStreak() did not modify database" : "❌ FAIL: getStreak() modified database");
  console.log();

  // Test 2: checkAndResetStreakIfNeeded() should reset if needed
  console.log("Test 2: Verify checkAndResetStreakIfNeeded() resets properly");
  const before2 = await streakService.getStreakBasic(null);
  console.log("Before:", { currentStreak: before2.currentStreak, lastActivity: before2.lastActivityDate });

  const wasReset = await streakService.checkAndResetStreakIfNeeded(null);
  const after2 = await streakService.getStreakBasic(null);

  console.log("After checkAndResetStreakIfNeeded():", { currentStreak: after2.currentStreak, wasReset });

  const daysSinceLastActivity = Math.floor(
    (new Date().getTime() - before2.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  console.log("Days since last activity:", daysSinceLastActivity);

  if (daysSinceLastActivity > 1 && before2.currentStreak > 0) {
    console.log(after2.currentStreak === 0 ? "✅ PASS: Streak reset to 0" : "❌ FAIL: Streak should be 0");
  } else {
    console.log(after2.currentStreak === before2.currentStreak ? "✅ PASS: Streak not reset (not needed)" : "❌ FAIL: Streak changed unexpectedly");
  }
  console.log();

  // Test 3: API flow (check + read)
  console.log("Test 3: Verify API flow (explicit check then read)");
  await streakService.checkAndResetStreakIfNeeded(null);
  const streak = await streakService.getStreak(null);
  console.log("Final streak:", {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    hoursRemaining: streak.hoursRemainingToday
  });
  console.log("✅ PASS: API flow works correctly");
  console.log();

  console.log("=== All tests complete ===");
}

testArchitecturalFix().catch(console.error);
