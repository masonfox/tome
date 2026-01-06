import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const importMappings: Record<string, string> = {
  // Modals
  'BaseModal': 'Modals/BaseModal',
  'ArchiveSessionModal': 'Modals/ArchiveSessionModal',
  'CompleteBookModal': 'Modals/CompleteBookModal',
  'FinishBookModal': 'Modals/FinishBookModal',
  'LogProgressModal': 'Modals/LogProgressModal',
  'PageCountEditModal': 'Modals/PageCountEditModal',
  'ProgressEditModal': 'Modals/ProgressEditModal',
  'RatingModal': 'Modals/RatingModal',
  'RereadConfirmModal': 'Modals/RereadConfirmModal',
  'SessionEditModal': 'Modals/SessionEditModal',
  'SessionProgressModal': 'Modals/SessionProgressModal',
  'StreakEditModal': 'Modals/StreakEditModal',

  // Books
  'BookCard': 'Books/BookCard',
  'BookCardSkeleton': 'Books/BookCardSkeleton',
  'BookGrid': 'Books/BookGrid',
  'CompletedBooksSection': 'Books/CompletedBooksSection',
  'SeriesCard': 'Books/SeriesCard',
  'SeriesCardSkeleton': 'Books/SeriesCardSkeleton',

  // CurrentlyReading
  'CurrentlyReadingCard': 'CurrentlyReading/CurrentlyReadingCard',
  'CurrentlyReadingCardSkeleton': 'CurrentlyReading/CurrentlyReadingCardSkeleton',
  'CurrentlyReadingList': 'CurrentlyReading/CurrentlyReadingList',
  'CurrentlyReadingSection': 'CurrentlyReading/CurrentlyReadingSection',
  'ReadingHistoryTab': 'CurrentlyReading/ReadingHistoryTab',

  // ReadingGoals
  'CreateGoalPrompt': 'ReadingGoals/CreateGoalPrompt',
  'GoalsOnboarding': 'ReadingGoals/GoalsOnboarding',
  'GoalsPagePanel': 'ReadingGoals/GoalsPagePanel',
  'ReadingGoalChart': 'ReadingGoals/ReadingGoalChart',
  'ReadingGoalChartSkeleton': 'ReadingGoals/ReadingGoalChartSkeleton',
  'ReadingGoalForm': 'ReadingGoals/ReadingGoalForm',
  'ReadingGoalsList': 'ReadingGoals/ReadingGoalsList',
  'ReadingGoalsPanel': 'ReadingGoals/ReadingGoalsPanel',
  'ReadingGoalsSettings': 'ReadingGoals/ReadingGoalsSettings',
  'ReadingGoalWidget': 'ReadingGoals/ReadingGoalWidget',
  'ReadingGoalWidgetSkeleton': 'ReadingGoals/ReadingGoalWidgetSkeleton',

  // Streaks
  'StreakAnalytics': 'Streaks/StreakAnalytics',
  'StreakChart': 'Streaks/StreakChart',
  'StreakChartSection': 'Streaks/StreakChartSection',
  'StreakDisplay': 'Streaks/StreakDisplay',
  'StreakOnboarding': 'Streaks/StreakOnboarding',
  'StreakRebuildSection': 'Streaks/StreakRebuildSection',
  'StreakSettings': 'Streaks/StreakSettings',

  // Layout
  'BottomNavigation': 'Layout/BottomNavigation',
  'BottomSheet': 'Layout/BottomSheet',
  'DesktopSidebar': 'Layout/DesktopSidebar',
  'LayoutWrapper': 'Layout/LayoutWrapper',
  'PageHeader': 'Layout/PageHeader',
  'ScrollToTopButton': 'Layout/ScrollToTopButton',

  // Library
  'LibraryFilters': 'Library/LibraryFilters',
  'LibraryHeader': 'Library/LibraryHeader',

  // Markdown
  'MarkdownEditor': 'Markdown/MarkdownEditor',
  'MarkdownRenderer': 'Markdown/MarkdownRenderer',

  // Settings
  'ThemeSettings': 'Settings/ThemeSettings',
  'TimezoneSettings': 'Settings/TimezoneSettings',
  'VersionSettings': 'Settings/VersionSettings',

  // Utilities
  'ArchiveTreeNode': 'Utilities/ArchiveTreeNode',
  'StatusBadge': 'Utilities/StatusBadge',
  'TimePeriodFilter': 'Utilities/TimePeriodFilter',
  'TimezoneDetector': 'Utilities/TimezoneDetector',
  'ToastProvider': 'Utilities/ToastProvider',
  'YearSelector': 'Utilities/YearSelector',
};

function updateImports(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8');
  let updated = false;

  for (const [component, newPath] of Object.entries(importMappings)) {
    // Match both default and named imports: from "@/components/Component"
    const pattern = new RegExp(
      `from ['"]@/components/${component}['"]`,
      'g'
    );

    if (pattern.test(content)) {
      content = content.replace(pattern, `from "@/components/${newPath}"`);
      updated = true;
    }
  }

  if (updated) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Updated: ${filePath}`);
  }

  return updated;
}

// Find all TypeScript files
const files = globSync('**/*.{ts,tsx}', {
  ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**'],
  cwd: process.cwd(),
  absolute: true,
});

let totalUpdated = 0;
files.forEach(file => {
  if (updateImports(file)) totalUpdated++;
});

console.log(`\n✓ Updated ${totalUpdated} files`);
