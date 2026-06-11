# Phase 0: Research - KoReader Sync Proxy

**Status**: Complete (Revised to Proxy Approach)
**Date**: 2026-06-10

---

## Executive Summary

After researching the KoReader sync protocol and evaluating three implementation approaches, we've decided to implement an **intercepting HTTP proxy** rather than a full sync server. This provides 80% of the value (automatic progress log creation) with 40% less implementation effort, while allowing users to maintain their existing sync infrastructure.

---

## Research Tasks

### Task 1: KoReader Sync Protocol Analysis

**Question**: What is the KoReader sync API specification and what integration options exist?

**Findings**:

1. **API Endpoints** (5 total):
   - `GET /healthcheck` - Server health check
   - `POST /users/create` - User registration
   - `GET /users/auth` - Credential validation
   - `GET /syncs/progress/:document` - Retrieve document progress
   - `PUT /syncs/progress` - Update document progress

2. **Key Characteristics**:
   - Simple REST API (no GraphQL, no gRPC)
   - Custom header authentication (`x-auth-user`, `x-auth-key`)
   - MD5 password hashing (client-side)
   - Document identification via MD5 hash (32 chars)
   - Last-write-wins conflict resolution

3. **Critical Discovery: NO PUSH MECHANISMS** ⚠️
   - No webhooks for progress updates
   - No WebSocket/SSE endpoints
   - No server-to-server notifications
   - **Only integration option: Polling**
   - **Major limitation**: Can't list all documents for a user (must know hash beforehand)

**Decision Impact**: This discovery fundamentally changed our approach. Since the official server doesn't support efficient integration, we have three options:
- **Option A**: Build full server (complete control, high effort)
- **Option B**: Poll official server (simple, delayed updates, hard document discovery)
- **Option C**: Intercept sync traffic via proxy (real-time, moderate effort)

---

### Task 2: Architecture Evaluation

**Question**: Which implementation approach best balances effort, functionality, and user value?

**Evaluation Matrix**:

| Criteria | Full Sync Server | Polling Client | **Intercepting Proxy** |
|----------|------------------|----------------|------------------------|
| **Implementation Effort** | ~25 hours | ~5 hours | **~15 hours** ✅ |
| **Real-Time Progress Logs** | ✅ Yes | ❌ Delayed (5-15min) | ✅ **Yes** |
| **Document Discovery** | ✅ Easy | ❌ Hard* | ✅ **Automatic** |
| **Multi-Device Sync** | ✅ Yes | ✅ Yes | ✅ **Yes** |
| **External Dependency** | ✅ None | ❌ Required | ⚠️ **Optional** |
| **Offline Operation** | ✅ Yes | ❌ No | ⚠️ **Degraded** |
| **Maintenance Burden** | ❌ High | ✅ Low | ✅ **Low** |
| **Constitution Alignment** | ✅ Perfect | ❌ Poor | ⚠️ **Good** |
| **User Value** | High | Low | **High** ✅ |

\* Polling can't discover documents - must know MD5 hash beforehand

**Analysis**:

**Option A: Full Sync Server**
- **Pros**: Complete control, no dependencies, perfect constitution alignment
- **Cons**: High effort (~25 hours), becomes Tome's responsibility to maintain protocol compatibility
- **User Benefit**: Users can use Tome as their only sync server
- **Risk**: Protocol changes in KoReader break our implementation

**Option B: Polling Client**
- **Pros**: Simplest implementation (~5 hours)
- **Cons**: 
  - Delayed updates (5-15 minute poll intervals)
  - Can't discover new documents (must build mapping database first)
  - External dependency (user must have working sync server)
  - Increased load on upstream server
- **User Benefit**: Minimal - delayed progress logs, complex setup
- **Risk**: Upstream API changes break integration

**Option C: Intercepting Proxy** ⭐
- **Pros**: 
  - Real-time progress capture (intercept PUT requests)
  - Automatic document discovery (learn hashes as they sync)
  - Users keep existing sync setup (multi-device still works)
  - Lower maintenance (just proxy logic, not protocol compliance)
- **Cons**: 
  - Requires users to reconfigure KoReader device
  - Modest external dependency (needs upstream server for actual sync)
  - Slight complexity in proxy implementation
- **User Benefit**: HIGH - Real-time progress logs + reliable sync
- **Risk**: Low - proxy is simple passthrough, minimal breaking changes possible

**Decision**: **Option C - Intercepting Proxy** ✅

**Rationale**:
1. **User's Primary Goal**: "Auto progress log functionality" - Proxy achieves this perfectly
2. **Effort vs. Value**: 40% less effort than full server, same real-time capability
3. **User Experience**: Keeps existing reliable sync (official or self-hosted)
4. **Pragmatic**: Leverages battle-tested infrastructure instead of rebuilding
5. **Lower Risk**: Less code = less maintenance burden

---

### Task 3: Proxy Architecture Design

**Question**: How should the intercepting proxy be implemented?

**Findings**:

**Proxy Patterns Evaluated**:

1. **Reverse Proxy (nginx-style)**
   - Forward all traffic with minimal inspection
   - Intercept specific routes for processing
   - **Choice**: ✅ This pattern

2. **API Gateway Pattern**
   - Parse and transform requests/responses
   - Add authentication, rate limiting, etc.
   - **Choice**: ❌ Too complex for our needs

3. **Sidecar Proxy (service mesh)**
   - Run alongside upstream service
   - Capture metrics and traces
   - **Choice**: ❌ Overkill, requires upstream access

**Chosen Architecture: Lightweight Reverse Proxy**

```
┌─────────────────────────────────────────────────────┐
│ KoReader Device                                      │
│ (PUT /syncs/progress)                                │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ Tome Proxy (localhost:7200)                          │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1. Receive Request                           │   │
│  │    - Parse headers (x-auth-user)            │   │
│  │    - Parse body (if PUT /syncs/progress)    │   │
│  └─────────────┬───────────────────────────────┘   │
│                │                                     │
│  ┌─────────────▼───────────────────────────────┐   │
│  │ 2. Process (Async, Non-Blocking)            │   │
│  │    - Map document hash → Tome book          │   │
│  │    - Create progress log                    │   │
│  │    - Log sync event (audit)                 │   │
│  └─────────────┬───────────────────────────────┘   │
│                │                                     │
│  ┌─────────────▼───────────────────────────────┐   │
│  │ 3. Forward to Upstream                       │   │
│  │    - https://sync.koreader.rocks            │   │
│  │    - Headers unchanged                       │   │
│  │    - Body unchanged                          │   │
│  └─────────────┬───────────────────────────────┘   │
│                │                                     │
│  ┌─────────────▼───────────────────────────────┐   │
│  │ 4. Return Response                           │   │
│  │    - Upstream response to device             │   │
│  │    - No modifications                        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Design Decisions**:

1. **Async Processing**: Progress log creation happens asynchronously (non-blocking)
   - **Why**: Keep proxy latency <50ms
   - **How**: Fire-and-forget background task

2. **Transparent Proxying**: Requests/responses unchanged
   - **Why**: KoReader device can't tell difference
   - **How**: Simple HTTP forwarding with fetch API

3. **Selective Interception**: Only process PUT /syncs/progress
   - **Why**: Other endpoints don't affect Tome
   - **How**: Route-specific middleware

4. **Graceful Degradation**: Handle upstream failures
   - **Why**: User experience shouldn't break if sync.koreader.rocks is down
   - **How**: Return 502/503 to device, optionally queue for retry (post-MVP)

**Implementation Tools**:
- **HTTP Server**: Next.js API routes (already in stack)
- **HTTP Client**: fetch API (native, no new dependencies)
- **Async Queue**: Promise.allSettled() for fire-and-forget (stdlib)

---

### Task 4: Document Mapping Strategy

**Question**: How do we map KoReader document hashes to Tome books?

**Challenge**: 
- KoReader uses MD5 hash of document path/identifier
- Hash is computed client-side (we don't control it)
- No filename or metadata sent in sync protocol (privacy by design)

**Mapping Strategies Evaluated**:

**Strategy 1: Path-Based Matching (Auto)**
```typescript
// KoReader may compute hash from file path like:
// "/mnt/onboard/Books/Harry Potter and the Philosopher's Stone.epub"
// MD5("...Stone.epub") = "a1b2c3d4..."

// Tome attempt:
// 1. Get all Calibre book paths from books.path
// 2. For each path, compute MD5
// 3. Match against intercepted document hash
// 4. Store mapping on first match
```
- **Success Rate**: 60-80% (if KoReader synced from Calibre library)
- **Limitations**: Depends on path consistency
- **Risk**: False positives if paths collide

**Strategy 2: Timing Correlation (Heuristic)**
```typescript
// When new document hash appears:
// 1. Get books read recently (last 7 days)
// 2. Suggest matches based on:
//    - Recent status changes (to-read → reading)
//    - Similar progress percentage
//    - No existing KoReader mapping
// 3. Ask user to confirm
```
- **Success Rate**: 40-60% (depends on reading habits)
- **User Effort**: Low (1-click confirm/reject)
- **Risk**: Incorrect suggestions if user reads multiple books

**Strategy 3: Manual Mapping (Fallback)**
```typescript
// User explicitly creates mapping:
// 1. View unmapped documents list
// 2. Select document → Select book from library
// 3. Store permanent mapping
```
- **Success Rate**: 100% (user-verified)
- **User Effort**: Medium (30s per document, one-time)
- **Risk**: None

**Decision**: **Hybrid Approach** ✅

1. **Auto-map** with Strategy 1 (path matching)
2. **Queue unmapped** documents for user review
3. **Suggest matches** with Strategy 2 (show in UI)
4. **Allow manual** mapping with Strategy 3 (final fallback)

**Expected Results**:
- 60-70% auto-mapped (Calibre-based libraries)
- 20-30% user-mapped (first-time, then permanent)
- 10% unmapped (edge cases, ignored by user)

---

### Task 5: Settings Management Approach

**Question**: How should proxy settings be stored and managed?

**Settings Required**:
1. `koreader_proxy_enabled` (boolean, default: false)
2. `koreader_upstream_url` (string, default: "https://sync.koreader.rocks")
3. `koreader_auto_progress_log` (boolean, default: true)
4. `koreader_proxy_port` (number, default: 7200)

**Options Evaluated**:
- **Option A**: Environment variables (rejected - not user-configurable)
- **Option B**: Config file (rejected - requires file system access)
- **Option C**: Database table (chosen - ✅ persistent, UI-friendly)

**Decision**: Create `application_settings` table (key-value store)

**Rationale**:
- Persistent across restarts
- Editable via Settings UI
- Extensible for future settings
- Follows standard settings pattern

**Schema**:
```typescript
{
  key: text (primary key),
  value: text (JSON-encoded for complex values),
  updated_at: datetime
}
```

---

### Task 6: Testing Strategy

**Question**: How do we test proxy functionality without physical KoReader device?

**Testing Approaches**:

1. **Mock KoReader Client**
```typescript
class MockKoReaderClient {
  async syncProgress(doc: string, progress: number) {
    return fetch('http://localhost:7200/syncs/progress', {
      method: 'PUT',
      headers: {
        'x-auth-user': 'testuser',
        'x-auth-key': md5('password'),
        'Content-Type': 'application/vnd.koreader.v1+json',
      },
      body: JSON.stringify({
        document: doc,
        percentage: progress,
        progress: String(Math.floor(progress * 100)),
        device: 'Test Device',
      }),
    });
  }
}
```

2. **Mock Upstream Server**
```typescript
// Simple HTTP server that returns success
const mockUpstream = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ document: '...', timestamp: Date.now() }));
});
```

3. **Integration Tests**
- Test proxy forwarding with mock upstream
- Test progress interception and log creation
- Test mapping persistence
- Test settings enable/disable

4. **Manual Testing with curl**
```bash
# Simulate KoReader device
curl -X PUT http://localhost:7200/syncs/progress \
  -H "x-auth-user: testuser" \
  -H "x-auth-key: 5f4dcc3b5aa765d61d8327deb882cf99" \
  -H "Content-Type: application/json" \
  -d '{"document":"a1b2c3d4...","percentage":0.35,"progress":"89","device":"Test"}'
```

**Decision**: Comprehensive test suite with mocks, defer real device testing to beta users.

---

## Research Outcomes Summary

| Research Area | Decision | Rationale |
|---------------|----------|-----------|
| **Architecture** | Intercepting Proxy | Real-time capture, 40% less effort, users keep existing sync |
| **Proxy Pattern** | Lightweight Reverse Proxy | Simple, transparent, low latency |
| **Document Mapping** | Hybrid (auto + manual) | 60-70% auto-success, 100% eventually mapped |
| **Settings Storage** | Database table (key-value) | Persistent, UI-friendly, extensible |
| **Testing** | Mocks + integration tests | No device dependency, fast feedback |
| **Upstream Server** | User-configurable | Default: sync.koreader.rocks, allow self-hosted |

---

## Proxy vs. Full Server: Final Comparison

### What We Gain with Proxy:
- ✅ 40% less implementation effort (~15h vs ~25h)
- ✅ Lower maintenance burden (no protocol compliance)
- ✅ Users keep reliable multi-device sync
- ✅ Real-time progress capture (same as full server)
- ✅ Automatic document discovery

### What We Lose with Proxy:
- ❌ Not fully self-contained (needs upstream for sync)
- ❌ Requires user to reconfigure device
- ❌ Can't work offline (for sync, progress logs still work)

### Constitutional Analysis:

**Principles Still Met**:
- ✅ **Data Integrity First**: Progress logs stored locally, Drizzle migrations
- ✅ **Layered Architecture**: Routes → Services → Repositories
- ✅ **User Experience**: Real-time progress, smart defaults
- ✅ **Observability**: Pino logging, comprehensive tests

**Principle Relaxed**:
- ⚠️ **Self-Contained Deployment**: Proxy requires upstream server for actual sync
  - **Justification**: Users already have sync servers they trust. Tome adds value (progress tracking) without replacing infrastructure.
  - **Mitigation**: Store-and-forward for offline resilience (post-MVP)

**Verdict**: Acceptable tradeoff. The modest external dependency is justified by significantly reduced complexity and better user experience.

---

## Open Questions Resolved

1. ❓ **How to integrate with KoReader?** → ✅ Intercepting proxy
2. ❓ **Polling or real-time?** → ✅ Real-time via request interception
3. ❓ **How to map documents to books?** → ✅ Hybrid (auto + manual)
4. ❓ **Store sync data?** → ✅ No, just mappings and audit log
5. ❓ **Support multiple users?** → ✅ Yes, via username header (no auth)

---

## Dependencies Identified

### Internal Dependencies
- Repository Pattern infrastructure (existing)
- Progress log and session repositories (existing)
- Database Factory Pattern (existing)
- Settings management (create `application_settings` table)

### External Dependencies (New)
- Upstream sync server (default: sync.koreader.rocks)
- User internet connection (for sync forwarding)
- **Zero new npm packages** (use fetch API, native crypto)

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Upstream server downtime** | High | Low | Queue requests for retry (post-MVP) |
| **Auto-mapping false positives** | Medium | Low | User can edit/delete mappings |
| **Port conflict (7200)** | Low | Medium | Allow port configuration |
| **Proxy performance** | Medium | Low | Async processing, load testing |

---

## Next Steps (Phase 1)

1. ✅ Research complete
2. ⏭️ Design simplified data model (no user management)
3. ⏭️ Define proxy API contracts
4. ⏭️ Create developer quickstart guide
5. ⏭️ Update plan with revised architecture

---

**Research Phase Complete - Proxy Approach Validated** ✅
