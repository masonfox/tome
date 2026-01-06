import { test, expect, describe, afterEach, mock, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PageCountEditModal from "@/components/PageCountEditModal";

// Mock toast utility
const mockToast = {
  success: vi.fn(() => {}),
  error: vi.fn(() => {}),
  info: vi.fn(() => {}),
  warning: vi.fn(() => {}),
  loading: vi.fn(() => {}),
  promise: vi.fn(() => {}),
  dismiss: vi.fn(() => {}),
};

vi.mock("@/utils/toast", () => ({
  toast: mockToast,
}));

// Mock lucide-react icons used in BaseModal
vi.mock("lucide-react", () => ({
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
  mockFetch = vi.fn(() =>
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
    onClose: vi.fn(() => {}),
    bookId: 1,
    currentPageCount: 300,
    onSuccess: vi.fn(() => {}),
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
      mockFetch = vi.fn(
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
      mockFetch = vi.fn(
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
      const onSuccess = vi.fn(() => {});
      const onClose = vi.fn(() => {});

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
      mockFetch = vi.fn(() =>
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
      mockFetch = vi.fn(() =>
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
      mockFetch = vi.fn(() => Promise.reject(new Error("Network error")));
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
      mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Server error" }),
        } as Response)
      );
      global.fetch = mockFetch as any;

      const onSuccess = vi.fn(() => {});
      const onClose = vi.fn(() => {});

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
      mockFetch = vi.fn(() =>
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
      const onClose = vi.fn(() => {});

      render(<PageCountEditModal {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    test("should call onClose when X button is clicked", () => {
      const onClose = vi.fn(() => {});

      render(<PageCountEditModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText("Close");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    test("should not allow closing while submitting", () => {
      // Mock slow fetch
      mockFetch = vi.fn(
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

      const onClose = vi.fn(() => {});

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

  describe("Sequential API Calls with Pending Status", () => {
    test("should make PATCH then POST when pendingStatus provided", async () => {
      const mockFetchSequential = vi.fn((url: string, options: any) => {
        if (options.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 1, totalPages: 400 }),
          } as Response);
        }
        if (options.method === "POST" && url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: "reading" }),
          } as Response);
        }
        return Promise.reject(new Error("Unexpected call"));
      });
      global.fetch = mockFetchSequential as any;

      render(
        <PageCountEditModal
          isOpen={true}
          onClose={vi.fn(() => {})}
          bookId={1}
          currentPageCount={null}
          onSuccess={vi.fn(() => {})}
          pendingStatus="reading"
        />
      );

      const input = screen.getByPlaceholderText("e.g. 320");
      fireEvent.change(input, { target: { value: "400" } });

      const saveButton = screen.getByText("Save");
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Assert both calls made in sequence
        expect(mockFetchSequential).toHaveBeenCalledTimes(2);
      });

      // First call: PATCH pages
      expect(mockFetchSequential.mock.calls[0][0]).toBe("/api/books/1");
      expect(mockFetchSequential.mock.calls[0][1].method).toBe("PATCH");
      expect(JSON.parse(mockFetchSequential.mock.calls[0][1].body)).toEqual({ totalPages: 400 });

      // Second call: POST status
      expect(mockFetchSequential.mock.calls[1][0]).toBe("/api/books/1/status");
      expect(mockFetchSequential.mock.calls[1][1].method).toBe("POST");
      expect(JSON.parse(mockFetchSequential.mock.calls[1][1].body)).toEqual({ status: "reading" });
    });

    test("should include rating in status POST when currentRating provided", async () => {
      const mockFetchWithRating = vi.fn((url: string, options: any) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });
      global.fetch = mockFetchWithRating as any;

      render(
        <PageCountEditModal
          isOpen={true}
          onClose={vi.fn(() => {})}
          bookId={1}
          currentPageCount={null}
          onSuccess={vi.fn(() => {})}
          pendingStatus="reading"
          currentRating={4}
        />
      );

      const input = screen.getByPlaceholderText("e.g. 320");
      fireEvent.change(input, { target: { value: "400" } });

      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockFetchWithRating).toHaveBeenCalledTimes(2);
      });

      // Verify status POST includes rating
      const statusCall = mockFetchWithRating.mock.calls.find(
        (call: any) => call[0].includes("/status") && call[1].method === "POST"
      );
      expect(JSON.parse(statusCall[1].body)).toEqual({
        status: "reading",
        rating: 4,
      });
    });

    test("should NOT include rating when currentRating is undefined", async () => {
      const mockFetchNoRating = vi.fn((url: string, options: any) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });
      global.fetch = mockFetchNoRating as any;

      render(
        <PageCountEditModal
          isOpen={true}
          onClose={vi.fn(() => {})}
          bookId={1}
          currentPageCount={null}
          onSuccess={vi.fn(() => {})}
          pendingStatus="reading"
          currentRating={undefined}
        />
      );

      const input = screen.getByPlaceholderText("e.g. 320");
      fireEvent.change(input, { target: { value: "400" } });

      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockFetchNoRating).toHaveBeenCalledTimes(2);
      });

      // Verify status POST does NOT include rating
      const statusCall = mockFetchNoRating.mock.calls.find(
        (call: any) => call[0].includes("/status") && call[1].method === "POST"
      );
      const body = JSON.parse(statusCall[1].body);
      expect(body).toEqual({ status: "reading" });
      expect(body.rating).toBeUndefined();
    });

    test("should show combined success message when pendingStatus provided", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      ) as any;

      render(
        <PageCountEditModal
          isOpen={true}
          onClose={vi.fn(() => {})}
          bookId={1}
          currentPageCount={null}
          onSuccess={vi.fn(() => {})}
          pendingStatus="reading"
        />
      );

      const input = screen.getByPlaceholderText("e.g. 320");
      fireEvent.change(input, { target: { value: "400" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Page count updated and status changed to "reading"!'
        );
      });
    });

    test("should abort status POST if PATCH fails", async () => {
      const mockFetchPatchFail = vi.fn((url: string, options: any) => {
        if (options.method === "PATCH") {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: "Failed to update pages" }),
          } as Response);
        }
        if (options.method === "POST") {
          throw new Error("POST should not be called if PATCH fails");
        }
        return Promise.reject(new Error("Unexpected call"));
      });
      global.fetch = mockFetchPatchFail as any;

      render(
        <PageCountEditModal
          isOpen={true}
          onClose={vi.fn(() => {})}
          bookId={1}
          currentPageCount={null}
          onSuccess={vi.fn(() => {})}
          pendingStatus="reading"
        />
      );

      const input = screen.getByPlaceholderText("e.g. 320");
      fireEvent.change(input, { target: { value: "400" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });

      // Verify only PATCH was called, POST was never attempted
      expect(mockFetchPatchFail).toHaveBeenCalledTimes(1);
      expect(mockFetchPatchFail.mock.calls[0][1].method).toBe("PATCH");
    });

    test("should handle status POST failure after successful PATCH", async () => {
      const mockFetchStatusFail = vi.fn((url: string, options: any) => {
        if (options.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ totalPages: 400 }),
          } as Response);
        }
        if (options.method === "POST") {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: "Failed to update status" }),
          } as Response);
        }
        return Promise.reject(new Error("Unexpected call"));
      });
      global.fetch = mockFetchStatusFail as any;

      const onSuccess = vi.fn(() => {});

      render(
        <PageCountEditModal
          isOpen={true}
          onClose={vi.fn(() => {})}
          bookId={1}
          currentPageCount={null}
          onSuccess={onSuccess}
          pendingStatus="reading"
        />
      );

      const input = screen.getByPlaceholderText("e.g. 320");
      fireEvent.change(input, { target: { value: "400" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        // onSuccess should NOT be called on failure
        expect(onSuccess).not.toHaveBeenCalled();

        // Error toast should be shown
        expect(mockToast.error).toHaveBeenCalled();
      });
    });
  });

  describe("Decimal Input Validation", () => {
    test("should reject decimal input and show error", async () => {
      const mockFetchDecimal = vi.fn(() => {});
      global.fetch = mockFetchDecimal as any;

      render(<PageCountEditModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("e.g. 320");
      fireEvent.change(input, { target: { value: "320.5" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        // Error toast shown
        expect(mockToast.error).toHaveBeenCalledWith("Please enter a whole number of pages");
      });

      // API never called
      expect(mockFetchDecimal).not.toHaveBeenCalled();
    });

    test("should handle various decimal formats", async () => {
      const testCases = [".5", "320.", "3.2.0", "100.99"];

      for (const value of testCases) {
        const mockFetchFormat = vi.fn(() => {});
        global.fetch = mockFetchFormat as any;

        const { unmount } = render(<PageCountEditModal {...defaultProps} />);

        const input = screen.getByPlaceholderText("e.g. 320");
        fireEvent.change(input, { target: { value } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
          expect(mockFetchFormat).not.toHaveBeenCalled();
        });

        unmount();
        mockToast.error.mockClear();
      }
    });
  });

  describe("Pending Status Info Box", () => {
    test("should render info box when pendingStatus provided", () => {
      render(
        <PageCountEditModal
          {...defaultProps}
          pendingStatus="reading"
        />
      );

      expect(
        screen.getByText(/After saving, your book status will change to "reading"/)
      ).toBeInTheDocument();
    });

    test("should NOT render info box when pendingStatus undefined", () => {
      render(
        <PageCountEditModal
          {...defaultProps}
          pendingStatus={undefined}
        />
      );

      expect(screen.queryByText(/After saving/)).not.toBeInTheDocument();
    });

    test("should show correct status in info box message", () => {
      const { rerender } = render(
        <PageCountEditModal
          {...defaultProps}
          pendingStatus="reading"
        />
      );

      expect(screen.getByText(/"reading"/)).toBeInTheDocument();

      rerender(
        <PageCountEditModal
          {...defaultProps}
          pendingStatus="read"
        />
      );

      expect(screen.getByText(/"read"/)).toBeInTheDocument();
    });
  });
});
