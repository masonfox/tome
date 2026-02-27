# Feature Specification: Support Non-Calibre Books

**Feature Branch**: `003-non-calibre-books`  
**Created**: 2026-02-05  
**Revised**: 2026-02-13 (Source vs. Metadata Provider Separation, Many-to-Many Book Sources)  
**Status**: Draft  
**Input**: User description: "I'd like begin preparing for this feature in a new branch: https://github.com/masonfox/tome/issues/185. This will be spec-003"

### Architectural Revision #1 (2026-02-13): Source vs. Metadata Provider

The original spec treated Hardcover and OpenLibrary as "sources" stored on book records alongside Calibre and Manual. After analysis, this conflated two distinct concepts:

- **Sources** (`BookSource`): Where the book record is owned/managed — `"calibre" | "manual"`. Stored on the book record.
- **Metadata Providers** (`ProviderId`): Search tools used to populate metadata — `"hardcover" | "openlibrary"`. Ephemeral; no trace on the book record.

Key changes: `source` enum narrowed to 2 values, `externalId` column removed, source migration eliminated, books from federated search always get `source='manual'`.

### Architectural Revision #2 (2026-02-13): Many-to-Many Book Sources

After further analysis to support future multi-source integrations (e.g., Audiobookshelf), the single `books.source` field has been refactored to a many-to-many `book_sources` table:

- **Books with NO sources** (`book_sources` entries): Implicit "manual" or "unconnected" books. No provider badge shown.
- **Books with ONE source**: Single-source books (e.g., only in Calibre). Display single provider badge.
- **Books with MULTIPLE sources**: Multi-source books (e.g., Calibre + Audiobookshelf). Display multiple badges side-by-side.

Key changes: `books.source` field removed, `book_sources` many-to-many table added, "manual" provider removed from provider_configs, books without sources are implicitly manual. This enables future features like "To Get" status (books to acquire) and multi-source support (e.g., audiobook in Audiobookshelf, ebook in Calibre).

## Clarifications

### Session 2026-02-05 (Initial)

- Q: When a user manually adds a book, how should the system enforce uniqueness to prevent accidental duplicates? → A: Warn but allow - show warning if title+author match exists, let user proceed
- Q: When fetching metadata from external providers (like Hardcover), what should happen if the API request times out or takes too long? → A: 5-second timeout, automatically fallback to manual entry form
- Q: When a user is filling out the manual book form, should fields be validated in real-time (as they type) or only when they submit the form? → A: Real-time + submit - validate as user types and again on submit
- Q: If the external metadata provider (like Hardcover) has rate limits, how should the system handle exceeding those limits? → A: Graceful fallback with message - fallback to manual entry, show informative message
- Q: For the page count field in manual book creation, what validation rules should apply? → A: Positive integer only with reasonable maximum (1-10000 pages)

### Session 2026-02-05 (Architecture Decisions)

- Q: How should providers be registered in the system? → A: Registry pattern (extensible) - allows future providers without core code changes
- Q: Should users search multiple providers at once? → A: Federated search (merged) - search all enabled providers simultaneously, merge results
- Q: Can book source change after creation? → A: ~~Allow source migration~~ **Revised 2026-02-13**: Source is immutable. No migration. Books from federated search always get source='manual'.
- Q: How to handle same book from multiple sources? → A: Warn about duplicates — prompt user with existing match, allow proceeding or cancelling
- Q: Where to store provider configuration? → A: Database table (provider_configs) - allows runtime enable/disable
- Q: How many providers to implement initially? → A: Hardcover + OpenLibrary - validates architecture works for multiple providers

### Session 2026-02-05 (Clarification Round 2)

- Q: How should provider capabilities be structured and accessed? → A: Static TypeScript interface (IMetadataProvider with boolean flags), checked at runtime via provider registry
- Q: What encryption approach for API keys and credentials? → A: No encryption (plaintext) - acceptable for single-user local SQLite deployments
- Q: What similarity threshold for federated search result deduplication? → A: No deduplication - display all results from all providers without merging
- Q: What should trigger 'degraded' health status? → A: Binary health (healthy/unavailable) - removed 'degraded' state from spec
- Q: Should duplicate detection during migration check other external providers? → A: Single-provider scope - allow same book from multiple external providers
- Q: Circuit breaker cooldown period (inconsistency found)? → A: 60 seconds (resolved inconsistency between Edge Cases and FR-017b)

### Session 2026-02-05 (Spec Refinement)

- Q: What events/metrics should be logged for provider operations? → A: Add FR-021 with explicit logging requirements (search requests, metadata fetch, circuit breaker state changes, source migrations, duplicate detection)
- Q: How should federated search results be ranked? → A: Hardcoded priority - Hardcover first, then OpenLibrary (FR-011g)
- Q: What optional metadata fields can users enter for manual books? → A: Add FR-007d - ISBN, publisher, publication date, description, cover image URL (optional fields)
- Q: How should provider configs be initialized? → A: Settings UI approach - all provider configuration managed through application settings (FR-022)
- Q: How should search cache be invalidated? → A: Add FR-011d-1 - invalidate when provider configuration changes
- Q: How to prevent concurrent migration race conditions? → A: Add FR-016f - pessimistic locking for source migration operations

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Book Addition (Priority: P1)

As a reader with physical books, I want to manually add books to my Tome library so that I can track my reading progress for both digital and physical books in one place.

**Why this priority**: This is the core value proposition - enabling users who mix physical and digital books to have a single source of truth for their reading. Without this, users cannot track physical books at all.

**Independent Test**: Can be fully tested by adding a manual book entry through the UI, logging progress for it, and viewing it in the library alongside Calibre-sourced books. Delivers immediate value by allowing tracking of non-Calibre books.

**Acceptance Scenarios**:

1. **Given** I'm viewing my library, **When** I click "Add Manual Book" and enter book details (title, author, page count), **Then** the book appears in my library with a visual indicator showing it's a manual entry
2. **Given** I'm filling out the manual book form, **When** I type in a required field (title, author, or page count), **Then** the system validates the field in real-time and displays any validation errors immediately
3. **Given** I've filled out the manual book form with invalid data, **When** I attempt to submit, **Then** the system validates all fields again and prevents submission until all required fields are valid
4. **Given** I'm entering page count in the manual book form, **When** I enter a value less than 1 or greater than 10000, **Then** the system displays a validation error indicating page count must be between 1 and 10000
5. **Given** I'm adding a manual book with title and author matching an existing book, **When** I submit the form, **Then** system displays a warning about potential duplication but allows me to proceed with creation
6. **Given** I have manually added a book, **When** I log reading progress for that book, **Then** progress is saved and displayed just like Calibre books
7. **Given** I have both Calibre and manual books in my library, **When** I view my library, **Then** both types are displayed together with clear visual differentiation (source badges)

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
2. **Given** I have books from multiple sources, **When** I apply a "Manual only" filter, **Then** only manually added books are displayed (including those added via federated search)
3. **Given** I have filtered by source, **When** I clear the filter, **Then** all books from all sources are displayed again

---

### User Story 4 - Federated Metadata Search (Priority: P3)

As a user adding manual books, I want the system to search multiple external providers simultaneously (Hardcover, OpenLibrary) so that I can find the best metadata match without searching each provider individually.

**Why this priority**: Quality-of-life enhancement that reduces friction but isn't required for core functionality. Users can still manually enter all details if needed.

**Independent Test**: Can be tested by initiating a manual book add, searching for a book title, and verifying results from multiple providers are displayed in a merged list. Delivers value through improved user experience.

**Acceptance Scenarios**:

1. **Given** I'm adding a manual book, **When** I search for a book title, **Then** the system searches ALL enabled providers simultaneously within 5 seconds
2. **Given** multiple providers return results, **When** viewing search results, **Then** results are displayed with provider badges (Hardcover, OpenLibrary) and sorted by provider priority (Hardcover first, then OpenLibrary)
3. **Given** I see search results from multiple providers, **When** I select a result, **Then** the book is created with source='manual' and the selected provider's metadata pre-populated
4. **Given** I'm searching for a book, **When** a provider's API request exceeds 5 seconds, **Then** that provider's results are excluded but other providers' results are shown
5. **Given** I'm searching for a book, **When** a provider returns a rate limit error, **Then** that provider's results are excluded with a message that the service is temporarily unavailable
6. **Given** I've selected a book from search results, **When** I review the auto-populated form, **Then** I can edit any field before saving and my edits override the fetched metadata
7. **Given** all enabled providers fail or timeout, **When** the search completes, **Then** the system falls back to the manual entry form with a message explaining provider unavailability

---

### User Story 5 - Duplicate Detection During Book Addition (Priority: P2)

As a user adding books from federated search, I want the system to detect when I'm adding a book that already exists in my library so that I can avoid accidental duplicates.

**Why this priority**: Prevents accidental duplicates and helps users maintain a clean library. Important for long-term library management but not essential for initial functionality.

**Independent Test**: Can be tested by adding a manual book, then searching for the same book via federated search, and verifying the system warns about the duplicate.

**Acceptance Scenarios**:

1. **Given** I have a book in my library, **When** I select the same book from federated search results (>85% title+author match or ISBN match), **Then** the system displays a warning: "This book may already exist in your library" with the matching book shown
2. **Given** the system detects a duplicate, **When** I choose to proceed, **Then** a new book with source='manual' is created and both books exist independently
3. **Given** the system detects a duplicate, **When** I choose to cancel, **Then** no new book is created and I return to the search results

---

### Edge Cases

- **Cross-source duplicates**: When a user adds a book (manually or via federated search) that already exists in their library (same title+author or ISBN), the system checks for matches across ALL sources, displays a warning showing the existing book(s) and their source(s), and allows the user to proceed or cancel.
- **Manual to Calibre later addition**: If a user has a manual book and later adds the same book to Calibre, the next Calibre sync creates a new book with source='calibre'. The system SHOULD detect this as a duplicate and offer to migrate the manual book's sessions/progress to the Calibre book (future enhancement, out of scope for Phase 1).
- **Provider unavailability**: If ALL external metadata providers are unavailable, timeout, or return rate limit errors, the system transitions to the pure manual entry form and displays a notification explaining that external search is unavailable.
- **Orphaned Calibre books vs. manual books**: Orphaned books have a distinct "orphaned" indicator separate from the source badge. Only books with source='calibre' can become orphaned.
- **Empty Calibre library sync**: Manual books remain untouched; only Calibre-sourced books would be orphaned.
- **Invalid form submission**: Real-time validation displays error messages as the user types. On submission attempt, the system validates all fields again and prevents form submission, highlighting all invalid or empty required fields.
- **Invalid page count**: The system displays a real-time validation error indicating that page count must be a positive integer between 1 and 10000, and prevents form submission until corrected.
- **Provider health degradation**: If a provider fails multiple consecutive requests (5 failures), the system automatically disables that provider via circuit breaker and displays an admin notification. The provider remains disabled for 60 seconds before attempting to re-enable.
- **Federated search result from provider**: When a user selects a result from Hardcover or OpenLibrary, the book is always created with source='manual'. The provider identity is used only for display in search results (via provider badges) and is not stored on the book record.

## Requirements *(mandatory)*

### Functional Requirements

#### Core Multi-Source Support

- **FR-001**: System MUST allow Calibre ID to be null for books, enabling books without Calibre sources
- **FR-002**: System MUST track the source of each book using a controlled vocabulary: 'calibre', 'manual'
- **FR-002a**: Source MUST be validated against allowed values
- **FR-002b**: Source is immutable after creation (no source migration)
- **FR-003**: ~~REMOVED~~ — `externalId` column eliminated. Metadata providers are ephemeral; no provider tracking on book records.
- **FR-003a**: ~~REMOVED~~ — No externalId means no (source, externalId) uniqueness constraint needed.
- **FR-003b**: System MUST allow the same book from different sources (Calibre and manual records can coexist)
- **FR-004**: System MUST restrict Calibre sync operations to only affect books where source equals 'calibre'
- **FR-005**: System MUST NOT orphan or remove manual books or external provider books during Calibre sync operations

#### Manual Book Creation

- **FR-006**: Users MUST be able to create books manually through a dedicated interface with source='manual'
- **FR-007**: Manual book creation MUST collect at minimum: title, author, and page count
- **FR-007a**: System MUST check for existing books with matching title and author across ALL sources during manual book creation
- **FR-007b**: System MUST validate required fields (title, author, page count) in real-time as the user types and perform final validation on form submission
- **FR-007c**: System MUST validate page count as a positive integer with a minimum value of 1 and maximum value of 10000
- **FR-007d**: Manual book creation MAY optionally collect: ISBN, publisher, publication date, description (these fields support richer metadata but are not required). Cover images may be attached via file upload.
- **FR-007e**: When creating a book via federated provider search, the system MUST attempt to download the provider's cover image to local storage (`./data/covers/{bookId}.{ext}`) after successful book creation. Download failure MUST NOT block book creation (graceful fallback — book is created without a cover).
- **FR-007f**: Users MUST be able to upload a cover image (JPEG, PNG, WebP, GIF; max 5MB) for any manual book via `POST /api/books/{id}/cover`. Uploading a new cover replaces the existing one.

#### UI & Display

- **FR-008**: System MUST display visual indicators (badges/icons) distinguishing book sources in the library (e.g., "Calibre", "Manual")
- **FR-009**: System MUST allow all existing Tome features (progress tracking, sessions, goals, streaks) to work identically for books from any source
- **FR-010**: System MUST provide UI access to add manual books from the main library view
- **FR-012**: System MUST allow filtering library view by book source (Calibre, Manual)

#### Provider Architecture

- **FR-013**: System MUST implement an extensible architecture that supports multiple metadata providers
- **FR-013a**: Each provider MUST implement a TypeScript interface declaring its capabilities via boolean flags (hasSearch, hasMetadataFetch, hasSync, requiresAuth), checked at runtime via the provider registry
- **FR-013b**: Providers MUST be independently enabled or disabled without affecting other providers
- **FR-014**: System MUST maintain provider configurations including enabled status, settings, and credentials
- **FR-014a**: System MUST provide the ability to configure provider-specific settings (timeouts, API endpoints, etc.)
- **FR-014b**: System MUST support both environment variable configuration (for initial setup) and runtime configuration
- **FR-014c**: Credentials MAY be stored in plaintext in provider_configs JSON (acceptable for single-user local SQLite deployments)

#### Federated Metadata Search

- **FR-011**: System MUST support federated metadata search from multiple external providers during manual book creation
- **FR-011a**: System MUST search ALL enabled providers simultaneously with a 5-second timeout per provider
- **FR-011b**: System MUST handle provider rate limit errors by excluding that provider from results with an informative message
- **FR-011c**: System MUST display which provider each search result came from (via badges/logos)
- **FR-011d**: System SHOULD cache search results for 5 minutes (TTL) to reduce redundant API calls, keyed by (query, enabled providers)
- **FR-011d-1**: Cache MUST be invalidated when provider configuration changes (enable/disable)
- **FR-011e**: System MUST merge results from multiple providers and display all results without deduplication (users see all provider options)
- **FR-011f**: When all providers fail or timeout, system MUST fall back to pure manual entry form with explanatory message
- **FR-011g**: Search results MUST be sorted by hardcoded provider priority (Hardcover first, then OpenLibrary), preserving each provider's internal result ranking

#### Duplicate Detection

- **FR-015**: System MUST detect potential duplicates during book creation using fuzzy matching on title+author (>85% similarity threshold) and ISBN matching
- **FR-015a**: When duplicate detected during manual book creation, system MUST show warning but allow user to proceed
- **FR-015b**: When duplicate detected during federated search book addition, system MUST show warning with existing match(es) and allow user to proceed or cancel
- **FR-016**: ~~REMOVED~~ — Source migration eliminated. Books added via federated search always get source='manual'. No source transitions occur.
- **FR-016a-f**: ~~REMOVED~~ — All source migration sub-requirements eliminated.

#### Error Handling & Resilience

- **FR-017**: System MUST implement circuit breaker pattern for each provider independently to prevent cascading failures
- **FR-017a**: Circuit breaker MUST automatically disable provider after 5 consecutive failures
- **FR-017b**: Circuit breaker MUST attempt to re-enable provider after a cooldown period (60 seconds)
- **FR-018**: System MUST implement timeouts for provider operations:
  - Search operations: 5 seconds per provider
  - Metadata fetch: 10 seconds per provider
  - Health checks: 3 seconds per provider
- **FR-019**: System MUST respect provider rate limits and implement appropriate backoff strategies
- **FR-019a**: When provider rate limit reached, system MUST queue requests with exponential backoff or exclude provider from current operation
- **FR-019b**: User MUST see informative message when provider is rate limited or unavailable

#### Built-in Providers

- **FR-020**: System MUST include four built-in providers:
  - **CalibreProvider**: Syncs existing Calibre books (source='calibre'), always enabled if CALIBRE_DB_PATH set
  - **ManualProvider**: User-created books (source='manual'), always enabled, no external metadata
  - **HardcoverProvider**: Metadata search provider — fetches metadata from Hardcover API, requires API key. Books added via this provider get source='manual'.
  - **OpenLibraryProvider**: Metadata search provider — fetches metadata from OpenLibrary API, no auth required. Books added via this provider get source='manual'.

#### Observability & Monitoring

- **FR-021**: System MUST log key provider operations for debugging and monitoring
- **FR-021a**: Provider operations MUST log: search requests (query, provider, result count, duration), metadata fetch requests (provider, externalId, success/failure, duration), circuit breaker state changes (provider, old state, new state, reason)
- **FR-021b**: Duplicate detection events SHOULD log: potential duplicate book IDs, similarity score, user decision (proceed/cancel)

#### Provider Bootstrap & Initialization

- **FR-022**: Provider configurations MUST be manageable through application settings UI
- **FR-022a**: Settings UI MUST allow users to enable/disable each provider independently
- **FR-022b**: Settings UI MUST allow users to configure provider credentials (API keys) for providers requiring authentication
- **FR-022c**: Settings UI MUST allow users to configure provider-specific settings (timeouts, API endpoints, priority order)

### Non-Functional Requirements

- **NFR-001**: Federated search MUST return merged results within 6 seconds (5s provider timeout + 1s processing)
- **NFR-002**: Library filtering by source MUST complete in under 3 seconds for libraries up to 10,000 books
- **NFR-003**: ~~REMOVED~~ — Source migration eliminated.
- **NFR-004**: Circuit breaker overhead MUST be less than 5ms per provider operation
- **NFR-005**: Provider configuration changes MUST take effect without requiring application restart
- **NFR-006**: System MUST handle up to 4 concurrent external provider API requests without degradation

### Data Requirements

#### Book Entity (Schema Extensions)

**New Fields**:
- `source` (TEXT, NOT NULL, DEFAULT 'calibre'): Identifies book origin - 'calibre' or 'manual'

**Removed Fields** (per 2026-02-13 revision):
- `externalId` — eliminated. Metadata providers are ephemeral; no provider tracking on book records.

**Modified Fields**:
- `calibreId` (INTEGER, NULLABLE, previously NOT NULL): Links to Calibre database when source is 'calibre'

**Constraints**:
- Unique constraint on calibreId where calibreId is not null

**Migration Requirements**:
- All existing books MUST be migrated to source='calibre'
- Migration MUST preserve all existing data and relationships
- Migration MUST be reversible (rollback capability)

#### Provider Configuration Entity

**Purpose**: Store provider-specific settings and credentials

**Required Fields**:
- `providerId` (TEXT, UNIQUE): Provider identifier
- `enabled` (BOOLEAN): Whether provider is currently active
- `config` (JSON): Provider-specific settings (timeout, API endpoints, rate limits)
- `credentials` (JSON): Authentication credentials (API keys, plaintext storage acceptable for local SQLite)
- `lastHealthCheck` (TIMESTAMP): Last successful health check
- `healthStatus` (TEXT): Current health status - 'healthy' or 'unavailable' (binary state)

#### Cover Image Storage (Filesystem — per 2026-02-13 revision)

**Purpose**: Store cover images for manual books on the local filesystem

Cover images are NOT stored in the database. They are stored as files at `./data/covers/{bookId}.{ext}`, sibling to `./data/tome.db`. This aligns with the self-contained deployment principle — covers work offline without depending on external CDN availability.

**Storage Rules**:
- Path: `./data/covers/{tomeBookId}.{ext}` (e.g., `./data/covers/42.jpg`)
- Max file size: 5MB
- Allowed formats: JPEG, PNG, WebP, GIF
- One cover per book; new uploads replace existing
- Calibre book covers continue to be served from the Calibre library filesystem (unchanged)

**Ingestion**:
- Provider search: Cover URL downloaded to local storage after book creation (non-blocking)
- Manual upload: User uploads via `POST /api/books/{id}/cover` endpoint
- Download failures do not block book creation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully add a manual book and log progress within 2 minutes of first attempt
- **SC-002**: Calibre sync operations complete without affecting manual books or external provider books (100% isolation verified through testing)
- **SC-003**: Users with mixed book sources report successful tracking of physical and digital books in post-feature feedback
- **SC-004**: Books from any source support all existing Tome features (sessions, progress, goals, streaks) with identical functionality
- **SC-005**: Library view clearly distinguishes book sources with visual indicators that 90%+ of users understand without explanation
- **SC-006**: Book filtering by source allows users to view source-specific subsets in under 3 seconds
- **SC-007**: Federated metadata search returns merged results from multiple providers within 6 seconds
- **SC-008**: External metadata provider requests that exceed 5 seconds are excluded from results without blocking other providers
- **SC-009**: External metadata provider rate limit errors result in graceful exclusion with informative messaging 100% of the time
- **SC-010**: ~~REMOVED~~ — Source migration eliminated.
- **SC-011**: Circuit breaker pattern prevents cascading failures when a provider is down (automatic disable after 5 failures)
- **SC-012**: Provider health monitoring detects and auto-disables unhealthy providers within 30 seconds of repeated failures

## Assumptions

- Users understand the difference between Calibre-sourced, manually added, and external provider books
- Most users mixing physical and digital books will want to see all sources in a unified library view by default
- Source is immutable after creation — no source migration between book types
- Manual books do not require ISBN or other formal identifiers; title/author/pages are sufficient minimums
- External metadata providers will use standard REST APIs accessible from the Tome backend
- Hardcover API requires authentication; OpenLibrary API is public and requires no authentication
- Sync performance will not degrade significantly with mixed-source libraries of typical size (under 10,000 books)
- Visual source indicators (badges/icons) are sufficient differentiation; color-coding is not required
- Provider health monitoring and circuit breakers are essential for production stability
- Federated search with 5-second per-provider timeouts provides adequate user experience

## Dependencies

- No external service dependencies for core manual book functionality (P1)
- Hardcover API access required for Hardcover provider (API key required)
- OpenLibrary API access required for OpenLibrary provider (no auth, public API)
- Database schema must support nullable calibreId and new source field
- Existing Tome architecture must be extended to support multiple book sources
- Calibre database structure remains unchanged (read-only except ratings)

## Out of Scope

### Phase 1 Out of Scope (May be added in future phases)

- Automatic session/progress migration between Calibre and manual books when same book detected
- Bulk import of manual books from CSV or other formats
- Source migration (upgrading manual books to provider-tracked books with externalId)
- Advanced metadata fields beyond core requirements for manual books
- Provider plugin system (all providers are built-in for Phase 1)
- Sync orchestration for multiple providers (only Calibre syncs in Phase 1)
- Admin UI for provider management (API only for Phase 1)
- Advanced duplicate detection (e.g., cover image similarity)
- Provider marketplace or third-party provider discovery
- Historical provider health metrics and dashboards

### Permanently Out of Scope

- Migration or merging of books into Calibre library (Calibre remains source of truth for Calibre books)
- Multi-user access or sharing of manual/external provider books
- Export of manual books to other systems (beyond existing Tome export capabilities)
- Editing or updating books in Calibre database from manual entries or external providers
- Social features (sharing provider searches, collaborative book lists)
- Automatic background re-syncing of external provider metadata (updates are manual only)

## Testing Requirements

### Critical Test Coverage

- **Sync Isolation**: Calibre sync operations must not touch manual books
- **Source Filtering**: Library filtering by source must work correctly with mixed sources
- **Federated Search**: Multiple providers must return and merge results correctly
- **Duplicate Detection**: Cross-source duplicate detection must identify matches accurately
- **Book Creation**: Books added via federated search must always get source='manual'
- **Circuit Breaker**: Provider failures must trigger circuit breaker without affecting other providers
- **Timeout Handling**: Provider timeouts must not block federated search operations
- **Rate Limit Handling**: Provider rate limits must be handled gracefully
- **Backward Compatibility**: Existing Calibre-only functionality must work unchanged after schema migration

### Performance Benchmarks

- Federated search with 2+ providers: < 6 seconds
- Library filtering by source (10k books): < 3 seconds
- Circuit breaker overhead: < 5ms per operation

## Implementation Phases

This feature should be implemented in logical phases to manage complexity:

### Phase 1: Foundation (P1 - Manual Books)
- Schema migration (source field, provider configs)
- Manual book creation without external providers
- Sync isolation (Calibre only affects Calibre books)
- Source badges and filtering

### Phase 2: Provider Infrastructure (P3 - Architecture)
- Provider abstraction and registry
- Provider configuration management
- Circuit breaker and health monitoring
- Error handling and resilience

### Phase 3: External Providers (P3 - Hardcover + OpenLibrary)
- Hardcover provider implementation
- OpenLibrary provider implementation
- Federated metadata search
- Provider-specific configuration UI/API

### Phase 4: Advanced Features (P2 - Polish)
- Duplicate detection across sources
- Enhanced search result display
- Provider health monitoring dashboard

## Related Documents

**Architecture Decision Records (to be created)**:
- ADR-015: Multi-Source Provider Architecture
- ADR-017: Provider Failure Handling with Circuit Breakers
- ADR-018: Calibre ID Nullable Migration

**Reference Documentation**:
- [Tome Constitution](../../.specify/memory/constitution.md)
- [Tome Patterns](../../.specify/memory/patterns.md)
- [Tome Architecture](../../docs/ARCHITECTURE.md)
- [Repository Pattern Guide](../../docs/REPOSITORY_PATTERN_GUIDE.md)
