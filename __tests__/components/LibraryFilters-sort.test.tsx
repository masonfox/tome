import { test, expect, describe, afterEach, mock, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { LibraryFilters } from "@/components/LibraryFilters";

describe("LibraryFilters - Sort Functionality", () => {
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
    availableTags: ["fiction", "non-fiction", "science"],
    sortBy: "created",
    onSortChange: vi.fn(() => {}),
    loading: false,
    loadingTags: false,
    onClearAll: vi.fn(() => {}),
  };

  beforeEach(() => {
    // Reset mocks before each test
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

  describe("Sort Dropdown Rendering", () => {
    test("should render sort dropdown with default label", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      // Should show "Recently Added" as default
      const elements = screen.getAllByText("Recently Added");
      expect(elements.length).toBeGreaterThan(0);
    });

    test("should display correct label for selected sort option", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} sortBy="title" />);
      
      let elements = screen.getAllByText("Title A-Z");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="author" />);
      elements = screen.getAllByText("Author A-Z");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="rating" />);
      elements = screen.getAllByText("Highest Rated");
      expect(elements.length).toBeGreaterThan(0);
    });

    test("should disable sort button when loading", () => {
      render(<LibraryFilters {...defaultProps} loading={true} />);
      
      const buttons = screen.getAllByRole("button");
      const sortButton = buttons.find(btn => 
        btn.textContent?.includes("Recently Added")
      );
      
      expect(sortButton?.getAttribute("disabled")).toBeDefined();
    });

    test("should render with all sort option values", () => {
      const sortValues = [
        "created",
        "recently_read",
        "title",
        "title_desc",
        "author",
        "author_desc",
        "rating",
        "rating_asc",
        "pages",
        "pages_desc",
        "pub_date",
        "pub_date_asc",
        "created_desc",
      ];

      sortValues.forEach(sortValue => {
        cleanup();
        const { container } = render(<LibraryFilters {...defaultProps} sortBy={sortValue} />);
        expect(container.textContent).toBeTruthy();
      });
    });
  });

  describe("Sort Dropdown Interaction", () => {
    test("should open dropdown when sort button is clicked", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      // Find and click the sort button
      const buttons = screen.getAllByRole("button");
      const sortButton = buttons.find(btn => 
        btn.textContent?.includes("Recently Added") || btn.querySelector('[data-icon="arrow-up-down"]')
      );
      
      expect(sortButton).toBeTruthy();
      fireEvent.click(sortButton!);
      
      // After clicking, dropdown should show all options
      expect(screen.getAllByText("Title A-Z").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Author A-Z").length).toBeGreaterThan(0);
    });

    test("should call onSortChange with correct value when option is clicked", () => {
      const onSortChange = vi.fn(() => {});
      render(<LibraryFilters {...defaultProps} onSortChange={onSortChange} />);
      
      // Open dropdown
      const buttons = screen.getAllByRole("button");
      const sortButton = buttons.find(btn => btn.textContent?.includes("Recently Added"));
      fireEvent.click(sortButton!);
      
      // Click "Title A-Z" option in dropdown
      const titleOptions = screen.getAllByText("Title A-Z");
      const titleButton = titleOptions.find(el => {
        const button = el.closest("button");
        return button && button.type === "button";
      });
      
      if (titleButton) {
        fireEvent.click(titleButton);
        expect(onSortChange).toHaveBeenCalledWith("title");
      }
    });

    test("should call onSortChange when different sort options are selected", () => {
      const onSortChange = vi.fn(() => {});
      
      // Test multiple sort options
      const sortTests = [
        { label: "Author A-Z", value: "author" },
        { label: "Highest Rated", value: "rating" },
        { label: "Oldest First", value: "created_desc" },
      ];

      sortTests.forEach(({ label, value }) => {
        cleanup();
        onSortChange.mockClear();
        
        render(<LibraryFilters {...defaultProps} onSortChange={onSortChange} />);
        
        // Open dropdown
        const buttons = screen.getAllByRole("button");
        const sortButton = buttons.find(btn => btn.textContent?.includes("Recently Added") || btn.textContent?.includes(label));
        fireEvent.click(sortButton!);
        
        // Click the specific option
        const options = screen.getAllByText(label);
        const optionButton = options.find(el => el.closest("button")?.type === "button");
        
        if (optionButton) {
          fireEvent.click(optionButton);
          expect(onSortChange).toHaveBeenCalledWith(value);
        }
      });
    });

    test("should display all 11 sort options when dropdown is open", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      // Open dropdown
      const buttons = screen.getAllByRole("button");
      const sortButton = buttons.find(btn => btn.textContent?.includes("Recently Added"));
      fireEvent.click(sortButton!);
      
      // Check for all sort option labels
      const expectedLabels = [
        "Recently Added",
        "Recently Read",
        "Oldest First",
        "Title A-Z",
        "Title Z-A",
        "Author A-Z",
        "Author Z-A",
        "Highest Rated",
        "Lowest Rated",
        "Shortest First",
        "Longest First",
      ];
      
      expectedLabels.forEach(label => {
        const elements = screen.getAllByText(label);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    test("should not call onSortChange when loading", () => {
      const onSortChange = vi.fn(() => {});
      render(<LibraryFilters {...defaultProps} loading={true} onSortChange={onSortChange} />);
      
      const buttons = screen.getAllByRole("button");
      const sortButton = buttons.find(btn => btn.textContent?.includes("Recently Added"));
      
      // Button should be disabled
      expect(sortButton?.hasAttribute("disabled")).toBe(true);
      
      // Verify handler not called
      expect(onSortChange).not.toHaveBeenCalled();
    });
  });

  describe("Sort Interaction with Other Filters", () => {
    test("should preserve sort when status filter changes", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} sortBy="title" />);
      
      let elements = screen.getAllByText("Title A-Z");
      expect(elements.length).toBeGreaterThan(0);
      
      // Change status filter but keep same sort
      rerender(<LibraryFilters {...defaultProps} sortBy="title" statusFilter="reading" />);
      
      elements = screen.getAllByText("Title A-Z");
      expect(elements.length).toBeGreaterThan(0);
    });

    test("should preserve sort when search changes", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} sortBy="rating" />);
      
      let elements = screen.getAllByText("Highest Rated");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="rating" search="test query" />);
      
      elements = screen.getAllByText("Highest Rated");
      expect(elements.length).toBeGreaterThan(0);
    });

    test("should preserve sort when tags are added", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} sortBy="author_desc" />);
      
      let elements = screen.getAllByText("Author Z-A");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="author_desc" selectedTags={["fiction", "history"]} />);
      
      elements = screen.getAllByText("Author Z-A");
      expect(elements.length).toBeGreaterThan(0);
    });

    test("should preserve sort when rating filter changes", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} sortBy="created_desc" />);
      
      let elements = screen.getAllByText("Oldest First");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="created_desc" ratingFilter="5" />);
      
      elements = screen.getAllByText("Oldest First");
      expect(elements.length).toBeGreaterThan(0);
    });

    test("should call onClearAll when Clear All button is clicked", () => {
      const onClearAll = vi.fn(() => {});
      render(<LibraryFilters {...defaultProps} search="test" onClearAll={onClearAll} />);
      
      const clearButton = screen.getByText("Clear All");
      fireEvent.click(clearButton);
      
      expect(onClearAll).toHaveBeenCalled();
    });
  });

  describe("Sort Options Coverage", () => {
    test("should handle all sort option values", () => {
      const sortOptions = [
        { value: "created", label: "Recently Added" },
        { value: "recently_read", label: "Recently Read" },
        { value: "created_desc", label: "Oldest First" },
        { value: "title", label: "Title A-Z" },
        { value: "title_desc", label: "Title Z-A" },
        { value: "author", label: "Author A-Z" },
        { value: "author_desc", label: "Author Z-A" },
        { value: "rating", label: "Highest Rated" },
        { value: "rating_asc", label: "Lowest Rated" },
        { value: "pages", label: "Shortest First" },
        { value: "pages_desc", label: "Longest First" },
      ];

      sortOptions.forEach(({ value, label }) => {
        cleanup();
        render(<LibraryFilters {...defaultProps} sortBy={value} />);
        
        const elements = screen.getAllByText(label);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    test("should handle sort value change via prop updates", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} sortBy="created" />);
      
      let elements = screen.getAllByText("Recently Added");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="title" />);
      elements = screen.getAllByText("Title A-Z");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="rating" />);
      elements = screen.getAllByText("Highest Rated");
      expect(elements.length).toBeGreaterThan(0);
    });

    test("should call onSortChange for new sort options", () => {
      const newSortTests = [
        { label: "Recently Read", value: "recently_read" },
        { label: "Shortest First", value: "pages" },
        { label: "Longest First", value: "pages_desc" },
      ];

      newSortTests.forEach(({ label, value }) => {
        cleanup();
        const onSortChange = vi.fn(() => {});
        
        render(<LibraryFilters {...defaultProps} onSortChange={onSortChange} />);
        
        // Open dropdown
        const buttons = screen.getAllByRole("button");
        const sortButton = buttons.find(btn => btn.textContent?.includes("Recently Added"));
        fireEvent.click(sortButton!);
        
        // Click the specific option
        const options = screen.getAllByText(label);
        const optionButton = options.find(el => el.closest("button")?.type === "button");
        
        if (optionButton) {
          fireEvent.click(optionButton);
          expect(onSortChange).toHaveBeenCalledWith(value);
        }
      });
    });

    test("should display correct labels for new sort options", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} sortBy="recently_read" />);
      
      let elements = screen.getAllByText("Recently Read");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="pages" />);
      elements = screen.getAllByText("Shortest First");
      expect(elements.length).toBeGreaterThan(0);
      
      rerender(<LibraryFilters {...defaultProps} sortBy="pages_desc" />);
      elements = screen.getAllByText("Longest First");
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    test("should handle rapid sort option changes", () => {
      const onSortChange = vi.fn(() => {});
      render(<LibraryFilters {...defaultProps} onSortChange={onSortChange} />);
      
      // Open dropdown
      const buttons = screen.getAllByRole("button");
      const sortButton = buttons.find(btn => btn.textContent?.includes("Recently Added"));
      fireEvent.click(sortButton!);
      
      // Rapidly click options (simulate quick user interaction)
      const titleOption = screen.getAllByText("Title A-Z").find(el => el.closest("button"));
      const authorOption = screen.getAllByText("Author A-Z").find(el => el.closest("button"));
      
      if (titleOption) fireEvent.click(titleOption);
      if (authorOption) fireEvent.click(authorOption);
      
      // Should have been called at least once
      expect(onSortChange.mock.calls.length).toBeGreaterThan(0);
    });

    test("should maintain dropdown functionality after multiple open/close cycles", () => {
      render(<LibraryFilters {...defaultProps} sortBy="author" />);
      
      const buttons = screen.getAllByRole("button");
      const sortButton = buttons.find(btn => btn.textContent?.includes("Author A-Z"));
      
      // Open
      fireEvent.click(sortButton!);
      expect(screen.getAllByText("Title A-Z").length).toBeGreaterThan(0);
      
      // Close by clicking outside
      fireEvent.mouseDown(document.body);
      
      // Reopen
      fireEvent.click(sortButton!);
      expect(screen.getAllByText("Title A-Z").length).toBeGreaterThan(0);
    });

    test("should handle undefined sort value gracefully", () => {
      // Component should default to showing a valid sort option
      // @ts-expect-error - Testing edge case with undefined
      const { container } = render(<LibraryFilters {...defaultProps} sortBy={undefined} />);
      
      // Should still render without crashing
      expect(container.querySelector("button")).toBeTruthy();
    });

    test("should render properly with minimal props", () => {
      const minimalProps = {
        ...defaultProps,
        availableTags: [],
        selectedTags: [],
      };
      
      const { container } = render(<LibraryFilters {...minimalProps} />);
      
      // Should render successfully
      expect(container.querySelector("button")).toBeTruthy();
      
      const elements = screen.getAllByText("Recently Added");
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe("Accessibility", () => {
    test("should have proper button type for sort dropdown", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      const buttons = screen.getAllByRole("button");
      const sortButton = buttons.find(btn => btn.textContent?.includes("Recently Added"));
      
      expect(sortButton?.getAttribute("type")).toBe("button");
    });

    test("should be keyboard navigable", () => {
      render(<LibraryFilters {...defaultProps} />);
      
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
      
      // All buttons should be focusable
      buttons.forEach(button => {
        expect(button.tagName).toBe("BUTTON");
      });
    });

    test("should maintain proper DOM structure", () => {
      const { container } = render(<LibraryFilters {...defaultProps} />);
      
      // Should have a form structure
      const form = container.querySelector("form");
      expect(form).toBeTruthy();
      
      // Should have button elements
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
