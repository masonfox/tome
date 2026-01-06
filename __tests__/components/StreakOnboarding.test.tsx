import { test, expect, describe, afterEach, mock, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreakOnboarding } from "@/components/StreakOnboarding";

afterEach(() => {
  cleanup();
});

describe("StreakOnboarding", () => {
  const mockOnEnable = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    mockOnEnable.mockClear();
  });

  describe("Component Rendering", () => {
    test("should render hero section with title", () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      expect(screen.getByText("Build a Reading Habit")).toBeInTheDocument();
      expect(
        screen.getByText(/Track your daily reading progress and build consistency/)
      ).toBeInTheDocument();
    });

    test("should render all three feature cards", () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      expect(screen.getByText("Daily Streaks")).toBeInTheDocument();
      expect(screen.getByText("Custom Goals")).toBeInTheDocument();
      expect(screen.getByText("Progress Insights")).toBeInTheDocument();
    });

    test("should render daily goal input with default value of 10", () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe("10");
      expect(input.type).toBe("number");
    });

    test("should render enable button", () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    test("should show suggested reading ranges", () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      expect(
        screen.getByText(/Suggested: 10-20 pages for casual readers/)
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    test("should update daily goal when input changes", () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "25" } });

      expect(input.value).toBe("25");
    });

    test("should handle non-numeric input gracefully", () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });

      // Should default to 1 when parsing fails
      expect(input.value).toBe("1");
    });

    test("should call onEnable with daily goal when button clicked", async () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "15" } });

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnEnable).toHaveBeenCalledWith(15);
      });
    });

    test("should disable button and show loading state while enabling", async () => {
      const slowOnEnable = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));
      render(<StreakOnboarding onEnable={slowOnEnable} />);

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      // Button should show loading state
      expect(screen.getByText("Enabling...")).toBeInTheDocument();
      expect(button).toBeDisabled();

      await waitFor(() => {
        expect(slowOnEnable).toHaveBeenCalled();
      });
    });

    test("should disable input while enabling", async () => {
      const slowOnEnable = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));
      render(<StreakOnboarding onEnable={slowOnEnable} />);

      const input = screen.getByLabelText("Pages per day");
      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      
      fireEvent.click(button);

      expect(input).toBeDisabled();

      await waitFor(() => {
        expect(slowOnEnable).toHaveBeenCalled();
      });
    });
  });

  describe("Validation", () => {
    test("should not call onEnable for daily goal less than 1", async () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "0" } });

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      // Wait a bit to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockOnEnable).not.toHaveBeenCalled();
    });

    test("should not call onEnable for daily goal greater than 9999", async () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "10000" } });

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      // Wait a bit to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockOnEnable).not.toHaveBeenCalled();
    });

    test("should enforce min and max attributes on input", () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const input = screen.getByLabelText("Pages per day");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("max", "9999");
    });
  });

  describe("Error Handling", () => {
    test("should call onEnable even when it fails", async () => {
      const failingOnEnable = vi.fn(() => Promise.reject(new Error("Network error")));
      render(<StreakOnboarding onEnable={failingOnEnable} />);

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(failingOnEnable).toHaveBeenCalled();
      });
    });

    test("should re-enable button after error", async () => {
      const failingOnEnable = vi.fn(() => Promise.reject(new Error("Network error")));
      render(<StreakOnboarding onEnable={failingOnEnable} />);

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(failingOnEnable).toHaveBeenCalled();
      });

      // Wait for error handling to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Button should be enabled again after error
      expect(button).not.toBeDisabled();
    });
  });

  describe("Success Flow", () => {
    test("should call onEnable on successful enable", async () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnEnable).toHaveBeenCalled();
      });
    });

    test("should pass correct daily goal value to onEnable", async () => {
      render(<StreakOnboarding onEnable={mockOnEnable} />);

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "30" } });

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnEnable).toHaveBeenCalledWith(30);
      });
    });
  });
});
