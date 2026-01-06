import { test, expect, describe, afterEach, mock, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreakSettings } from "@/components/StreakSettings";

afterEach(() => {
  cleanup();
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

describe("StreakSettings", () => {
  describe("Component Rendering", () => {
    test("should render with initial threshold value", () => {
      render(<StreakSettings initialThreshold={10} />);

      expect(screen.getByLabelText("Pages per day")).toBeInTheDocument();
      expect(screen.getByLabelText("Pages per day")).toHaveValue(10);
      expect(screen.getByText("Daily Reading Goal")).toBeInTheDocument();
    });

    test("should render save button", () => {
      render(<StreakSettings initialThreshold={10} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeInTheDocument();
    });

    test("should disable save button when threshold equals initial value", () => {
      render(<StreakSettings initialThreshold={10} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    test("should show validation hint text", () => {
      render(<StreakSettings initialThreshold={10} />);

      expect(screen.getByText("Must be between 1 and 9999")).toBeInTheDocument();
    });
  });

  describe("Input Validation", () => {
    test("should enable save button when threshold changes", () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "20" } });

      expect(saveButton).not.toBeDisabled();
    });

    test("should update input value when changed", () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "25" } });

      expect(input.value).toBe("25");
    });

    test("should handle boundary value 1", () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "1" } });

      expect(input.value).toBe("1");
    });

    test("should handle boundary value 9999", () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "9999" } });

      expect(input.value).toBe("9999");
    });

    test("should default to 1 when input is cleared", () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "" } });

      expect(input.value).toBe("1");
    });
  });

  describe("Form Submission", () => {
    test("should show loading state when saving", async () => {
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

      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "20" } });
      fireEvent.click(saveButton);

      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    test("should call fetch with correct data on save", async () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "30" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/streak",
          expect.objectContaining({
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dailyThreshold: 30 }),
          })
        );
      });
    });

    test("should disable input and button while saving", async () => {
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

      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "20" } });
      fireEvent.click(saveButton);

      expect(input).toBeDisabled();
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Validation Error Handling", () => {
    test("should handle threshold value 0 by converting it to 1", async () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "0" } });

      // Component converts 0 to 1 automatically
      expect(input.value).toBe("1");
    });

    test("should not call API when threshold is greater than 9999", async () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "10000" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    test("should allow valid threshold value 1", async () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "1" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    test("should allow valid threshold value 9999", async () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "9999" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("API Response Handling", () => {
    test("should handle successful API response", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response)
      );
      global.fetch = mockFetch as any;

      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "20" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    test("should handle API error response", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              success: false,
              error: { message: "Validation failed" },
            }),
        } as Response)
      );
      global.fetch = mockFetch as any;

      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "20" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    test("should handle network error", async () => {
      mockFetch = vi.fn(() => Promise.reject(new Error("Network error")));
      global.fetch = mockFetch as any;

      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      const saveButton = screen.getByRole("button", { name: /save/i });

      fireEvent.change(input, { target: { value: "20" } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Accessibility", () => {
    test("should have proper label association", () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      expect(input).toHaveAttribute("id", "daily-threshold");
    });

    test("should have proper input constraints", () => {
      render(<StreakSettings initialThreshold={10} />);

      const input = screen.getByLabelText("Pages per day");
      expect(input).toHaveAttribute("type", "number");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("max", "9999");
    });

    test("should show visual feedback for disabled state", () => {
      render(<StreakSettings initialThreshold={10} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveClass("disabled:opacity-50");
    });
  });
});
