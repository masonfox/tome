# Feature Specification: Annual Reading Goals

**Feature Branch**: `002-annual-reading-goals`
**Created**: 2025-11-27
**Status**: Draft
**Input**: User description: "Build an Annual Reading Goals feature for Tome — a user-facing option allowing each user to set and track a book-reading goal for a given calendar year. This feature should support setting the goal, dynamically tracking reading progress, and provide a dashboard visualization comparing current progress to the goal, with pace feedback (on track / ahead / behind). It also enables filtering/composing library views by the year in which books were completed."

## Clarifications

### Session 2025-11-27

- Q: Book Completion Integration Point - How should the annual goals feature integrate with existing book completion tracking? → A: Use existing book completion date field (completedDate or similar) from the reading_sessions/books table without creating new tracking mechanisms
- Q: Dashboard Widget Visibility for Past Years - Should the dashboard show historical goals from past years or only the current year? → A: Show only the current year's goal on the dashboard; past/future years are viewable only in Settings
- Q: Historical Goal Data Retention - How should the system handle goals from past years? → A: Keep all historical goals indefinitely; allow users to view but not edit past years
- Q: Projected Finish Date Early in Year - When should the system start showing projected finish date predictions? → A: Show projection only after at least 14 days have passed OR at least 2 books completed, whichever comes first
- Q: Goal Data Privacy and Visibility - Should reading goals be shareable or visible to other users? → A: Goals are private to each user; no sharing or visibility to other users

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set Annual Reading Goal (Priority: P1)

A user wants to set a goal for how many books they aim to read during a specific calendar year. They navigate to the Settings page, find the Reading Goals section, and enter their target number of books along with the year they want to track. Users can create and edit goals for the current year and future years. Historical goals (past years) are viewable but cannot be edited.

**Why this priority**: This is the foundation of the entire feature. Without the ability to set a goal, none of the tracking or visualization features can function. This delivers immediate value by allowing users to commit to a reading target.

**Independent Test**: Can be fully tested by navigating to Settings, setting a goal of "40 books for 2026", saving it, and verifying the goal persists when viewing Settings again. Delivers value by allowing users to formalize their reading commitment.

**Acceptance Scenarios**:

1. **Given** a user is logged in and viewing the Settings page, **When** they navigate to the "Reading Goals" section and enter "40" for year "2026" and save, **Then** the system stores the goal and displays "Your goal: 40 books for 2026"
2. **Given** a user has already set a goal of "40 books for 2026", **When** they update it to "30 books for 2026" mid-year, **Then** the system updates the stored goal and all progress calculations reflect the new target
3. **Given** a user attempts to set a goal of "0" or negative number, **When** they submit the form, **Then** the system displays a validation error "Goal must be at least 1 book"
4. **Given** a user wants to set goals for multiple years, **When** they create "40 books for 2026" and "50 books for 2027", **Then** both goals are stored separately and can be viewed/edited independently
5. **Given** a user is viewing Settings in 2026 and has a goal for 2025, **When** they attempt to edit the 2025 goal, **Then** the system prevents editing and displays the goal as read-only with the message "Historical goals cannot be modified"

---

### User Story 2 - View Progress on Dashboard (Priority: P2)

A user with an active reading goal wants to see their current progress at a glance. When they visit the dashboard (home page), they see a Reading Goal widget displaying their target for the current calendar year, current progress (X / Y books), a visual progress bar, and an indicator of whether they're on track, ahead, or behind schedule. Only the current year's goal is shown on the dashboard; historical and future year goals are accessible in Settings.

**Why this priority**: This is the primary motivation feature that keeps users engaged. Seeing progress visualized provides immediate feedback and motivation. This is P2 because it depends on P1 (setting a goal) but is critical to the feature's core value proposition.

**Independent Test**: Can be tested by setting a goal, marking books as completed, and verifying the dashboard widget shows correct counts, progress percentage, and pace indicator (e.g., "12 / 40 books - 30% - Behind pace"). Delivers value by providing motivation and visibility into reading habits.

**Acceptance Scenarios**:

1. **Given** a user has a goal of "40 books for 2026" and has completed 12 books this year, **When** they view the dashboard on March 1, 2026, **Then** they see "12 / 40 books" with a 30% progress bar and an indicator showing "Behind pace - 3 books behind"
2. **Given** a user has completed 25 books against a goal of 40 by July 1 (mid-year), **When** they view the dashboard, **Then** they see "25 / 40 books" with a 62.5% progress bar and "Ahead of pace - 5 books ahead"
3. **Given** a user has completed 45 books against a goal of 40, **When** they view the dashboard, **Then** they see "45 / 40 books" with a 100%+ progress bar and a "Goal exceeded!" badge
4. **Given** a user has no active goal for the current year, **When** they view the dashboard, **Then** the Reading Goal widget displays a prompt to "Set your reading goal for 2026"
5. **Given** a user is viewing their progress mid-year and has been reading for at least 14 days or completed at least 2 books, **When** they hover over or tap the pace indicator, **Then** they see a projected finish date message like "At this pace, you'll finish by November 15, 2026"
6. **Given** a user is viewing their progress on January 5th with 1 book completed (less than 14 days and less than 2 books), **When** they view the dashboard, **Then** no projected finish date is shown (insufficient data for reliable projection)

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

### User Story 4 - Filter Library by Completion Year (Priority: P3)

A user wants to browse books they completed in a specific year. In the library view, they can filter by "Year Completed" to see only books finished during selected years. The filter shows available years with book counts (e.g., "2025 (12 books)", "2024 (48 books)").

**Why this priority**: This is P3 because it's a convenience feature that enhances library browsing but isn't critical to the core goal-setting and tracking functionality. It provides additional value for users who want to reflect on past reading years.

**Independent Test**: Can be tested by completing books across multiple years (2024, 2025, 2026), then using the year filter dropdown to view only 2025 books and verifying the correct subset appears. Delivers value by enabling yearly reading retrospectives.

**Acceptance Scenarios**:

1. **Given** a user has completed 12 books in 2025 and 8 books in 2024, **When** they view the library page, **Then** the "Year Completed" filter dropdown shows "2025 (12 books)" and "2024 (8 books)" as options
2. **Given** a user selects "2025" from the year filter, **When** the filter is applied, **Then** only the 12 books completed in 2025 are displayed in the library
3. **Given** a user has books in their library but none are marked as completed, **When** they view the year filter dropdown, **Then** it displays a message "No completed books yet"
4. **Given** a user has books completed in 2024, 2025, and 2026, **When** they view the filter dropdown, **Then** years are listed in descending order (2026, 2025, 2024)

---

### Edge Cases

- What happens when a user sets multiple goals for the same year? The system enforces one goal per year per user through database constraints, showing an error "You already have a goal for 2026. Edit your existing goal instead."
- How does the system handle books without completion dates? Books without completion dates are not counted toward any annual goal, as they are not considered "finished."
- What if a user deletes their reading goal mid-year? The goal is removed from the database, the dashboard widget disappears, and library filtering by year still works (using completion dates, not goals).
- How is "on track / ahead / behind" calculated? Calculate expected pace as (goal / 365 days * days elapsed in year). Compare actual books completed to expected books. Ahead if actual > expected + 1, behind if actual < expected - 1, on track otherwise.
- What happens on January 1st when switching to a new year? The dashboard automatically displays the new year's goal (if set) with 0 books completed. If no goal exists for the new year, the dashboard prompts the user to create one. Previous year's goal is no longer shown on the dashboard but remains accessible in Settings for historical reference.
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
- **FR-008**: System MUST calculate and display whether the user is on track, ahead, or behind their annual pace
- **FR-009**: System MUST show a visual progress bar representing completion percentage (books completed / goal target * 100%)
- **FR-010**: System MUST calculate projected finish date based on current reading pace (books per day) only when sufficient data exists (at least 14 days elapsed in the year OR at least 2 books completed, whichever comes first)
- **FR-011**: System MUST indicate when a goal has been exceeded with a "Goal exceeded!" badge
- **FR-012**: System MUST provide a year filter in the library view showing only years with completed books
- **FR-013**: System MUST display book counts for each year in the filter dropdown (e.g., "2025 (12 books)")
- **FR-014**: System MUST persist goal changes and immediately reflect updates in all progress calculations
- **FR-015**: System MUST validate that year values are positive four-digit integers representing valid calendar years
- **FR-016**: Dashboard widget MUST display only the current calendar year's goal; past and future year goals are accessible only in Settings
- **FR-017**: System MUST allow editing goals for current and future years only; goals for past years are read-only
- **FR-018**: System MUST retain all historical goals indefinitely for user reference
- **FR-019**: System MUST ensure reading goals are private to each user with no sharing or cross-user visibility

### Key Entities

- **Reading Goal**: Represents a user's target for books to read in a specific calendar year. Key attributes: user identifier, year (integer), books_goal (integer >= 1), creation timestamp, last updated timestamp. One goal per user per year.
- **Completed Book**: Derived from existing reading_sessions or books table via completedDate field queries. Key attribute: completion date (used to determine which year a book counts toward). Relationship: Multiple completed books contribute to one annual goal based on matching year. No separate tracking table is created for annual goals - counts are calculated on-demand from existing data.
- **Progress Calculation**: Derived entity representing current state of a goal. Attributes: books completed (count), books remaining (goal - completed), completion percentage, pace status (on track / ahead / behind), projected finish date. Calculated dynamically from completed books and goal target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can set an annual reading goal in under 30 seconds
- **SC-002**: Progress updates appear on the dashboard within 2 seconds of marking a book as completed
- **SC-003**: Users can view their reading progress for the current year on the dashboard without needing to navigate to a separate page
- **SC-004**: 90% of users can correctly interpret their pace status (on track / ahead / behind) based on the visual indicators
- **SC-005**: The system accurately calculates progress across 1000+ completed books per user without performance degradation
- **SC-006**: Year filter in library view displays results in under 1 second for users with up to 500 completed books
- **SC-007**: Users can update their goal mid-year and see recalculated progress reflected immediately
- **SC-008**: Projected finish date calculations have a margin of error within ±3 days when tested against actual completion patterns

## Assumptions

- Users track book completion through an existing "mark as read" or "reading session" feature that records completion dates in a reading_sessions or books table with a completedDate field
- The annual goals feature queries existing completion data directly without duplicating or caching book counts
- The system already has a user authentication system in place (referenced as user_id)
- A Settings page exists where new configuration sections can be added
- A dashboard/home page exists where widgets can be displayed
- A library view exists that displays the user's book collection and supports filtering
- Completion dates are stored in a format that allows year extraction (ISO date format or similar)
- The system operates in a single timezone per user or uses UTC with proper date handling
- "Books completed" means books with a recorded completion date, not partial progress
- The year in a completion date determines which annual goal the book counts toward
- Progress calculations should round to whole numbers for display (e.g., 62.5% displayed as 63%)
- Pace calculations assume linear reading rate (average books per day/week/month)
- Projected finish dates require a minimum sample size (14 days OR 2 books) to ensure statistical reliability
- The feature will be available to all registered users without additional permissions required
- Historical goals are never automatically deleted; they remain accessible indefinitely for historical reference
- Goal editability is determined by comparing the goal's year to the current calendar year (past years are read-only)
- Reading goals are completely private to each user; no social sharing, public profiles, or cross-user visibility features are included in this specification
