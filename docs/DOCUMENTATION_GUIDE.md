# Book Tracker Documentation Guide

This folder contains comprehensive documentation for the Book Tracker codebase. Use this guide to navigate the available resources.

## Documentation Files

### 1. ARCHITECTURE.md (21KB)
**Comprehensive architecture and design documentation**

Contains:
- Overall architecture overview
- Complete directory structure
- Database models and relationships (Book, ReadingSession, ProgressLog, Streak)
- Calibre integration explanation
- Automatic sync mechanism (watcher + instrumentation)
- Complete API routes reference with examples
- Frontend architecture (pages and components)
- Data flow examples (Progress, Sync, Status workflows)
- Configuration files explained
- Deployment information (Docker)
- Design patterns used
- Common workflows for development
- Future expansion points

**Best for:** Understanding the big picture, architecture decisions, how systems interact

### 2. patterns.md (16KB)
**Code snippets, patterns, and quick lookup guide**

Contains:
- 10 critical code sections with explanations
  - Database connection patterns
  - Syncing flow
  - Auto-sync architecture
  - Reading progress tracking
  - Streak calculation
  - API route patterns
  - Calibre metadata extraction
  - Cover image serving
  - Status state machine
  - Client-side data fetching
- Environment variables reference
- Database indexes quick reference
- Common issues and solutions
- Performance optimization tips
- Testing checklist

**Best for:** Quick lookups, understanding specific implementation details, troubleshooting

## Reading Recommendations

### For New Developers
1. Start with ARCHITECTURE.md sections 1-3
2. Review the directory structure and models
3. Read the Calibre integration section
4. Look at patterns.md sections 1-2

### For Understanding a Specific Feature
1. Find the feature in ARCHITECTURE.md
2. Look for relevant code snippets in patterns.md
3. Review the actual source files if needed

### For API Development
- ARCHITECTURE.md section 5 (API Routes)
- patterns.md sections 6-7 (API patterns)

### For Frontend Work
- ARCHITECTURE.md section 6 (Frontend Architecture)
- patterns.md section 10 (Client-side patterns)

### For Integration Work
- ARCHITECTURE.md sections 3-4 (Calibre integration)
- patterns.md sections 2-3 (Sync details)
- patterns.md section 7 (Metadata extraction)

## Source Files Reference

### Core Services (/lib)
| File | Purpose | Documentation |
|------|---------|---|
| db/mongodb.ts | MongoDB connection | Arch 2, QR 1 |
| db/calibre.ts | Calibre reader | Arch 3, QR 7 |
| sync-service.ts | Sync logic | Arch 3, QR 2 |
| calibre-watcher.ts | File monitoring | Arch 4, QR 3 |
| streaks.ts | Streak calculations | Arch 2, QR 5 |

### Models (/models)
| File | Purpose | Documentation |
|------|---------|---|
| Book.ts | Calibre metadata | Arch 2 |
| ReadingSession.ts | Session tracking | Arch 2 |
| ProgressLog.ts | Progress entries | Arch 2 |
| Streak.ts | Streak tracking | Arch 2 |

### API Routes (/app/api)
| Route | Purpose | Documentation |
|-------|---------|---|
| /books | Book list | Arch 5, QR 6 |
| /books/:id | Book details | Arch 5 |
| /books/:id/progress | Progress tracking | Arch 5, QR 4 |
| /books/:id/status | Status management | Arch 5, QR 9 |
| /stats/* | Statistics | Arch 5, QR 6 |
| /streaks | Streak data | Arch 5 |
| /calibre/sync | Manual sync | Arch 5 |
| /calibre/status | Sync status | Arch 5 |
| /covers | Cover images | Arch 5, QR 8 |

### Pages (/app)
| Page | Purpose | Documentation |
|------|---------|---|
| page.tsx | Dashboard | Arch 6 |
| /library | Book browsing | Arch 6 |
| /books/[id] | Book detail | Arch 6 |
| /stats | Statistics | Arch 6 |
| /settings | Configuration | Arch 6 |

## Key Concepts

### Sync System
- **File Watcher:** Monitors Calibre database file for changes
- **Debouncing:** 2-second wait prevents excessive syncs
- **Concurrency Control:** isSyncing flag prevents concurrent syncs
- **Initial Sync:** Runs on server startup

See: ARCHITECTURE.md sections 3-4, QUICK_REFERENCE.md sections 2-3

### Data Model
- **Books:** From Calibre (read-only in app)
- **ReadingSession:** User's reading sessions per book (supports re-reading)
- **ProgressLog:** Individual reading progress entries
- **Streak:** Consistency metric from progress

See: ARCHITECTURE.md section 2

### Frontend Architecture
- **Server Components:** Dashboard, Stats, Settings load data server-side
- **Client Components:** Library, Book Detail are interactive
- **Data Fetching:** Patterns vary by component type

See: ARCHITECTURE.md section 6, QUICK_REFERENCE.md section 10

## Common Tasks

### Adding a New Statistic
1. Create MongoDB query or aggregation pipeline
2. Add API endpoint in /app/api/stats/
3. Create or update page in /app/stats or /app/
4. Use StatsCard component for display

See: ARCHITECTURE.md section 11

### Debugging Sync Issues
1. Check CALIBRE_DB_PATH is set correctly
2. Verify file permissions on library folder
3. Check server logs for instrumentation hook startup
4. Verify file watcher debounce timing

See: QUICK_REFERENCE.md "Common Issues" section

### Optimizing Database Queries
1. Use MongoDB aggregation pipeline for stats
2. Add indexes for frequently filtered fields
3. Use pagination for large result sets
4. Fetch only needed fields with projection

See: QUICK_REFERENCE.md "Performance Optimization Tips"

### Adding Calibre Metadata
1. Update CalibreBook interface in calibre.ts
2. Add column to SQL query with dynamic checking
3. Include in sync process (sync-service.ts)
4. Display in book detail page

See: ARCHITECTURE.md section 3, QUICK_REFERENCE.md section 7

## Development Checklist

- [ ] Understand the sync architecture (ARCHITECTURE.md 4)
- [ ] Understand the data model (ARCHITECTURE.md 2)
- [ ] Review the API routes (ARCHITECTURE.md 5)
- [ ] Review the frontend pages (ARCHITECTURE.md 6)
- [ ] Set up environment (.env with Calibre path)
- [ ] Run local MongoDB (docker-compose up)
- [ ] Start dev server (bun run dev)
- [ ] Manual sync from settings page
- [ ] Test each page and feature

## Key Files to Know

**Always Required Before Making Changes:**
- /models/* - Understand the data structures
- /lib/sync-service.ts - Main sync logic
- /app/api/books/[id]/progress/route.ts - Progress tracking logic
- /lib/streaks.ts - Streak calculation logic

**Frequently Modified:**
- /app/api/books/ - Book endpoints
- /app/[page]/page.tsx - Frontend pages
- /components/ - UI components

**Rarely Changed:**
- /lib/db/ - Database connections
- /instrumentation.ts - Server initialization
- /next.config.js - Build configuration

## Performance Considerations

1. **Sync Performance:** Large Calibre libraries (10k+ books) take time to sync
2. **Query Performance:** N+1 queries in /api/books need aggregation refactor
3. **Image Caching:** Cover images are immutable cached (1 year)
4. **Streak Calculation:** Uses date normalization for accuracy

See: QUICK_REFERENCE.md "Performance Optimization Tips"

## Deployment Notes

- Docker image uses Bun runtime
- Requires separate MongoDB service
- CALIBRE_DB_PATH must be accessible from container
- File watcher works inside container if library mounted

See: ARCHITECTURE.md section 9

## Troubleshooting

**Problem:** Sync not working
- Check CALIBRE_DB_PATH in .env
- Verify file permissions
- Check server logs for instrumentation errors
- See QUICK_REFERENCE.md "Common Issues"

**Problem:** Streak not calculating
- Verify updateStreaks() is called in progress endpoint
- Check date normalization with startOfDay()
- See QUICK_REFERENCE.md section 5

**Problem:** Cover images not showing
- Verify CALIBRE_DB_PATH points to metadata.db location
- Check library folder permissions from server process
- Look for path validation errors in logs
- See QUICK_REFERENCE.md section 8

## Getting Help

1. Check the relevant documentation section first
2. Look for similar code patterns in the codebase
3. Search the Quick Reference for your issue
4. Review the "Common Issues" section
5. Check server logs for error messages

## Keeping Documentation Updated

When making changes to the codebase:
1. Update relevant documentation sections
2. Add new code snippets to Quick Reference if pattern is novel
3. Update API routes table if endpoints change
4. Update common workflows if adding new features

---

Generated: 2025-11-17
Last Updated: 2025-11-17
Scope: Book Tracker v0.1.0
