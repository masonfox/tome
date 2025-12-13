import { format, startOfMonth, endOfMonth } from "date-fns";

export interface ArchiveNode {
  id: string; // Unique identifier (e.g., "2024", "2024-11", "2024-11-W3")
  type: "year" | "month" | "week";
  label: string; // Display text (e.g., "2024", "November", "Week 3 (Nov 15-21)")
  dateKey: string; // Key to match against journal entries
  startDate: string; // YYYY-MM-DD for this period's start
  endDate: string; // YYYY-MM-DD for this period's end
  count: number; // Total entry count in this period
  children?: ArchiveNode[]; // Child nodes (months for years, weeks for months)
}

/**
 * Builds a hierarchical Year → Month → Week archive structure from an array of dates
 * @param dates Array of Date objects from progress logs
 * @returns Array of year nodes with nested month and week children
 */
export function buildArchiveHierarchy(dates: Date[]): ArchiveNode[] {
  const yearMap = new Map<string, Map<string, Date[]>>();

  // Group dates by year → month using UTC to match journal grouping
  for (const date of dates) {
    // Extract date from ISO string to avoid timezone issues (same as journal.service.ts)
    const isoString = date.toISOString();
    const dateStr = isoString.split('T')[0]; // YYYY-MM-DD in UTC
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(0, 7); // YYYY-MM

    if (!yearMap.has(year)) {
      yearMap.set(year, new Map());
    }
    const monthMap = yearMap.get(year)!;

    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }
    monthMap.get(month)!.push(date);
  }

  // Build year nodes
  const years: ArchiveNode[] = [];

  for (const [year, months] of Array.from(yearMap.entries())) {
    const monthNodes: ArchiveNode[] = [];
    let yearCount = 0;

    for (const [monthKey, monthDates] of Array.from(months.entries())) {
      // Group dates into weeks of month
      const weekNodes = buildWeekNodes(monthDates, monthKey);

      // Extract month number and create label directly to avoid timezone issues
      const monthNum = parseInt(monthKey.split("-")[1]);
      const monthNames = ["January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"];
      const monthLabel = monthNames[monthNum - 1];

      // Calculate month boundaries
      const year = parseInt(monthKey.split("-")[0]);
      const lastDay = new Date(year, monthNum, 0).getDate(); // 0 means last day of previous month

      monthNodes.push({
        id: monthKey,
        type: "month",
        label: monthLabel,
        dateKey: monthKey,
        startDate: `${monthKey}-01`,
        endDate: `${monthKey}-${lastDay.toString().padStart(2, '0')}`,
        count: monthDates.length,
        children: weekNodes,
      });

      yearCount += monthDates.length;
    }

    years.push({
      id: year,
      type: "year",
      label: year,
      dateKey: year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      count: yearCount,
      children: monthNodes.sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    });
  }

  return years.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/**
 * Groups dates into weeks of month (Week 1-5)
 * Week calculation: Week 1 = days 1-7, Week 2 = days 8-14, etc.
 * @param dates Array of dates within a single month
 * @param monthKey Month identifier (YYYY-MM)
 * @returns Array of week nodes sorted by week number
 */
function buildWeekNodes(dates: Date[], monthKey: string): ArchiveNode[] {
  // Group by week of month (1-5)
  const weekMap = new Map<number, Date[]>();

  // Get the correct month abbreviation from monthKey (avoid timezone issues)
  const monthNum = parseInt(monthKey.split("-")[1]);
  const monthAbbrs = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthAbbr = monthAbbrs[monthNum - 1];

  for (const date of dates) {
    // Extract date from ISO string to avoid timezone issues (same as journal.service.ts)
    const isoString = date.toISOString();
    const dateStr = isoString.split('T')[0]; // YYYY-MM-DD in UTC
    const [year, month, dayStr] = dateStr.split("-");
    const day = parseInt(dayStr);

    // Only include dates that actually belong to this month
    const dateMonthKey = `${year}-${month}`;
    if (dateMonthKey !== monthKey) {
      continue; // Skip dates that don't belong to this month
    }

    const weekNum = Math.ceil(day / 7); // Simple week of month: 1-7 = week 1, 8-14 = week 2, etc.

    if (!weekMap.has(weekNum)) {
      weekMap.set(weekNum, []);
    }
    weekMap.get(weekNum)!.push(date);
  }

  const weeks: ArchiveNode[] = [];

  for (const [weekNum, weekDates] of Array.from(weekMap.entries())) {
    const sortedDates = weekDates.sort((a, b) => a.getTime() - b.getTime());

    // Get actual first and last day from the data using UTC
    const firstDateStr = sortedDates[0].toISOString().split('T')[0];
    const lastDateStr = sortedDates[sortedDates.length - 1].toISOString().split('T')[0];
    const firstDay = parseInt(firstDateStr.split("-")[2]);
    const lastDay = parseInt(lastDateStr.split("-")[2]);

    const label =
      firstDay === lastDay
        ? `Week ${weekNum} (${monthAbbr} ${firstDay})`
        : `Week ${weekNum} (${monthAbbr} ${firstDay}-${lastDay})`;

    weeks.push({
      id: `${monthKey}-W${weekNum}`,
      type: "week",
      label,
      dateKey: `${monthKey}-W${weekNum}`,
      startDate: firstDateStr,
      endDate: lastDateStr,
      count: weekDates.length,
    });
  }

  return weeks.sort((a, b) => {
    // Sort by week number (extracted from id)
    const aWeek = parseInt(a.id.split("-W")[1]);
    const bWeek = parseInt(b.id.split("-W")[1]);
    return bWeek - aWeek; // Descending order (week 5, 4, 3, 2, 1)
  });
}

/**
 * Checks if a date matches a given date key
 * @param date Date string in YYYY-MM-DD format
 * @param dateKey Archive node date key (e.g., "2024", "2024-11", "2024-11-W3")
 * @returns True if the date falls within the date key's range
 */
export function matchesDateKey(date: string, dateKey: string): boolean {
  // Year match: "2024"
  if (dateKey.length === 4) {
    return date.startsWith(dateKey);
  }

  // Month match: "2024-11"
  if (dateKey.length === 7) {
    return date.startsWith(dateKey);
  }

  // Week match: "2024-11-W3"
  if (dateKey.includes("-W")) {
    const [yearMonth, weekPart] = dateKey.split("-W");
    const weekNum = parseInt(weekPart);
    const [year, month] = yearMonth.split("-");

    // Check if date is in the same year-month
    if (!date.startsWith(yearMonth)) {
      return false;
    }

    // Check if date's day falls in this week
    const day = parseInt(date.split("-")[2]);
    const weekStart = (weekNum - 1) * 7 + 1;
    const weekEnd = weekNum * 7;

    return day >= weekStart && day <= weekEnd;
  }

  return false;
}

/**
 * Gets the date key for a given date string
 * @param date Date string in YYYY-MM-DD format
 * @returns Object with year, month, and week date keys
 */
export function getDateKeys(date: string): {
  year: string;
  month: string;
  week: string;
} {
  const [year, month, dayStr] = date.split("-");
  const day = parseInt(dayStr);
  const weekNum = Math.ceil(day / 7);

  return {
    year,
    month: `${year}-${month}`,
    week: `${year}-${month}-W${weekNum}`,
  };
}
