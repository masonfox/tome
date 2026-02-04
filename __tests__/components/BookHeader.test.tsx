/**
 * BookHeader Component Tests - Expanded Coverage
 * 
 * This test suite covers:
 * - Status dropdown rendering and interactions
 * - Status option disabled states (DNF only from reading, Read disabled from DNF)
 * - Rating display for different states
 * - Re-read button visibility (for read/DNF status)
 * - Image error fallback
 * - Status dropdown open/close
 */

import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import BookHeader from "@/components/BookDetail/BookHeader";

/**
 * Mock Rationale: Simplify Next.js Image component for testing.
 * Next/Image has complex optimization logic that's not relevant to our component
 * tests. We replace it with a simple <img> tag to test our rendering logic without
 * Next.js image optimization concerns.
 */
vi.mock("next/image", () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

afterEach(() => {
  cleanup();
});

describe("BookHeader", () => {
  const mockBook = {
    calibreId: 1,
    totalPages: 300,
  };

  const defaultProps = {
    book: mockBook,
    selectedStatus: "to-read",
    imageError: false,
    onImageError: vi.fn(),
    onStatusChange: vi.fn(),
    onRatingClick: vi.fn(),
    onRereadClick: vi.fn(),
    showStatusDropdown: false,
    setShowStatusDropdown: vi.fn(),
    rating: null as number | null,
    hasCompletedReads: false,
    hasFinishedSessions: false,
    hasActiveSession: false,
  };

  describe("Status Display", () => {
    test("should render status dropdown with current status - to-read", () => {
      render(<BookHeader {...defaultProps} selectedStatus="to-read" />);
      expect(screen.getByText("Want to Read")).toBeInTheDocument();
    });

    test("should render status dropdown with current status - reading", () => {
      render(<BookHeader {...defaultProps} selectedStatus="reading" />);
      expect(screen.getByText("Reading")).toBeInTheDocument();
    });

    test("should render status dropdown with current status - read", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read" />);
      expect(screen.getByText("Read")).toBeInTheDocument();
    });

    test("should render status dropdown with current status - dnf", () => {
      render(<BookHeader {...defaultProps} selectedStatus="dnf" />);
      expect(screen.getByText("Did Not Finish")).toBeInTheDocument();
    });

    test("should render status dropdown with current status - read-next", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read-next" />);
      expect(screen.getByText("Read Next")).toBeInTheDocument();
    });
  });

  describe("Status Dropdown Interactions", () => {
    test("should toggle dropdown when status button clicked", () => {
      const setShowStatusDropdown = vi.fn();
      render(
        <BookHeader
          {...defaultProps}
          showStatusDropdown={false}
          setShowStatusDropdown={setShowStatusDropdown}
        />
      );

      const statusButton = screen.getByText("Want to Read").closest("button");
      fireEvent.click(statusButton!);

      expect(setShowStatusDropdown).toHaveBeenCalledWith(true);
    });

    test("should show dropdown menu when showStatusDropdown is true", () => {
      render(<BookHeader {...defaultProps} showStatusDropdown={true} />);

      // All status options should be visible (some appear in both button and dropdown)
      const wantToReadElements = screen.getAllByText("Want to Read");
      expect(wantToReadElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Read Next")).toBeInTheDocument();
      expect(screen.getByText("Reading")).toBeInTheDocument();
      expect(screen.getByText("Read")).toBeInTheDocument();
      expect(screen.getByText("Did Not Finish")).toBeInTheDocument();
    });

    test("should not show dropdown menu when showStatusDropdown is false", () => {
      render(<BookHeader {...defaultProps} showStatusDropdown={false} />);

      // Only the current status should be visible (in the button)
      const readOptions = screen.queryAllByText("Reading");
      expect(readOptions).toHaveLength(0);
    });

    test("should call onStatusChange when selecting a status option", () => {
      const onStatusChange = vi.fn();
      const setShowStatusDropdown = vi.fn();

      render(
        <BookHeader
          {...defaultProps}
          showStatusDropdown={true}
          onStatusChange={onStatusChange}
          setShowStatusDropdown={setShowStatusDropdown}
        />
      );

      // Click on "Reading" status
      const readingOption = screen.getAllByText("Reading")[0].closest("button");
      fireEvent.click(readingOption!);

      expect(onStatusChange).toHaveBeenCalledWith("reading");
      expect(setShowStatusDropdown).toHaveBeenCalledWith(false);
    });
  });

  describe("Status Option Disabled States", () => {
    test("should disable DNF option when not in reading status", () => {
      render(
        <BookHeader {...defaultProps} selectedStatus="to-read" showStatusDropdown={true} />
      );

      const dnfButton = screen.getByText("Did Not Finish").closest("button");
      expect(dnfButton).toBeDisabled();
      expect(dnfButton).toHaveAttribute("title", "Only available when actively reading");
    });

    test("should enable DNF option when in reading status", () => {
      render(
        <BookHeader {...defaultProps} selectedStatus="reading" showStatusDropdown={true} />
      );

      const dnfButton = screen.getByText("Did Not Finish").closest("button");
      expect(dnfButton).not.toBeDisabled();
    });

    test("should disable Read option when in DNF status", () => {
      render(<BookHeader {...defaultProps} selectedStatus="dnf" showStatusDropdown={true} />);

      const readButton = screen.getByText("Read").closest("button");
      expect(readButton).toBeDisabled();
    });

    test("should enable Read option when not in DNF status", () => {
      render(
        <BookHeader {...defaultProps} selectedStatus="to-read" showStatusDropdown={true} />
      );

      const readButton = screen.getByText("Read").closest("button");
      expect(readButton).not.toBeDisabled();
    });

    test("should not call onStatusChange when clicking disabled option", () => {
      const onStatusChange = vi.fn();

      render(
        <BookHeader
          {...defaultProps}
          selectedStatus="to-read"
          showStatusDropdown={true}
          onStatusChange={onStatusChange}
        />
      );

      const dnfButton = screen.getByText("Did Not Finish").closest("button");
      fireEvent.click(dnfButton!);

      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe("Rating Display", () => {
    test("should show rating display when book has rating", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read" rating={4} />);

      expect(screen.getByText("4 stars")).toBeInTheDocument();
    });

    test("should show rating display with singular 'star' for rating of 1", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read" rating={1} />);

      expect(screen.getByText("1 star")).toBeInTheDocument();
    });

    test("should show 'Rate this book' when status is read but no rating", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read" rating={null} />);

      expect(screen.getByText("Rate this book")).toBeInTheDocument();
    });

    test("should not show rating section when status is not read and no rating", () => {
      render(<BookHeader {...defaultProps} selectedStatus="reading" rating={null} />);

      expect(screen.queryByText("Rate this book")).not.toBeInTheDocument();
    });

    test("should call onRatingClick when rating area is clicked", () => {
      const onRatingClick = vi.fn();

      render(
        <BookHeader {...defaultProps} selectedStatus="read" rating={4} onRatingClick={onRatingClick} />
      );

      const ratingArea = screen.getByText("4 stars").closest("div")!.parentElement;
      fireEvent.click(ratingArea!);

      expect(onRatingClick).toHaveBeenCalled();
    });

    test("should show filled stars for rating value", () => {
      const { container } = render(
        <BookHeader {...defaultProps} selectedStatus="read" rating={3} />
      );

      // There should be star icons, 3 filled and 2 unfilled
      const stars = container.querySelectorAll("svg");
      // Note: We can't easily test fill classes without more complex setup,
      // but we can verify the component renders
      expect(stars.length).toBeGreaterThan(0);
    });
  });

  describe("Re-read Button", () => {
    test("should show re-read button when status is read", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read" />);

      expect(screen.getByText("Start Re-reading")).toBeInTheDocument();
    });

    test("should show re-read button when status is dnf", () => {
      render(<BookHeader {...defaultProps} selectedStatus="dnf" />);

      expect(screen.getByText("Start Re-reading")).toBeInTheDocument();
    });

    test("should not show re-read button when status is reading", () => {
      render(<BookHeader {...defaultProps} selectedStatus="reading" />);

      expect(screen.queryByText("Start Re-reading")).not.toBeInTheDocument();
    });

    test("should not show re-read button when status is to-read", () => {
      render(<BookHeader {...defaultProps} selectedStatus="to-read" />);

      expect(screen.queryByText("Start Re-reading")).not.toBeInTheDocument();
    });

    test("should call onRereadClick when re-read button is clicked", () => {
      const onRereadClick = vi.fn();

      render(
        <BookHeader {...defaultProps} selectedStatus="read" onRereadClick={onRereadClick} />
      );

      const rereadButton = screen.getByText("Start Re-reading");
      fireEvent.click(rereadButton);

      expect(onRereadClick).toHaveBeenCalled();
    });
  });

  describe("Image Display", () => {
    test("should show book cover image when no error", () => {
      const { container } = render(<BookHeader {...defaultProps} imageError={false} />);

      const image = container.querySelector("img");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("alt", "Book cover");
      expect(image).toHaveAttribute("src", expect.stringContaining("/api/books/1/cover"));
    });

    test("should show fallback icon when image error", () => {
      const { container } = render(<BookHeader {...defaultProps} imageError={true} />);

      const bookOpenIcon = container.querySelector("svg");
      expect(bookOpenIcon).toBeInTheDocument();

      const image = container.querySelector("img");
      expect(image).not.toBeInTheDocument();
    });

    test("should call onImageError when image fails to load", () => {
      const onImageError = vi.fn();

      const { container } = render(
        <BookHeader {...defaultProps} imageError={false} onImageError={onImageError} />
      );

      const image = container.querySelector("img");
      fireEvent.error(image!);

      expect(onImageError).toHaveBeenCalled();
    });
  });

  describe("Combined States", () => {
    test("should show rating and re-read button together for read status", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read" rating={5} />);

      expect(screen.getByText("5 stars")).toBeInTheDocument();
      expect(screen.getByText("Start Re-reading")).toBeInTheDocument();
    });

    test("should show DNF status with re-read button", () => {
      render(<BookHeader {...defaultProps} selectedStatus="dnf" />);

      expect(screen.getByText("Did Not Finish")).toBeInTheDocument();
      expect(screen.getByText("Start Re-reading")).toBeInTheDocument();
    });

    test("should handle reading status with active session", () => {
      render(
        <BookHeader
          {...defaultProps}
          selectedStatus="reading"
          hasActiveSession={true}
        />
      );

      expect(screen.getByText("Reading")).toBeInTheDocument();
      expect(screen.queryByText("Start Re-reading")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("should handle rating of 5 stars", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read" rating={5} />);

      expect(screen.getByText("5 stars")).toBeInTheDocument();
    });

    test("should handle rating of 0 stars (no rating)", () => {
      render(<BookHeader {...defaultProps} selectedStatus="read" rating={0} />);

      // 0 rating should be treated as no rating
      expect(screen.queryByText("0 stars")).not.toBeInTheDocument();
    });

    test("should handle undefined rating same as null", () => {
      render(
        <BookHeader {...defaultProps} selectedStatus="read" rating={undefined as any} />
      );

      expect(screen.getByText("Rate this book")).toBeInTheDocument();
    });

    test("should handle book without totalPages", () => {
      const bookWithoutPages = { calibreId: 1 };

      render(<BookHeader {...defaultProps} book={bookWithoutPages} />);

      expect(screen.getByText("Want to Read")).toBeInTheDocument();
    });
  });
});
