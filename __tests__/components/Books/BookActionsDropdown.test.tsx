import { test, expect, describe, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BookActionsDropdown } from "@/components/Books/BookActionsDropdown";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("BookActionsDropdown", () => {
  const defaultProps = {
    bookId: 1,
    bookTitle: "Test Book",
    isAtTop: false,
    onRemove: vi.fn(),
    onMoveToTop: vi.fn(),
    disabled: false,
  };

  test("renders dropdown toggle button", () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    const toggleButton = screen.getByLabelText("More actions");
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("title", "More actions");
  });

  test("does not show menu initially", () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    expect(screen.queryByText("View Book")).not.toBeInTheDocument();
    expect(screen.queryByText("Move to Top")).not.toBeInTheDocument();
    expect(screen.queryByText("Remove")).not.toBeInTheDocument();
  });

  test("shows menu when toggle button is clicked", () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    const toggleButton = screen.getByLabelText("More actions");
    fireEvent.click(toggleButton);
    
    expect(screen.getByText("View Book")).toBeInTheDocument();
    expect(screen.getByText("Move to Top")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  test("hides menu when toggle button is clicked again", async () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    const toggleButton = screen.getByLabelText("More actions");
    
    // Open menu
    fireEvent.click(toggleButton);
    expect(screen.getByText("View Book")).toBeInTheDocument();
    
    // Close menu
    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(screen.queryByText("View Book")).not.toBeInTheDocument();
    });
  });

  test("renders View Book link with correct href", () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    
    const viewBookLink = screen.getByText("View Book");
    expect(viewBookLink).toBeInTheDocument();
    expect(viewBookLink.closest("a")).toHaveAttribute("href", "/books/1");
  });

  test("Move to Top button is enabled when not at top", () => {
    render(<BookActionsDropdown {...defaultProps} isAtTop={false} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    
    const moveToTopButton = screen.getByText("Move to Top");
    expect(moveToTopButton).not.toBeDisabled();
    expect(moveToTopButton).toHaveAttribute("title", "Move to top of list");
  });

  test("Move to Top button is disabled when at top", () => {
    render(<BookActionsDropdown {...defaultProps} isAtTop={true} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    
    const moveToTopButton = screen.getByText("Move to Top");
    expect(moveToTopButton).toBeDisabled();
    expect(moveToTopButton).toHaveAttribute("title", "Already at top");
  });

  test("calls onMoveToTop when Move to Top is clicked", () => {
    const onMoveToTop = vi.fn();
    render(<BookActionsDropdown {...defaultProps} onMoveToTop={onMoveToTop} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    fireEvent.click(screen.getByText("Move to Top"));
    
    expect(onMoveToTop).toHaveBeenCalledTimes(1);
  });

  test("does not call onMoveToTop when button is disabled", () => {
    const onMoveToTop = vi.fn();
    render(<BookActionsDropdown {...defaultProps} isAtTop={true} onMoveToTop={onMoveToTop} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    
    const moveToTopButton = screen.getByText("Move to Top");
    // Disabled buttons shouldn't respond to clicks
    fireEvent.click(moveToTopButton);
    
    expect(onMoveToTop).not.toHaveBeenCalled();
  });

  test("calls onRemove when Remove is clicked", () => {
    const onRemove = vi.fn();
    render(<BookActionsDropdown {...defaultProps} onRemove={onRemove} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    fireEvent.click(screen.getByText("Remove"));
    
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("closes menu after clicking Move to Top", async () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    expect(screen.getByText("Move to Top")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Move to Top"));
    
    await waitFor(() => {
      expect(screen.queryByText("Move to Top")).not.toBeInTheDocument();
    });
  });

  test("closes menu after clicking Remove", async () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    expect(screen.getByText("Remove")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Remove"));
    
    await waitFor(() => {
      expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    });
  });

  test("closes menu after clicking View Book link", async () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    expect(screen.getByText("View Book")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("View Book"));
    
    await waitFor(() => {
      expect(screen.queryByText("View Book")).not.toBeInTheDocument();
    });
  });

  test("closes menu when clicking outside", async () => {
    render(
      <div>
        <BookActionsDropdown {...defaultProps} />
        <div data-testid="outside">Outside element</div>
      </div>
    );
    
    fireEvent.click(screen.getByLabelText("More actions"));
    expect(screen.getByText("View Book")).toBeInTheDocument();
    
    fireEvent.mouseDown(screen.getByTestId("outside"));
    
    await waitFor(() => {
      expect(screen.queryByText("View Book")).not.toBeInTheDocument();
    });
  });

  test("does not close menu when clicking inside menu", () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    expect(screen.getByText("View Book")).toBeInTheDocument();
    
    // Click inside the menu (but not on an action)
    const menu = screen.getByText("View Book").closest("div");
    if (menu) {
      fireEvent.mouseDown(menu);
    }
    
    // Menu should still be visible
    expect(screen.getByText("View Book")).toBeInTheDocument();
  });

  test("disables toggle button when disabled prop is true", () => {
    render(<BookActionsDropdown {...defaultProps} disabled={true} />);
    
    const toggleButton = screen.getByLabelText("More actions");
    expect(toggleButton).toBeDisabled();
  });

  test("does not open menu when clicking disabled toggle button", () => {
    render(<BookActionsDropdown {...defaultProps} disabled={true} />);
    
    const toggleButton = screen.getByLabelText("More actions");
    fireEvent.click(toggleButton);
    
    expect(screen.queryByText("View Book")).not.toBeInTheDocument();
  });

  test("renders all three action icons", () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    
    // Check that all three action items are present with their text
    expect(screen.getByText("View Book")).toBeInTheDocument();
    expect(screen.getByText("Move to Top")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  test("Remove button has red styling", () => {
    render(<BookActionsDropdown {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText("More actions"));
    
    const removeButton = screen.getByText("Remove");
    expect(removeButton).toHaveClass("text-red-500");
  });
});
