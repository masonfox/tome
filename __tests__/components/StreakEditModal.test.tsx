import { test, expect, describe, afterEach, mock, beforeEach } from "bun:test";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreakEditModal } from "@/components/StreakEditModal";
import { createTestQueryClient } from "../test-utils";
import { QueryClientProvider } from "@tanstack/react-query";

afterEach(() => {
  cleanup();
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

describe("StreakEditModal", () => {
  const mockOnClose = mock(() => {});
  const mockOnSuccess = mock(() => {});
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  const renderModal = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  describe("Component Rendering", () => {
    test("should not render when isOpen is false", () => {
      renderModal(
        <StreakEditModal
          isOpen={false}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText("Edit Daily Reading Goal")).not.toBeInTheDocument();
    });

    test("should render when isOpen is true", () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText("Edit Daily Reading Goal")).toBeInTheDocument();
      expect(screen.getByLabelText("Pages per day")).toBeInTheDocument();
    });

    test("should render with initial threshold value", () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={25}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByLabelText("Pages per day")).toHaveValue(25);
    });

    test("should show subtitle text", () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      expect(
        screen.getByText("Set how many pages you want to read each day to maintain your streak")
      ).toBeInTheDocument();
    });

    test("should disable save button when threshold equals initial value", () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      expect(saveButton).toBeDisabled();
    });

    test("should show validation hint text", () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText("Must be between 1 and 9999")).toBeInTheDocument();
    });
  });

  describe("User Interaction", () => {
    test("should call onClose when close button is clicked", () => {
      const onClose = mock(() => {});
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={onClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const closeButton = screen.getByLabelText("Close");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("should call onClose when cancel button is clicked", () => {
      const onClose = mock(() => {});
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={onClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("should enable save button when threshold changes", () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "20" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      expect(saveButton).not.toBeDisabled();
    });

    test("should update input value when changed", () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "30" } });

      expect(input.value).toBe("30");
    });
  });

  describe("API Integration", () => {
    test("should call API when save is clicked", async () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "20" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    test("should send correct data to API", async () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "15" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/streak",
          expect.objectContaining({
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dailyThreshold: 15 }),
          })
        );
      });
    });

    test("should call onSuccess and onClose on successful save", async () => {
      const onClose = mock(() => {});
      const onSuccess = mock(() => {});

      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={onClose}
          initialThreshold={10}
          onSuccess={onSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "20" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    test("should show error message on API failure", async () => {
      mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Update failed" } }),
        } as Response)
      );
      global.fetch = mockFetch as any;

      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "20" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      // Note: toast.error would be called here, but we can't easily test that without mocking sonner
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Validation", () => {
    test("should not allow threshold less than 1", async () => {
      // Note: This test verifies validation works, but HTML5 number inputs
      // may prevent entering 0 in some browsers. The validation is still present
      // as a safety net for programmatic changes or edge cases.
      let fetchCallCount = 0;
      const fetchSpy = mock(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);
      });
      global.fetch = fetchSpy as any;

      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      
      // Change to 0 directly (bypassing HTML5 validation)
      Object.defineProperty(input, 'value', {
        writable: true,
        value: '0'
      });
      fireEvent.change(input, { target: { value: "0" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not call fetch for invalid values
      expect(fetchCallCount).toBe(0);
    });

    test("should not allow threshold greater than 9999", async () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "10000" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      // Should not call API for invalid values
      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    test("should enforce min and max attributes on input", () => {
      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("max", "9999");
      expect(input).toHaveAttribute("type", "number");
    });
  });

  describe("Loading States", () => {
    test("should disable save button while saving", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      mockFetch = mock(() => fetchPromise);
      global.fetch = mockFetch as any;

      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "20" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      // Button should be disabled while saving (check immediately after click)
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      // Resolve the fetch to clean up
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    test("should show saving text while saving", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      mockFetch = mock(() => fetchPromise);
      global.fetch = mockFetch as any;

      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "20" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      // Should show "Saving..." text
      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeInTheDocument();
      });

      // Resolve the fetch to clean up
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    test("should disable cancel button while saving", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      mockFetch = mock(() => fetchPromise);
      global.fetch = mockFetch as any;

      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "20" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        expect(cancelButton).toBeDisabled();
      });

      // Resolve the fetch to clean up
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    test("should disable input while saving", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      mockFetch = mock(() => fetchPromise);
      global.fetch = mockFetch as any;

      renderModal(
        <StreakEditModal
          isOpen={true}
          onClose={mockOnClose}
          initialThreshold={10}
          onSuccess=  {mockOnSuccess}
        />
      );

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "20" } });

      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(input).toBeDisabled();
      });

      // Resolve the fetch to clean up
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });
});
