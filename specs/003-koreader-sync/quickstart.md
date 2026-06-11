# KoReader Sync Proxy - Developer Quickstart

**Feature**: 003-koreader-sync (Proxy Approach)  
**Target Audience**: Developers implementing the proxy  
**Last Updated**: 2026-06-10  
**Estimated Time**: 15-19 hours total

---

## 📚 Prerequisites Reading

Before coding, read these in order (30 min):

1. ✅ `spec.md` - Feature overview and requirements
2. ✅ `research.md` - Why proxy > full server
3. ✅ `data-model.md` - Database schema (2-3 tables)
4. ✅ `contracts/API.md` - Proxy behavior and endpoints

---

## 🚀 Quick Start (5-Minute Overview)

**What We're Building**:
```
KoReader Device → Tome Proxy (localhost:7200) → Upstream Server
                       ↓ (intercept)
                  Create Progress Log
```

**Core Components** (4 pieces):
1. **Proxy Service** - HTTP forwarding logic
2. **Progress Service** - Interception + progress log creation
3. **Mapping Repository** - Document hash → Book lookups
4. **Settings** - Enable/disable proxy, upstream URL

**Effort Breakdown**:
- Database & schema: 2-3 hours
- Proxy service: 4-6 hours
- Progress integration: 3-4 hours
- Management UI: 4-6 hours
- Testing: 3-4 hours

---

## 📋 Implementation Phases

### Phase 1: Database Setup (2-3 hours)

#### 1.1 Create Schema File

**File**: `lib/db/schema/koreader.ts`

```typescript
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { books } from './books';

export const koreaderDocumentMappings = sqliteTable('koreader_document_mappings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentHash: text('document_hash').notNull().unique(),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  mappingSource: text('mapping_source', { enum: ['auto_path', 'manual'] }).notNull(),
  deviceName: text('device_name'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  bookIdIdx: index('koreader_mapping_book_id_idx').on(table.bookId),
}));

export const applicationSettings = sqliteTable('application_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type KoReaderDocumentMapping = typeof koreaderDocumentMappings.$inferSelect;
export type NewKoReaderDocumentMapping = typeof koreaderDocumentMappings.$inferInsert;
```

#### 1.2 Update Schema Index

Add to `lib/db/schema/index.ts`:
```typescript
export * from './koreader';
```

#### 1.3 Generate & Apply Migration

```bash
bunx drizzle-kit generate
# Creates: drizzle/XXXX_koreader_proxy_tables.sql

npm run db:migrate
# Applies migration to data/tome.db
```

#### 1.4 Seed Default Settings

```bash
sqlite3 data/tome.db <<EOF
INSERT OR IGNORE INTO application_settings (key, value) VALUES 
  ('koreader_proxy_enabled', 'false'),
  ('koreader_upstream_url', 'https://sync.koreader.rocks'),
  ('koreader_auto_progress_log', 'true'),
  ('koreader_proxy_port', '7200');
EOF
```

**Checkpoint**: Verify tables exist
```bash
sqlite3 data/tome.db ".schema koreader_document_mappings"
```

---

### Phase 2: Repositories (2-3 hours)

#### 2.1 Mapping Repository

**File**: `lib/repositories/koreader-mapping.repository.ts`

```typescript
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/lib/db/context';
import { koreaderDocumentMappings, type KoReaderDocumentMapping } from '@/lib/db/schema/koreader';

class KoReaderMappingRepository {
  async findByDocumentHash(documentHash: string): Promise<KoReaderDocumentMapping | null> {
    const db = getDatabase();
    return db.select().from(koreaderDocumentMappings)
      .where(eq(koreaderDocumentMappings.documentHash, documentHash))
      .get() || null;
  }

  async create(data: Omit<KoReaderDocumentMapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<KoReaderDocumentMapping> {
    const db = getDatabase();
    return db.insert(koreaderDocumentMappings).values(data).returning().get();
  }

  async updateLastSynced(documentHash: string, syncedAt: Date): Promise<void> {
    const db = getDatabase();
    db.update(koreaderDocumentMappings)
      .set({ lastSyncedAt: syncedAt, updatedAt: new Date() })
      .where(eq(koreaderDocumentMappings.documentHash, documentHash))
      .run();
  }

  async findAll(): Promise<KoReaderDocumentMapping[]> {
    const db = getDatabase();
    return db.select().from(koreaderDocumentMappings).all();
  }

  async delete(id: number): Promise<void> {
    const db = getDatabase();
    db.delete(koreaderDocumentMappings).where(eq(koreaderDocumentMappings.id, id)).run();
  }
}

export const koreaderMappingRepository = new KoReaderMappingRepository();
```

#### 2.2 Settings Repository (if not exists)

**File**: `lib/repositories/settings.repository.ts`

```typescript
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/lib/db/context';
import { applicationSettings } from '@/lib/db/schema/koreader';

class SettingsRepository {
  async get(key: string): Promise<string | null> {
    const db = getDatabase();
    const setting = db.select().from(applicationSettings)
      .where(eq(applicationSettings.key, key))
      .get();
    return setting?.value || null;
  }

  async set(key: string, value: string): Promise<void> {
    const db = getDatabase();
    db.insert(applicationSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: applicationSettings.key,
        set: { value, updatedAt: new Date() },
      })
      .run();
  }
}

export const settingsRepository = new SettingsRepository();
```

**Checkpoint**: Write repository tests
```bash
npm test -- koreader-mapping.repository.test.ts
```

---

### Phase 3: Proxy Service (4-6 hours)

#### 3.1 Proxy Service

**File**: `lib/services/koreader-proxy.service.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { settingsRepository } from '@/lib/repositories/settings.repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger().child({ module: 'koreader-proxy' });

export class KoReaderProxyService {
  async forwardRequest(request: NextRequest, path: string[]): Promise<NextResponse> {
    // Get upstream URL from settings
    const upstreamUrl = await settingsRepository.get('koreader_upstream_url') || 'https://sync.koreader.rocks';
    
    const targetUrl = `${upstreamUrl}/${path.join('/')}`;
    
    logger.info({ targetUrl, method: request.method }, 'Forwarding request');
    
    try {
      // Build forwarded request
      const headers = new Headers();
      request.headers.forEach((value, key) => {
        // Skip host header
        if (key.toLowerCase() !== 'host') {
          headers.set(key, value);
        }
      });
      
      // Get body if present
      let body: BodyInit | null = null;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.text();
      }
      
      // Forward to upstream
      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      // Build response
      const responseBody = await upstreamResponse.text();
      
      return new NextResponse(responseBody, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: upstreamResponse.headers,
      });
      
    } catch (error) {
      logger.error({ error, targetUrl }, 'Upstream request failed');
      
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: 'Upstream server timeout' }, { status: 504 });
      }
      
      return NextResponse.json({ 
        error: 'Upstream sync server unreachable',
        upstream: upstreamUrl 
      }, { status: 502 });
    }
  }
}

export const koReaderProxyService = new KoReaderProxyService();
```

#### 3.2 Progress Interception Service

**File**: `lib/services/koreader-progress.service.ts`

```typescript
import { koreaderMappingRepository } from '@/lib/repositories/koreader-mapping.repository';
import { bookRepository } from '@/lib/repositories/book.repository';
import { progressRepository } from '@/lib/repositories/progress.repository';
import { sessionRepository } from '@/lib/repositories/session.repository';
import { settingsRepository } from '@/lib/repositories/settings.repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger().child({ module: 'koreader-progress' });

interface ProgressData {
  documentHash: string;
  percentage: number;
  progress: string;
  device: string;
  username?: string;
}

export class KoReaderProgressService {
  async processProgressUpdate(data: ProgressData): Promise<void> {
    try {
      // Check if auto-progress is enabled
      const autoProgress = await settingsRepository.get('koreader_auto_progress_log');
      if (autoProgress !== 'true') {
        logger.info('Auto progress log disabled, skipping');
        return;
      }
      
      // Find mapping
      const mapping = await koreaderMappingRepository.findByDocumentHash(data.documentHash);
      
      if (!mapping) {
        logger.info({ documentHash: data.documentHash }, 'No mapping found, skipping progress log');
        // TODO: Queue for manual mapping UI
        return;
      }
      
      // Get book
      const book = await bookRepository.findById(mapping.bookId);
      if (!book) {
        logger.warn({ bookId: mapping.bookId }, 'Book not found for mapping');
        return;
      }
      
      // Find or create active session
      let session = await sessionRepository.findActiveByBookId(book.id);
      if (!session) {
        const nextNumber = await sessionRepository.getNextSessionNumber(book.id);
        session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: nextNumber,
          status: 'reading',
          isActive: true,
        });
      }
      
      // Calculate current page if book has total pages
      let currentPage: number | undefined;
      if (book.totalPages) {
        currentPage = Math.floor(data.percentage * book.totalPages);
      }
      
      // Create progress log
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPercentage: data.percentage * 100, // Convert to 0-100
        currentPage,
        progressDate: new Date(),
        notes: `Synced from KoReader device: ${data.device}`,
      });
      
      // Update mapping last synced
      await koreaderMappingRepository.updateLastSynced(data.documentHash, new Date());
      
      // Auto-complete session at 100%
      if (data.percentage >= 1.0 && session.status !== 'read') {
        await sessionRepository.update(session.id, {
          status: 'read',
          completedDate: new Date(),
        });
      }
      
      logger.info({ 
        documentHash: data.documentHash, 
        bookId: book.id, 
        percentage: data.percentage 
      }, 'Progress log created from KoReader sync');
      
    } catch (error) {
      logger.error({ error, data }, 'Failed to process progress update');
      // Don't throw - this is async, shouldn't block proxy response
    }
  }
}

export const koReaderProgressService = new KoReaderProgressService();
```

**Checkpoint**: Write service tests
```bash
npm test -- koreader-progress.service.test.ts
```

---

### Phase 4: API Routes (2-3 hours)

#### 4.1 Proxy Catch-All Route

**File**: `app/api/koreader/[...path]/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { koReaderProxyService } from '@/lib/services/koreader-proxy.service';
import { koReaderProgressService } from '@/lib/services/koreader-progress.service';
import { settingsRepository } from '@/lib/repositories/settings.repository';

async function handleProxyRequest(request: NextRequest, params: { path: string[] }) {
  // Check if proxy is enabled
  const enabled = await settingsRepository.get('koreader_proxy_enabled');
  if (enabled !== 'true') {
    return Response.json({ error: 'KoReader sync proxy is disabled' }, { status: 503 });
  }
  
  // Special handling for progress updates
  if (request.method === 'PUT' && params.path.join('/') === 'syncs/progress') {
    // Clone request to read body (can only read once)
    const body = await request.text();
    const progressData = JSON.parse(body);
    
    // Process async (don't await, fire-and-forget)
    koReaderProgressService.processProgressUpdate({
      documentHash: progressData.document,
      percentage: progressData.percentage,
      progress: progressData.progress,
      device: progressData.device,
      username: request.headers.get('x-auth-user') || undefined,
    }).catch(err => console.error('Progress processing failed:', err));
    
    // Create new request with same body for forwarding
    const forwardRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    });
    
    return koReaderProxyService.forwardRequest(forwardRequest, params.path);
  }
  
  // Forward all other requests unchanged
  return koReaderProxyService.forwardRequest(request, params.path);
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxyRequest(request, params);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxyRequest(request, params);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxyRequest(request, params);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxyRequest(request, params);
}
```

#### 4.2 Management Routes

Create these files:
- `app/api/koreader-management/mappings/route.ts` (GET, POST)
- `app/api/koreader-management/mappings/[id]/route.ts` (PATCH, DELETE)
- `app/api/settings/koreader/route.ts` (GET, PATCH)

See `contracts/API.md` for detailed specs.

**Checkpoint**: Manual testing with curl
```bash
curl http://localhost:3000/api/koreader/healthcheck
```

---

### Phase 5: Testing (3-4 hours)

#### 5.1 Repository Tests

**File**: `__tests__/repositories/koreader-mapping.repository.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setDatabase, resetDatabase } from '@/lib/db/context';
import { db as testDb } from '@/lib/db/sqlite';
import { koreaderMappingRepository } from '@/lib/repositories/koreader-mapping.repository';

beforeEach(() => {
  setDatabase(testDb);
  resetDatabase();
});

describe('KoReaderMappingRepository', () => {
  it('should create and find mapping', async () => {
    const mapping = await koreaderMappingRepository.create({
      documentHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      bookId: 1,
      mappingSource: 'manual',
    });
    
    expect(mapping.documentHash).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
    
    const found = await koreaderMappingRepository.findByDocumentHash('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
    expect(found).not.toBeNull();
    expect(found?.bookId).toBe(1);
  });
});
```

#### 5.2 Integration Tests

Test proxy forwarding, progress interception, settings behavior.

#### 5.3 Manual Testing

```bash
# Start dev server
npm run dev

# In another terminal, test proxy
curl -X PUT http://localhost:3000/api/koreader/syncs/progress \
  -H "x-auth-user: testuser" \
  -H "x-auth-key: 5f4dcc3b5aa765d61d8327deb882cf99" \
  -H "Content-Type: application/json" \
  -d '{"document":"test123","percentage":0.5,"progress":"50","device":"Test"}'
```

---

## 🎯 Success Checklist

Before marking complete:

- [ ] All tables created in database
- [ ] Settings seeded with defaults
- [ ] Proxy forwards requests to upstream
- [ ] Progress interception working (check logs)
- [ ] Mappings can be created/retrieved
- [ ] All tests passing
- [ ] Manual curl testing successful
- [ ] Settings enable/disable works (503 when disabled)

---

## 🚨 Common Pitfalls

1. **Forgetting to clone request body** - Can only read once!
2. **Blocking on progress processing** - Must be async/fire-and-forget
3. **Not handling upstream timeouts** - Use AbortSignal.timeout()
4. **Forgetting test isolation** - Always use setDatabase/resetDatabase
5. **Hard-coding upstream URL** - Must read from settings

---

## 📚 Reference Links

- **Full spec**: `spec.md`
- **Architecture decision**: `research.md`
- **Database schema**: `data-model.md`
- **API contracts**: `contracts/API.md`
- **Patterns**: `.specify/memory/patterns.md`
- **Constitution**: `.specify/memory/constitution.md`

---

## ⏭️ Post-MVP Enhancements

After core proxy works:

1. **Auto-mapping logic** (path-based matching)
2. **Management UI** (view/edit mappings)
3. **Settings UI** (enable/disable proxy)
4. **Store-and-forward** (offline queue)
5. **Sync statistics** (dashboard)

---

**Ready to start? Begin with Phase 1: Database Setup!** 🚀

**Estimated completion**: 15-19 hours (vs. 25-30 for full server)
