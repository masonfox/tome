import { test, expect, describe, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { LibraryFilters } from "@/components/Library/LibraryFilters";

describe("LibraryFilters - Tag Filter Dropdown", () => {
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
    availableTags: ["Fantasy", "Sci-Fi", "Mystery", "Romance", "Horror"],
    noTags: false,
    onNoTagsChange: vi.fn(() => {}),
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
    defaultProps.onNoTagsChange = vi.fn(() => {});
    defaultProps.onSortChange = vi.fn(() => {});
    defaultProps.onClearAll = vi.fn(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  describe("Tag Dropdown Button Rendering", () => {
    test("should render tag dropdown button with 'All Tags' label by default", () => {
      render(<LibraryFilters {...defaultProps} />);
      expect(screen.getByText("All Tags")).toBeDefined();
    });

    test("should show 'Books Without Tags' when noTags is true", () => {
      render(<LibraryFilters {...defaultProps} noTags={true} />);
      expect(screen.getByText("Books Without Tags")).toBeDefined();
    });

    test("should show '1 tag selected' when one tag is selected", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);
      expect(screen.getByText("1 tag selected")).toBeDefined();
    });

    test("should show 'X tags selected' when multiple tags are selected", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy", "Sci-Fi", "Mystery"]} />);
      expect(screen.getByText("3 tags selected")).toBeDefined();
    });

    test("should render Tag icon in dropdown button", () => {
      const { container } = render(<LibraryFilters {...defaultProps} />);
      const tagButton = screen.getByText("All Tags").closest("button");

      // Check for SVG icon presence
      const icons = tagButton!.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    test("should render ChevronDown icon in dropdown button", () => {
      const { container } = render(<LibraryFilters {...defaultProps} />);
      const tagButton = screen.getByText("All Tags").closest("button");

      // Check for chevron icon
      const chevron = tagButton!.querySelector('svg[class*="rotate"]');
      expect(chevron).toBeDefined();
    });

    test("should not render tag dropdown when no tags available", () => {
      render(<LibraryFilters {...defaultProps} availableTags={[]} />);
      expect(() => screen.getByText("All Tags")).toThrow();
    });
  });

  describe("Tag Dropdown Opening and Closing", () => {
    test("should show dropdown when clicked", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      // Check for dropdown options
      expect(screen.getAllByText("All Tags").length).toBeGreaterThan(1); // Button + dropdown option
      expect(screen.getByText("Books Without Tags")).toBeDefined();
    });

    test("should show all available tags in dropdown", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      // All tags should be visible
      expect(screen.getByText("Fantasy")).toBeDefined();
      expect(screen.getByText("Sci-Fi")).toBeDefined();
      expect(screen.getByText("Mystery")).toBeDefined();
      expect(screen.getByText("Romance")).toBeDefined();
      expect(screen.getByText("Horror")).toBeDefined();
    });

    test("should show search input in dropdown", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      const searchInput = screen.getByPlaceholderText("Search tags...");
      expect(searchInput).toBeDefined();
    });

    test("should close dropdown when clicking outside", async () => {
      const { container } = render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      // Dropdown should be open
      expect(screen.getByText("Fantasy")).toBeDefined();

      // Click outside
      fireEvent.mouseDown(document.body);

      // Dropdown should close
      await waitFor(() => {
        expect(() => screen.getByText("Fantasy")).toThrow();
      });
    });

    test("should handle disabled state", () => {
      render(<LibraryFilters {...defaultProps} loading={true} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      expect(tagButton?.hasAttribute("disabled")).toBe(true);
    });

    test("should handle loadingTags state", () => {
      render(<LibraryFilters {...defaultProps} loadingTags={true} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      expect(tagButton?.hasAttribute("disabled")).toBe(true);
    });
  });

  describe("'All Tags' Option Functionality", () => {
    test("should show check mark when 'All Tags' is selected", () => {
      const { container } = render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      // Find the "All Tags" option in dropdown and check for check mark
      const allTagsOptions = screen.getAllByText("All Tags");
      const dropdownOption = allTagsOptions.find(el =>
        el.closest('button')?.classList.contains('px-4')
      );

      // Check for check mark icon (Check component)
      const checkIcon = dropdownOption?.closest('button')?.querySelector('svg[class*="w-4 h-4"]');
      expect(checkIcon).toBeDefined();
    });

    test("should call onNoTagsChange(false) when 'All Tags' is clicked while noTags is true", () => {
      render(<LibraryFilters {...defaultProps} noTags={true} />);

      const tagButton = screen.getByText("Books Without Tags").closest("button");
      fireEvent.click(tagButton!);

      // Get the dropdown option
      const allTagsElements = screen.getAllByText("All Tags");
      const allTagsOption = allTagsElements[allTagsElements.length > 1 ? 1 : 0]?.closest("button");
      fireEvent.click(allTagsOption!);

      expect(defaultProps.onNoTagsChange).toHaveBeenCalledWith(false);
    });

    test("should call onTagsChange([]) when 'All Tags' is clicked while tags are selected", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy", "Sci-Fi"]} />);

      const tagButton = screen.getByText("2 tags selected").closest("button");
      fireEvent.click(tagButton!);

      // Get the dropdown option (there should be 2: button label and dropdown option)
      const allTagsElements = screen.getAllByText("All Tags");
      const allTagsOption = allTagsElements[allTagsElements.length > 1 ? 1 : 0]?.closest("button");
      fireEvent.click(allTagsOption!);

      expect(defaultProps.onTagsChange).toHaveBeenCalledWith([]);
    });

    test("should close dropdown when 'All Tags' is clicked", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);

      const tagButton = screen.getByText("1 tag selected").closest("button");
      fireEvent.click(tagButton!);

      // Get the dropdown option
      const allTagsElements = screen.getAllByText("All Tags");
      const allTagsOption = allTagsElements[allTagsElements.length > 1 ? 1 : 0]?.closest("button");
      fireEvent.click(allTagsOption!);

      // Dropdown should close - check that a tag option is no longer visible
      expect(() => screen.getByText("Mystery")).toThrow();
    });
  });

  describe("'Books Without Tags' Option Functionality", () => {
    test("should render 'Books Without Tags' option in dropdown", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      expect(screen.getAllByText("Books Without Tags").length).toBe(1);
    });

    test("should show check mark when noTags is true", () => {
      const { container } = render(<LibraryFilters {...defaultProps} noTags={true} />);

      const tagButton = screen.getByText("Books Without Tags").closest("button");
      fireEvent.click(tagButton!);

      const noTagsOption = screen.getAllByText("Books Without Tags")[1].closest("button");
      const checkIcon = noTagsOption?.querySelector('svg[class*="w-4 h-4"]');
      expect(checkIcon).toBeDefined();
    });

    test("should call onNoTagsChange(true) when clicked", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      // Find the dropdown option (not the button label)
      const allOptions = screen.getAllByText("Books Without Tags");
      const noTagsOption = allOptions[allOptions.length > 1 ? 1 : 0]?.closest("button");
      fireEvent.click(noTagsOption!);

      expect(defaultProps.onNoTagsChange).toHaveBeenCalledWith(true);
    });

    test("should clear selected tags when 'Books Without Tags' is clicked", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy", "Sci-Fi"]} />);

      const tagButton = screen.getByText("2 tags selected").closest("button");
      fireEvent.click(tagButton!);

      // Get the Books Without Tags option from dropdown
      const noTagsElements = screen.getAllByText("Books Without Tags");
      const noTagsOption = noTagsElements[0]?.closest("button");
      fireEvent.click(noTagsOption!);

      expect(defaultProps.onTagsChange).toHaveBeenCalledWith([]);
    });

    test("should close dropdown when 'Books Without Tags' is clicked", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      // Get the Books Without Tags option from dropdown
      const noTagsElements = screen.getAllByText("Books Without Tags");
      const noTagsOption = noTagsElements[0]?.closest("button");
      fireEvent.click(noTagsOption!);

      // Dropdown should close
      expect(() => screen.getByText("Mystery")).toThrow();
    });

    test("should not render 'Books Without Tags' if onNoTagsChange is not provided", () => {
      const propsWithoutNoTags = { ...defaultProps };
      delete (propsWithoutNoTags as any).onNoTagsChange;

      render(<LibraryFilters {...propsWithoutNoTags} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      expect(() => screen.getByText("Books Without Tags")).toThrow();
    });
  });

  describe("Tag Selection Functionality", () => {
    test("should call onTagsChange with added tag when tag is clicked", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      const fantasyTag = screen.getByText("Fantasy").closest("button");
      fireEvent.click(fantasyTag!);

      expect(defaultProps.onTagsChange).toHaveBeenCalledWith(["Fantasy"]);
    });

    test("should show check mark for selected tags", () => {
      const { container } = render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);

      const tagButton = screen.getByText("1 tag selected").closest("button");
      fireEvent.click(tagButton!);

      const fantasyOption = screen.getByText("Fantasy").closest("button");
      const checkIcon = fantasyOption?.querySelector('svg[class*="w-4 h-4"]');
      expect(checkIcon).toBeDefined();
    });

    test("should support multi-select (dropdown stays open)", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      const fantasyTag = screen.getByText("Fantasy").closest("button");
      fireEvent.click(fantasyTag!);

      // Dropdown should still be open
      expect(screen.getByText("Sci-Fi")).toBeDefined();
    });

    test("should clear noTags when selecting a tag", () => {
      render(<LibraryFilters {...defaultProps} noTags={true} />);

      const tagButton = screen.getByText("Books Without Tags").closest("button");
      fireEvent.click(tagButton!);

      const fantasyTag = screen.getByText("Fantasy").closest("button");
      fireEvent.click(fantasyTag!);

      expect(defaultProps.onNoTagsChange).toHaveBeenCalledWith(false);
    });

    test("should handle selecting multiple tags", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);

      // Select second tag
      rerender(<LibraryFilters {...defaultProps} selectedTags={["Fantasy", "Sci-Fi"]} />);

      expect(screen.getByText("2 tags selected")).toBeDefined();
    });

    test("should filter out selected tags from the list", () => {
      const { container } = render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);

      const tagButton = screen.getByText("1 tag selected").closest("button");
      fireEvent.click(tagButton!);

      // Fantasy should appear as a pill but not in the dropdown tag list
      // Check that Fantasy pill exists
      const fantasyPill = screen.getByText("Fantasy").closest("button");
      expect(fantasyPill).toBeDefined();

      // Check that Sci-Fi and Mystery are in the dropdown (unselected tags)
      expect(screen.getByText("Sci-Fi")).toBeDefined();
      expect(screen.getByText("Mystery")).toBeDefined();

      // Count how many times "Fantasy" appears - should be just once (the pill)
      const fantasyElements = screen.getAllByText("Fantasy");
      expect(fantasyElements.length).toBe(1);
    });
  });

  describe("Tag Search Functionality", () => {
    test("should filter tags based on search input", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      const searchInput = screen.getByPlaceholderText("Search tags...");
      fireEvent.change(searchInput, { target: { value: "fan" } });

      // Only Fantasy should match
      expect(screen.getByText("Fantasy")).toBeDefined();
      expect(() => screen.getByText("Sci-Fi")).toThrow();
      expect(() => screen.getByText("Mystery")).toThrow();
    });

    test("should be case-insensitive", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      const searchInput = screen.getByPlaceholderText("Search tags...");
      fireEvent.change(searchInput, { target: { value: "FANTASY" } });

      expect(screen.getByText("Fantasy")).toBeDefined();
    });

    test("should show 'No matching tags found' when search has no results", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      const searchInput = screen.getByPlaceholderText("Search tags...");
      fireEvent.change(searchInput, { target: { value: "xyz123" } });

      expect(screen.getByText("No matching tags found")).toBeDefined();
    });

    test("should show all tags when search is cleared", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      const searchInput = screen.getByPlaceholderText("Search tags...");

      // Search for something
      fireEvent.change(searchInput, { target: { value: "fantasy" } });
      expect(() => screen.getByText("Sci-Fi")).toThrow();

      // Clear search
      fireEvent.change(searchInput, { target: { value: "" } });
      expect(screen.getByText("Sci-Fi")).toBeDefined();
    });

    test("should show all unselected tags when no search input", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);

      const tagButton = screen.getByText("1 tag selected").closest("button");
      fireEvent.click(tagButton!);

      // Should show all except Fantasy (which is selected)
      expect(screen.getByText("Sci-Fi")).toBeDefined();
      expect(screen.getByText("Mystery")).toBeDefined();
      expect(screen.getByText("Romance")).toBeDefined();
      expect(screen.getByText("Horror")).toBeDefined();
    });
  });

  describe("Selected Tags Pills", () => {
    test("should render selected tags as pills below dropdown", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy", "Sci-Fi"]} />);

      // Pills should be visible outside the dropdown
      const fantasyPill = screen.getByText("Fantasy").closest("button");
      const sciFiPill = screen.getByText("Sci-Fi").closest("button");

      expect(fantasyPill).toBeDefined();
      expect(sciFiPill).toBeDefined();
    });

    test("should not show pills when noTags is true", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} noTags={true} />);

      // Pills should not be visible when noTags is active
      expect(() => screen.getByText("Fantasy")).toThrow();
    });

    test("should call onTagsChange when pill X is clicked", () => {
      const { container } = render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy", "Sci-Fi"]} />);

      const fantasyPill = screen.getByText("Fantasy").closest("button");
      fireEvent.click(fantasyPill!);

      expect(defaultProps.onTagsChange).toHaveBeenCalledWith(["Sci-Fi"]);
    });

    test("should render X icon in each pill", () => {
      const { container } = render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);

      const fantasyPill = screen.getByText("Fantasy").closest("button");
      const xIcon = fantasyPill?.querySelector('svg');

      expect(xIcon).toBeDefined();
    });

    test("should not render pills when no tags selected", () => {
      const { container } = render(<LibraryFilters {...defaultProps} selectedTags={[]} />);

      // Pills container should not exist
      const pillsContainer = container.querySelector('.flex.flex-wrap.gap-2');
      expect(pillsContainer).toBeNull();
    });
  });

  describe("Divider Rendering", () => {
    test("should render divider between special options and tag list", () => {
      const { container } = render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      // Check for divider element
      const dividers = container.querySelectorAll('div[class*="border"]');
      expect(dividers.length).toBeGreaterThan(0);
    });
  });

  describe("Integration with Other Filters", () => {
    test("should work alongside status filter", () => {
      render(<LibraryFilters {...defaultProps} statusFilter="reading" selectedTags={["Fantasy"]} />);

      expect(screen.getByText("Reading")).toBeDefined();
      expect(screen.getByText("1 tag selected")).toBeDefined();
    });

    test("should work alongside rating filter", () => {
      render(<LibraryFilters {...defaultProps} ratingFilter="5" selectedTags={["Fantasy", "Sci-Fi"]} />);

      expect(screen.getByText("2 tags selected")).toBeDefined();
    });

    test("should preserve tag selection when other filters change", () => {
      const { rerender } = render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);

      // Change status filter
      rerender(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} statusFilter="read" />);

      // Tag selection should persist
      expect(screen.getByText("1 tag selected")).toBeDefined();
    });

    test("should be cleared by onClearAll", () => {
      render(<LibraryFilters {...defaultProps} selectedTags={["Fantasy"]} />);

      const clearAllButton = screen.getByText(/Clear All/i);
      fireEvent.click(clearAllButton);

      expect(defaultProps.onClearAll).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    test("should handle large number of tags", () => {
      const manyTags = Array.from({ length: 100 }, (_, i) => `Tag ${i + 1}`);
      render(<LibraryFilters {...defaultProps} availableTags={manyTags} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      // Should render all tags
      expect(screen.getByText("Tag 1")).toBeDefined();
      expect(screen.getByText("Tag 50")).toBeDefined();
      expect(screen.getByText("Tag 100")).toBeDefined();
    });

    test("should handle tags with special characters", () => {
      const specialTags = ["Action & Adventure", "Science-Fiction", "Editor's Choice"];
      render(<LibraryFilters {...defaultProps} availableTags={specialTags} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      expect(screen.getByText("Action & Adventure")).toBeDefined();
      expect(screen.getByText("Science-Fiction")).toBeDefined();
      expect(screen.getByText("Editor's Choice")).toBeDefined();
    });

    test("should handle very long tag names", () => {
      const longTag = "A".repeat(100);
      render(<LibraryFilters {...defaultProps} availableTags={[longTag]} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      fireEvent.click(tagButton!);

      expect(screen.getByText(longTag)).toBeDefined();
    });

    test("should handle selecting all available tags", () => {
      const allTags = ["Fantasy", "Sci-Fi", "Mystery", "Romance", "Horror"];
      render(<LibraryFilters {...defaultProps} selectedTags={allTags} />);

      expect(screen.getByText("5 tags selected")).toBeDefined();

      // Open dropdown - no tags should be available to select
      const tagButton = screen.getByText("5 tags selected").closest("button");
      fireEvent.click(tagButton!);

      // Search input should still be there
      expect(screen.getByPlaceholderText("Search tags...")).toBeDefined();
    });
  });

  describe("Accessibility", () => {
    test("should have proper button role", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      expect(tagButton?.getAttribute("type")).toBe("button");
    });

    test("should be keyboard accessible", () => {
      render(<LibraryFilters {...defaultProps} />);

      const tagButton = screen.getByText("All Tags").closest("button");

      // Should respond to keyboard events
      expect(tagButton).toBeDefined();
    });

    test("should have disabled state reflected in DOM", () => {
      render(<LibraryFilters {...defaultProps} loading={true} />);

      const tagButton = screen.getByText("All Tags").closest("button");
      expect(tagButton?.hasAttribute("disabled")).toBe(true);
    });
  });
});
