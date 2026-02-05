# Feature Specification: Support Non-Calibre Books

**Feature Branch**: `003-non-calibre-books`  
**Created**: 2026-02-05  
**Status**: Draft  
**Input**: User description: "I'd like begin preparing for this feature in a new branch: https://github.com/masonfox/tome/issues/185. This will be spec-003"

## Clarifications

### Session 2026-02-05

- Q: When a user manually adds a book, how should the system enforce uniqueness to prevent accidental duplicates? → A: Warn but allow - show warning if title+author match exists, let user proceed
- Q: When fetching metadata from external providers (like Hardcover), what should happen if the API request times out or takes too long? → A: 5-second timeout, automatically fallback to manual entry form
- Q: When a user is filling out the manual book form, should fields be validated in real-time (as they type) or only when they submit the form? → A: Real-time + submit - validate as user types and again on submit
- Q: If the external metadata provider (like Hardcover) has rate limits, how should the system handle exceeding those limits? → A: Graceful fallback with message - fallback to manual entry, show informative message
- Q: For the page count field in manual book creation, what validation rules should apply? → A: Positive integer only with reasonable maximum (1-10000 pages)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Book Addition (Priority: P1)

As a reader with physical books, I want to manually add books to my Tome library so that I can track my reading progress for both digital and physical books in one place.

**Why this priority**: This is the core value proposition - enabling users who mix physical and digital books to have a single source of truth for their reading. Without this, users cannot track physical books at all.

**Independent Test**: Can be fully tested by adding a manual book entry through the UI, logging progress for it, and viewing it in the library alongside Calibre-sourced books. Delivers immediate value by allowing tracking of non-Calibre books.

**Acceptance Scenarios**:

1. **Given** I'm viewing my library, **When** I click "Add Manual Book" and enter book details (title, author, page count), **Then** the book appears in my library with a visual indicator showing it's a manual entry
5. **Given** I'm filling out the manual book form, **When** I type in a required field (title, author, or page count), **Then** the system validates the field in real-time and displays any validation errors immediately
6. **Given** I've filled out the manual book form with invalid data, **When** I attempt to submit, **Then** the system validates all fields again and prevents submission until all required fields are valid
7. **Given** I'm entering page count in the manual book form, **When** I enter a value less than 1 or greater than 10000, **Then** the system displays a validation error indicating page count must be between 1 and 10000
4. **Given** I'm adding a manual book with title and author matching an existing book, **When** I submit the form, **Then** system displays a warning about potential duplication but allows me to proceed with creation
2. **Given** I have manually added a book, **When** I log reading progress for that book, **Then** progress is saved and displayed just like Calibre books
3. **Given** I have both Calibre and manual books in my library, **When** I view my library, **Then** both types are displayed together with clear visual differentiation (source badges)

---

### User Story 2 - Library Sync Isolation (Priority: P1)

As a user with mixed book sources, I want Calibre syncs to only affect Calibre-sourced books so that my manually added books are never accidentally removed or modified during sync operations.

**Why this priority**: Critical for data integrity. Without proper sync isolation, manual books could be orphaned or removed during Calibre sync, destroying user data and trust in the system.

**Independent Test**: Can be tested by adding manual books, running a Calibre sync that removes books, and verifying manual books remain untouched. Delivers value by ensuring data safety.

**Acceptance Scenarios**:

1. **Given** I have manual books in my library, **When** a Calibre sync removes books from Calibre, **Then** only Calibre-sourced books are marked as orphaned, manual books remain active
2. **Given** I have manual books in my library, **When** a Calibre sync adds or updates books, **Then** manual books are unchanged and unaffected
3. **Given** I have a book with the same title in both Calibre and manual sources, **When** sync occurs, **Then** both books remain as separate entities with different source identifiers

---

### User Story 3 - Source-Based Filtering and Display (Priority: P2)

As a user managing multiple book sources, I want to filter my library by source (Calibre vs Manual) so that I can quickly view subsets of my collection based on how I obtained the books.

**Why this priority**: Enhances usability for power users but isn't essential for core functionality. Users can still use the feature effectively without filtering.

**Independent Test**: Can be tested by adding books from different sources, applying source filters, and verifying correct subset display. Delivers value through improved organization.

**Acceptance Scenarios**:

1. **Given** I have books from both Calibre and manual sources, **When** I apply a "Calibre only" filter, **Then** only Calibre-sourced books are displayed
2. **Given** I have books from multiple sources, **When** I apply a "Manual only" filter, **Then** only manually added books are displayed
3. **Given** I have filtered by source, **When** I clear the filter, **Then** all books from all sources are displayed again

---

### User Story 4 - External Metadata Provider Integration (Priority: P3)

As a user adding manual books, I want the system to optionally fetch metadata from external providers like Hardcover so that I don't have to manually enter all book details.

**Why this priority**: Quality-of-life enhancement that reduces friction but isn't required for core functionality. Users can still manually enter all details if needed.

**Independent Test**: Can be tested by initiating a manual book add, searching an external provider, selecting a book, and verifying metadata population. Delivers value through improved user experience.

**Acceptance Scenarios**:

1. **Given** I'm adding a manual book, **When** I search for the book title in the external provider search, **Then** matching books are displayed with cover images and basic metadata
4. **Given** I'm searching for a book in an external provider, **When** the API request exceeds 5 seconds, **Then** the system automatically falls back to the manual entry form and notifies me that external search is unavailable
5. **Given** I'm searching for a book in an external provider, **When** the provider's rate limit is exceeded, **Then** the system automatically falls back to the manual entry form and displays an informative message that the search service is temporarily unavailable
2. **Given** I've searched for a book in an external provider, **When** I select a book from results, **Then** title, author, page count, and cover image are auto-populated in the form
3. **Given** I've auto-populated book details from an external provider, **When** I edit any field before saving, **Then** my manual edits override the fetched metadata

---

### Edge Cases

- What happens when a user manually adds a book that already exists in their Calibre library (same title and author)? System checks for title+author matches across all sources, displays a warning showing the existing book(s) and their source(s), but allows the user to proceed with creation after acknowledging the warning.
- How does the system handle manual books when a user later adds the same book to Calibre? Both books remain separate; the user can optionally merge or delete one.
- What happens if an external metadata provider is unavailable or returns no results? System implements a 5-second timeout for API requests. If the provider is unavailable, times out, returns no results, or returns a rate limit error, the system automatically transitions to the manual entry form and displays an informative notification explaining why external search is unavailable.
- How are orphaned Calibre books distinguished from manual books in the UI? Orphaned books have a distinct "orphaned" indicator separate from the source badge.
- What happens when syncing with an empty Calibre library? Manual books remain untouched; only Calibre-sourced books would be orphaned.
- What happens if a user tries to submit the manual book form with missing required fields? Real-time validation displays error messages as the user types in each field. On submission attempt, the system validates all fields again and prevents form submission, highlighting all invalid or empty required fields until corrected.
- What happens if a user enters an invalid page count (e.g., 0, negative, or >10000)? The system displays a real-time validation error indicating that page count must be a positive integer between 1 and 10000, and prevents form submission until corrected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow Calibre ID to be null for books, enabling books without Calibre sources
- **FR-002**: System MUST track the source of each book (Calibre, Manual, or External Provider like Hardcover)
- **FR-003**: System MUST store external provider IDs for books sourced from external metadata providers
- **FR-004**: System MUST restrict sync operations to only affect books where source equals 'calibre'
- **FR-005**: System MUST NOT orphan or remove manual books during Calibre sync operations
- **FR-006**: Users MUST be able to create books manually through a dedicated interface
- **FR-007**: Manual book creation MUST collect at minimum: title, author, and page count
- **FR-007a**: System MUST check for existing books with matching title and author during manual book creation and display a warning to the user, but MUST allow creation to proceed if user confirms
- **FR-007b**: System MUST validate required fields (title, author, page count) in real-time as the user types and perform final validation on form submission, preventing submission if any required field is invalid or empty
- **FR-007c**: System MUST validate page count as a positive integer with a minimum value of 1 and maximum value of 10000, displaying validation errors for values outside this range
- **FR-008**: System MUST display visual indicators (badges/icons) distinguishing book sources in the library
- **FR-009**: System MUST allow all existing Tome features (progress tracking, sessions, goals, streaks) to work identically for manual and Calibre books
- **FR-010**: System MUST provide UI access to add manual books from the main library view
- **FR-011**: System MUST support optional metadata search from external providers during manual book creation
- **FR-011a**: System MUST implement a 5-second timeout for external metadata provider API requests and automatically fallback to manual entry form when timeout is reached or provider is unavailable
- **FR-011b**: System MUST handle external provider rate limit errors by automatically falling back to manual entry form and displaying an informative message to the user that the search service is temporarily unavailable
- **FR-012**: System MUST allow filtering library view by book source (optional for P2)

### Key Entities

- **Book (Extended)**: Represents any tracked book regardless of source
  - Calibre ID (now optional/nullable): Links to Calibre database when source is 'calibre'
  - Source: Identifies origin ('calibre', 'manual', 'hardcover')
  - External ID: Stores provider-specific ID for books from external services
  - Page Count: Positive integer with valid range 1-10000
  - All existing attributes (title, author, status, dates, etc.) remain unchanged

- **Sync Operation (Behavioral Change)**: Calibre library synchronization
  - Only processes books where source equals 'calibre'
  - Only orphans books where source equals 'calibre'
  - Ignores manual and external provider books completely

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully add a manual book and log progress within 2 minutes of first attempt
- **SC-002**: Calibre sync operations complete without affecting manual books (100% isolation verified through testing)
- **SC-003**: Users with mixed book sources report successful tracking of both physical and digital books in post-feature feedback
- **SC-004**: Manual books support all existing Tome features (sessions, progress, goals, streaks) with identical functionality to Calibre books
- **SC-005**: Library view clearly distinguishes book sources with visual indicators that 90%+ of users understand without explanation (based on user testing)
- **SC-006**: Book filtering by source (when implemented) allows users to view source-specific subsets in under 3 seconds
- **SC-007**: External metadata provider integration (when implemented) reduces manual data entry time by 70% for users who use the feature
- **SC-008**: External metadata provider requests that exceed 5 seconds automatically fallback to manual entry without user intervention 100% of the time
- **SC-009**: External metadata provider rate limit errors result in graceful fallback to manual entry with informative messaging 100% of the time

## Assumptions

- Users understand the difference between Calibre-sourced and manually added books
- Most users mixing physical and digital books will want to see both in a unified library view by default
- Duplicate books (same title/author from different sources) are acceptable; users can manage duplicates themselves
- Manual books do not require ISBN or other formal identifiers; title/author/pages are sufficient minimums
- External metadata providers will use standard REST APIs accessible from the Tome backend
- The Hardcover API (if used) provides adequate metadata (title, author, pages, cover) without authentication requirements
- Sync performance will not degrade significantly with mixed-source libraries of typical size (under 10,000 books)
- Visual source indicators (badges/icons) are sufficient differentiation; color-coding is not required
- Users do not expect manual books to retroactively sync with Calibre if later added to Calibre library

## Dependencies

- No external service dependencies for core manual book functionality (P1)
- External metadata provider API (e.g., Hardcover) required for P3 auto-population feature
- Existing Tome architecture (database, repositories, sync service) must remain intact
- Calibre database structure remains unchanged (read-only except ratings)

## Out of Scope

- Automatic detection of duplicate books across sources (user must manually identify)
- Migration or merging of manual books into Calibre library
- Bulk import of manual books from CSV or other formats
- Advanced metadata fields beyond core requirements (ISBN, publisher, publication date optional for future)
- Multi-user access or sharing of manual books
- Export of manual books to other systems (beyond existing Tome export capabilities)
- Editing or updating books in Calibre database from manual entries
- Automatic matching between manual books and later-added Calibre books
