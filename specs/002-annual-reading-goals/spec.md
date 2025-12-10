# Feature Specification: Annual Reading Goals

**Feature Branch**: `002-annual-reading-goals`
**Created**: 2025-11-27
**Status**: Draft
**Input**: User description: "Build an Annual Reading Goals feature for Tome — a user-facing option allowing each user to set and track a book-reading goal for a given calendar year. This feature should support setting the goal, dynamically tracking reading progress, and provide a dedicated Goals page with visualizations comparing current progress to the goal, with pace feedback (on track / ahead / behind). Users can view the books they completed in a given year directly on the Goals page."

## Clarifications

### Session 2025-11-27

- Q: Book Completion Integration Point - How should the annual goals feature integrate with existing book completion tracking? → A: Use existing book completion date field (completedDate or similar) from the reading_sessions/books table without creating new tracking mechanisms
- Q: Dashboard Widget Visibility for Past Years - Should the dashboard show historical goals from past years or only the current year? → A: Show only the current year's goal on the dashboard; past/future years are viewable only in Settings
- Q: Historical Goal Data Retention - How should the system handle goals from past years? → A: Keep all historical goals indefinitely; allow users to view but not edit past years
- Q: Projected Finish Date Early in Year - When should the system start showing projected finish date predictions? → A: Show projection only after at least 14 days have passed OR at least 2 books completed, whichever comes first
- Q: Goal Data Privacy and Visibility - Should reading goals be shareable or visible to other users? → A: Goals are private to each user; no sharing or visibility to other users

### Session 2025-12-10

- Q: Where should goal progress be displayed? → A: Move from dashboard to dedicated Goals page to keep dashboard minimal and focused on currently reading books
- Q: What visualizations should be included? → A: Month-by-month bar chart showing books completed with expected pace reference line
- Q: How should pace be displayed? → A: Show "X books ahead/behind" instead of days, since the goal is measured in books
- Q: Where should goal management (create/edit/delete) live? → A: Move from Settings page to Goals page with modal interface
- Q: How should users navigate between different years? → A: Year selector dropdown on Goals page showing only years with created goals
- Q: Should year-based book browsing be added to the library page filters? → A: No. Instead, show completed books directly on the Goals page below the chart. This keeps all year-based retrospective functionality in one place and avoids adding complexity to the already-complex library filters.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set Annual Reading Goal (Priority: P1)

A user wants to set a goal for how many books they aim to read during a specific calendar year. They navigate to the Goals page via bottom navigation, and can create or edit goals through a modal interface. Users can create and edit goals for the current year and future years. Historical goals (past years) are viewable but cannot be edited.

**Why this priority**: This is the foundation of the entire feature. Without the ability to set a goal, none of the tracking or visualization features can function. This delivers immediate value by allowing users to commit to a reading target.

**Independent Test**: Can be fully tested by navigating to Goals page, clicking "Create Goal", entering "40 books for 2026" in the modal, saving it, and verifying the goal persists when viewing the page again. Delivers value by allowing users to formalize their reading commitment.

**Acceptance Scenarios**:

1. **Given** a user is viewing the Goals page, **When** they click "Create Goal", enter "40" for year "2026" in the modal and save, **Then** the system stores the goal and displays "Your goal: 40 books for 2026"
2. **Given** a user has already set a goal of "40 books for 2026", **When** they click "Edit Goal", update it to "30 books for 2026" and save, **Then** the system updates the stored goal and all progress calculations reflect the new target
3. **Given** a user attempts to set a goal of "0" or negative number, **When** they submit the form, **Then** the system displays a validation error "Goal must be at least 1 book"
4. **Given** a user wants to set goals for multiple years, **When** they create "40 books for 2026" and "50 books for 2027" via the modal, **Then** both goals are stored separately and can be viewed/edited independently using the year selector
5. **Given** a user is viewing the Goals page in 2026 with the year selector set to 2025, **When** they attempt to edit the 2025 goal, **Then** the system prevents editing and displays the goal as read-only with the message "Historical goals cannot be modified"

---

### User Story 2 - View Progress on Dedicated Goals Page with Visualizations (Priority: P2)

A user with an active reading goal wants to see their progress in detail with visual feedback. When they navigate to the Goals page via bottom navigation, they see a year selector dropdown, their goal progress widget with current progress (X / Y books), a visual progress bar, and an indicator of whether they're on track, ahead, or behind schedule measured in books. Below the progress widget, they see a month-by-month bar chart showing books completed throughout the year with an expected pace reference line. Users can switch between different years using the year selector to view historical goals and their completion data.

**Why this priority**: This is the primary motivation feature that keeps users engaged. Seeing progress visualized with detailed charts provides immediate feedback and motivation. This is P2 because it depends on P1 (setting a goal) but is critical to the feature's core value proposition. The dedicated page allows for richer visualizations without cluttering the dashboard.

**Independent Test**: Can be tested by setting a goal, marking books as completed, navigating to Goals page, and verifying it shows correct counts, progress percentage, pace indicator (e.g., "12 / 40 books - 30% - 2.3 books behind"), and a month-by-month chart. Delivers value by providing motivation, detailed insights, and visibility into reading habits.

**Acceptance Scenarios**:

1. **Given** a user has a goal of "40 books for 2025" and has completed 12 books by March, **When** they navigate to the Goals page, **Then** they see "12 / 40 books" with a 30% progress bar and an indicator showing "2.3 books behind"
2. **Given** a user has completed 25 books against a goal of 40 by July 1 (mid-year), **When** they view the Goals page, **Then** they see "25 / 40 books" with a 62.5% progress bar and "4.5 books ahead"
3. **Given** a user has completed 45 books against a goal of 40, **When** they view the Goals page, **Then** they see "45 / 40 books" with a 100%+ progress bar and a "Goal exceeded!" badge
4. **Given** a user has no active goal for the current year, **When** they view the Goals page, **Then** they see a "Create Your First Goal" prompt with a button that opens the creation modal
5. **Given** a user has goals for 2024 and 2025, **When** they open the year selector dropdown on the Goals page, **Then** they see both years listed in descending order (2025, 2024)
6. **Given** a user selects "2024" from the year selector, **When** the page updates, **Then** they see 2024's goal data, progress widget, and chart showing that year's monthly completion history
7. **Given** a user is viewing their 2025 goal, **When** they scroll down to the chart, **Then** they see a bar chart with 12 bars (Jan-Dec) showing books completed per month and an orange dashed reference line showing the expected pace (goal / 12 books per month)
8. **Given** a user clicks "Edit Goal" button on the progress widget, **When** the modal opens, **Then** they see the goal form with current values pre-filled and can update the target number
9. **Given** a user is viewing their progress mid-year and has been reading for at least 14 days or completed at least 2 books, **When** they view the progress widget, **Then** they see a projected finish date message like "At this pace, you'll finish by November 15, 2025"
10. **Given** a user is viewing their progress on January 5th with 1 book completed (less than 14 days and less than 2 books), **When** they view the progress widget, **Then** no projected finish date is shown (insufficient data for reliable projection)

---

### User Story 3 - Automatic Progress Tracking (Priority: P1)

As a user marks books as read with completion dates, the system automatically counts these toward their annual goal for the corresponding year. The user doesn't need to manually update their progress - it happens seamlessly based on when they finished each book.

**Why this priority**: This is P1 because automatic tracking is essential for the feature to be practical. Manual tracking would create friction and reduce adoption. This also depends on existing book completion functionality, making it a natural integration point.

**Independent Test**: Can be tested by setting a goal, marking 3 books as completed with today's date, and verifying the progress automatically increments to "3 / 40 books" without manual intervention. Delivers value by eliminating manual effort.

**Acceptance Scenarios**:

1. **Given** a user has a goal of "40 books for 2026" with 10 books currently completed, **When** they mark a book as read with completion date "2026-03-15", **Then** their progress automatically updates to "11 / 40 books"
2. **Given** a user marks a book as completed with a date in a previous year (e.g., "2024-06-10"), **When** they view their 2026 goal progress, **Then** that book does NOT count toward their 2026 goal
3. **Given** a user has completed 15 books in 2026, **When** they delete a reading session for one of those books, **Then** their progress automatically decreases to "14 / 40 books"
4. **Given** a user changes a book's completion date from 2025 to 2026, **When** the change is saved, **Then** the book now counts toward their 2026 goal and progress recalculates accordingly

---

### User Story 4 - View Completed Books on Goals Page (Priority: P2)

A user wants to see which specific books they completed in a given year while viewing their goal progress. On the Goals page, below the chart, they see an expandable "Books Completed in [Year]" section that displays all books they finished during the selected year using the existing book grid component.

**Why this priority**: This is P2 because it completes the "annual retrospective" experience by showing not just how many books were read (chart) but which books were read. This keeps all year-based reflection in one place (the Goals page) rather than splitting it across multiple pages. It's simpler than adding another filter to the library page and provides better UX by co-locating related information.

**Independent Test**: Can be tested by completing books in 2025, navigating to Goals page, selecting 2025 from the year selector, and verifying the "Books Completed in 2025" section shows all completed books from that year. Can expand/collapse the section. Delivers value by enabling yearly reading retrospectives in context.

**Acceptance Scenarios**:

1. **Given** a user has completed 12 books in 2025 and is viewing the 2025 goal, **When** they scroll below the chart, **Then** they see an expandable section titled "Books Completed in 2025 (12 books)"
2. **Given** the "Books Completed" section is collapsed by default, **When** a user clicks on it, **Then** it expands to show a grid of all 12 books completed in 2025 using the same book card layout as the library page
3. **Given** a user selects "2024" from the year selector, **When** the page updates, **Then** the books section updates to "Books Completed in 2024 (X books)" showing only books completed in 2024
4. **Given** a user has a goal for 2026 but hasn't completed any books yet, **When** they view the 2026 goal, **Then** the books section shows "Books Completed in 2026 (0 books)" with an empty state message "No books completed yet this year"
5. **Given** a user clicks on a book in the "Books Completed" section, **When** they navigate to the book detail page and return, **Then** the Goals page retains the selected year and expansion state

---

### Edge Cases

- What happens when a user sets multiple goals for the same year? The system enforces one goal per year per user through database constraints, showing an error "You already have a goal for 2026. Edit your existing goal instead."
- How does the system handle books without completion dates? Books without completion dates are not counted toward any annual goal, as they are not considered "finished."
- What if a user deletes their reading goal mid-year? The goal is removed from the database. The year is no longer shown in the year selector on the Goals page (since only years with goals are shown). However, books remain in the library with their completion dates intact.
- How is "on track / ahead / behind" calculated? Calculate expected pace as (goal / 365 days * days elapsed in year). Compare actual books completed to expected books. Ahead if actual > expected + 1, behind if actual < expected - 1, on track otherwise. The difference is displayed in books (e.g., "2.3 books ahead") rather than days.
- What happens on January 1st when switching to a new year? The Goals page automatically displays the new year's goal (if set) with 0 books completed in the year selector. If no goal exists for the new year, the Goals page prompts the user to create one. Previous year's goal remains accessible via the year selector dropdown for historical reference.
- How does the system handle leap years in pace calculations? Leap years use 366 days instead of 365 when calculating daily pace (goal / days in year).
- What if a user completes 100 books against a goal of 10? Progress bar displays at 100% with "Goal exceeded!" indicator and shows actual completion (e.g., "100 / 10 books - 1000%").
- Can users edit goals from previous years? No. Historical goals (years before the current year) are read-only and preserved for reference. Only current and future year goals can be edited.
- When does the projected finish date appear? The system shows projected finish date only when there's sufficient data for a reliable prediction: either 14+ days have elapsed in the year OR the user has completed 2+ books, whichever comes first. Before this threshold, the projection is hidden.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create a reading goal by specifying a target number of books and a calendar year
- **FR-002**: System MUST enforce a minimum goal of 1 book when a goal is set
- **FR-003**: System MUST store one goal per year per user with a unique constraint on (user_id, year)
- **FR-004**: System MUST allow users to update an existing goal's target number for a specific year
- **FR-005**: System MUST automatically count completed books toward the corresponding year's goal based on completion date
- **FR-006**: System MUST recalculate progress when a reading session is added, updated, or deleted
- **FR-007**: System MUST display current progress as "X / Y books" where X is books completed and Y is the goal target
- **FR-008**: System MUST calculate pace in terms of books completed (not days) and display as "X.X books ahead/behind/on track" based on comparison between actual books completed and expected books at current point in year
- **FR-009**: System MUST show a visual progress bar representing completion percentage (books completed / goal target * 100%)
- **FR-010**: System MUST calculate projected finish date based on current reading pace (books per day) only when sufficient data exists (at least 14 days elapsed in the year OR at least 2 books completed, whichever comes first)
- **FR-011**: System MUST indicate when a goal has been exceeded with a "Goal exceeded!" badge
- **FR-012**: Goals page MUST display an expandable "Books Completed in [Year]" section below the chart showing all books completed during the selected year
- **FR-013**: System MUST display book count in the completed books section header (e.g., "Books Completed in 2025 (12 books)")
- **FR-014**: System MUST persist goal changes and immediately reflect updates in all progress calculations
- **FR-015**: System MUST validate that year values are positive four-digit integers representing valid calendar years
- **FR-016**: Goals page MUST display selected year's goal with year selector dropdown; only years with created goals are shown in the selector
- **FR-017**: System MUST allow editing goals for current and future years via modal interface on Goals page; goals for past years are read-only
- **FR-018**: System MUST retain all historical goals indefinitely for user reference, accessible via year selector on Goals page
- **FR-019**: System MUST ensure reading goals are private to each user with no sharing or cross-user visibility
- **FR-020**: System MUST provide month-by-month bar chart visualization of books completed within a selected year
- **FR-021**: System MUST display expected pace reference line on chart showing linear progress target (goal / 12 books per month)
- **FR-022**: Year selector dropdown MUST be populated only with years where user has created a goal, ordered descending (most recent first)
- **FR-023**: System MUST provide modal interface for creating and editing goals, accessible from Goals page via "Create Goal" or "Edit Goal" buttons
- **FR-024**: Goals page MUST be accessible via dedicated "Goals" navigation item positioned after Library and before Streak in bottom navigation
- **FR-025**: Completed books section MUST use the existing BookGrid component for consistent presentation with the library page
- **FR-026**: Completed books section MUST support expand/collapse interaction to minimize page length when not needed
- **FR-027**: System MUST fetch and display only books completed during the selected year (filtered by completion date year matching selected year)

### Key Entities

- **Reading Goal**: Represents a user's target for books to read in a specific calendar year. Key attributes: user identifier, year (integer), books_goal (integer >= 1), creation timestamp, last updated timestamp. One goal per user per year.
- **Completed Book**: Derived from existing reading_sessions or books table via completedDate field queries. Key attribute: completion date (used to determine which year a book counts toward). Relationship: Multiple completed books contribute to one annual goal based on matching year. No separate tracking table is created for annual goals - counts are calculated on-demand from existing data.
- **Progress Calculation**: Derived entity representing current state of a goal. Attributes: books completed (count), books remaining (goal - completed), completion percentage, pace status (on track / ahead / behind), projected finish date. Calculated dynamically from completed books and goal target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can set an annual reading goal in under 30 seconds via the modal interface
- **SC-002**: Progress updates appear on the Goals page within 2 seconds of marking a book as completed
- **SC-003**: Users can view detailed reading progress with month-by-month visualization on Goals page within one click from any page via bottom navigation
- **SC-004**: 90% of users can correctly interpret their pace status (on track / ahead / behind) based on the visual indicators showing book counts
- **SC-005**: The system accurately calculates progress across 1000+ completed books per user without performance degradation
- **SC-006**: Completed books section on Goals page displays results in under 1 second for users with up to 500 completed books
- **SC-007**: Users can update their goal mid-year and see recalculated progress reflected immediately in the progress widget and chart
- **SC-008**: Projected finish date calculations have a margin of error within ±3 days when tested against actual completion patterns
- **SC-009**: Users can switch between different years' goals and see corresponding historical data within 1 second
- **SC-010**: Monthly chart renders correctly for all screen sizes (320px to 2560px width) without horizontal scrolling or layout issues
- **SC-011**: Users can expand the completed books section and see their books within 1 second on mobile and desktop devices

## Assumptions

- Users track book completion through an existing "mark as read" or "reading session" feature that records completion dates in a reading_sessions or books table with a completedDate field
- The annual goals feature queries existing completion data directly without duplicating or caching book counts
- The system already has a user authentication system in place (referenced as user_id)
- A Settings page exists for application-wide configuration
- A dashboard/home page exists focused on currently reading books
- A bottom navigation system exists where new navigation items can be added
- A library view exists that displays the user's book collection with a BookGrid component that can be reused
- Completion dates are stored in a format that allows year extraction (ISO date format or similar)
- The system operates in a single timezone per user or uses UTC with proper date handling
- "Books completed" means books with a recorded completion date, not partial progress
- The year in a completion date determines which annual goal the book counts toward
- Progress calculations should round to whole numbers for display (e.g., 62.5% displayed as 63%)
- Pace calculations assume linear reading rate (average books per day/week/month)
- Pace is displayed in terms of books (e.g., "2.3 books ahead") rather than days for better user comprehension
- Projected finish dates require a minimum sample size (14 days OR 2 books) to ensure statistical reliability
- The feature will be available to all registered users without additional permissions required
- Historical goals are never automatically deleted; they remain accessible indefinitely for historical reference
- Goal editability is determined by comparing the goal's year to the current calendar year (past years are read-only)
- Reading goals are completely private to each user; no social sharing, public profiles, or cross-user visibility features are included in this specification
- Monthly chart visualization uses bar chart format with 12 bars (one per month) for annual view
- Chart interactions (tooltips, legend) follow existing patterns from the streak analytics page

## Design Decisions

### Dedicated Goals Page vs Dashboard Widget

**Decision**: Move reading goals from dashboard to dedicated Goals page accessed via bottom navigation.

**Rationale**: 
- Dashboard should remain minimal and focused on currently reading books (primary user action)
- Goals tracking is a periodic reflection activity, not a frequent action
- Dedicated page allows for richer visualizations (charts, historical data) without cluttering the dashboard
- Separates "action" (reading books) from "reflection" (tracking progress)

### Pace Display: Books vs Days

**Decision**: Display pace as "X books ahead/behind" instead of "X days ahead/behind".

**Rationale**:
- Goals are measured in books, so pace should also be measured in books for consistency
- "I need to read 2 more books" is more actionable than "I'm 14 days behind"
- Books are concrete and countable; days are abstract and don't directly translate to action
- Users think in terms of "how many books do I need to read" not "how many days am I behind"

### Chart Visualization (Simplified v1)

**Decision**: Start with bars (books per month) + pace line (expected rate). Defer cumulative line and projected trend line to future iteration.

**Rationale**:
- Bars show actual achievement clearly
- Pace line provides comparison target
- Simpler chart is easier to understand and implement
- Can add complexity in future iterations based on user feedback
- Follows iterative development approach

### Goal Management Location

**Decision**: Move goal CRUD operations from Settings page to Goals page via modal interface.

**Rationale**:
- Co-locates goal management with goal visualization (all in one place)
- Settings page should be for application-wide configuration, not feature-specific data
- Modal pattern allows quick edits without navigation away from progress view
- Reduces cognitive load (user doesn't need to remember where to manage goals)

### Year Selector Scope

**Decision**: Show only years where user has created goals, not all years with completed books.

**Rationale**:
- A goal must exist for progress tracking to be meaningful
- Viewing years without goals provides no actionable insights
- Simplifies UI by reducing dropdown options
- Encourages intentional goal-setting rather than passive historical viewing

### Completed Books Display Location

**Decision**: Show completed books directly on the Goals page in an expandable section, rather than adding a year filter to the library page.

**Rationale**:
- **Co-location**: All year-based retrospective functionality stays in one place (Goals page)
- **Reduced complexity**: Library page already has 4 filters (search, status, tags, rating); adding a 5th increases cognitive load and maintenance burden
- **Mental model alignment**: Goals page is for "looking back" at annual progress; viewing which books were completed is a natural part of that reflection
- **Simpler implementation**: Reuses existing BookGrid component without touching the complex library filter state management
- **Better UX flow**: User selects year → sees goal progress → sees chart → sees actual books, all in one scrollable page
- **Separation of concerns**: Library is for "books to manage" (to-read, currently reading), Goals page is for "books completed" (retrospective)

## Future Enhancements (Not in Scope)

The following features are intentionally excluded from this specification but may be considered in future iterations:

1. **Unified Stats Page**: Merge Goals page with Streak analytics under `/stats` with sub-navigation ["Daily" | "Annual"]
2. **Projected Trend Line**: Add predictive trend line on chart showing whether user will exceed, meet, or miss goal
3. **Cumulative Line**: Show running total of books completed over the year on the chart
4. **Reading Velocity Insights**: Display books per week/month averages and trends
5. **Goal Templates**: Suggest goals based on past reading history
6. **Goal Milestones**: Celebrate 25%, 50%, 75% completion
7. **Year-over-Year Comparison**: Compare current year progress to same period in previous years
8. **Genre Breakdown**: Show which genres contributed to goal progress
