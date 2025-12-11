/**
 * Reading goals generation helpers for development seeding
 * Generates multiple years of goals with realistic targets
 */

export interface GoalData {
  year: number;
  booksGoal: number;
}

/**
 * Generates reading goals for multiple years
 * Creates goals for past years (with varying targets), current year, and next year
 * @param currentYear - Current calendar year
 * @param yearsBack - Number of past years to generate goals for (default 2)
 * @returns Array of goal data objects
 */
export function generateMultiYearGoals(
  currentYear: number,
  yearsBack: number = 2
): GoalData[] {
  const goals: GoalData[] = [];

  // Generate goals for past years (2023, 2024, etc.)
  for (let i = yearsBack; i > 0; i--) {
    const year = currentYear - i;
    // Past years had varying goals: 24-40 books
    const booksGoal = 24 + Math.floor(Math.random() * 17); // 24-40 books
    goals.push({ year, booksGoal });
  }

  // Current year goal (set to 10 to achieve 130% completion with 13 books)
  goals.push({
    year: currentYear,
    booksGoal: 10,
  });

  // Next year goal (even more ambitious)
  goals.push({
    year: currentYear + 1,
    booksGoal: 50 + Math.floor(Math.random() * 11), // 50-60 books
  });

  return goals;
}

/**
 * Calculates how many books should be marked as completed for a given year
 * For past years: achieves 70-110% of goal (some years exceeded, some fell short)
 * For 2023 specifically: exceeds goal by 20-30%
 * For current year: returns 13 books (130% of 10 book goal)
 * @param goal - Goal data with year and target
 * @param currentYear - Current calendar year
 * @returns Number of books that should be completed
 */
export function calculateCompletedBooksForGoal(
  goal: GoalData,
  currentYear: number
): number {
  if (goal.year < currentYear) {
    // 2023: Specifically exceed goal by 20-30%
    if (goal.year === 2023) {
      const completionRate = 1.2 + Math.random() * 0.1; // 1.2-1.3 (120-130%)
      return Math.floor(goal.booksGoal * completionRate);
    }
    
    // Other past years: 70-110% completion (realistic variation)
    const completionRate = 0.7 + Math.random() * 0.4; // 0.7-1.1
    return Math.floor(goal.booksGoal * completionRate);
  } else if (goal.year === currentYear) {
    // Current year: fixed at 13 books for 130% completion
    return 13;
  } else {
    // Future year: no books completed yet
    return 0;
  }
}

/**
 * Generates realistic completion dates for books throughout a year
 * Spreads completions across the year with some clustering (more in summer/winter)
 * @param year - The year for which to generate dates
 * @param count - Number of completion dates to generate
 * @returns Array of Date objects sorted chronologically
 */
export function generateCompletionDatesForYear(
  year: number,
  count: number
): Date[] {
  const dates: Date[] = [];
  
  // Generate dates spread throughout the year
  for (let i = 0; i < count; i++) {
    // More books completed in certain months (summer reading, winter holidays)
    // Weighted distribution: Jan-Feb (10%), Mar-Apr (15%), May-Jun (20%), 
    // Jul-Aug (25%), Sep-Oct (15%), Nov-Dec (15%)
    const rand = Math.random();
    let month: number;
    
    if (rand < 0.1) {
      month = Math.floor(Math.random() * 2); // Jan-Feb (0-1)
    } else if (rand < 0.25) {
      month = 2 + Math.floor(Math.random() * 2); // Mar-Apr (2-3)
    } else if (rand < 0.45) {
      month = 4 + Math.floor(Math.random() * 2); // May-Jun (4-5)
    } else if (rand < 0.7) {
      month = 6 + Math.floor(Math.random() * 2); // Jul-Aug (6-7)
    } else if (rand < 0.85) {
      month = 8 + Math.floor(Math.random() * 2); // Sep-Oct (8-9)
    } else {
      month = 10 + Math.floor(Math.random() * 2); // Nov-Dec (10-11)
    }
    
    // Random day within the month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = 1 + Math.floor(Math.random() * daysInMonth);
    
    // Random time (mostly evenings)
    const hour = 18 + Math.floor(Math.random() * 5); // 6pm-10pm
    const minute = Math.floor(Math.random() * 60);
    
    dates.push(new Date(year, month, day, hour, minute, 0));
  }
  
  // Sort chronologically
  dates.sort((a, b) => a.getTime() - b.getTime());
  
  return dates;
}
