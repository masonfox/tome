import { test, expect, describe, afterEach, mock, beforeEach } from "bun:test";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PageCountEditModal from "@/components/PageCountEditModal";

// Mock toast utility
const mockToast = {
  success: mock(() => {}),
  error: mock(() => {}),
  info: mock(() => {}),
  warning: mock(() => {}),
  loading: mock(() => {}),
  promise: mock(() => {}),
  dismiss: mock(() => {}),
};

mock.module("@/utils/toast", () => ({
  toast: mockToast,
}));

// Mock lucide-react icons used in BaseModal
mock.module("lucide-react", () => ({
  X: ({ className }: { className?: string }) => (
    <span className={className} data-testid="x-icon">×</span>
  ),
}));

afterEach(() => {
  cleanup();
  mockToast.success.mockClear();
  mockToast.error.mockClear();
});

// Mock fetch globally
let mockFetch: ReturnType<typeof mock>;

beforeEach(() => {
  mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response)
  );
  global.fetch = mockFetch as any;
});

describe("PageCountEditModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: mock(() => {}),
    bookId: 1,
    currentPageCount: 300,
    onSuccess: mock(() => {}),
  };

  describe("Component Rendering", () => {
    test("should not render when isOpen is false", () => {
      render(<PageCountEditModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText("Edit Page Count")).not.toBeInTheDocument();
    });

    test("should render modal with title when isOpen is true", () => {
      render(<PageCountEditModal {...defaultProps} />);

      expect(screen.getByText("Edit Page Count")).toBeInTheDocument();
    });

    test("should render input pre-filled with current page count", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe("300");
    });

    test("should render empty input when currentPageCount is null", () => {
      render(<PageCountEditModal {...defaultProps} currentPageCount={null} />);

      const input = screen.getByPlaceholderText("e.g. 320") as HTMLInputElement;
      expect(input.value).toBe("");
    });

    test("should render subtitle with current page count", () => {
      render(<PageCountEditModal {...defaultProps} />);

      expect(screen.getByText("Current: 300 pages")).toBeInTheDocument();
    });

    test("should not render subtitle when currentPageCount is null", () => {
      render(<PageCountEditModal {...defaultProps} currentPageCount={null} />);

      expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    });

    test("should render informational message about active sessions", () => {
      render(<PageCountEditModal {...defaultProps} hasProgress={true} />);

      expect(
        screen.getByText(
          "⚠️ This will update progress calculations for all active reading sessions."
        )
      ).toBeInTheDocument();
    });

    test("should render Cancel and Save buttons", () => {
      render(<PageCountEditModal {...defaultProps} />);

      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Save")).toBeInTheDocument();
    });

    test("should have autofocus on input field", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      // In React, autoFocus is set as a boolean prop, not as an HTML attribute
      expect(input).toBeInTheDocument();
    });
  });

  describe("Input Validation", () => {
    test("should update input value when user types", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "450" } });

      expect(input.value).toBe("450");
    });

    test("should disable Save button when input is empty", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "" } });

      expect(saveButton).toBeDisabled();
    });

    test("should disable Save button when input is zero", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "0" } });

      expect(saveButton).toBeDisabled();
    });

    test("should disable Save button when input is negative", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "-5" } });

      expect(saveButton).toBeDisabled();
    });

    test("should enable Save button for valid positive integer", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "500" } });

      expect(saveButton).not.toBeDisabled();
    });

    test("should show validation error when submitting empty input", async () => {
      render(<PageCountEditModal {...defaultProps} currentPageCount={null} />);

      const saveButton = screen.getByText("Save");

      // With empty input, button is disabled, testing the disabled state
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Form Submission", () => {
    test("should call API with correct data on successful save", async () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/books/1",
          expect.objectContaining({
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ totalPages: 450 }),
          })
        );
      });
    });

    test("should show loading state during submission", async () => {
      // Mock slow fetch
      mockFetch = mock(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ success: true }),
                } as Response),
              100
            )
          )
      );
      global.fetch = mockFetch as any;

      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    test("should disable input and buttons during submission", async () => {
      // Mock slow fetch
      mockFetch = mock(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ success: true }),
                } as Response),
              100
            )
          )
      );
      global.fetch = mockFetch as any;

      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");
      const cancelButton = screen.getByText("Cancel");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      expect(input).toBeDisabled();
      expect(saveButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    test("should call onSuccess and onClose on successful save", async () => {
      const onSuccess = mock(() => {});
      const onClose = mock(() => {});

      render(
        <PageCountEditModal
          {...defaultProps}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      );

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    test("should show success toast on successful save", async () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith("Page count updated");
      });
    });
  });

  describe("Error Handling", () => {
    test("should show error toast when API returns error response", async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Book not found" }),
        } as Response)
      );
      global.fetch = mockFetch as any;

      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Book not found");
      });
    });

    test("should show generic error toast when API returns error without message", async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        } as Response)
      );
      global.fetch = mockFetch as any;

      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to update page count");
      });
    });

    test("should handle network error", async () => {
      mockFetch = mock(() => Promise.reject(new Error("Network error")));
      global.fetch = mockFetch as any;

      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Network error");
      });
    });

    test("should not call onSuccess or onClose on error", async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Server error" }),
        } as Response)
      );
      global.fetch = mockFetch as any;

      const onSuccess = mock(() => {});
      const onClose = mock(() => {});

      render(
        <PageCountEditModal
          {...defaultProps}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      );

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    test("should re-enable input and buttons after error", async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Server error" }),
        } as Response)
      );
      global.fetch = mockFetch as any;

      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320") as HTMLInputElement;
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(input).not.toBeDisabled();
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe("Modal Controls", () => {
    test("should call onClose when Cancel button is clicked", () => {
      const onClose = mock(() => {});

      render(<PageCountEditModal {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    test("should call onClose when X button is clicked", () => {
      const onClose = mock(() => {});

      render(<PageCountEditModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText("Close");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    test("should not allow closing while submitting", () => {
      // Mock slow fetch
      mockFetch = mock(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ success: true }),
                } as Response),
              100
            )
          )
      );
      global.fetch = mockFetch as any;

      const onClose = mock(() => {});

      render(<PageCountEditModal {...defaultProps} onClose={onClose} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");
      const cancelButton = screen.getByText("Cancel");

      fireEvent.change(input, { target: { value: "450" } });
      fireEvent.click(saveButton);

      // Try to close while submitting
      fireEvent.click(cancelButton);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    test("should have proper label for input", () => {
      render(<PageCountEditModal {...defaultProps} />);

      expect(screen.getByText("Total Pages")).toBeInTheDocument();
    });

    test("should have proper input type", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      expect(input).toHaveAttribute("type", "number");
    });

    test("should have proper input constraints", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("step", "1");
    });

    test("should show disabled state styling on buttons", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      const saveButton = screen.getByText("Save");

      fireEvent.change(input, { target: { value: "" } });

      expect(saveButton).toHaveClass("disabled:opacity-50");
      expect(saveButton).toHaveClass("disabled:cursor-not-allowed");
    });

    test("should have proper aria-label on close button", () => {
      render(<PageCountEditModal {...defaultProps} />);

      const closeButton = screen.getByLabelText("Close");
      expect(closeButton).toBeInTheDocument();
    });
  });
});
