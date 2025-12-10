import { readingGoalRepository } from "@/lib/repositories";
import type { ReadingGoal } from "@/lib/db/schema";
import { differenceInDays, addDays } from "date-fns";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export interface ProgressCalculation {
  booksCompleted: number;
  booksRemaining: number;
  completionPercentage: number;
  paceStatus: "ahead" | "on-track" | "behind";
  daysElapsed: number;
  projectedFinishDate: Date | null;
  booksAheadBehind: number;
}

export interface ReadingGoalWithProgress {
  goal: ReadingGoal;
  progress: ProgressCalculation;
}

export interface YearSummary {
  year: number;
  booksCompleted: number;
}

export class ReadingGoalsService {
  /**
   * Get goal with calculated progress
   */
  async getGoal(userId: number | null, year: number): Promise<ReadingGoalWithProgress | null> {
    const goal = await readingGoalRepository.findByUserAndYear(userId, year);
    if (!goal) return null;

    const progress = await this.calculateProgress(userId, year, goal.booksGoal);
    return { goal, progress };
  }

  /**
   * Get current year's goal
   */
  async getCurrentYearGoal(userId: number | null): Promise<ReadingGoalWithProgress | null> {
    const currentYear = new Date().getFullYear();
    return this.getGoal(userId, currentYear);
  }

  /**
   * Get all goals for a user
   */
  async getAllGoals(userId: number | null): Promise<ReadingGoal[]> {
    return readingGoalRepository.findByUserId(userId);
  }

  /**
   * Calculate progress for a goal
   */
  async calculateProgress(
    userId: number | null,
    year: number,
    booksGoal: number
  ): Promise<ProgressCalculation> {
    const booksCompleted = await readingGoalRepository.getBooksCompletedInYear(userId, year);

    const now = new Date();
    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInYear = isLeapYear(year) ? 366 : 365;
    const startOfYearDate = new Date(year, 0, 1);
    const daysElapsed = Math.max(0, differenceInDays(now, startOfYearDate));
    const expectedBooks = (booksGoal / daysInYear) * daysElapsed;

    let paceStatus: "ahead" | "on-track" | "behind";
    let booksAheadBehind = 0;

    if (booksCompleted >= expectedBooks + 1) {
      paceStatus = "ahead";
      booksAheadBehind = Math.floor(booksCompleted - expectedBooks);
    } else if (booksCompleted <= expectedBooks - 1) {
      paceStatus = "behind";
      booksAheadBehind = Math.floor(booksCompleted - expectedBooks); // Negative
    } else {
      paceStatus = "on-track";
    }

    let projectedFinishDate: Date | null = null;
    if (daysElapsed >= 14 || booksCompleted >= 2) {
      const booksPerDay = booksCompleted / daysElapsed;
      if (booksPerDay > 0) {
        const booksRemaining = booksGoal - booksCompleted;
        const daysToFinish = booksRemaining / booksPerDay;
        projectedFinishDate = addDays(now, Math.ceil(daysToFinish));
      }
    }

    logger.debug(
      { year, booksCompleted, booksGoal, daysElapsed, paceStatus },
      "Calculated reading goal progress"
    );

    return {
      booksCompleted,
      booksRemaining: Math.max(0, booksGoal - booksCompleted),
      completionPercentage: Math.min(100, Math.round((booksCompleted / booksGoal) * 100)),
      paceStatus,
      daysElapsed,
      projectedFinishDate,
      booksAheadBehind,
    };
  }

  /**
   * Create a new goal
   */
  async createGoal(userId: number | null, year: number, booksGoal: number): Promise<ReadingGoal> {
    this.validateYear(year);
    this.validateGoal(booksGoal);

    const existing = await readingGoalRepository.findByUserAndYear(userId, year);
    if (existing) {
      throw new Error(`You already have a goal for ${year}. Edit your existing goal instead.`);
    }

    logger.info({ userId, year, booksGoal }, "Creating reading goal");
    return readingGoalRepository.create({ userId, year, booksGoal });
  }

  /**
   * Update an existing goal
   */
  async updateGoal(goalId: number, booksGoal: number): Promise<ReadingGoal> {
    this.validateGoal(booksGoal);

    const existing = await readingGoalRepository.findById(goalId);
    if (!existing) {
      throw new Error("Goal not found");
    }

    if (!this.canEditGoal(existing.year)) {
      throw new Error("Cannot edit goals for past years");
    }

    logger.info({ goalId, booksGoal }, "Updating reading goal");
    const updated = await readingGoalRepository.update(goalId, { 
      booksGoal,
      updatedAt: new Date()
    });
    
    if (!updated) {
      throw new Error("Failed to update goal");
    }
    
    return updated;
  }

  /**
   * Delete a goal
   */
  async deleteGoal(goalId: number): Promise<void> {
    const existing = await readingGoalRepository.findById(goalId);
    if (!existing) {
      throw new Error("Goal not found");
    }

    if (!this.canEditGoal(existing.year)) {
      throw new Error("Cannot delete goals for past years");
    }

    logger.info({ goalId, year: existing.year }, "Deleting reading goal");
    await readingGoalRepository.delete(goalId);
  }

  /**
   * Get years with completed books
   */
  async getYearsSummary(userId: number | null): Promise<YearSummary[]> {
    const years = await readingGoalRepository.getYearsWithCompletedBooks(userId);
    return years.map(({ year, count }) => ({
      year,
      booksCompleted: count,
    }));
  }

  /**
   * Validate year is within acceptable range
   */
  private validateYear(year: number): void {
    if (!Number.isInteger(year) || year < 1900 || year > 9999) {
      throw new Error("Year must be between 1900 and 9999");
    }
  }

  /**
   * Validate goal is a positive integer
   */
  private validateGoal(booksGoal: number): void {
    if (!Number.isInteger(booksGoal) || booksGoal < 1) {
      throw new Error("Goal must be at least 1 book");
    }
    if (booksGoal > 9999) {
      throw new Error("Goal must be less than 10,000 books");
    }
  }

  /**
   * Check if a goal can be edited (current or future year only)
   */
  private canEditGoal(year: number): boolean {
    return year >= new Date().getFullYear();
  }
}

export const readingGoalsService = new ReadingGoalsService();
