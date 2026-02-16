import { test, expect, describe, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StreakOnboarding } from "@/components/Streaks/StreakOnboarding";

// Mock useStreak hook
const mockEnableStreak = vi.fn();
let mockIsEnablingStreak = false;

vi.mock('@/hooks/useStreak', () => ({
  useStreak: () => ({
    enableStreak: mockEnableStreak,
    isEnablingStreak: mockIsEnablingStreak,
  }),
}));

afterEach(() => {
  cleanup();
  mockIsEnablingStreak = false;
});

describe("StreakOnboarding", () => {
  beforeEach(() => {
    mockEnableStreak.mockClear();
    mockIsEnablingStreak = false;
  });

  describe("Component Rendering", () => {
    test("should render hero section with title", () => {
      render(<StreakOnboarding />);

      expect(screen.getByText("Build a Reading Habit")).toBeInTheDocument();
      expect(
        screen.getByText(/Track your daily reading progress and build consistency/)
      ).toBeInTheDocument();
    });

    test("should render all three feature cards", () => {
      render(<StreakOnboarding />);

      expect(screen.getByText("Daily Streaks")).toBeInTheDocument();
      expect(screen.getByText("Custom Goals")).toBeInTheDocument();
      expect(screen.getByText("Progress Insights")).toBeInTheDocument();
    });

    test("should render daily goal input with default value of 10", () => {
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe("10");
      expect(input.type).toBe("number");
    });

    test("should render enable button", () => {
      render(<StreakOnboarding />);

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    test("should show suggested reading ranges", () => {
      render(<StreakOnboarding />);

      expect(
        screen.getByText(/Suggested: 10-20 pages for casual readers/)
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    test("should update daily goal when input changes", () => {
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "25" } });

      expect(input.value).toBe("25");
    });

    test("should handle non-numeric input gracefully", () => {
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });

      // Should default to 1 when parsing fails
      expect(input.value).toBe("1");
    });

    test("should call enableStreak with correct params when button clicked", async () => {
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "15" } });

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockEnableStreak).toHaveBeenCalledWith({ 
          streakEnabled: true, 
          dailyThreshold: 15 
        });
      });
    });

    test("should disable button and show loading state while enabling", () => {
      mockIsEnablingStreak = true;
      render(<StreakOnboarding />);

      const button = screen.getByRole("button", { name: /enabling/i });
      expect(button).toBeDisabled();
    });

    test("should disable input while enabling", () => {
      mockIsEnablingStreak = true;
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day");
      expect(input).toBeDisabled();
    });
  });

  describe("Validation", () => {
    test("should not call enableStreak for daily goal less than 1", async () => {
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "0" } });

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      // Wait a bit to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockEnableStreak).not.toHaveBeenCalled();
    });

    test("should not call enableStreak for daily goal greater than 9999", async () => {
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "10000" } });

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      // Wait a bit to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockEnableStreak).not.toHaveBeenCalled();
    });

    test("should enforce min and max attributes on input", () => {
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("max", "9999");
    });
  });

  describe("Success Flow", () => {
    test("should call enableStreak on successful enable", async () => {
      render(<StreakOnboarding />);

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockEnableStreak).toHaveBeenCalled();
      });
    });

    test("should pass correct daily goal value to enableStreak", async () => {
      render(<StreakOnboarding />);

      const input = screen.getByLabelText("Pages per day");
      fireEvent.change(input, { target: { value: "30" } });

      const button = screen.getByRole("button", { name: /enable streak tracking/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockEnableStreak).toHaveBeenCalledWith({ 
          streakEnabled: true, 
          dailyThreshold: 30 
        });
      });
    });
  });
});
