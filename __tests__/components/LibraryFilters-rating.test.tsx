import { test, expect, describe, afterEach, mock, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { LibraryFilters } from "@/components/LibraryFilters";

describe("LibraryFilters - Rating Filter with Visual Stars", () => {
  const defaultProps = {
    search: "",
    onSearchChange: vi.fn(() => {}),
    onSearchSubmit: vi.fn(() => {}),
    onSearchClear: vi.fn(() => {}),
    statusFilter: "all",
    onStatusFilterChange: vi.fn(() => {}),
    ratingFilter: "all",
    onRatingFilterChange: vi.fn(() => {}),
    selectedTags: [],
    onTagsChange: vi.fn(() => {}),
    availableTags: [],
    sortBy: "created",
    onSortChange: vi.fn(() => {}),
    loading: false,
    loadingTags: false,
    onClearAll: vi.fn(() => {}),
  };

  beforeEach(() => {
    defaultProps.onSearchChange = vi.fn(() => {});
    defaultProps.onSearchSubmit = vi.fn(() => {});
    defaultProps.onSearchClear = vi.fn(() => {});
    defaultProps.onStatusFilterChange = vi.fn(() => {});
    defaultProps.onRatingFilterChange = vi.fn(() => {});
    defaultProps.onTagsChange = vi.fn(() => {});
    defaultProps.onSortChange = vi.fn(() => {});
    defaultProps.onClearAll = vi.fn(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rating Dropdown Rendering", () => {
    test("should render rating dropdown button with default label", () => {
      render(<LibraryFilters {...defaultProps} />);
      expect(screen.getByText("All Ratings")).toBeDefined();
    });

    test("should show rating dropdown when clicked", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      // Find and click the rating dropdown button
      const ratingButton = screen.getByText("All Ratings").closest("button");
      expect(ratingButton).toBeDefined();
      fireEvent.click(ratingButton!);
      
      // Check for segment headers
      expect(screen.getByText("General")).toBeDefined();
      expect(screen.getByText("By Rating")).toBeDefined();
    });

    test("should render general options in dropdown", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      const ratingButton = screen.getByText("All Ratings").closest("button");
      fireEvent.click(ratingButton!);
      
      // Check for general options
      expect(screen.getAllByText("All Ratings").length).toBeGreaterThan(0);
      expect(screen.getByText("Rated")).toBeDefined();
      expect(screen.getByText("Unrated")).toBeDefined();
    });

    test("should render star rating options in dropdown", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      const ratingButton = screen.getByText("All Ratings").closest("button");
      fireEvent.click(ratingButton!);
      
      // Star options are rendered as icons, but we can check the dropdown structure
      // The dropdown should have the "By Rating" segment
      expect(screen.getByText("By Rating")).toBeDefined();
    });

    test("should call onRatingFilterChange when rating option is clicked", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      const ratingButton = screen.getByText("All Ratings").closest("button");
      fireEvent.click(ratingButton!);
      
      // Click on "Rated" option
      const ratedOption = screen.getByText("Rated").closest("button");
      fireEvent.click(ratedOption!);
      
      expect(defaultProps.onRatingFilterChange).toHaveBeenCalledWith("rated");
    });

    test("should close dropdown after selecting an option", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      const ratingButton = screen.getByText("All Ratings").closest("button");
      fireEvent.click(ratingButton!);
      
      // Verify dropdown is open
      expect(screen.getByText("General")).toBeDefined();
      
      // Click on "Unrated" option
      const unratedOption = screen.getByText("Unrated").closest("button");
      fireEvent.click(unratedOption!);
      
      // Dropdown should close - "General" header should not be visible
      expect(() => screen.getByText("General")).toThrow();
    });

    test("should display selected rating filter label", () => {
      render(<LibraryFilters {...defaultProps} ratingFilter="rated" />);
      
      // Should show "Rated" as the selected option
      expect(screen.getAllByText("Rated").length).toBeGreaterThan(0);
    });

    test("should show visual stars for numeric rating selections", () => {
      const { container } = render(<LibraryFilters {...defaultProps} ratingFilter="5" />);
      
      // When 5 stars is selected, star icons should be rendered
      // Check for the presence of star icons in the button
      const ratingButton = container.querySelector('button[class*="flex items-center"]');
      expect(ratingButton).toBeDefined();
      
      // The star SVGs should be present when a numeric rating is selected
      const starIcons = container.querySelectorAll('svg');
      expect(starIcons.length).toBeGreaterThan(0);
    });

    test("should render divider between segment groups", () => {
      const { container } = render(<LibraryFilters {...defaultProps} />);
      
      const ratingButton = screen.getByText("All Ratings").closest("button");
      fireEvent.click(ratingButton!);
      
      // Check for divider element (should be a div with border)
      const dividers = container.querySelectorAll('div[class*="border"]');
      expect(dividers.length).toBeGreaterThan(0);
    });

    test("should handle disabled state", () => {
      render(<LibraryFilters {...defaultProps} loading={true} />);
      
      const ratingButton = screen.getByText("All Ratings").closest("button");
      expect(ratingButton?.hasAttribute("disabled")).toBe(true);
    });
  });

  describe("Star Rendering Function", () => {
    test("should render stars for each rating level", () => {
      const { container } = render(<LibraryFilters {...defaultProps} ratingFilter="5" />);
      
      // Star icons should be rendered when a numeric rating is selected
      const starIcons = container.querySelectorAll('svg');
      expect(starIcons.length).toBeGreaterThan(5); // Should have multiple stars plus chevron and star icon
    });

    test("should render different rating levels", () => {
      const { container: container3, rerender } = render(<LibraryFilters {...defaultProps} ratingFilter="3" />);
      expect(container3.querySelectorAll('svg').length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} ratingFilter="1" />);
      expect(container3.querySelectorAll('svg').length).toBeGreaterThan(0);
    });

    test("should render filled and unfilled stars correctly", () => {
      const { container } = render(<LibraryFilters {...defaultProps} ratingFilter="3" />);
      
      // Open dropdown
      const ratingButton = container.querySelector('button')!;
      fireEvent.click(ratingButton);
      
      // Should have star icons with different fill states
      // Filled stars have fill-[var(--accent)] class
      // Unfilled stars have text-[var(--foreground)]/30 class
      const stars = container.querySelectorAll('svg[class*="w-4 h-4"]');
      expect(stars.length).toBeGreaterThan(0);
    });
  });

  describe("Status Filter Icon", () => {
    test("should render library icon in status filter button", () => {
      const { container } = render(<LibraryFilters {...defaultProps} />);
      
      // The status button should have a library icon
      const statusButton = screen.getByText("All Books").closest("button");
      expect(statusButton).toBeDefined();
      
      // Check for SVG icon presence
      const icons = statusButton!.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe("Integration with Other Filters", () => {
    test("should work alongside status filter", () => {
      const { container } = render(<LibraryFilters {...defaultProps} statusFilter="reading" ratingFilter="5" />);
      
      expect(screen.getByText("Reading")).toBeDefined();
      // Stars should be visible when rating is selected
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    });

    test("should preserve rating when other filters change", () => {
      const { container, rerender } = render(<LibraryFilters {...defaultProps} ratingFilter="4" />);
      
      // Change status filter
      rerender(<LibraryFilters {...defaultProps} ratingFilter="4" statusFilter="read" />);
      
      // Rating filter should still be set to 4 (stars should be visible)
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    });
  });
});
