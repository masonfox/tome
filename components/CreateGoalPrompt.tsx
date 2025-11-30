"use client";

import Link from "next/link";

export function CreateGoalPrompt() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Set Your {currentYear} Reading Goal
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Track your reading progress and stay motivated throughout the year.
        </p>
        <Link
          href="/settings"
          className="inline-block px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-md hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors font-medium text-sm"
        >
          Create Goal
        </Link>
      </div>
    </div>
  );
}
