import { NextRequest, NextResponse } from "next/server";
import { streakRepository } from "@/lib/repositories/streak.repository";
import { streakService } from "@/lib/services/streak.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/streak/timezone
 * Update user's timezone and rebuild streak with new day boundaries
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { timezone } = body;

    if (!timezone || typeof timezone !== 'string') {
      return NextResponse.json(
        { success: false, error: { message: "Timezone is required" } },
        { status: 400 }
      );
    }

    // Validate timezone using Intl.DateTimeFormat
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      return NextResponse.json(
        { success: false, error: { message: `Invalid timezone: ${timezone}` } },
        { status: 400 }
      );
    }

    logger.info({ timezone }, "[Streak] Updating timezone");

    // Update timezone in database
    await streakRepository.setTimezone(null, timezone);

    // Rebuild streak with new timezone to recalculate day boundaries
    const updatedStreak = await streakService.rebuildStreak(null);

    logger.info(
      {
        timezone,
        currentStreak: updatedStreak.currentStreak,
        longestStreak: updatedStreak.longestStreak,
      },
      "[Streak] Timezone updated and streak rebuilt"
    );

    return NextResponse.json({
      success: true,
      data: updatedStreak,
    });
  } catch (error) {
    logger.error({ error }, "[Streak] Failed to update timezone");
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Failed to update timezone",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/streak/timezone/detect
 * Auto-detect and set timezone from client (only if using default)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timezone } = body;

    if (!timezone || typeof timezone !== 'string') {
      return NextResponse.json(
        { success: false, error: { message: "Timezone is required" } },
        { status: 400 }
      );
    }

    // Validate timezone
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      return NextResponse.json(
        { success: false, error: { message: `Invalid timezone: ${timezone}` } },
        { status: 400 }
      );
    }

    const streak = await streakRepository.getOrCreate(null);

    // Only set if still using default timezone (not customized by user)
    if (streak.userTimezone === 'America/New_York') {
      logger.info({ timezone }, "[Streak] Auto-detecting timezone on first visit");
      await streakRepository.setTimezone(null, timezone);
      
      return NextResponse.json({
        success: true,
        message: "Timezone auto-detected and set",
        data: { timezone },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Timezone already customized, skipping auto-detection",
      data: { timezone: streak.userTimezone },
    });
  } catch (error) {
    logger.error({ error }, "[Streak] Failed to auto-detect timezone");
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Failed to detect timezone",
        },
      },
      { status: 500 }
    );
  }
}
