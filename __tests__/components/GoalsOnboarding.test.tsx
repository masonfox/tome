import { test, expect, describe, afterEach, mock, beforeEach } from "bun:test";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GoalsOnboarding } from "@/components/GoalsOnboarding";

afterEach(() => {
  cleanup();
});

describe("GoalsOnboarding", () => {
  const mockOnCreateGoal = mock(() => Promise.resolve());
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    mockOnCreateGoal.mockClear();
  });

  describe("Component Rendering", () => {
    test("should render hero section with title", () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      expect(screen.getByText("Set Your Reading Goals")).toBeInTheDocument();
      expect(
        screen.getByText(/Track your annual reading targets/)
      ).toBeInTheDocument();
    });

    test("should render all three feature cards", () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      expect(screen.getByText("Annual Targets")).toBeInTheDocument();
      expect(screen.getByText("Progress Tracking")).toBeInTheDocument();
      expect(screen.getByText("Year History")).toBeInTheDocument();
    });

    test("should render books goal input with default value of 12", () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe("12");
      expect(input.type).toBe("number");
    });

    test("should render create button", () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const button = screen.getByRole("button", { name: /create reading goal/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    test("should show suggested reading ranges", () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      expect(
        screen.getByText(/Suggested: 12-24 books for casual readers/)
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    test("should update books goal when input changes", () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "30" } });

      expect(input.value).toBe("30");
    });

    test("should handle non-numeric input gracefully", () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "" } });

      // Should default to 1 when parsing fails
      expect(input.value).toBe("1");
    });

    test("should call onCreateGoal with year and books goal when button clicked", async () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read");
      fireEvent.change(input, { target: { value: "24" } });

      const button = screen.getByRole("button", { name: /create reading goal/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnCreateGoal).toHaveBeenCalledWith(currentYear, 24);
      });
    });

    test("should disable button and show loading state while creating", async () => {
      const slowOnCreateGoal = mock(() => new Promise((resolve) => setTimeout(resolve, 100)));
      render(<GoalsOnboarding onCreateGoal={slowOnCreateGoal} />);

      const button = screen.getByRole("button", { name: /create reading goal/i });
      fireEvent.click(button);

      // Button should show loading state
      expect(screen.getByText("Creating...")).toBeInTheDocument();
      expect(button).toBeDisabled();

      await waitFor(() => {
        expect(slowOnCreateGoal).toHaveBeenCalled();
      });
    });

    test("should disable input while creating", async () => {
      const slowOnCreateGoal = mock(() => new Promise((resolve) => setTimeout(resolve, 100)));
      render(<GoalsOnboarding onCreateGoal={slowOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read");
      const button = screen.getByRole("button", { name: /create reading goal/i });
      
      fireEvent.click(button);

      expect(input).toBeDisabled();

      await waitFor(() => {
        expect(slowOnCreateGoal).toHaveBeenCalled();
      });
    });
  });

  describe("Validation", () => {
    test("should not call onCreateGoal for books goal less than 1", async () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read");
      fireEvent.change(input, { target: { value: "0" } });

      const button = screen.getByRole("button", { name: /create reading goal/i });
      fireEvent.click(button);

      // Wait a bit to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockOnCreateGoal).not.toHaveBeenCalled();
    });

    test("should not call onCreateGoal for books goal greater than 9999", async () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read");
      fireEvent.change(input, { target: { value: "10000" } });

      const button = screen.getByRole("button", { name: /create reading goal/i });
      fireEvent.click(button);

      // Wait a bit to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockOnCreateGoal).not.toHaveBeenCalled();
    });

    test("should enforce min and max attributes on input", () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("max", "9999");
    });
  });

  describe("Error Handling", () => {
    test("should call onCreateGoal even when it fails", async () => {
      const failingOnCreateGoal = mock(() => Promise.reject(new Error("Network error")));
      render(<GoalsOnboarding onCreateGoal={failingOnCreateGoal} />);

      const button = screen.getByRole("button", { name: /create reading goal/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(failingOnCreateGoal).toHaveBeenCalled();
      });
    });

    test("should re-enable button after error", async () => {
      const failingOnCreateGoal = mock(() => Promise.reject(new Error("Network error")));
      render(<GoalsOnboarding onCreateGoal={failingOnCreateGoal} />);

      const button = screen.getByRole("button", { name: /create reading goal/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(failingOnCreateGoal).toHaveBeenCalled();
      });

      // Wait for error handling to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Button should be enabled again after error
      expect(button).not.toBeDisabled();
    });
  });

  describe("Success Flow", () => {
    test("should call onCreateGoal with current year on successful creation", async () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const button = screen.getByRole("button", { name: /create reading goal/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnCreateGoal).toHaveBeenCalledWith(currentYear, 12);
      });
    });

    test("should pass correct books goal value to onCreateGoal", async () => {
      render(<GoalsOnboarding onCreateGoal={mockOnCreateGoal} />);

      const input = screen.getByLabelText("Books to read");
      fireEvent.change(input, { target: { value: "50" } });

      const button = screen.getByRole("button", { name: /create reading goal/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnCreateGoal).toHaveBeenCalledWith(currentYear, 50);
      });
    });
  });
});
