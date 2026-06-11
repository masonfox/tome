# Feature Specification: KoReader Sync Proxy with Auto Progress Logs

**Feature ID**: 003-koreader-sync  
**Date**: 2026-06-10  
**Status**: Planning - Revised to Intercepting Proxy Approach

---

## Overview

Implement a **KoReader sync proxy** that intercepts sync traffic between KoReader devices and their configured sync server (e.g., sync.koreader.rocks), automatically creating Tome progress logs from reading progress updates. This proxy approach provides real-time progress integration without the complexity of building a full sync server.

**Key Insight**: Users already have reliable sync servers (official or self-hosted). Tome's value is in **capturing progress data for local tracking**, not replacing existing infrastructure.

---

## Architecture Overview

```
KoReader Device (e-reader)
    │
    │ PUT /syncs/progress
    │ (reading progress update)
    ▼
Tome Proxy (localhost:7200)
    │
    ├─► 1. Intercept request
    │   ├─► Parse progress data
    │   ├─► Map document hash → Tome book
    │   └─► Create Tome progress log ✨
    │
    └─► 2. Forward to upstream sync server
        │   (sync.koreader.rocks or custom)
        │
        ▼
    Response ← Device receives sync confirmation
```

**Benefits:**
- Real-time progress capture (no polling delays)
- Users keep existing multi-device sync setup
- Automatic document discovery (learn hashes as devices sync)
- Simpler implementation (~60% less code than full server)
- Graceful degradation (offline store-and-forward)

---

## User Stories

### MVP (Must Have)

1. **As a user**, I want to configure my KoReader sync address to point to Tome's proxy, so I can capture reading progress automatically.

2. **As a user**, I want to configure which upstream sync server Tome proxies to (default: sync.koreader.rocks), so I can keep my existing sync setup.

3. **As a KoReader device**, I want Tome to forward all sync requests to the real sync server, so multi-device sync continues to work.

4. **As a user**, I want Tome to automatically create progress logs when my KoReader syncs, so I don't have to manually track reading progress.

5. **As a user**, I want Tome to map KoReader documents to Calibre books automatically (when possible), so progress logs are associated with the correct books.

6. **As a user**, I want to enable/disable the KoReader proxy in settings, so I can control whether the service is running (default: disabled).

7. **As a user**, I want to manually map unmapped KoReader documents to Tome books, so progress tracking works even when auto-mapping fails.

### Post-MVP (Optional)

8. **As a user**, I want to view a list of synced KoReader documents and their mapping status, so I can verify which books are being tracked.

9. **As a user**, I want Tome to store-and-forward sync requests when the upstream server is unavailable, so sync doesn't fail during internet outages.

10. **As a user**, I want to see sync statistics (documents synced, last sync time, errors), so I can monitor proxy health.

---

## Functional Requirements

### FR1: Proxy Server Implementation

#### FR1.1: HTTP Proxy
- Listen on configurable port (default: 7200, matching KoReader default)
- Accept all KoReader sync API requests (5 endpoints)
- Forward requests to configured upstream server
- Return upstream responses to client (transparent proxying)
- Support HTTPS upstream servers (verify certificates)

#### FR1.2: Request Interception
- Intercept `PUT /syncs/progress` requests (progress updates)
- Parse request body to extract:
  - Document hash (MD5, 32 chars)
  - Percentage (0.0 to 1.0)
  - Progress (page/location string)
  - Device name
- Do NOT block on Tome processing (async progress log creation)
- Maintain low latency (<50ms overhead)

#### FR1.3: Authentication Passthrough
- Forward `x-auth-user` and `x-auth-key` headers unchanged
- Do not store or validate credentials (upstream handles auth)
- Log username for debugging (not password hash)

### FR2: Progress Log Integration

#### FR2.1: Automatic Progress Log Creation
- When `PUT /syncs/progress` intercepted:
  1. Map document hash to Tome book (see FR2.2)
  2. If book found, create progress log entry:
     - Current percentage from KoReader
     - Current page (calculated if book has `total_pages`)
     - Progress date (current date)
     - Notes: "Synced from KoReader device: [device_name]"
  3. Find or create active reading session for book
  4. Handle session state transitions (auto-complete at 100%)

#### FR2.2: Document-to-Book Mapping
- **Strategy 1 (Auto)**: Match by Calibre path
  - Extract potential file path from KoReader document structure
  - Compare with Calibre book paths in `books` table
  - Store successful mapping in `koreader_document_mappings`
  
- **Strategy 2 (Manual)**: User creates mapping via UI
  - User selects unmapped document
  - User selects Tome book from library
  - Store mapping in `koreader_document_mappings`
  
- **Strategy 3 (Learning)**: Build mapping over time
  - Track document hashes as they appear
  - Suggest matches based on timing/context
  - User confirms suggestions

#### FR2.3: Mapping Management
- Store mappings persistently in database
- Reuse mappings for future syncs
- Allow users to view and edit mappings
- Handle books deleted from Calibre (orphaned mappings)

### FR3: Settings Management

#### FR3.1: Proxy Enable/Disable
- Add settings toggle: "Enable KoReader Sync Proxy" (default: OFF)
- When disabled, proxy server does not start
- Display proxy status in UI (running/stopped)
- Show configured proxy address (e.g., "http://localhost:7200")

#### FR3.2: Upstream Server Configuration
- Setting: "Upstream Sync Server URL" (default: "https://sync.koreader.rocks")
- Validate URL format on save
- Support HTTP and HTTPS upstream servers
- Display connection status (reachable/unreachable)

#### FR3.3: Auto Progress Log Toggle
- Setting: "Automatically Create Progress Logs from Sync" (default: ON when proxy enabled)
- When disabled, proxy still forwards requests but doesn't create progress logs
- Useful for testing proxy without affecting Tome data

### FR4: Management UI

#### FR4.1: Document Mappings Page
- Display table of synced KoReader documents:
  - Document Hash (first 8 chars + "...")
  - Mapped Book (title, or "Unmapped")
  - Last Synced (timestamp)
  - Device Name
  - Actions (Edit Mapping, View Progress)
  
- Filter by mapping status (mapped/unmapped)
- Search by document hash or book title

#### FR4.2: Manual Mapping Interface
- Click "Map" button on unmapped document
- Modal shows:
  - Document hash (full)
  - Device name
  - Current progress (percentage, last page)
  - Book selector (searchable Calibre library)
- Confirm mapping → saves to database

#### FR4.3: Sync Statistics (Optional)
- Total documents synced
- Active mappings count
- Last sync time (per document)
- Error log (failed proxy requests)

---

## Non-Functional Requirements

### NFR1: Performance
- Proxy overhead <50ms per request (p95)
- Progress log creation async (non-blocking)
- Support 10+ concurrent device syncs

### NFR2: Reliability
- Graceful upstream failure handling (return 502/503 to device)
- Store-and-forward for offline resilience (post-MVP)
- No data loss: all intercepted progress persisted

### NFR3: Security
- Forward credentials without inspection (privacy)
- Validate upstream HTTPS certificates
- Log requests without sensitive data (no passwords)

### NFR4: Compatibility
- 100% transparent proxy (devices can't tell difference)
- Support all KoReader sync protocol endpoints
- Handle KoReader protocol changes gracefully

---

## Technical Architecture

### Database Schema (Simplified)

#### Table: `koreader_document_mappings`
```typescript
{
  id: integer (primary key, auto-increment),
  document_hash: text (unique, not null, 32-char MD5 hash),
  book_id: integer (foreign key → books.id, not null),
  mapping_source: text (enum: "auto_path", "manual"),
  device_name: text (last known device),
  last_synced_at: datetime,
  created_at: datetime (not null),
  updated_at: datetime (not null)
}
```

#### Table: `koreader_sync_events` (Optional - Audit Log)
```typescript
{
  id: integer (primary key, auto-increment),
  document_hash: text (not null),
  username: text,
  percentage: real,
  device: text,
  upstream_status: integer (HTTP status from upstream),
  tome_processed: boolean (progress log created?),
  error: text (if processing failed),
  synced_at: datetime (not null)
}
```

#### Table: `application_settings` (Extend or Create)
```typescript
{
  key: text (primary key),
  value: text (JSON or boolean),
  updated_at: datetime
}

// Settings keys:
// - "koreader_proxy_enabled": boolean (default: false)
// - "koreader_upstream_url": string (default: "https://sync.koreader.rocks")
// - "koreader_auto_progress_log": boolean (default: true)
// - "koreader_proxy_port": number (default: 7200)
```

### API Routes

#### Proxy Endpoints (All under `/api/koreader/`)
- `ALL /api/koreader/*` - Proxy catch-all route
  - Intercepts all KoReader sync requests
  - Forwards to upstream server
  - Special handling for `PUT /syncs/progress` (progress interception)

#### Management Endpoints (Tome-specific)
- `GET /api/koreader-management/mappings` - List document mappings
- `POST /api/koreader-management/mappings` - Create manual mapping
- `PATCH /api/koreader-management/mappings/:id` - Update mapping
- `DELETE /api/koreader-management/mappings/:id` - Delete mapping
- `GET /api/koreader-management/sync-events` - List recent sync events (audit log)
- `GET /api/settings/koreader` - Get proxy settings
- `PATCH /api/settings/koreader` - Update proxy settings

### Services (New)
- `KoReaderProxyService` - HTTP proxy logic, request forwarding
- `KoReaderProgressService` - Progress log creation, mapping resolution
- `KoReaderMappingService` - Auto-mapping logic (path matching, etc.)

### Repositories (New)
- `koreaderMappingRepository` - CRUD for document mappings
- `koreaderSyncEventRepository` - Audit log for sync events (optional)

---

## User Experience Flow

### Initial Setup
1. User navigates to Settings → KoReader Sync
2. User enables "Enable KoReader Sync Proxy" toggle
3. System displays proxy address: `http://localhost:7200` or `http://<local-ip>:7200`
4. User optionally changes upstream server (default: sync.koreader.rocks)
5. User configures KoReader device:
   - Custom sync server: `http://<tome-ip>:7200`
   - Username/password: (existing credentials for upstream server)

### Syncing Progress (Automatic)
1. User reads on KoReader device
2. Device syncs progress to Tome proxy (e.g., every page turn)
3. Tome intercepts request:
   - Attempts auto-mapping (document hash → book)
   - If mapped: creates progress log entry
   - If unmapped: queues for manual mapping
4. Tome forwards request to upstream server (sync.koreader.rocks)
5. Device receives success response
6. User sees progress updated in Tome library (next page load)

### Manual Mapping (First Time)
1. User navigates to Settings → KoReader Sync → Document Mappings
2. User sees list of unmapped documents
3. User clicks "Map" on document
4. Modal shows document details and book selector
5. User searches for book title and selects match
6. User clicks "Save Mapping"
7. Future syncs for this document automatically create progress logs

---

## Acceptance Criteria

### MVP

#### AC1: Proxy Server
- [ ] Proxy listens on configurable port (default: 7200)
- [ ] All KoReader sync requests forwarded to upstream server
- [ ] Upstream responses returned to device (transparent)
- [ ] Proxy overhead <50ms (measured with load testing)
- [ ] Handles upstream connection failures gracefully (502/503)

#### AC2: Progress Interception
- [ ] `PUT /syncs/progress` requests intercepted
- [ ] Progress data extracted (document hash, percentage, device)
- [ ] Progress log created for mapped documents
- [ ] Unmapped documents logged for later mapping
- [ ] Interception does not block proxy response (<50ms)

#### AC3: Document Mapping
- [ ] Auto-mapping attempts Calibre path matching
- [ ] Manual mapping UI functional (select book from library)
- [ ] Mappings persisted in database
- [ ] Mappings reused for subsequent syncs
- [ ] Mapping success rate logged (for tuning)

#### AC4: Settings Management
- [ ] Proxy enable/disable toggle functional
- [ ] Upstream server URL configurable and validated
- [ ] Auto progress log creation toggle functional
- [ ] Settings persist across application restarts

#### AC5: Management UI
- [ ] Document mappings page displays synced documents
- [ ] Manual mapping modal functional (search + select book)
- [ ] Mapping status visible (mapped/unmapped)
- [ ] Last sync time displayed

---

## Out of Scope

- **User management**: No KoReader user accounts in Tome (upstream handles auth)
- **Data storage**: No sync data stored (just audit log, optional)
- **Conflict resolution**: Upstream server handles multi-device conflicts
- **Real-time notifications**: No WebSocket/SSE (polling on management page is fine)
- **Custom sync protocol**: Must remain KoReader-compatible (no extensions)

---

## Dependencies

- **Internal**: 
  - Existing progress log and session repositories
  - Existing book repository (for mapping lookup)
  - HTTP client library (fetch API)
  - Settings management infrastructure

- **External**: 
  - Upstream sync server (sync.koreader.rocks or user-configured)
  - User must have internet connection (for upstream sync)
  - KoReader device firmware with sync support

---

## Testing Requirements

### Unit Tests
- Document hash validation
- Path-based auto-mapping logic
- Progress log creation from sync data

### Integration Tests
- Proxy forwarding (mock upstream server)
- Progress interception and log creation
- Mapping persistence and retrieval
- Settings CRUD operations

### E2E Tests (Optional)
- Complete sync flow with real KoReader device
- Manual mapping workflow
- Proxy enable/disable behavior

---

## Documentation

- Update ARCHITECTURE.md with proxy architecture
- Create ADR for proxy vs. full server decision
- Add KoReader setup guide (configure device to point to proxy)
- Document mapping strategies and success rates
- Update AGENTS.md with proxy patterns

---

## Migration Plan

1. **Phase 1: Core Proxy** (~6-8 hours)
   - Implement HTTP proxy middleware
   - Request forwarding logic
   - Basic interception for PUT /syncs/progress
   
2. **Phase 2: Progress Integration** (~4-6 hours)
   - Progress log creation logic
   - Document mapping (auto + manual)
   - Mapping repository
   
3. **Phase 3: Settings UI** (~2-3 hours)
   - Proxy enable/disable toggle
   - Upstream server configuration
   - Auto progress log toggle
   
4. **Phase 4: Management UI** (~4-6 hours)
   - Document mappings page
   - Manual mapping modal
   - Sync statistics (optional)
   
5. **Phase 5: Testing** (~3-4 hours)
   - Unit tests for mapping logic
   - Integration tests for proxy
   - Manual testing with device

**Total Estimated Effort: 19-27 hours** (vs. 20-30 for full server)

---

## Success Metrics

- Proxy successfully forwards all sync requests (100% success rate)
- Progress logs created automatically for mapped documents
- Proxy overhead <50ms (p95)
- Auto-mapping success rate >60% (for Calibre-synced KoReader libraries)
- Manual mapping UI workflow <30 seconds per document
- Zero data loss (all progress updates captured)

---

## Open Questions

1. **Port Conflict**: What if port 7200 is already in use? → Allow configuration, auto-detect available port
2. **Multiple Users**: Should proxy support multiple KoReader users? → Yes, use username from headers for logging
3. **Offline Mode**: Store-and-forward when upstream unavailable? → Post-MVP, add request queue
4. **Auto-mapping Confidence**: When to auto-map vs. ask user? → Start conservative (high confidence only), tune later

---

## References

- [KoReader Sync Server (Reference)](https://github.com/koreader/koreader-sync-server)
- [KoReader Documentation](https://github.com/koreader/koreader)
- Tome Constitution: `.specify/memory/constitution.md`
- Tome Patterns: `.specify/memory/patterns.md`
