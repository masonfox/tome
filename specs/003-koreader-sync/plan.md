# Implementation Plan: KoReader Sync Proxy

**Branch**: `003-koreader-sync` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Status**: ✅ Planning Complete - Ready for Implementation

---

## Summary

Implement a **KoReader sync intercepting proxy** that forwards sync requests to an upstream server (e.g., sync.koreader.rocks) while selectively capturing progress updates to automatically create Tome progress logs. This approach achieves the primary goal (auto progress tracking) with 40% less effort than building a full sync server.

**Key Architecture Decision**: Proxy instead of full server - users keep their existing reliable sync infrastructure while Tome adds value through automatic progress tracking.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+ (dev) / Bun 1.x (production)  
**Primary Dependencies**: Next.js 14 (App Router), Drizzle ORM, SQLite (better-sqlite3 / bun:sqlite), Zod (validation), Pino (logging)  
**Storage**: SQLite (Tome database: `data/tome.db`) for mappings and settings only  
**Testing**: Vitest (unit + integration tests with real SQLite databases)  
**Target Platform**: Self-hosted Linux/Docker (Next.js server on port 3000, proxy on port 7200)  
**Project Type**: Web application (Next.js fullstack)  
**Performance Goals**: <50ms proxy overhead (p95), support 10+ concurrent device syncs  
**Constraints**: Minimal external dependencies (only upstream sync server), SQLite-only storage, transparent proxy (100% KoReader protocol compatible)  
**Scale/Scope**: ~1 proxy route, 2-3 database tables, 2 services, ~10-15 repository methods, ~20-30 tests

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with principles from `.specify/memory/constitution.md`:

- [x] **Data Integrity First**: ✅ **PASS** - No Calibre DB writes. Uses Drizzle migrations for new schema (mappings, settings). Database Factory Pattern for all connections.
- [x] **Layered Architecture Pattern**: ✅ **PASS** - Follows Routes → Services → Repositories. New: `koreaderMappingRepository`, `settingsRepository`, `KoReaderProxyService`, `KoReaderProgressService`.
- [x] **Self-Contained Deployment**: ⚠️ **RELAXED** - Proxy requires upstream sync server for forwarding. **Justification**: Users already have trusted sync servers. Tome adds value (progress tracking) without replacing infrastructure. Alternative (full server) is 40% more effort for minimal gain.
- [x] **User Experience Standards**: ✅ **PASS** - Smart defaults: proxy disabled by default, auto-progress enabled when proxy enabled. Preserves history: mappings deletable with confirmation. Validates inputs: document hash format, URL validation.
- [x] **Observability & Testing**: ✅ **PASS** - All proxy operations logged with Pino (requests, interceptions, errors). Tests use real SQLite with `setDatabase()` pattern. Integration tests for proxy forwarding and progress creation.

**Violations**: One principle relaxed (Self-Contained Deployment) with strong justification.

**Special Considerations**:
- **Transparent Proxy**: Must forward requests unchanged (protocol compliance)
- **Async Processing**: Progress log creation non-blocking (<50ms overhead)
- **Graceful Degradation**: Handle upstream failures (502/504 responses)

---

## Project Structure

### Documentation (this feature)

```text
specs/003-koreader-sync/
├── spec.md              # Feature specification (proxy approach)
├── research.md          # Why proxy > full server
├── data-model.md        # Simplified schema (2-3 tables)
├── contracts/API.md     # Proxy behavior and endpoints
├── quickstart.md        # Developer implementation guide
└── plan.md              # This file
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── koreader/
│   │   └── [...path]/
│   │       └── route.ts          # Proxy catch-all (ALL methods)
│   ├── koreader-management/
│   │   └── mappings/
│   │       ├── route.ts          # GET (list), POST (create)
│   │       └── [id]/
│   │           └── route.ts      # PATCH (update), DELETE
│   └── settings/
│       └── koreader/
│           └── route.ts          # GET/PATCH settings
├── koreader-sync/
│   └── page.tsx                  # Document mappings management UI (post-MVP)
└── settings/
    └── page.tsx                  # Settings page (add KoReader section, post-MVP)

lib/
├── db/
│   └── schema/
│       └── koreader.ts           # koreader_document_mappings, application_settings
├── repositories/
│   ├── koreader-mapping.repository.ts  # CRUD for mappings
│   └── settings.repository.ts          # Key-value settings (reusable)
└── services/
    ├── koreader-proxy.service.ts       # HTTP forwarding logic
    └── koreader-progress.service.ts    # Progress interception + log creation

__tests__/
├── repositories/
│   └── koreader-mapping.repository.test.ts
├── services/
│   ├── koreader-proxy.service.test.ts
│   └── koreader-progress.service.test.ts
└── api/
    └── koreader/
        └── proxy.test.ts               # Integration tests

drizzle/
└── XXXX_koreader_proxy_tables.sql      # Migration for mappings + settings
```

**Structure Decision**: Minimal structure. Single proxy catch-all route replaces 5 separate API routes from full server approach. Services layer handles proxy and progress logic. Management UI routes separate from proxy routes.

---

## Complexity Tracking

No violations of constitution principles. One principle (Self-Contained Deployment) relaxed with justification documented above.

---

## Phase 0: Outline & Research

**Status**: ✅ Complete  
**Output**: `research.md`

### Research Tasks Completed

1. ✅ **KoReader Sync Protocol Analysis** - Discovered no webhooks/push mechanisms, only polling possible
2. ✅ **Architecture Evaluation** - Compared full server vs. polling vs. proxy (proxy wins)
3. ✅ **Proxy Architecture Design** - Lightweight reverse proxy with selective interception
4. ✅ **Document Mapping Strategy** - Hybrid approach (auto + manual mapping)
5. ✅ **Settings Management** - New `application_settings` table (key-value)
6. ✅ **Testing Strategy** - Mock KoReader client + mock upstream server

**Key Decisions**:
- **Proxy > Full Server**: 40% less effort, same real-time capability, users keep existing sync
- **Transparent Forwarding**: Minimal inspection, low latency (<50ms overhead)
- **Async Processing**: Progress log creation non-blocking
- **Hybrid Mapping**: Auto-map (60-70% success) + manual fallback

**Artifacts**: See `specs/003-koreader-sync/research.md` (3,800 words)

---

## Phase 1: Design & Contracts

**Status**: ✅ Complete  
**Outputs**: `data-model.md`, `contracts/API.md`, `quickstart.md`, agent context updated

### Data Model (Simplified)

**Tables Created** (2-3 vs. 4 in full server):
1. `koreader_document_mappings` - Document hash → book mappings
2. `application_settings` - Key-value settings (proxy config)
3. `koreader_sync_events` - Optional audit log (can be omitted from MVP)

**Key Simplifications**:
- ❌ No `koreader_users` table (upstream handles auth)
- ❌ No `koreader_sync_records` table (upstream stores data)
- ❌ No authentication logic (passthrough to upstream)

**Relationships**:
- `koreader_document_mappings.book_id` → `books.id` (CASCADE DELETE)

**Artifacts**: See `specs/003-koreader-sync/data-model.md` (4,200 words)

### API Contracts (Proxy Behavior)

**Proxy Endpoint**:
- `ALL /api/koreader/*` - Catch-all proxy route
  - Forwards all methods (GET, POST, PUT, DELETE)
  - Intercepts `PUT /syncs/progress` for processing
  - Returns upstream response unchanged

**Management Endpoints** (Tome-specific):
- `GET /api/koreader-management/mappings` - List mappings
- `POST /api/koreader-management/mappings` - Create manual mapping
- `PATCH /api/koreader-management/mappings/:id` - Update mapping
- `DELETE /api/koreader-management/mappings/:id` - Delete mapping
- `GET/PATCH /api/settings/koreader` - Settings CRUD

**Artifacts**: See `specs/003-koreader-sync/contracts/API.md` (4,300 words)

### Developer Quickstart

Complete implementation guide with:
- 5 phased implementation (database → repos → services → routes → tests)
- Code examples for all components
- Testing checklist
- Common pitfalls

**Artifacts**: See `specs/003-koreader-sync/quickstart.md` (2,700 words)

---

## Constitution Re-Check (Post-Design)

All principles remain compliant after Phase 1 design. One relaxed principle (Self-Contained Deployment) justified by:
1. Users already have sync servers (official or self-hosted)
2. 40% effort reduction outweighs modest dependency
3. Store-and-forward can be added later for offline resilience (post-MVP)

**No changes to original assessment.**

---

## Implementation Roadmap

### Phase 1: Database & Schema (2-3 hours)
- [x] Planning complete
- [ ] Create `lib/db/schema/koreader.ts` (mappings, settings tables)
- [ ] Update `lib/db/schema/index.ts`
- [ ] Generate Drizzle migration
- [ ] Apply migration to `data/tome.db`
- [ ] Seed default settings
- [ ] Verify tables with sqlite3

### Phase 2: Repositories (2-3 hours)
- [ ] Implement `koreaderMappingRepository` (7 methods)
- [ ] Implement `settingsRepository` (4 methods, reusable)
- [ ] Write repository unit tests (10-15 tests)
- [ ] Test isolation with `setDatabase()` / `resetDatabase()`

### Phase 3: Services (4-6 hours)
- [ ] Implement `KoReaderProxyService` (request forwarding)
  - Upstream URL from settings
  - Header/body forwarding
  - Timeout handling (30s)
  - Error responses (502, 504)
- [ ] Implement `KoReaderProgressService` (progress interception)
  - Mapping lookup
  - Progress log creation
  - Session management
  - Auto-complete at 100%
- [ ] Write service unit tests (10-15 tests)

### Phase 4: API Routes (2-3 hours)
- [ ] Implement `/api/koreader/[...path]/route.ts` (proxy catch-all)
  - Settings check (503 if disabled)
  - Progress interception (async, non-blocking)
  - Forward to upstream
- [ ] Implement management routes (4 endpoints)
  - List/create/update/delete mappings
  - Get/update settings
- [ ] Write API integration tests (10-15 tests)

### Phase 5: Testing & Validation (3-4 hours)
- [ ] Run all tests: `npm test -- koreader`
- [ ] Manual curl testing (all endpoints)
- [ ] Load testing (10+ concurrent devices)
- [ ] Verify proxy overhead <50ms (p95)
- [ ] Test upstream failure scenarios

### Phase 6: Documentation (1-2 hours)
- [ ] Update `docs/ARCHITECTURE.md` with proxy section
- [ ] Create ADR for proxy vs. full server decision
- [ ] Add KoReader setup guide (device configuration)
- [ ] Update `AGENTS.md` if new patterns emerge

---

## Effort Estimates

| Phase | Description | Estimate |
|-------|-------------|----------|
| **Phase 1** | Database & schema | 2-3 hours |
| **Phase 2** | Repositories | 2-3 hours |
| **Phase 3** | Services (proxy + progress) | 4-6 hours |
| **Phase 4** | API routes | 2-3 hours |
| **Phase 5** | Testing & validation | 3-4 hours |
| **Phase 6** | Documentation | 1-2 hours |
| **Total (MVP)** | Core proxy functionality | **14-21 hours** |

**Post-MVP** (optional enhancements):
- Auto-mapping logic (path matching): 2-3 hours
- Management UI (mappings page): 4-6 hours
- Settings UI (proxy controls): 2-3 hours
- Store-and-forward (offline queue): 3-4 hours
- **Total (Post-MVP)**: 11-16 hours

**Grand Total**: 25-37 hours (includes post-MVP features)

**Comparison to Full Server**: 
- Full server: ~25-30 hours (MVP only)
- Proxy approach: ~15-21 hours (MVP only)
- **Savings**: 40% less effort

---

## Technical Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Upstream server downtime** | High | Low | Graceful error handling (502), queue requests (post-MVP) |
| **Proxy performance** | Medium | Low | Async processing, load testing, <50ms overhead target |
| **Auto-mapping false positives** | Medium | Low | Manual mapping UI, user can edit/delete |
| **Port conflict (7200)** | Low | Medium | Allow port configuration in settings |
| **Request body consumption** | Low | Medium | Clone request before reading body |

---

## Out of Scope

**MVP Exclusions** (deferred to post-MVP):
- ❌ Auto-mapping implementation (path matching)
- ❌ Management UI (view/edit mappings)
- ❌ Settings UI (enable/disable proxy)
- ❌ Store-and-forward (offline resilience)
- ❌ Sync statistics dashboard
- ❌ Multi-user support (single user for MVP)

**Permanent Exclusions**:
- ❌ User authentication in Tome (upstream handles)
- ❌ Sync data storage (upstream stores)
- ❌ Conflict resolution (upstream handles)
- ❌ Real-time notifications (no WebSocket/SSE)
- ❌ Custom sync protocol (must remain KoReader-compatible)

---

## Success Metrics

### Functional Requirements
- ✅ Proxy forwards all sync requests transparently
- ✅ Progress updates intercepted and logged
- ✅ Mappings persist across syncs
- ✅ Settings enable/disable functional
- ✅ Management API endpoints working

### Performance Requirements
- ✅ Proxy overhead <50ms (p95)
- ✅ Supports 10+ concurrent device syncs
- ✅ Progress processing non-blocking

### Quality Requirements
- ✅ All tests passing (>90% coverage)
- ✅ Manual curl testing successful
- ✅ Load testing validates performance
- ✅ Documentation complete

---

## Comparison: Proxy vs. Full Server

### Implementation Effort

| Component | Full Server | Proxy Approach | Reduction |
|-----------|-------------|----------------|-----------|
| **Database tables** | 4 | 2-3 | 25-50% |
| **API routes** | 5 | 1 + 5 mgmt | Same |
| **Repositories** | 3 (15 methods) | 2 (11 methods) | 30% |
| **Services** | 2 | 2 | Same |
| **Authentication** | Complex (MD5) | None (passthrough) | 100% |
| **Tests** | 40-50 | 20-30 | 40% |
| **Total effort** | 25-30 hours | 15-21 hours | **40%** |

### Capabilities

| Capability | Full Server | Proxy Approach |
|------------|-------------|----------------|
| **Real-time progress logs** | ✅ Yes | ✅ Yes |
| **Multi-device sync** | ✅ Yes | ✅ Yes (upstream) |
| **Document discovery** | ✅ Easy | ✅ Easy |
| **Offline operation** | ✅ Full | ⚠️ Degraded |
| **External dependency** | ✅ None | ⚠️ Upstream server |
| **Maintenance burden** | ❌ High | ✅ Low |
| **User value** | High | **High** |

**Conclusion**: Proxy achieves 80% of value with 40% less effort.

---

## Next Actions

**This planning phase is complete.** All artifacts generated:

1. ✅ `spec.md` - Feature specification (proxy approach)
2. ✅ `research.md` - Architecture analysis and decisions
3. ✅ `data-model.md` - Simplified database schema
4. ✅ `contracts/API.md` - Proxy behavior and endpoints
5. ✅ `quickstart.md` - Developer implementation guide
6. ✅ `plan.md` - This file (implementation roadmap)

**Total planning artifacts**: ~15,000 words across 6 documents

**To begin implementation**:

```bash
# Start with Phase 1: Database Setup
cd /home/masonfox/git/tome

# Follow quickstart.md step-by-step
cat specs/003-koreader-sync/quickstart.md

# Create schema file
# Generate migration
# Apply migration
# ...
```

**Or use SpecKit**:
```bash
/speckit.tasks    # Generate granular task breakdown
/speckit.implement  # Begin implementation with AI guidance
```

---

**Planning Complete - Ready for Implementation** ✅  
**Branch**: `003-koreader-sync`  
**Approach**: Intercepting proxy (40% less effort than full server)  
**Estimated Effort**: 15-21 hours (MVP), 25-37 hours (with post-MVP features)
