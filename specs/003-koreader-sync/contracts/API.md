# KoReader Sync Proxy - API Documentation

**Feature**: 003-koreader-sync (Proxy Approach)
**API Type**: HTTP Transparent Proxy with Selective Interception  
**Protocol**: KoReader Sync Protocol v1 (passthrough)

---

## Overview

The Tome KoReader Sync Proxy is a **transparent HTTP proxy** that forwards all sync requests to a configured upstream server while selectively intercepting progress updates to create local Tome progress logs.

**Key Characteristics**:
- **Transparent**: Devices can't tell they're talking to a proxy
- **Selective**: Only intercepts `PUT /syncs/progress` for processing
- **Non-blocking**: Progress log creation happens asynchronously
- **Stateless**: No session management, just request forwarding

---

## Proxy Architecture

### Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RECEIVE (from KoReader device)                           │
│    - Parse HTTP method, path, headers, body                 │
│    - Log request (username, endpoint, no passwords)         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. INTERCEPT (if PUT /syncs/progress)                       │
│    - Extract: document_hash, percentage, device             │
│    - Async: Map document → book → create progress log       │
│    - Non-blocking: Continue to step 3 immediately           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. FORWARD (to upstream sync server)                        │
│    - Build upstream URL: {upstream_url}{request_path}       │
│    - Forward headers unchanged                               │
│    - Forward body unchanged                                  │
│    - Timeout: 30 seconds                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RETURN (response from upstream)                          │
│    - Status code unchanged                                   │
│    - Headers unchanged (except proxy headers)                │
│    - Body unchanged                                          │
└─────────────────────────────────────────────────────────────┘
```

**Latency Budget**:
- Total overhead: <50ms (target: <20ms)
- Interception: <5ms (extract data, queue async task)
- Forwarding: <10ms (HTTP overhead)
- Progress log creation: Async (doesn't block response)

---

## Proxy Endpoints

### Catch-All Proxy Route

**Endpoint**: `ALL /api/koreader/*`  
**Method**: ALL (GET, POST, PUT, DELETE, etc.)  
**Purpose**: Forward all KoReader sync requests to upstream server

**Implementation**:
```typescript
// app/api/koreader/[...path]/route.ts
export async function GET(request: NextRequest, { params }) {
  return proxyToUpstream(request, params.path);
}

export async function POST(request: NextRequest, { params }) {
  return proxyToUpstream(request, params.path);
}

export async function PUT(request: NextRequest, { params }) {
  // Special handling for /syncs/progress
  if (params.path.join('/') === 'syncs/progress') {
    await interceptProgressUpdate(request); // Async, non-blocking
  }
  return proxyToUpstream(request, params.path);
}
```

**Request Example**:
```http
PUT /api/koreader/syncs/progress HTTP/1.1
Host: localhost:7200
x-auth-user: johndoe
x-auth-key: 5f4dcc3b5aa765d61d8327deb882cf99
Content-Type: application/vnd.koreader.v1+json

{
  "document": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "percentage": 0.35,
  "progress": "89",
  "device": "Kindle Paperwhite"
}
```

**Forwarded Request** (to `https://sync.koreader.rocks`):
```http
PUT /syncs/progress HTTP/1.1
Host: sync.koreader.rocks
x-auth-user: johndoe
x-auth-key: 5f4dcc3b5aa765d61d8327deb882cf99
Content-Type: application/vnd.koreader.v1+json

{
  "document": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "percentage": 0.35,
  "progress": "89",
  "device": "Kindle Paperwhite"
}
```

**Response** (from upstream, passed through):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "document": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "timestamp": 1717776600
}
```

---

## Progress Interception Logic

### When to Intercept

**Trigger**: `PUT /api/koreader/syncs/progress`

**Extraction**:
```typescript
const body = await request.json();
const { document, percentage, progress, device } = body;
const username = request.headers.get('x-auth-user');

// Queue async processing (non-blocking)
processProgressUpdate({
  documentHash: document,
  percentage,
  progress,
  device,
  username,
}).catch(err => logger.error({ err }, 'Progress processing failed'));
```

**Processing Steps** (async):
1. Check settings: Is auto-progress enabled?
2. Lookup mapping: `SELECT * FROM koreader_document_mappings WHERE document_hash = ?`
3. If mapped:
   - Get book from `books` table
   - Find or create active session
   - Calculate current page (if book has `total_pages`)
   - Create progress log entry
   - Update session status (auto-complete at 100%)
4. If not mapped:
   - Log for manual mapping queue
   - Skip progress log creation
5. Update mapping `last_synced_at`
6. Log sync event (optional audit log)

**Error Handling**:
- Progress processing errors logged but **don't affect proxy response**
- Upstream response always returned to device
- Failed processing retried on next sync (idempotent)

---

## Management Endpoints (Tome-Specific)

These endpoints are for Tome's UI, not proxied to upstream.

### 1. List Document Mappings

**Endpoint**: `GET /api/koreader-management/mappings`  
**Purpose**: Get all document mappings for management UI

**Query Parameters**:
- `mapped` (optional): Filter by mapping status (`true` | `false`)
- `search` (optional): Search by document hash or book title

**Response**:
```json
{
  "mappings": [
    {
      "id": 1,
      "documentHash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
      "book": {
        "id": 123,
        "title": "Harry Potter and the Philosopher's Stone",
        "authors": ["J.K. Rowling"]
      },
      "mappingSource": "auto_path",
      "deviceName": "Kindle Paperwhite",
      "lastSyncedAt": "2026-06-10T10:30:00Z",
      "createdAt": "2026-06-01T08:00:00Z"
    }
  ],
  "total": 1,
  "unmappedCount": 3
}
```

### 2. Create Manual Mapping

**Endpoint**: `POST /api/koreader-management/mappings`  
**Purpose**: Manually map document hash to Tome book

**Request**:
```json
{
  "documentHash": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
  "bookId": 456,
  "deviceName": "Kobo Libra"
}
```

**Response (201 Created)**:
```json
{
  "id": 2,
  "documentHash": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
  "bookId": 456,
  "mappingSource": "manual",
  "deviceName": "Kobo Libra",
  "createdAt": "2026-06-10T11:00:00Z"
}
```

### 3. Update Mapping

**Endpoint**: `PATCH /api/koreader-management/mappings/:id`  
**Purpose**: Update existing mapping (change book association)

**Request**:
```json
{
  "bookId": 789
}
```

**Response (200 OK)**:
```json
{
  "id": 2,
  "documentHash": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
  "bookId": 789,
  "mappingSource": "manual",
  "updatedAt": "2026-06-10T12:00:00Z"
}
```

### 4. Delete Mapping

**Endpoint**: `DELETE /api/koreader-management/mappings/:id`  
**Purpose**: Remove document mapping

**Response (204 No Content)**

### 5. Get Proxy Settings

**Endpoint**: `GET /api/settings/koreader`  
**Purpose**: Retrieve proxy configuration

**Response**:
```json
{
  "proxyEnabled": true,
  "upstreamUrl": "https://sync.koreader.rocks",
  "autoProgressLog": true,
  "proxyPort": 7200,
  "proxyAddress": "http://192.168.1.100:7200"
}
```

### 6. Update Proxy Settings

**Endpoint**: `PATCH /api/settings/koreader`  
**Purpose**: Update proxy configuration

**Request**:
```json
{
  "proxyEnabled": true,
  "upstreamUrl": "https://my-custom-sync.example.com",
  "autoProgressLog": false
}
```

**Response (200 OK)**:
```json
{
  "proxyEnabled": true,
  "upstreamUrl": "https://my-custom-sync.example.com",
  "autoProgressLog": false,
  "proxyPort": 7200
}
```

---

## Error Handling

### Proxy Errors

**Upstream Unreachable** (ECONNREFUSED, timeout):
```http
HTTP/1.1 502 Bad Gateway
Content-Type: application/json

{
  "error": "Upstream sync server unreachable",
  "upstream": "https://sync.koreader.rocks"
}
```

**Upstream Error Response** (4xx, 5xx):
```http
HTTP/1.1 {upstream_status}
Content-Type: application/json

{upstream_body}
```
(Pass through upstream error unchanged)

**Settings: Proxy Disabled**:
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "error": "KoReader sync proxy is disabled",
  "hint": "Enable in Settings → KoReader Sync"
}
```

### Processing Errors (Logged, Not Returned)

Progress log creation failures:
- Mapping not found → Log for manual mapping
- Book not found → Log error, skip progress log
- Session creation failed → Log error, retry next sync
- Database error → Log error, retry next sync

**Critical**: Proxy response never blocked by processing errors.

---

## Settings Behavior

### When Proxy Disabled (`koreader_proxy_enabled = false`)

All requests return:
```http
HTTP/1.1 503 Service Unavailable

{
  "error": "KoReader sync proxy is disabled"
}
```

### When Auto-Progress Disabled (`koreader_auto_progress_log = false`)

- Requests still forwarded to upstream (proxy works)
- Progress interception skipped (no Tome progress logs)
- Useful for testing proxy without affecting Tome data

---

## Performance Characteristics

### Latency Measurements

| Operation | Target | Typical | Max Acceptable |
|-----------|--------|---------|----------------|
| **Proxy overhead** | <20ms | 15ms | 50ms |
| **Header parsing** | <1ms | <1ms | 2ms |
| **Body parsing** (if needed) | <5ms | 3ms | 10ms |
| **Upstream request** | <200ms | 150ms | 500ms |
| **Total request** | <220ms | 165ms | 550ms |

**Progress log creation**: Async (doesn't count toward latency)

### Throughput

- **Concurrent syncs supported**: 10+ devices
- **Requests per second**: 100+ (proxy layer)
- **Database writes per second**: 10-20 (progress logs)

---

## Security Considerations

### What Proxy Sees

**Logged** (for debugging):
- Username (`x-auth-user` header)
- Request path and method
- Document hash
- Device name

**NOT Logged**:
- Password hash (`x-auth-key` header)
- Request/response bodies (except intercepted progress data)

### What Proxy Doesn't Validate

- ❌ User credentials (forwarded to upstream)
- ❌ Document ownership (upstream handles)
- ❌ Request signatures (none in protocol)

### TLS/HTTPS

- **Device → Proxy**: HTTP (localhost) or HTTPS (if configured)
- **Proxy → Upstream**: HTTPS (validates certificates)

---

## Testing the Proxy

### Manual Testing with curl

**1. Health Check** (should forward to upstream):
```bash
curl http://localhost:7200/healthcheck
# Expected: {"state":"OK"} (from upstream)
```

**2. Simulate Progress Update**:
```bash
curl -X PUT http://localhost:7200/syncs/progress \
  -H "x-auth-user: testuser" \
  -H "x-auth-key: 5f4dcc3b5aa765d61d8327deb882cf99" \
  -H "Content-Type: application/vnd.koreader.v1+json" \
  -d '{
    "document": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    "percentage": 0.35,
    "progress": "89",
    "device": "Test Device"
  }'
# Expected: {"document":"a1b2c3d4...","timestamp":1717776600} (from upstream)
# Side effect: Progress log created in Tome (if mapped)
```

**3. Get Progress** (should forward):
```bash
curl http://localhost:7200/syncs/progress/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4 \
  -H "x-auth-user: testuser" \
  -H "x-auth-key: 5f4dcc3b5aa765d61d8327deb882cf99"
# Expected: {percentage, progress, device, ...} or {} (from upstream)
```

### Integration Tests

```typescript
describe('KoReader Proxy', () => {
  it('forwards requests to upstream', async () => {
    const mockUpstream = createMockServer((req, res) => {
      res.json({ document: 'test', timestamp: 123 });
    });
    
    const response = await fetch('http://localhost:7200/syncs/progress', {
      method: 'PUT',
      headers: { 'x-auth-user': 'test', 'x-auth-key': 'abc123' },
      body: JSON.stringify({ document: 'test', percentage: 0.5, ... }),
    });
    
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ document: 'test', timestamp: 123 });
  });
  
  it('creates progress log for mapped document', async () => {
    await koreaderMappingRepository.create({
      documentHash: 'test123',
      bookId: 1,
      mappingSource: 'manual',
    });
    
    await fetch('http://localhost:7200/syncs/progress', {
      method: 'PUT',
      body: JSON.stringify({ document: 'test123', percentage: 0.5, ... }),
    });
    
    // Wait for async processing
    await sleep(100);
    
    const progressLogs = await progressRepository.findByBookId(1);
    expect(progressLogs).toHaveLength(1);
    expect(progressLogs[0].currentPercentage).toBe(0.5);
  });
});
```

---

## Configuration Examples

### Default Configuration (sync.koreader.rocks)

```json
{
  "koreader_proxy_enabled": "true",
  "koreader_upstream_url": "https://sync.koreader.rocks",
  "koreader_auto_progress_log": "true",
  "koreader_proxy_port": "7200"
}
```

**Device Configuration**:
- Custom sync server: `http://192.168.1.100:7200`
- Username: (your koreader.rocks username)
- Password: (your koreader.rocks password)

### Self-Hosted Upstream

```json
{
  "koreader_proxy_enabled": "true",
  "koreader_upstream_url": "http://my-kobo-sync:8080",
  "koreader_auto_progress_log": "true",
  "koreader_proxy_port": "7200"
}
```

### Testing Mode (No Progress Logs)

```json
{
  "koreader_proxy_enabled": "true",
  "koreader_upstream_url": "https://sync.koreader.rocks",
  "koreader_auto_progress_log": "false",
  "koreader_proxy_port": "7200"
}
```

---

## Proxy vs. Direct Connection Comparison

| Aspect | Direct to sync.koreader.rocks | **Via Tome Proxy** |
|--------|-------------------------------|-------------------|
| **Multi-device sync** | ✅ Works | ✅ **Works** (forwarded) |
| **Latency** | ~150ms | ~165ms (+15ms overhead) |
| **Progress logs in Tome** | ❌ Manual entry | ✅ **Automatic** |
| **Document discovery** | N/A | ✅ **Automatic** |
| **Privacy** | Username/hash sent | **Same** (forwarded) |
| **Reliability** | Official server uptime | **Depends on upstream** |

**Conclusion**: Proxy adds minimal overhead (~10%) while enabling automatic progress tracking.

---

## Summary

### Key Points

✅ **Transparent proxy** - Devices can't tell the difference  
✅ **Selective interception** - Only processes progress updates  
✅ **Non-blocking** - Async progress log creation  
✅ **Stateless** - No session management  
✅ **Low latency** - <50ms overhead target  
✅ **Configurable** - User chooses upstream server  
✅ **Graceful** - Handles upstream failures  

### API Endpoints Summary

| Endpoint | Type | Purpose |
|----------|------|---------|
| `ALL /api/koreader/*` | Proxy | Forward all KoReader sync requests |
| `GET /api/koreader-management/mappings` | Management | List document mappings |
| `POST /api/koreader-management/mappings` | Management | Create manual mapping |
| `PATCH /api/koreader-management/mappings/:id` | Management | Update mapping |
| `DELETE /api/koreader-management/mappings/:id` | Management | Delete mapping |
| `GET /api/settings/koreader` | Settings | Get proxy config |
| `PATCH /api/settings/koreader` | Settings | Update proxy config |

---

**Next Steps**:
1. Implement proxy middleware (`lib/services/koreader-proxy.service.ts`)
2. Implement progress interception (`lib/services/koreader-progress.service.ts`)
3. Create management API routes
4. Add UI for mappings and settings
