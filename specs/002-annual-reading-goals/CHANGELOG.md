# Spec Changelog: Annual Reading Goals

## 2025-12-10 - Major UX Redesign

### Overview
Redesigned the reading goals feature to move from dashboard widget to a dedicated Goals page with enhanced visualizations, while changing pace tracking from days to books for better user comprehension.

### Key Changes

#### 1. **Location Change: Dashboard → Goals Page**
- **Before**: Goals displayed on dashboard via widget
- **After**: Dedicated Goals page accessed via bottom navigation (positioned after Library, before Streak)
- **Rationale**: Keep dashboard minimal and focused on currently reading books; provide dedicated space for goal tracking and visualizations

#### 2. **Pace Display: Days → Books**
- **Before**: "X days ahead/behind"
- **After**: "X.X books ahead/behind"
- **Rationale**: Goals are measured in books, so pace should be too; more actionable for users

#### 3. **Goal Management: Settings → Goals Page Modal**
- **Before**: Goal CRUD in Settings page section
- **After**: Modal interface on Goals page with "Create Goal" / "Edit Goal" buttons
- **Rationale**: Co-locate management with visualization; Settings for app-wide config only

#### 4. **New Feature: Year Selector**
- **What**: Dropdown to switch between different years' goals
- **Scope**: Only years where user has created goals (not all years with completed books)
- **Benefit**: View historical goal performance without cluttering UI

#### 5. **New Feature: Monthly Chart Visualization**
- **What**: Bar chart showing books completed per month (Jan-Dec)
- **Elements**: 
  - Bars: Books completed each month (green gradient)
  - Reference line: Expected pace (goal / 12 books per month, orange dashed)
- **Benefit**: Visual progress tracking, identify reading patterns, see pace comparison

#### 6. **Navigation Enhancement**
- **New**: "Goals" bottom navigation item
- **Position**: Home → Library → **Goals** → Streak → Settings

---

### Specification Updates

#### New Clarifications (Session 2025-12-10)
- Where should goal progress be displayed?
- What visualizations should be included?
- How should pace be displayed?
- Where should goal management live?
- How should users navigate between years?

#### Updated User Stories

**User Story 1 - Set Annual Reading Goal**
- Changed from Settings page to Goals page
- Modal interface instead of inline form
- Year selector for multi-year goal management

**User Story 2 - View Progress** (Renamed)
- **Old Title**: "View Progress on Dashboard"
- **New Title**: "View Progress on Dedicated Goals Page with Visualizations"
- Moved from dashboard to Goals page
- Added month-by-month chart
- Added year selector functionality
- Updated acceptance scenarios (10 scenarios, up from 6)

#### New Functional Requirements

- **FR-008** (Updated): Pace calculated in books, not days
- **FR-016** (Updated): Goals page (not dashboard) displays selected year's goal
- **FR-017** (Updated): Modal interface for editing on Goals page
- **FR-018** (Updated): Historical goals accessible via year selector
- **FR-020** (NEW): Month-by-month bar chart visualization
- **FR-021** (NEW): Expected pace reference line on chart
- **FR-022** (NEW): Year selector populated only with years having goals
- **FR-023** (NEW): Modal interface for goal CRUD operations
- **FR-024** (NEW): Goals accessible via dedicated navigation item

#### Updated Success Criteria

- **SC-002** (Updated): Progress updates on Goals page (not dashboard)
- **SC-003** (Updated): View detailed progress with visualization via navigation
- **SC-004** (Updated): Clarified pace shows book counts
- **SC-007** (Updated): Updates reflected in both widget and chart
- **SC-009** (NEW): Year switching performance (< 1 second)
- **SC-010** (NEW): Chart responsive design (320px to 2560px)

#### Updated Assumptions
- Dashboard focused on currently reading books
- Bottom navigation system for adding new items
- Pace displayed in books for better comprehension
- Monthly chart uses bar format (12 bars for annual view)
- Chart interactions follow streak analytics patterns

---

### New Sections Added

#### Design Decisions
Documented four key design decisions with rationales:
1. Dedicated Goals Page vs Dashboard Widget
2. Pace Display: Books vs Days
3. Chart Visualization (Simplified v1)
4. Goal Management Location
5. Year Selector Scope

#### Future Enhancements
Listed 8 potential features for future iterations:
1. Unified Stats Page (merge with Streak)
2. Projected Trend Line
3. Cumulative Line
4. Reading Velocity Insights
5. Goal Templates
6. Goal Milestones
7. Year-over-Year Comparison
8. Genre Breakdown

---

### Edge Cases Updated

- **Pace calculation**: Now explicitly states difference displayed in books
- **Year switching**: Goals page (not dashboard) handles new year
- **Historical access**: Via year selector (not Settings)

---

### Implementation Impact

#### Breaking Changes
- Dashboard no longer shows goal widget
- Settings page will no longer have reading goals section
- Component props may change (`daysAheadBehind` → `booksAheadBehind`)

#### New Components Required
- `ReadingGoalsPanel.tsx` - Main Goals page container
- `YearSelector.tsx` - Year dropdown
- `ReadingGoalModal.tsx` - Modal wrapper for CRUD forms
- `ReadingGoalChart.tsx` - Monthly bar chart
- `ReadingGoalChartSection.tsx` - Chart container

#### New API Endpoints
- `GET /api/reading-goals/[year]/monthly` - Monthly breakdown data

#### Repository Changes
- New method: `getBooksCompletedByMonth(userId, year)`
- Returns array of 12 months with counts

#### Service Changes
- Rename: `daysAheadBehind` → `booksAheadBehind` in `ProgressCalculation`
- New method: `getMonthlyBreakdown(userId, year)`

---

### Testing Updates

#### New Test Scenarios
- Year selector shows only years with goals
- Year switching updates widget and chart
- Chart displays 12 bars with pace line
- Modal opens/closes correctly
- Goals page accessible via navigation
- Dashboard no longer shows goal widget
- Settings no longer has goals section

#### Performance Criteria
- Year switching < 1 second (SC-009)
- Chart responsive 320px-2560px (SC-010)
- Monthly data query < 1 second

---

### Migration Notes

#### User Communication
- Consider in-app notification: "Reading Goals moved to Goals page for better visualization"
- Update any user documentation/help text

#### Data Migration
- No database changes required
- Existing goals remain intact
- No data transformation needed

#### Component Migration
- Remove `ReadingGoalWidget` from `app/page.tsx`
- Remove `ReadingGoalsSettings` from Settings page
- Add "Goals" to bottom navigation
- Move goal management to new Goals page

---

## Version History

- **v1.0** (2025-11-27): Initial specification - dashboard widget, Settings page management
- **v2.0** (2025-12-10): Major redesign - dedicated Goals page, month-by-month chart, books-based pace

---

---

## 2025-12-10 (Afternoon) - Completed Books Display Decision

### Overview
Revised User Story 4 to show completed books directly on the Goals page instead of adding a year filter to the library page. This simplifies implementation and improves user experience by keeping all year-based retrospective functionality in one place.

### Key Changes

#### 1. **User Story 4 Revision**
- **Old Approach**: Add "Year Completed" filter to library page filters (alongside search, status, tags, rating)
- **New Approach**: Display completed books in expandable section on Goals page below the chart
- **Priority Change**: Remains P2 (not P3) - enhances the Goals page experience

#### 2. **Rationale for Change**
- **Co-location**: All annual retrospective functionality stays on Goals page (goal → chart → books)
- **Reduced complexity**: Library page already has 4 filters; avoiding a 5th reduces cognitive load and state management complexity
- **Mental model**: Goals page is for "looking back"; library is for "managing books to read"
- **Simpler implementation**: Reuse `BookGrid` component without touching complex library filter logic
- **Better UX flow**: Year selector controls everything on one page - seamless experience

#### 3. **Component Design**
- **New Component**: `CompletedBooksSection.tsx`
- **Features**: 
  - Expandable/collapsible section
  - Header shows "Books Completed in [Year] (X books)"
  - Reuses existing `BookGrid` component for book display
  - Empty state: "No books completed yet this year"
- **Position**: Below monthly chart on Goals page

#### 4. **Specification Updates**

**Updated User Story 4**
- Title: "Filter Library by Completion Year" → "View Completed Books on Goals Page"
- Location: Library page → Goals page
- Interaction: Filter dropdown → Expandable section
- Acceptance scenarios updated (5 scenarios focused on Goals page experience)

**Removed Requirements**
- ~~FR-012: Library view year filter~~
- ~~FR-013: Filter dropdown with year counts~~

**New Requirements**
- **FR-012**: Goals page displays expandable "Books Completed" section
- **FR-013**: Section header shows year and book count
- **FR-025**: Use existing BookGrid component for consistency
- **FR-026**: Support expand/collapse interaction
- **FR-027**: Fetch only books from selected year

**Updated Success Criteria**
- **SC-006**: "Library view displays results" → "Completed books section displays results"
- **SC-011** (NEW): Expand section and see books < 1 second on all devices

#### 5. **Implementation Changes**

**Phase 12 Tasks Updated** (13 tasks revised)
- Removed: Library filter component, library page integration, year filter API
- Added: CompletedBooksSection component, books API endpoint (or extend existing), expand/collapse state

**API Strategy**
- Option A: New endpoint `GET /api/books/completed?year=2025`
- Option B: Extend existing books API with year parameter
- Repository: Reuse `getBooksCompletedInYear()` (already exists for progress calculation)

**Estimated Effort Reduction**
- Library filter approach: ~13 tasks involving complex state management, URL params, filter interactions
- Goals page approach: ~13 tasks but simpler - mostly component rendering and single data fetch
- Net benefit: Simpler code, better UX, no additional complexity to library page

---

### Edge Cases Updated

- **Goal deletion**: Year no longer in selector, but completed books section would not be visible anyway (no goal = no page)
- **Large book counts**: Performance tested with 100+ books per year (same as library grid)
- **Navigation**: Clicking book navigates to detail; returning preserves year selection and expansion state

---

### Decision Impact

#### Positive Outcomes
1. **Cleaner library page**: No additional filter complexity
2. **Better information architecture**: Related features grouped together
3. **Simplified testing**: One page to test instead of coordinating two
4. **Easier maintenance**: Fewer moving parts, clearer separation of concerns
5. **Better user journey**: "I want to reflect on 2024" → everything in one place

#### No Breaking Changes
- This decision made during planning phase before Phase 12 implementation
- No existing code affected
- No user-facing features impacted

---

## Status

**Current Phase**: Specification updated and finalized
**Next Steps**: Ready for Phase 12 implementation with new approach
