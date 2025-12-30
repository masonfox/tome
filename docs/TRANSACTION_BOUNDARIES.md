# Transaction Boundaries in SessionService

## Current State

The `SessionService.markAsRead()` method performs multiple database operations that ideally should be wrapped in a transaction to ensure atomicity. However, full transactional support requires significant refactoring of the repository layer.

## Operations in markAsRead()

### Critical Operations (Should Be Transactional)
These operations modify core data and should succeed or fail together:

1. **Status Transition** (`ensureReadingStatus()`)
   - Creates/updates reading session
   - Changes book status to "reading"

2. **Progress Creation** (`create100PercentProgress()`)
   - Creates 100% progress log
   - Triggers auto-completion to "read" status
   - Archives the reading session

3. **Direct Status Update** (`updateStatus()`)
   - Direct status change for books without pages
   - Session state updates

### Best-Effort Operations (Should Be Outside Transaction)
These operations can fail without compromising data integrity:

1. **Rating Update** (`updateBookRating()`)
   - Syncs to external services (Calibre)
   - Updates books.rating field
   - Failures logged but don't block main operation

2. **Review Update** (`updateSessionReview()`)
   - Updates session.review field
   - Failures logged but don't block main operation

## Why Full Transactions Aren't Implemented Yet

### Technical Barriers

1. **Repository Methods Don't Accept Transaction Parameter**
   ```typescript
   // Current signature
   async findById(id: number): Promise<Book | null>

   // Would need to be
   async findById(id: number, tx?: Transaction): Promise<Book | null>
   ```

2. **Service Methods Call Other Services**
   - `ensureReadingStatus()` calls `updateStatus()`
   - `create100PercentProgress()` calls `progressService.logProgress()`
   - These nested calls would need transaction propagation

3. **Better-SQLite3 Transaction Semantics**
   - Requires synchronous transaction callbacks (no async/await inside transaction)
   - Drizzle ORM handles this, but adds complexity
   - See `lib/services/book.service.ts:updateTotalPages()` for example

### Refactoring Required

To implement full transaction support:

1. **Update all repository methods**
   ```typescript
   // Example: bookRepository
   async update(
     id: number,
     data: Partial<Book>,
     tx?: Transaction
   ): Promise<Book> {
     const db = tx ?? getDatabase();
     return db.update(books).set(data).where(eq(books.id, id));
   }
   ```

2. **Add transaction parameter to service methods**
   ```typescript
   async ensureReadingStatus(
     bookId: number,
     tx?: Transaction
   ): Promise<ReadingSession> {
     // Pass tx to repository calls
   }
   ```

3. **Update markAsRead to use transactions**
   ```typescript
   async markAsRead(params: MarkAsReadParams): Promise<MarkAsReadResult> {
     return await db.transaction(async (tx) => {
       // All critical operations use tx
       const session = await this.ensureReadingStatus(bookId, tx);
       await this.create100PercentProgress(bookId, totalPages, completedDate, tx);
       // ...
       return result;
     });
   }
   ```

## Current Risk Assessment

### Risk Level: **MEDIUM**

**Why It's Not Critical:**
1. Most failure scenarios are unlikely (database writes rarely fail)
2. Rating/review updates are best-effort (documented behavior)
3. Status transitions are single operations (atomic at DB level)
4. No evidence of partial-state bugs in production

**Scenarios That Could Cause Partial State:**
1. Network failure between `ensureReadingStatus()` and `create100PercentProgress()`
   - Result: Book stuck in "reading" status without progress log
   - Recovery: User can manually complete or re-mark as read

2. Database failure during multi-step workflow
   - Result: Incomplete status transition
   - Recovery: User can retry operation

## Recommended Path Forward

### Phase 1: Documentation (Completed)
- ✅ Document transaction boundaries
- ✅ Identify critical vs best-effort operations
- ✅ Create this technical reference

### Phase 2: Repository Refactoring (Future)
Estimated effort: 8-12 hours

1. Add transaction parameter to all repository methods (2-3 hours)
2. Update method signatures and implementations (3-4 hours)
3. Add tests for transaction behavior (2-3 hours)
4. Update documentation (1-2 hours)

### Phase 3: Service Layer Transactions (Future)
Estimated effort: 6-8 hours

1. Add transaction parameter to service methods (2-3 hours)
2. Implement transaction wrapping in markAsRead (1-2 hours)
3. Add transaction tests (2-3 hours)
4. Performance testing (1 hour)

### Phase 4: Integration Testing (Future)
Estimated effort: 4-6 hours

1. Create transaction failure simulation tests (2-3 hours)
2. Test rollback scenarios (1-2 hours)
3. Validate partial-state prevention (1-2 hours)

## Total Estimated Effort
**18-26 hours** of development time for full transactional guarantees.

## Decision
For the current PR (#179), we've decided to:
1. ✅ Document the current state and requirements
2. ✅ Extract external service sync to dedicated layer (reduces transaction complexity)
3. ⏳ Defer full transaction implementation to future PR
4. ⏳ Monitor production for partial-state incidents (none reported so far)

## Related References
- Example transaction usage: `lib/services/book.service.ts:updateTotalPages()`
- Drizzle transaction docs: https://orm.drizzle.team/docs/transactions
- Database context: `lib/db/context.ts`
- Repository pattern: `lib/repositories/base.repository.ts`

---

**Last Updated:** 2025-12-29
**Status:** Documented, implementation deferred
**Next Review:** After any production incidents involving partial state
