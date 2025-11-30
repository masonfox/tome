import { NextRequest, NextResponse } from "next/server";
import { streakService } from "@/lib/services/streak.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

/**
 * POST /api/streak/rebuild
 * Rebuild streak from all historical progress data
 * Useful for fixing streak calculation issues or after data changes
 */
export async function POST() {
  try {
    logger.info("[API] Rebuilding streak from all progress data");
    const streak = await streakService.rebuildStreak(null);
    
    logger.info({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalDaysActive: streak.totalDaysActive,
    }, "[API] Streak rebuilt successfully");
    
    return NextResponse.json({ 
      success: true, 
      data: streak,
      message: "Streak rebuilt from all progress data"
    });
  } catch (error) {
    logger.error({ error }, "Failed to rebuild streak");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred while rebuilding streak",
        },
      },
      { status: 500 }
    );
  }
}
