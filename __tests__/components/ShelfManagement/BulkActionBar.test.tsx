import { test, expect, describe, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BulkActionBar } from "@/components/ShelfManagement/BulkActionBar";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * Component Tests: BulkActionBar
 * 
 * Tests the bulk action bar that appears at the bottom of the screen
 * when books are selected for bulk operations.
 * 
 * Coverage:
 * - Rendering: Shows/hides based on selection count
 * - Text content: Singular/plural book count display
 * - Button interactions: Delete and Cancel button clicks
 * - Loading state: Disabled buttons and loading text
 * - Edge cases: Zero selection, disabled states
 */

describe("BulkActionBar", () => {
  const mockOnMove = vi.fn();
  const mockOnCopy = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCancel = vi.fn();

  describe("Visibility and Rendering", () => {
    test("should not render when selectedCount is 0", () => {
      const { container } = render(
        <BulkActionBar
          selectedCount={0}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      // Should render null (empty container)
      expect(container.firstChild).toBeNull();
    });

    test("should render when selectedCount is greater than 0", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("3 books selected")).toBeInTheDocument();
      expect(screen.getAllByText("Remove")[0]).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    test("should render with custom className", () => {
      const { container } = render(
        <BulkActionBar
          selectedCount={1}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          className="custom-class"
        />
      );

      const bulkBar = container.firstChild as HTMLElement;
      expect(bulkBar).toHaveClass("custom-class");
    });
  });

  describe("Selected Count Display", () => {
    test("should display singular 'book' for count of 1", () => {
      render(
        <BulkActionBar
          selectedCount={1}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("1 book selected")).toBeInTheDocument();
      expect(screen.queryByText("1 books selected")).not.toBeInTheDocument();
    });

    test("should display plural 'books' for count greater than 1", () => {
      render(
        <BulkActionBar
          selectedCount={5}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("5 books selected")).toBeInTheDocument();
    });

    test("should display plural 'books' for large counts", () => {
      render(
        <BulkActionBar
          selectedCount={100}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("100 books selected")).toBeInTheDocument();
    });
  });

  describe("Remove Button", () => {
    test("should call onDelete when Remove button is clicked", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      const deleteButton = screen.getByText("Remove");
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    test("should show 'Remove' text by default", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Remove")).toBeInTheDocument();
    });

    test("should show 'Removing...' text when loading", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      expect(screen.getByText("Removing...")).toBeInTheDocument();
      expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    });

    test("should be disabled when loading", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      const deleteButton = screen.getByText("Removing...");
      expect(deleteButton).toBeDisabled();
    });

    test("should not call onDelete when clicked while loading", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      const deleteButton = screen.getByText("Removing...");
      fireEvent.click(deleteButton);

      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    test("should have Trash2 icon", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      const deleteButton = screen.getByText("Remove").closest("button");
      const icon = deleteButton?.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    test("should have red background styling", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      const deleteButton = screen.getByText("Remove");
      expect(deleteButton).toHaveClass("bg-red-600");
    });
  });

  describe("Cancel Button", () => {
    test("should call onCancel when Cancel button is clicked", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test("should be disabled when loading", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      const cancelButton = screen.getByText("Cancel");
      expect(cancelButton).toBeDisabled();
    });

    test("should not call onCancel when clicked while loading", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    test("should maintain Cancel text when loading", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      // Cancel button text doesn't change when loading
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    test("should disable both buttons when loading", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      const cancelButton = screen.getByText("Cancel");
      const deleteButton = screen.getByText("Removing...");

      expect(cancelButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();
    });

    test("should enable both buttons when not loading", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={false}
        />
      );

      const cancelButton = screen.getByText("Cancel");
      const deleteButton = screen.getByText("Remove");

      expect(cancelButton).not.toBeDisabled();
      expect(deleteButton).not.toBeDisabled();
    });

    test("should handle loading state transitions", () => {
      const { rerender } = render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={false}
        />
      );

      // Initially not loading
      expect(screen.getByText("Remove")).not.toBeDisabled();

      // Transition to loading
      rerender(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      expect(screen.getByText("Removing...")).toBeDisabled();

      // Transition back to not loading
      rerender(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={false}
        />
      );

      expect(screen.getByText("Remove")).not.toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    test("should handle very large selectedCount values", () => {
      render(
        <BulkActionBar
          selectedCount={999999}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("999999 books selected")).toBeInTheDocument();
    });

    test("should handle rapid button clicks", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      const deleteButton = screen.getByText("Remove");
      
      // Click multiple times rapidly
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);

      // All clicks should be registered
      expect(mockOnDelete).toHaveBeenCalledTimes(3);
    });

    test("should handle switching between different selectedCounts", () => {
      const { rerender } = render(
        <BulkActionBar
          selectedCount={1}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("1 book selected")).toBeInTheDocument();

      rerender(
        <BulkActionBar
          selectedCount={5}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("5 books selected")).toBeInTheDocument();
      expect(screen.queryByText("1 book selected")).not.toBeInTheDocument();
    });

    test("should unmount cleanly when selectedCount becomes 0", () => {
      const { rerender, container } = render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("3 books selected")).toBeInTheDocument();

      rerender(
        <BulkActionBar
          selectedCount={0}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    test("should handle callback prop changes", () => {
      const newOnDelete = vi.fn();
      const newOnCancel = vi.fn();

      const { rerender } = render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      // Click with original callbacks
      fireEvent.click(screen.getByText("Remove"));
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
      expect(newOnDelete).not.toHaveBeenCalled();

      // Update callbacks
      rerender(
        <BulkActionBar
          selectedCount={3}
          onDelete={newOnDelete}
          onCancel={newOnCancel}
        />
      );

      // Click with new callbacks
      fireEvent.click(screen.getByText("Remove"));
      expect(mockOnDelete).toHaveBeenCalledTimes(1); // Still only once
      expect(newOnDelete).toHaveBeenCalledTimes(1); // New callback called
    });
  });

  describe("Accessibility", () => {
    test("should have properly structured buttons without move/copy", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      const buttons = screen.getAllByRole("button");
      // Cancel button + 1 Remove button (desktop) + 1 Actions button (mobile)
      expect(buttons).toHaveLength(3);
    });

    test("should have descriptive button text", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
    });

    test("should indicate disabled state in loading mode", () => {
      render(
        <BulkActionBar
          selectedCount={3}
          onDelete={mockOnDelete}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });
});
