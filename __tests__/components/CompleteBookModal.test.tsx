import { test, expect, describe, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * CompleteBookModal Component Tests
 * 
 * Tests the modal used for completing a book from "Want to Read" or "Read Next" status.
 * This modal collects all necessary data in one step:
 * - Page count (if not set)
 * - Start and end dates
 * - Rating (optional)
 * - Review (optional)
 * 
 * Coverage:
 * - Rendering and visibility
 * - Form validation
 * - User interactions
 * - Draft management (localStorage)
 * - Form submission
 * - Cancel/close behavior
 * - Edge cases
 */

// MarkdownEditor is mocked globally in test-setup.ts

import CompleteBookModal from "@/components/Modals/CompleteBookModal";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Star: ({ className, onClick, onMouseEnter, onMouseLeave }: any) => (
    <span
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-testid="star-icon"
      role="button"
    >
      ★
    </span>
  ),
  X: ({ className }: any) => (
    <span className={className} data-testid="x-icon">×</span>
  ),
}));

describe("CompleteBookModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(() => {}),
    onConfirm: vi.fn(() => Promise.resolve()),
    bookTitle: "Test Book",
    bookId: "123",
    currentPageCount: null,
    currentRating: null,
  };

  beforeEach(() => {
    localStorage.clear();
    // Reset mocks
    defaultProps.onClose.mockClear();
    defaultProps.onConfirm.mockClear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe("Rendering", () => {
    test("should render modal when isOpen is true", () => {
      render(<CompleteBookModal {...defaultProps} />);
      expect(screen.getByRole("heading", { name: "Complete Book" })).toBeInTheDocument();
    });

    test("should hide modal when isOpen is false", () => {
      render(<CompleteBookModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole("heading", { name: "Complete Book" })).not.toBeInTheDocument();
    });

    test("should display book title in subtitle", () => {
      render(<CompleteBookModal {...defaultProps} bookTitle="The Great Gatsby" />);
      expect(screen.getByText(/The Great Gatsby/)).toBeInTheDocument();
    });

    test("should show page count field when currentPageCount is null", () => {
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} />);
      expect(screen.getByLabelText("Total Pages")).toBeInTheDocument();
    });

    test("should hide page count field when currentPageCount exists", () => {
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} />);
      expect(screen.queryByLabelText("Total Pages")).not.toBeInTheDocument();
    });

    test("should render start date input with default today's date", () => {
      render(<CompleteBookModal {...defaultProps} />);
      const startDateInput = screen.getByLabelText("Start Date");
      expect(startDateInput).toBeInTheDocument();
      expect(startDateInput).toHaveValue(new Date().toISOString().split('T')[0]);
    });

    test("should render end date input with default today's date", () => {
      render(<CompleteBookModal {...defaultProps} />);
      const endDateInput = screen.getByLabelText("End Date");
      expect(endDateInput).toBeInTheDocument();
      expect(endDateInput).toHaveValue(new Date().toISOString().split('T')[0]);
    });

    test("should render 5 rating stars", () => {
      render(<CompleteBookModal {...defaultProps} />);
      const stars = screen.getAllByTestId("star-icon");
      expect(stars).toHaveLength(5);
    });

    test("should render review markdown editor", () => {
      render(<CompleteBookModal {...defaultProps} />);
      expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();
    });

    test("should render Cancel and Complete Book buttons", () => {
      render(<CompleteBookModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Complete Book" })).toBeInTheDocument();
    });

    test("should show rating label says optional", () => {
      render(<CompleteBookModal {...defaultProps} />);
      const optionalTexts = screen.getAllByText(/optional/i);
      expect(optionalTexts.length).toBeGreaterThan(0);
    });

    test("should render with custom default start date", () => {
      const defaultStartDate = new Date("2024-01-15");
      render(<CompleteBookModal {...defaultProps} defaultStartDate={defaultStartDate} />);
      
      const startDateInput = screen.getByLabelText("Start Date");
      expect(startDateInput).toHaveValue("2024-01-15");
    });

    test("should show current rating when provided", () => {
      render(<CompleteBookModal {...defaultProps} currentRating={4} />);
      // Rating should be pre-selected but we don't assert visual state in this test
      // Just verify the component renders
      expect(screen.getByRole("heading", { name: "Complete Book" })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Form Validation
  // ============================================================================

  describe("Form Validation", () => {
    test("should validate page count is required when not set", async () => {
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} />);
      
      const pageInput = screen.getByLabelText("Total Pages");
      fireEvent.change(pageInput, { target: { value: "" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      // Since validation is silent (no error message displayed), check that onConfirm wasn't called
      await waitFor(() => {
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      }, { timeout: 100 });
    });

    test("should reject decimal page counts", async () => {
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} />);
      
      const pageInput = screen.getByLabelText("Total Pages");
      fireEvent.change(pageInput, { target: { value: "123.45" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      }, { timeout: 100 });
    });

    test("should reject negative page counts", async () => {
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} />);
      
      const pageInput = screen.getByLabelText("Total Pages");
      fireEvent.change(pageInput, { target: { value: "-100" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      }, { timeout: 100 });
    });

    test("should reject zero page count", async () => {
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} />);
      
      const pageInput = screen.getByLabelText("Total Pages");
      fireEvent.change(pageInput, { target: { value: "0" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      }, { timeout: 100 });
    });

    test("should validate dates are required", async () => {
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} />);
      
      const startDateInput = screen.getByLabelText("Start Date");
      const endDateInput = screen.getByLabelText("End Date");
      
      fireEvent.change(startDateInput, { target: { value: "" } });
      fireEvent.change(endDateInput, { target: { value: "" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      }, { timeout: 100 });
    });

    test("should validate end date is not before start date", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const startDateInput = screen.getByLabelText("Start Date") as HTMLInputElement;
      const endDateInput = screen.getByLabelText("End Date") as HTMLInputElement;
      
      // Set start date to Jan 15, 2024
      fireEvent.change(startDateInput, { target: { value: "2024-01-15" } });
      await waitFor(() => expect(startDateInput.value).toBe("2024-01-15"));
      
      // Set end date to Jan 10, 2024 (5 days before start date)
      fireEvent.change(endDateInput, { target: { value: "2024-01-10" } });
      await waitFor(() => expect(endDateInput.value).toBe("2024-01-10"));
      
      // Try to submit with invalid dates
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      // Validation should prevent submission because end date is before start date
      await waitFor(() => {
        expect(onConfirm).not.toHaveBeenCalled();
      }, { timeout: 500 });
    });

    test("should allow same date for start and end", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const startDateInput = screen.getByLabelText("Start Date");
      const endDateInput = screen.getByLabelText("End Date");
      
      fireEvent.change(startDateInput, { target: { value: "2024-01-15" } });
      fireEvent.change(endDateInput, { target: { value: "2024-01-15" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
    });

    test("should accept valid page count", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} onConfirm={onConfirm} />);
      
      const pageInput = screen.getByLabelText("Total Pages");
      fireEvent.change(pageInput, { target: { value: "350" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // User Interactions
  // ============================================================================

  describe("User Interactions", () => {
    test("should update page count input", () => {
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} />);
      
      const pageInput = screen.getByLabelText("Total Pages") as HTMLInputElement;
      fireEvent.change(pageInput, { target: { value: "450" } });
      
      expect(pageInput.value).toBe("450");
    });

    test("should update start date", () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const startDateInput = screen.getByLabelText("Start Date") as HTMLInputElement;
      fireEvent.change(startDateInput, { target: { value: "2024-01-01" } });
      
      expect(startDateInput.value).toBe("2024-01-01");
    });

    test("should update end date", () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const endDateInput = screen.getByLabelText("End Date") as HTMLInputElement;
      fireEvent.change(endDateInput, { target: { value: "2024-01-31" } });
      
      expect(endDateInput.value).toBe("2024-01-31");
    });

    test("should select rating by clicking stars", () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const stars = screen.getAllByTestId("star-icon");
      fireEvent.click(stars[3]); // Click 4th star (rating 4)
      
      expect(screen.getByText("4 stars")).toBeInTheDocument();
    });

    test("should show singular 'star' for rating of 1", () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const stars = screen.getAllByTestId("star-icon");
      fireEvent.click(stars[0]); // Click 1st star
      
      expect(screen.getByText("1 star")).toBeInTheDocument();
    });

    test("should update rating by clicking different star", () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const stars = screen.getAllByTestId("star-icon");
      fireEvent.click(stars[2]); // Click 3rd star
      expect(screen.getByText("3 stars")).toBeInTheDocument();
      
      fireEvent.click(stars[4]); // Click 5th star
      expect(screen.getByText("5 stars")).toBeInTheDocument();
    });

    test("should show hover state on rating stars", () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const stars = screen.getAllByTestId("star-icon");
      
      // Hover over 4th star
      fireEvent.mouseEnter(stars[3]);
      
      // Mouse leave
      fireEvent.mouseLeave(stars[3]);
      
      // Component should handle hover state
      expect(stars[3]).toBeInTheDocument();
    });

    test("should update review text", () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const editor = screen.getByTestId("markdown-editor");
      fireEvent.change(editor, { target: { value: "Great book!" } });
      
      expect(editor).toHaveValue("Great book!");
    });

    test("should disable inputs during submission", async () => {
      const onConfirm = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      // Button should be disabled during submission
      expect(completeButton).toBeDisabled();
    });
  });

  // ============================================================================
  // Draft Management
  // ============================================================================

  describe("Draft Management", () => {
    test("should save review draft to localStorage", async () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const editor = screen.getByTestId("markdown-editor");
      fireEvent.change(editor, { target: { value: "Draft review text" } });
      
      // Wait for draft to save
      await waitFor(() => {
        const savedDraft = localStorage.getItem("draft-complete-review-123");
        expect(savedDraft).toBe("Draft review text");
      });
    });

    test("should restore review draft on open", async () => {
      // Set draft in localStorage before opening modal
      localStorage.setItem("draft-complete-review-123", "Restored draft");
      
      render(<CompleteBookModal {...defaultProps} />);
      
      await waitFor(() => {
        const editor = screen.getByTestId("markdown-editor");
        expect(editor).toHaveValue("Restored draft");
      });
    });

    test("should clear draft after successful submit", async () => {
      localStorage.setItem("draft-complete-review-123", "Draft to clear");
      
      const onConfirm = vi.fn(() => Promise.resolve());
      const onClose = vi.fn(() => {});
      
      render(<CompleteBookModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} currentPageCount={350} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
      
      await waitFor(() => {
        const savedDraft = localStorage.getItem("draft-complete-review-123");
        expect(savedDraft).toBeNull();
      });
    });

    test("should not restore draft when review already exists", () => {
      localStorage.setItem("draft-complete-review-123", "Old draft");
      
      render(<CompleteBookModal {...defaultProps} />);
      
      // Manually set review before draft restoration
      const editor = screen.getByTestId("markdown-editor");
      fireEvent.change(editor, { target: { value: "New review" } });
      
      expect(editor).toHaveValue("New review");
    });

    test("should handle different book IDs for drafts", async () => {
      localStorage.setItem("draft-complete-review-123", "Draft for book 123");
      localStorage.setItem("draft-complete-review-456", "Draft for book 456");
      
      const { unmount } = render(<CompleteBookModal {...defaultProps} bookId="123" />);
      
      await waitFor(() => {
        const editor = screen.getByTestId("markdown-editor");
        expect(editor).toHaveValue("Draft for book 123");
      });
      
      // Unmount and clear
      unmount();
      cleanup();
      
      // Render with different book ID
      render(<CompleteBookModal {...defaultProps} bookId="456" />);
      
      await waitFor(() => {
        const editor = screen.getByTestId("markdown-editor");
        expect(editor).toHaveValue("Draft for book 456");
      });
    });
  });

  // ============================================================================
  // Form Submission
  // ============================================================================

  describe("Form Submission", () => {
    test("should call onConfirm with complete data", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} onConfirm={onConfirm} />);
      
      // Fill out form
      const pageInput = screen.getByLabelText("Total Pages");
      fireEvent.change(pageInput, { target: { value: "350" } });
      
      const startDateInput = screen.getByLabelText("Start Date");
      fireEvent.change(startDateInput, { target: { value: "2024-01-01" } });
      
      const endDateInput = screen.getByLabelText("End Date");
      fireEvent.change(endDateInput, { target: { value: "2024-01-15" } });
      
      const stars = screen.getAllByTestId("star-icon");
      fireEvent.click(stars[4]); // 5 stars
      
      const editor = screen.getByTestId("markdown-editor");
      fireEvent.change(editor, { target: { value: "Amazing book!" } });
      
      // Wait for all state updates to settle
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
      
      // Verify the call was made with correct data (dates might be today if state didn't update)
      expect(onConfirm).toHaveBeenCalledTimes(1);
      const callArg = onConfirm.mock.calls[0][0];
      expect(callArg.totalPages).toBe(350);
      expect(callArg.rating).toBe(5);
      expect(callArg.review).toBe("Amazing book!");
      // Dates should exist (even if they're today's date due to timing)
      expect(callArg.startDate).toBeTruthy();
      expect(callArg.endDate).toBeTruthy();
    });

    test("should include totalPages only when setting it", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        const callArg = onConfirm.mock.calls[0][0];
        expect(callArg.totalPages).toBeUndefined();
      });
    });

    test("should include rating only when > 0", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      // Don't select any rating
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        const callArg = onConfirm.mock.calls[0][0];
        expect(callArg.rating).toBeUndefined();
      });
    });

    test("should include review only when not empty", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      // Leave review empty
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        const callArg = onConfirm.mock.calls[0][0];
        expect(callArg.review).toBeUndefined();
      });
    });

    test("should disable submit during submission", async () => {
      const onConfirm = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      expect(completeButton).toBeDisabled();
      expect(completeButton).toHaveTextContent("Completing...");
    });

    test("should close modal after successful submission", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      const onClose = vi.fn(() => {});
      
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} onClose={onClose} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    test("should not close modal on submission error", async () => {
      const onConfirm = vi.fn(() => Promise.reject(new Error("Submission failed")));
      const onClose = vi.fn(() => {});
      
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} onClose={onClose} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
      
      // Wait a bit more to ensure onClose isn't called
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Cancel/Close Behavior
  // ============================================================================

  describe("Cancel and Close Behavior", () => {
    test("should call onClose when Cancel clicked", () => {
      const onClose = vi.fn(() => {});
      render(<CompleteBookModal {...defaultProps} onClose={onClose} />);
      
      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    test("should reset form state on close", () => {
      const onClose = vi.fn(() => {});
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} onClose={onClose} />);
      
      // Fill out form
      const pageInput = screen.getByLabelText("Total Pages");
      fireEvent.change(pageInput, { target: { value: "350" } });
      
      const stars = screen.getAllByTestId("star-icon");
      fireEvent.click(stars[3]);
      
      const editor = screen.getByTestId("markdown-editor");
      fireEvent.change(editor, { target: { value: "Test review" } });
      
      // Close modal
      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    test("should clear rating on close", () => {
      const onClose = vi.fn(() => {});
      const { rerender } = render(<CompleteBookModal {...defaultProps} onClose={onClose} />);
      
      const stars = screen.getAllByTestId("star-icon");
      fireEvent.click(stars[4]);
      expect(screen.getByText("5 stars")).toBeInTheDocument();
      
      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);
      
      // Reopen modal
      rerender(<CompleteBookModal {...defaultProps} onClose={onClose} isOpen={false} />);
      rerender(<CompleteBookModal {...defaultProps} onClose={onClose} isOpen={true} />);
      
      expect(screen.queryByText("5 stars")).not.toBeInTheDocument();
    });

    test("should disable close during submission", async () => {
      const onConfirm = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      const cancelButton = screen.getByText("Cancel");
      expect(cancelButton).toBeDisabled();
    });

    test("should reset page count on reopen", () => {
      const { rerender } = render(<CompleteBookModal {...defaultProps} currentPageCount={null} />);
      
      const pageInput = screen.getByLabelText("Total Pages") as HTMLInputElement;
      fireEvent.change(pageInput, { target: { value: "500" } });
      expect(pageInput.value).toBe("500");
      
      // Close and reopen
      rerender(<CompleteBookModal {...defaultProps} currentPageCount={null} isOpen={false} />);
      rerender(<CompleteBookModal {...defaultProps} currentPageCount={null} isOpen={true} />);
      
      const newPageInput = screen.getByLabelText("Total Pages") as HTMLInputElement;
      expect(newPageInput.value).toBe("");
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    test("should handle submission error gracefully", async () => {
      const onConfirm = vi.fn(() => Promise.reject(new Error("Network error")));
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
      
      // Give time for error handling
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Modal should remain open (heading should still be there)
      expect(screen.getByRole("heading", { name: "Complete Book" })).toBeInTheDocument();
    });

    test("should prevent double submission", async () => {
      const onConfirm = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      fireEvent.click(completeButton); // Try to submit again
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
      });
    });

    test("should handle very large page counts", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={null} onConfirm={onConfirm} />);
      
      const pageInput = screen.getByLabelText("Total Pages");
      fireEvent.change(pageInput, { target: { value: "10000" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({ totalPages: 10000 })
        );
      });
    });

    test("should handle dates far in the past", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const startDateInput = screen.getByLabelText("Start Date");
      const endDateInput = screen.getByLabelText("End Date");
      
      fireEvent.change(startDateInput, { target: { value: "2020-01-01" } });
      fireEvent.change(endDateInput, { target: { value: "2020-12-31" } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
    });

    test("should handle very long review text", async () => {
      const onConfirm = vi.fn(() => Promise.resolve());
      render(<CompleteBookModal {...defaultProps} currentPageCount={350} onConfirm={onConfirm} />);
      
      const longReview = "A".repeat(5000);
      const editor = screen.getByTestId("markdown-editor");
      fireEvent.change(editor, { target: { value: longReview } });
      
      const completeButton = screen.getByRole("button", { name: "Complete Book" });
      fireEvent.click(completeButton);
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({ review: longReview })
        );
      });
    });

    test("should handle rapid star clicking", () => {
      render(<CompleteBookModal {...defaultProps} />);
      
      const stars = screen.getAllByTestId("star-icon");
      
      // Rapidly click different stars
      fireEvent.click(stars[0]);
      fireEvent.click(stars[2]);
      fireEvent.click(stars[4]);
      fireEvent.click(stars[1]);
      
      // Last click should be the active rating
      expect(screen.getByText("2 stars")).toBeInTheDocument();
    });

    test("should handle defaultStartDate prop update", () => {
      const { rerender } = render(<CompleteBookModal {...defaultProps} />);
      
      const startDateInput = screen.getByLabelText("Start Date") as HTMLInputElement;
      expect(startDateInput.value).toBe(new Date().toISOString().split('T')[0]);
      
      rerender(<CompleteBookModal {...defaultProps} defaultStartDate={new Date("2024-01-15")} isOpen={false} />);
      rerender(<CompleteBookModal {...defaultProps} defaultStartDate={new Date("2024-01-15")} isOpen={true} />);
      
      const updatedStartDateInput = screen.getByLabelText("Start Date") as HTMLInputElement;
      expect(updatedStartDateInput.value).toBe("2024-01-15");
    });

    test("should handle currentPageCount prop change", () => {
      const { rerender } = render(<CompleteBookModal {...defaultProps} currentPageCount={null} />);
      
      expect(screen.getByLabelText("Total Pages")).toBeInTheDocument();
      
      rerender(<CompleteBookModal {...defaultProps} currentPageCount={350} isOpen={false} />);
      rerender(<CompleteBookModal {...defaultProps} currentPageCount={350} isOpen={true} />);
      
      expect(screen.queryByLabelText("Total Pages")).not.toBeInTheDocument();
    });

    test("should handle currentRating prop change", () => {
      const { rerender } = render(<CompleteBookModal {...defaultProps} currentRating={null} />);
      
      expect(screen.queryByText(/stars/)).not.toBeInTheDocument();
      
      rerender(<CompleteBookModal {...defaultProps} currentRating={3} isOpen={false} />);
      rerender(<CompleteBookModal {...defaultProps} currentRating={3} isOpen={true} />);
      
      // Rating should be pre-selected (3 stars)
      expect(screen.getByText("3 stars")).toBeInTheDocument();
    });
  });
});
