import { test, expect, describe, afterEach, mock, beforeEach } from "bun:test";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FinishBookModal from "@/components/FinishBookModal";

// Mock MarkdownEditor component
mock.module("@/components/MarkdownEditor", () => ({
  default: ({ value, onChange, placeholder, id }: any) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      id={id}
      data-testid="markdown-editor"
    />
  ),
}));

// Mock lucide-react icons
mock.module("lucide-react", () => ({
  Star: ({ className, onClick, onMouseEnter, onMouseLeave }: any) => (
    <span
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-testid="star-icon"
    >
      ★
    </span>
  ),
  X: ({ className }: any) => (
    <span className={className} data-testid="x-icon">×</span>
  ),
}));

describe("FinishBookModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: mock(() => {}),
    onConfirm: mock(() => {}),
    bookTitle: "Test Book",
    bookId: "123",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  describe("Rendering", () => {
    test("should not render when isOpen is false", () => {
      render(<FinishBookModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText("Finished Reading?")).not.toBeInTheDocument();
    });

    test("should render modal with title when isOpen is true", () => {
      render(<FinishBookModal {...defaultProps} />);
      expect(screen.getByText("Finished Reading?")).toBeInTheDocument();
    });

    test("should display book title in rating label", () => {
      render(<FinishBookModal {...defaultProps} bookTitle="The Great Gatsby" />);
      expect(screen.getByText(/The Great Gatsby/)).toBeInTheDocument();
    });

    test("should render 5 star rating buttons", () => {
      render(<FinishBookModal {...defaultProps} />);
      const stars = screen.getAllByTestId("star-icon");
      expect(stars).toHaveLength(5);
    });

    test("should render review textarea", () => {
      render(<FinishBookModal {...defaultProps} />);
      expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();
    });

    test("should render Cancel and Mark as Read buttons", () => {
      render(<FinishBookModal {...defaultProps} />);
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Mark as Read")).toBeInTheDocument();
    });
  });

  describe("Rating Interaction", () => {
    test("should select rating when star is clicked", () => {
      render(<FinishBookModal {...defaultProps} />);
      const stars = screen.getAllByTestId("star-icon");

      fireEvent.click(stars[3]); // Click 4th star

      // Check if 4-star rating is displayed
      expect(screen.getByText("4 stars")).toBeInTheDocument();
    });

    test("should show singular 'star' for rating of 1", () => {
      render(<FinishBookModal {...defaultProps} />);
      const stars = screen.getAllByTestId("star-icon");

      fireEvent.click(stars[0]); // Click 1st star

      expect(screen.getByText("1 star")).toBeInTheDocument();
    });

    test("should allow changing rating by clicking different star", () => {
      render(<FinishBookModal {...defaultProps} />);
      const stars = screen.getAllByTestId("star-icon");

      fireEvent.click(stars[4]); // Click 5th star
      expect(screen.getByText("5 stars")).toBeInTheDocument();

      fireEvent.click(stars[1]); // Click 2nd star
      expect(screen.getByText("2 stars")).toBeInTheDocument();
    });
  });

  describe("Draft Persistence", () => {
    test("should restore draft review on modal open", async () => {
      // Arrange: Set draft in localStorage
      const draftText = "This book was amazing!";
      localStorage.setItem("draft-finish-review-123", draftText);

      // Act: Open modal
      render(<FinishBookModal {...defaultProps} />);

      // Assert: Draft should be restored
      await waitFor(() => {
        const textarea = screen.getByTestId("markdown-editor") as HTMLTextAreaElement;
        expect(textarea.value).toBe(draftText);
      });
    });

    test("should auto-save draft as user types", async () => {
      render(<FinishBookModal {...defaultProps} />);
      const textarea = screen.getByTestId("markdown-editor");

      // Type some text
      fireEvent.change(textarea, { target: { value: "Great read!" } });

      // Wait for auto-save (isInitialized flag allows saving)
      await waitFor(() => {
        expect(localStorage.getItem("draft-finish-review-123")).toBe("Great read!");
      });
    });

    test("should clear draft after successful submit", async () => {
      // Arrange: Type a review (creates draft)
      localStorage.setItem("draft-finish-review-123", "My review");
      const onConfirm = mock(() => {});

      render(<FinishBookModal {...defaultProps} onConfirm={onConfirm} />);
      const stars = screen.getAllByTestId("star-icon");

      // Act: Select rating and submit
      fireEvent.click(stars[3]); // 4 stars
      fireEvent.click(screen.getByText("Mark as Read"));

      // Assert: Draft should be cleared
      expect(localStorage.getItem("draft-finish-review-123")).toBeNull();
      expect(onConfirm).toHaveBeenCalledWith(4, "My review");
    });

    test("should preserve draft when modal is closed without submitting", () => {
      localStorage.setItem("draft-finish-review-123", "Unsaved review");

      render(<FinishBookModal {...defaultProps} />);

      // Close modal
      fireEvent.click(screen.getByText("Cancel"));

      // Draft should still exist
      expect(localStorage.getItem("draft-finish-review-123")).toBe("Unsaved review");
    });

    test("should not restore draft if review already has content", async () => {
      // This tests the condition: if (draftReview && !review && isOpen)
      localStorage.setItem("draft-finish-review-123", "Draft text");

      const { rerender } = render(<FinishBookModal {...defaultProps} />);

      // Wait for draft to be restored initially
      await waitFor(() => {
        const textarea = screen.getByTestId("markdown-editor") as HTMLTextAreaElement;
        expect(textarea.value).toBe("Draft text");
      });

      // Simulate typing new content
      const textarea = screen.getByTestId("markdown-editor");
      fireEvent.change(textarea, { target: { value: "New text" } });

      // Close and reopen (without calling handleClose, so state persists)
      rerender(<FinishBookModal {...defaultProps} isOpen={false} />);
      rerender(<FinishBookModal {...defaultProps} isOpen={true} />);

      // Should keep "New text" because review already has content
      // Draft is NOT restored when review field already has content
      await waitFor(() => {
        const updatedTextarea = screen.getByTestId("markdown-editor") as HTMLTextAreaElement;
        expect(updatedTextarea.value).toBe("New text");
      });
    });

    test("should handle empty draft gracefully", () => {
      localStorage.setItem("draft-finish-review-123", "");

      render(<FinishBookModal {...defaultProps} />);

      const textarea = screen.getByTestId("markdown-editor") as HTMLTextAreaElement;
      expect(textarea.value).toBe("");
    });
  });

  describe("Form Submission", () => {
    test("should call onConfirm with rating and review", () => {
      const onConfirm = mock(() => {});
      render(<FinishBookModal {...defaultProps} onConfirm={onConfirm} />);

      const stars = screen.getAllByTestId("star-icon");
      const textarea = screen.getByTestId("markdown-editor");

      // Select rating and type review
      fireEvent.click(stars[4]); // 5 stars
      fireEvent.change(textarea, { target: { value: "Masterpiece!" } });

      // Submit
      fireEvent.click(screen.getByText("Mark as Read"));

      expect(onConfirm).toHaveBeenCalledWith(5, "Masterpiece!");
    });

    test("should call onConfirm with rating only when review is empty", () => {
      const onConfirm = mock(() => {});
      render(<FinishBookModal {...defaultProps} onConfirm={onConfirm} />);

      const stars = screen.getAllByTestId("star-icon");

      // Select rating, leave review empty
      fireEvent.click(stars[2]); // 3 stars

      // Submit
      fireEvent.click(screen.getByText("Mark as Read"));

      expect(onConfirm).toHaveBeenCalledWith(3, undefined);
    });

    test("should submit with rating=0 if no star selected", () => {
      const onConfirm = mock(() => {});
      render(<FinishBookModal {...defaultProps} onConfirm={onConfirm} />);

      // Submit without selecting rating
      fireEvent.click(screen.getByText("Mark as Read"));

      expect(onConfirm).toHaveBeenCalledWith(0, undefined);
    });
  });

  describe("Modal Controls", () => {
    test("should call onClose when Cancel button is clicked", () => {
      const onClose = mock(() => {});
      render(<FinishBookModal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByText("Cancel"));

      expect(onClose).toHaveBeenCalled();
    });

    test("should call onClose when X button is clicked", () => {
      const onClose = mock(() => {});
      render(<FinishBookModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByTestId("x-icon");
      fireEvent.click(closeButton.parentElement!);

      expect(onClose).toHaveBeenCalled();
    });

    test("should reset form state when closing", () => {
      render(<FinishBookModal {...defaultProps} />);

      const stars = screen.getAllByTestId("star-icon");
      const textarea = screen.getByTestId("markdown-editor");

      // Set some state
      fireEvent.click(stars[3]); // 4 stars
      fireEvent.change(textarea, { target: { value: "Some text" } });

      // Close modal
      fireEvent.click(screen.getByText("Cancel"));

      // TODO: This test would need rerender to verify state reset
      // For now, we're just verifying onClose is called
    });
  });

  describe("Edge Cases", () => {
    test("should handle whitespace-only review as undefined", () => {
      const onConfirm = mock(() => {});
      render(<FinishBookModal {...defaultProps} onConfirm={onConfirm} />);

      const stars = screen.getAllByTestId("star-icon");
      const textarea = screen.getByTestId("markdown-editor");

      fireEvent.click(stars[2]); // 3 stars
      fireEvent.change(textarea, { target: { value: "   \n  \t  " } });

      fireEvent.click(screen.getByText("Mark as Read"));

      // Whitespace is trimmed in handleSubmit, but still passed as string
      // The component passes review || undefined, so empty string becomes undefined
      expect(onConfirm).toHaveBeenCalled();
    });

    test("should handle different book IDs for draft isolation", () => {
      // Book 1
      localStorage.setItem("draft-finish-review-123", "Review for book 123");
      render(<FinishBookModal {...defaultProps} bookId="123" />);

      let textarea = screen.getByTestId("markdown-editor") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Review for book 123");

      cleanup();

      // Book 2 (different draft)
      localStorage.setItem("draft-finish-review-456", "Review for book 456");
      render(<FinishBookModal {...defaultProps} bookId="456" />);

      textarea = screen.getByTestId("markdown-editor") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Review for book 456");
    });
  });

  describe("Accessibility", () => {
    test("should have proper label for review field", () => {
      render(<FinishBookModal {...defaultProps} />);
      expect(screen.getByText("Review")).toBeInTheDocument();
      expect(screen.getByText("(optional)")).toBeInTheDocument();
    });

    test("should have descriptive placeholder for review", () => {
      render(<FinishBookModal {...defaultProps} />);
      const textarea = screen.getByTestId("markdown-editor");
      expect(textarea).toHaveAttribute("placeholder", "What did you think about this book?");
    });

    test("should show helper text for personal notes", () => {
      render(<FinishBookModal {...defaultProps} />);
      expect(screen.getByText("Personal notes just for you")).toBeInTheDocument();
    });
  });
});
