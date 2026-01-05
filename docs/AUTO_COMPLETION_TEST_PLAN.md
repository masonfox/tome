# Auto-Completion Refactoring: Comprehensive Test Plan

**Status**: Implementation Guide  
**Created**: 2025-12-29  
**Related**: Progress Service, Rating API, useBookStatus Hook, LogProgressModal

## Overview

This document outlines comprehensive test coverage for the auto-completion refactoring that automatically changes book status to "read" when progress reaches 100%. This eliminates duplicate code paths and fixes the backdating bug.

## Architectural Changes

### 1. Progress Service (`lib/services/progress.service.ts`)
- **Auto-completion**: When progress reaches 100%, automatically calls `SessionService.updateStatus()` to change status to "read"
- **Date preservation**: Uses progress date (including backdated entries) as completedDate
- **Integration**: Calls SessionService after creating 100% progress log

### 2. Rating API (`app/api/books/[id]/rating/route.ts`) 
- **New endpoint**: PATCH `/api/books/[id]/rating` 
- **Purpose**: Update rating/review independently of status changes
- **Separation**: Cleaner architecture by decoupling rating from status

### 3. LogProgressModal (`components/LogProgressModal.tsx`)
- **Updated flow**: `handleConfirmFinish()` now uses `/rating` endpoint
- **No status change**: Status already changed by progress service
- **Simplified logic**: Just updates rating/review

### 4. useBookStatus Hook (`hooks/useBookStatus.ts`)
- **Refactored**: `markAsReadMutation` checks for 100% progress
- **Auto-creation**: If no 100% progress, creates it (triggers auto-completion)
- **Rating update**: Then updates rating/review via `/rating` endpoint
- **Edge case**: Handles books without totalPages separately

---

## Test Requirements

### 1. Service Layer Tests

#### File: `__tests__/services/progress.service.test.ts`

**Current Status**: Has 260-284 lines testing completion detection  
**Needed**: Expand auto-completion coverage

**Tests to Add:**

```typescript
describe("logProgress - auto-completion", () => {
  test("should auto-complete book when progress reaches 100%", async () => {
    // GIVEN: Book with active "reading" session
    // WHEN: Log 100% progress
    const result = await progressService.logProgress(book.id, {
      currentPercentage: 100,
    });
    
    // THEN: Book status changes to "read", session marked inactive
    expect(result.shouldShowCompletionModal).toBe(true);
    const session = await sessionRepository.findById(sessionId);
    expect(session?.status).toBe("read");
    expect(session?.completedDate).not.toBeNull();
    expect(session?.isActive).toBe(false);
  });

  test("should use progress date as completedDate when backdated", async () => {
    // GIVEN: Book with active "reading" session
    // WHEN: Log 100% progress with backdated date (Dec 15)
    const backdatedDate = new Date("2025-12-15");
    await progressService.logProgress(book.id, {
      currentPercentage: 100,
      progressDate: backdatedDate,
    });
    
    // THEN: completedDate is Dec 15, NOT today
    const session = await sessionRepository.findById(sessionId);
    expect(session?.completedDate).toEqual(backdatedDate);
  });

  test("should handle 100% progress when book already completed", async () => {
    // GIVEN: Book already marked as "read" (from previous 100% log)
    await progressService.logProgress(book.id, { currentPercentage: 100 });
    
    // WHEN: Log another 100% entry
    const result = await progressService.logProgress(book.id, { 
      currentPercentage: 100,
      progressDate: new Date("2025-12-20")
    });
    
    // THEN: Does not show completion modal (already completed)
    expect(result.shouldShowCompletionModal).toBe(false);
  });

  test("should not auto-complete when progress < 100%", async () => {
    // GIVEN: Book with active "reading" session
    // WHEN: Log 99.9% progress
    const result = await progressService.logProgress(book.id, {
      currentPercentage: 99.9,
    });
    
    // THEN: Status remains "reading"
    expect(result.shouldShowCompletionModal).toBe(false);
    const session = await sessionRepository.findById(sessionId);
    expect(session?.status).toBe("reading");
  });

  test("should auto-complete book without totalPages at 100%", async () => {
    // GIVEN: Book with no totalPages set
    const bookWithoutPages = await bookRepository.create({
      calibreId: 999,
      title: "No Pages Book",
      totalPages: null,
    });
    await sessionRepository.create({
      bookId: bookWithoutPages.id,
      status: "reading",
    });
    
    // WHEN: Log 100% progress
    const result = await progressService.logProgress(bookWithoutPages.id, {
      currentPercentage: 100,
    });
    
    // THEN: Still auto-completes
    expect(result.shouldShowCompletionModal).toBe(true);
  });

  test("should call SessionService.updateStatus with correct date", async () => {
    // GIVEN: Book with active "reading" session
    const progressDate = new Date("2025-12-20");
    
    // WHEN: Log 100% progress
    await progressService.logProgress(book.id, {
      currentPercentage: 100,
      progressDate,
    });
    
    // THEN: SessionService was called with progress date
    const session = await sessionRepository.findById(sessionId);
    expect(session?.status).toBe("read");
    expect(session?.completedDate).toEqual(progressDate);
  });
});
```

**Regression Tests:**
- Verify existing tests still pass (no breaking changes)
- Verify < 100% progress doesn't trigger completion
- Verify temporal validation still works

---

### 2. API Layer Tests

#### File: `__tests__/api/rating.test.ts`

**Current Status**: EXISTS but tests old POST endpoint  
**Needed**: Update to test new PATCH endpoint

**Tests to Add/Update:**

```typescript
describe("PATCH /api/books/[id]/rating", () => {
  describe("rating updates", () => {
    test("should update book rating", async () => {
      // GIVEN: Book exists
      const book = await bookRepository.create(mockBook1);
      
      // WHEN: PATCH /api/books/[id]/rating with rating=5
      const response = await PATCH(createMockRequest("PATCH", 
        `/api/books/${book.id}/rating`, { rating: 5 }
      ));
      
      // THEN: Rating updated
      expect(response.status).toBe(200);
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });

    test("should update both rating and review", async () => {
      const response = await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, 
        { rating: 4, review: "Great book!" }
      ));
      
      expect(response.status).toBe(200);
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(4);
      expect(updatedBook?.review).toBe("Great book!");
    });

    test("should set rating to null when rating=0", async () => {
      // GIVEN: Book with rating
      await bookRepository.update(book.id, { rating: 5 });
      
      // WHEN: PATCH with rating=0 (remove rating)
      await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { rating: 0 }
      ));
      
      // THEN: Rating is null
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBeNull();
    });

    test("should update review only and preserve rating", async () => {
      await bookRepository.update(book.id, { rating: 5 });
      
      await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { review: "Updated review" }
      ));
      
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5); // Preserved
      expect(updatedBook?.review).toBe("Updated review");
    });
  });

  describe("Calibre sync", () => {
    test("should sync rating to Calibre", async () => {
      await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { rating: 5 }
      ));
      
      expect(mockCalibreService.updateRating).toHaveBeenCalledWith(
        book.calibreId, 5
      );
    });

    test("should not sync when only updating review", async () => {
      await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { review: "Just a review" }
      ));
      
      expect(mockCalibreService.updateRating).not.toHaveBeenCalled();
    });

    test("should succeed even if Calibre sync fails", async () => {
      // GIVEN: Calibre service throws error
      mockCalibreService.updateRating.mockImplementationOnce(() => {
        throw new Error("Calibre sync failed");
      });
      
      // WHEN: Update rating
      const response = await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { rating: 5 }
      ));
      
      // THEN: Request succeeds (best effort)
      expect(response.status).toBe(200);
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });
  });

  describe("error handling", () => {
    test("should return 404 for non-existent book", async () => {
      const response = await PATCH(createMockRequest("PATCH",
        `/api/books/99999/rating`, { rating: 5 }
      ));
      
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ 
        error: "Book not found" 
      });
    });

    test("should return 400 for invalid book ID", async () => {
      const response = await PATCH(createMockRequest("PATCH",
        `/api/books/invalid/rating`, { rating: 5 }
      ));
      
      expect(response.status).toBe(400);
    });

    test("should handle empty request body gracefully", async () => {
      const response = await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, {}
      ));
      
      // Should succeed with no changes
      expect(response.status).toBe(200);
    });
  });
});
```

---

### 3. Integration Tests

#### File: `__tests__/integration/auto-completion.test.ts` (NEW FILE)

**Purpose**: Test end-to-end flows with real database

**Tests to Create:**

```typescript
describe("Auto-Completion Integration", () => {
  describe("full completion flow", () => {
    test("should auto-complete then add rating", async () => {
      // GIVEN: Book with active reading session
      const book = await bookRepository.create(mockBook1);
      const session = await sessionRepository.create({
        bookId: book.id,
        status: "reading",
      });
      
      // WHEN: Log 100% progress
      const progressResponse = await POST(createMockRequest("POST",
        `/api/books/${book.id}/progress`, { currentPercentage: 100 }
      ));
      expect(progressResponse.status).toBe(200);
      
      // THEN: Status is now "read"
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
      
      // AND WHEN: Update rating
      const ratingResponse = await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { rating: 5 }
      ));
      expect(ratingResponse.status).toBe(200);
      
      // THEN: Rating is saved
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(5);
    });

    test("should preserve backdated completion date", async () => {
      // GIVEN: Book with active reading session
      const book = await bookRepository.create(mockBook1);
      await sessionRepository.create({
        bookId: book.id,
        status: "reading",
      });
      
      // WHEN: Log 100% progress with Dec 15 date
      const backdatedDate = "2025-12-15";
      await POST(createMockRequest("POST",
        `/api/books/${book.id}/progress`, 
        { currentPercentage: 100, progressDate: backdatedDate }
      ));
      
      // THEN: completedDate is Dec 15, not today
      const sessions = await sessionRepository.findAllByBookId(book.id);
      const completedSession = sessions.find(s => s.status === "read");
      expect(new Date(completedSession!.completedDate!).toISOString())
        .toContain("2025-12-15");
    });
  });

  describe("manual mark as read", () => {
    test("should create 100% progress then auto-complete", async () => {
      // GIVEN: Book with NO progress logs
      const book = await bookRepository.create(mockBook1);
      await sessionRepository.create({
        bookId: book.id,
        status: "reading",
      });
      
      // WHEN: Mark as read via useBookStatus hook simulation
      // Step 1: Auto-create 100% progress
      const progressResponse = await POST(createMockRequest("POST",
        `/api/books/${book.id}/progress`, 
        { currentPage: book.totalPages, currentPercentage: 100 }
      ));
      expect(progressResponse.status).toBe(200);
      
      // Step 2: Update rating
      await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { rating: 4 }
      ));
      
      // THEN: Book is completed with rating
      const sessions = await sessionRepository.findAllByBookId(book.id);
      const session = sessions.find(s => s.status === "read");
      expect(session).toBeDefined();
      
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(4);
    });

    test("should skip progress creation if 100% already exists", async () => {
      // GIVEN: Book with existing 100% progress
      const book = await bookRepository.create(mockBook1);
      const session = await sessionRepository.create({
        bookId: book.id,
        status: "reading",
      });
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPercentage: 100,
        currentPage: book.totalPages!,
        pagesRead: book.totalPages!,
        progressDate: new Date(),
      });
      
      // WHEN: Mark as read (should detect existing 100% progress)
      // Only update rating, no progress creation
      await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { rating: 5 }
      ));
      
      // THEN: Only one 100% progress entry exists
      const progress = await progressRepository.findBySessionId(session.id);
      const hundredPercentLogs = progress.filter(p => p.currentPercentage >= 100);
      expect(hundredPercentLogs.length).toBe(1);
    });

    test("should handle books without totalPages", async () => {
      // GIVEN: Book with no totalPages
      const book = await bookRepository.create({
        ...mockBook1,
        totalPages: null,
      });
      await sessionRepository.create({
        bookId: book.id,
        status: "reading",
      });
      
      // WHEN: Mark as read (should skip progress creation)
      const statusResponse = await POST(createMockRequest("POST",
        `/api/books/${book.id}/status`, 
        { status: "read" }
      ));
      expect(statusResponse.status).toBe(200);
      
      // THEN: Status changed directly
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions[0].status).toBe("read");
    });
  });

  describe("edge cases", () => {
    test("should handle progress 50% then 100%", async () => {
      // GIVEN: Book with 50% progress
      const book = await bookRepository.create(mockBook1);
      const session = await sessionRepository.create({
        bookId: book.id,
        status: "reading",
      });
      await POST(createMockRequest("POST",
        `/api/books/${book.id}/progress`, { currentPercentage: 50 }
      ));
      
      // WHEN: Log 100% progress
      await POST(createMockRequest("POST",
        `/api/books/${book.id}/progress`, { currentPercentage: 100 }
      ));
      
      // THEN: Auto-completed on 100%
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession?.status).toBe("read");
    });

    test("should handle completion modal cancel then reopen", async () => {
      // GIVEN: Book just reached 100% but user canceled modal
      const book = await bookRepository.create(mockBook1);
      await sessionRepository.create({
        bookId: book.id,
        status: "reading",
      });
      await POST(createMockRequest("POST",
        `/api/books/${book.id}/progress`, { currentPercentage: 100 }
      ));
      
      // Status is already "read" from auto-completion
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions[0].status).toBe("read");
      
      // WHEN: User reopens book and adds rating later
      await PATCH(createMockRequest("PATCH",
        `/api/books/${book.id}/rating`, { rating: 4 }
      ));
      
      // THEN: Rating added successfully
      const updatedBook = await bookRepository.findById(book.id);
      expect(updatedBook?.rating).toBe(4);
    });

    test("should handle auto-completion failure gracefully", async () => {
      // This test would require mocking SessionService to throw an error
      // For now, document as TODO - requires dependency injection
      // TODO: Add test for auto-completion error handling
    });
  });
});
```

---

### 4. Hook Tests

#### File: `__tests__/hooks/useBookStatus.test.ts`

**Current Status**: EXISTS with 356 lines  
**Needed**: Update to test refactored `markAsReadMutation`

**Tests to Update/Add:**

```typescript
describe("handleConfirmRead", () => {
  test("should skip progress creation if 100% already exists", async () => {
    // GIVEN: Book with existing 100% progress
    const progressEntries = [
      { id: 1, currentPage: 300, currentPercentage: 100, ... }
    ];
    
    const { result } = renderHook(() =>
      useBookStatus(mockBook, progressEntries, "123")
    );
    
    // WHEN: Confirm read with rating
    await act(async () => {
      await result.current.handleConfirmRead(5, "Great!");
    });
    
    // THEN: Did NOT call /progress endpoint (already 100%)
    expect(global.fetch).toHaveBeenCalledTimes(1); // Only /rating
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/books/123/rating",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ rating: 5, review: "Great!" }),
      })
    );
  });

  test("should create 100% progress if none exists", async () => {
    // GIVEN: Book with NO 100% progress
    const progressEntries = [
      { id: 1, currentPage: 150, currentPercentage: 50, ... }
    ];
    
    const { result } = renderHook(() =>
      useBookStatus(mockBook, progressEntries, "123")
    );
    
    // WHEN: Confirm read
    await act(async () => {
      await result.current.handleConfirmRead(4);
    });
    
    // THEN: Called /progress to create 100%, then /rating
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/books/123/progress",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"currentPage":300'),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/books/123/rating",
      expect.anything()
    );
  });

  test("should handle book without totalPages", async () => {
    // GIVEN: Book with no totalPages
    const bookWithoutPages = { ...mockBook, totalPages: undefined };
    
    const { result } = renderHook(() =>
      useBookStatus(bookWithoutPages, [], "123")
    );
    
    // WHEN: Confirm read
    await act(async () => {
      await result.current.handleConfirmRead(5);
    });
    
    // THEN: Called /status directly (not /progress)
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/books/123/status",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ status: "read" }),
      })
    );
  });

  test("should update rating only via /rating endpoint", async () => {
    // GIVEN: Book with 100% progress
    const progressEntries = [
      { id: 1, currentPage: 300, currentPercentage: 100, ... }
    ];
    
    const { result } = renderHook(() =>
      useBookStatus(mockBook, progressEntries, "123")
    );
    
    // WHEN: Confirm read with rating only
    await act(async () => {
      await result.current.handleConfirmRead(5);
    });
    
    // THEN: Used /rating endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/books/123/rating",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ rating: 5 }),
      })
    );
  });

  test("should update review only via /rating endpoint", async () => {
    const progressEntries = [
      { id: 1, currentPage: 300, currentPercentage: 100, ... }
    ];
    
    const { result } = renderHook(() =>
      useBookStatus(mockBook, progressEntries, "123")
    );
    
    await act(async () => {
      await result.current.handleConfirmRead(0, "Great review!");
    });
    
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/books/123/rating",
      expect.objectContaining({
        body: JSON.stringify({ review: "Great review!" }),
      })
    );
  });

  test("should handle /rating API failure", async () => {
    global.fetch = mock(() => Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    }));
    
    const progressEntries = [
      { id: 1, currentPage: 300, currentPercentage: 100, ... }
    ];
    
    const { result } = renderHook(() =>
      useBookStatus(mockBook, progressEntries, "123")
    );
    
    await act(async () => {
      await result.current.handleConfirmRead(5);
    });
    
    // Should log error but not crash
    await waitFor(() => {
      expect(result.current.selectedStatus).toBe("read"); // Status still updated
    });
  });
});
```

---

### 5. Component Tests

#### File: `__tests__/components/LogProgressModal.test.tsx`

**Current Status**: May not exist  
**Needed**: Test updated `handleConfirmFinish`

**Tests to Create:**

```typescript
describe("LogProgressModal", () => {
  describe("handleConfirmFinish", () => {
    test("should call /rating endpoint with rating", async () => {
      // GIVEN: Modal is open after 100% progress
      const mockBook = {
        id: 123,
        title: "Test Book",
        totalPages: 300,
      };
      
      render(<LogProgressModal 
        isOpen={true} 
        onClose={mockOnClose}
        book={mockBook}
      />);
      
      // Show completion modal
      fireEvent.click(screen.getByText("Log Progress"));
      
      // WHEN: Confirm finish with rating
      fireEvent.change(screen.getByLabelText("Rating"), { target: { value: "5" } });
      fireEvent.click(screen.getByText("Finish Book"));
      
      // THEN: Called /rating endpoint
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/rating",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ rating: 5 }),
          })
        );
      });
    });

    test("should call /rating endpoint with review", async () => {
      render(<LogProgressModal {...props} />);
      
      // Trigger completion
      // ...
      
      fireEvent.change(screen.getByLabelText("Review"), { 
        target: { value: "Great book!" } 
      });
      fireEvent.click(screen.getByText("Finish Book"));
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/rating",
          expect.objectContaining({
            body: JSON.stringify({ review: "Great book!" }),
          })
        );
      });
    });

    test("should close modal without API call if no rating/review", async () => {
      render(<LogProgressModal {...props} />);
      
      // Trigger completion
      // ...
      
      // Click finish without rating/review
      fireEvent.click(screen.getByText("Finish Book"));
      
      // Should just close
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    test("should verify book is already 'read' when modal appears", async () => {
      // GIVEN: Book just reached 100% progress
      // Auto-completion already changed status to "read"
      
      render(<LogProgressModal {...props} />);
      
      // WHEN: Completion modal appears
      // THEN: Book status should already be "read"
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions[0].status).toBe("read");
    });

    test("should show error toast on API failure", async () => {
      global.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 500,
      }));
      
      render(<LogProgressModal {...props} />);
      
      // Trigger completion with rating
      // ...
      
      fireEvent.click(screen.getByText("Finish Book"));
      
      await waitFor(() => {
        expect(screen.getByText(/failed to update/i)).toBeInTheDocument();
        // Modal should NOT close
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });
  });
});
```

---

## Success Criteria

### ✅ All Tests Pass
- [ ] Service layer tests (progress.service.test.ts)
- [ ] API tests (rating.test.ts)  
- [ ] Integration tests (auto-completion.test.ts)
- [ ] Hook tests (useBookStatus.test.ts)
- [ ] Component tests (LogProgressModal.test.tsx)

### ✅ No Regressions
- [ ] Existing tests still pass
- [ ] < 100% progress doesn't trigger completion
- [ ] Temporal validation still works
- [ ] Manual status changes work

### ✅ Auto-Completion Works
- [ ] 100% progress auto-completes to "read"
- [ ] Backdated progress preserves correct date
- [ ] Works for books without totalPages
- [ ] Handles second 100% log gracefully

### ✅ Backdating Bug Fixed
- [ ] completedDate matches progress date
- [ ] Not set to "today" for historical entries
- [ ] Verified via integration tests

### ✅ Edge Cases Handled
- [ ] Books without totalPages
- [ ] Multiple 100% logs
- [ ] Completion modal cancel
- [ ] API failures

---

## Implementation Notes

### Test Execution Order
1. **Unit tests first**: Services, utilities
2. **Integration tests**: API endpoints with real DB
3. **Hook tests**: React hooks with mocked fetch
4. **Component tests**: UI with mocked dependencies

### Mock Strategy
- **CalibreService**: Mock at service boundary (not implementation)
- **SessionService**: Use real service with test database
- **ProgressService**: Use real service with test database
- **Next.js cache**: Mock `revalidatePath`
- **Streaks**: Mock streak calculations

### Database Setup
- Each test file: `setupTestDatabase(__filename)`
- Each test: `clearTestDatabase(__filename)` in `beforeEach`
- Clean up: `teardownTestDatabase(__filename)` in `afterAll`

### Testing Patterns
- **Arrange-Act-Assert**: Clear test structure
- **GIVEN-WHEN-THEN**: Readable test descriptions
- **Real database**: For service/API/integration tests
- **Mocked fetch**: For hook/component tests

---

## Related Documentation
- [TESTING_GUIDELINES.md](./TESTING_GUIDELINES.md) - General testing patterns
- [REPOSITORY_PATTERN_GUIDE.md](./REPOSITORY_PATTERN_GUIDE.md) - Data layer patterns
- [AI_CODING_PATTERNS.md](./AI_CODING_PATTERNS.md) - Development patterns

---

## Next Steps
1. Implement service layer tests (expand existing file)
2. Update API tests to test PATCH endpoint
3. Create integration test file
4. Update hook tests for refactored logic
5. Create component tests for LogProgressModal
6. Run full test suite and verify coverage
7. Document any edge cases discovered during testing
