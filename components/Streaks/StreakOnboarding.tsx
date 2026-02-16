"use client";

import { useState } from "react";
import { Flame, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/Utilities/Button";
import { toast } from "sonner";
import { useStreak } from "@/hooks/useStreak";

export function StreakOnboarding() {
  const [dailyGoal, setDailyGoal] = useState(10);
  const { enableStreak, isEnablingStreak } = useStreak();

  function handleEnable() {
    if (dailyGoal < 1 || dailyGoal > 9999) {
      toast.error("Daily goal must be between 1 and 9999 pages");
      return;
    }

    enableStreak({ streakEnabled: true, dailyThreshold: dailyGoal });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full mb-4">
          <Flame className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-[var(--heading-text)]">
          Build a Reading Habit
        </h1>
        <p className="text-lg text-[var(--subheading-text)] max-w-2xl mx-auto">
          Track your daily reading progress and build consistency with streak tracking.
          Set a daily page goal and watch your streak grow as you read every day.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6 space-y-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[var(--heading-text)]">
            Daily Streaks
          </h3>
          <p className="text-sm text-[var(--subheading-text)]">
            Build momentum by reading consistently. Track your current streak and all-time best.
          </p>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6 space-y-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Target className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[var(--heading-text)]">
            Custom Goals
          </h3>
          <p className="text-sm text-[var(--subheading-text)]">
            Set a daily page goal that works for you. Start small and adjust anytime.
          </p>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6 space-y-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[var(--heading-text)]">
            Progress Insights
          </h3>
          <p className="text-sm text-[var(--subheading-text)]">
            Visualize your reading patterns with charts and see your active reading days.
          </p>
        </div>
      </div>

      {/* Setup Section */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)]">
            Set Your Daily Goal
          </h2>
          <p className="text-[var(--subheading-text)]">
            Choose how many pages you want to read each day. You can change this later.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="daily-goal"
              className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2"
            >
              Pages per day
            </label>
            <div className="flex gap-4 items-start">
              <input
                id="daily-goal"
                type="number"
                min="1"
                max="9999"
                value={dailyGoal}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setDailyGoal(isNaN(val) ? 1 : val);
                }}
                className="flex-1 px-4 py-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm text-[var(--foreground)] text-lg font-medium focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent"
                disabled={isEnablingStreak}
              />
            </div>
            <p className="text-xs text-[var(--subheading-text)] mt-2">
              Suggested: 10-20 pages for casual readers, 30-50 for regular readers
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleEnable}
              disabled={isEnablingStreak}
              variant="primary"
              size="lg"
              fullWidth
            >
              {isEnablingStreak ? "Enabling..." : "Enable Streak Tracking"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
