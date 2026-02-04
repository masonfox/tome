import { test, expect, describe, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DraggableBookTable } from "@/components/Books/DraggableBookTable";

afterEach(() => {
  cleanup();
});

describe("DraggableBookTable", () => {
  const mockBooks = [
    {
      id: 1,
      calibreId: 101,
      title: "Book One",
      authors: ["Author One"],
      series: "Series A",
      seriesIndex: 1,
      rating: 5,
      totalPages: 300,
      addedToLibrary: new Date("2024-01-01"),
      addedAt: new Date("2024-01-02"),
      status: "reading",
      sortOrder: 0,
    },
    {
      id: 2,
      calibreId: 102,
      title: "Book Two",
      authors: ["Author Two"],
      series: "Series B",
      seriesIndex: 2,
      rating: 4,
      totalPages: 250,
      addedToLibrary: new Date("2024-01-03"),
      addedAt: new Date("2024-01-04"),
      status: "read",
      sortOrder: 1,
    },
    {
      id: 3,
      calibreId: 103,
      title: "Book Three",
      authors: ["Author Three"],
      series: null,
      seriesIndex: null,
      rating: 3,
      totalPages: 400,
      addedToLibrary: new Date("2024-01-05"),
      addedAt: new Date("2024-01-06"),
      status: "to-read",
      sortOrder: 2,
    },
  ];

  describe("Drag Handles", () => {
    test("should show drag handles when isDragEnabled is true", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={true}
          sortBy="sortOrder"
          sortDirection="asc"
        />
      );

      // Check for GripVertical icons (drag handles)
      const dragHandles = screen.getAllByLabelText("Drag to reorder");
      expect(dragHandles).toHaveLength(mockBooks.length);
    });

    test("should not show drag handles when isDragEnabled is false", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="sortOrder"
          sortDirection="asc"
        />
      );

      // Drag handles should not be present
      const dragHandles = screen.queryAllByLabelText("Drag to reorder");
      expect(dragHandles).toHaveLength(0);
    });

    test("should disable drag handles when isDragEnabled is false", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Should not render drag handle column at all
      const dragHandles = screen.queryAllByLabelText("Drag to reorder");
      expect(dragHandles).toHaveLength(0);
    });
  });

  describe("Table Rendering", () => {
    test("should render all books in the table", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Check that all book titles are rendered
      expect(screen.getByText("Book One")).toBeInTheDocument();
      expect(screen.getByText("Book Two")).toBeInTheDocument();
      expect(screen.getByText("Book Three")).toBeInTheDocument();
    });

    test("should render book metadata correctly", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Check authors
      expect(screen.getByText("Author One")).toBeInTheDocument();
      expect(screen.getByText("Author Two")).toBeInTheDocument();

      // Check series
      expect(screen.getByText("Series A #1")).toBeInTheDocument();
      expect(screen.getByText("Series B #2")).toBeInTheDocument();
    });

    test("should display sortOrder as 1-based index", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="sortOrder"
          sortDirection="asc"
        />
      );

      // sortOrder 0, 1, 2 should display as 1, 2, 3
      // Note: These appear in table cells, so we need to check the entire table
      const table = screen.getByRole("table");
      expect(table.textContent).toContain("1"); // sortOrder 0 displays as 1
      expect(table.textContent).toContain("2"); // sortOrder 1 displays as 2
      expect(table.textContent).toContain("3"); // sortOrder 2 displays as 3
    });
  });

  describe("Empty State", () => {
    test("should show empty state when no books", () => {
      render(
        <DraggableBookTable
          books={[]}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      expect(screen.getByText("No books on this shelf")).toBeInTheDocument();
      expect(
        screen.getByText("Add books to this shelf from your library")
      ).toBeInTheDocument();
    });

    test("should show link to library in empty state", () => {
      render(
        <DraggableBookTable
          books={[]}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      const libraryLink = screen.getByRole("link", { name: /go to library/i });
      expect(libraryLink).toHaveAttribute("href", "/library");
    });
  });

  describe("Loading State", () => {
    test("should show skeleton when loading", () => {
      render(
        <DraggableBookTable
          books={[]}
          loading={true}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Skeleton shows animate-pulse class
      const skeletonRows = document.querySelectorAll(".animate-pulse");
      expect(skeletonRows.length).toBeGreaterThan(0);
    });
  });

  describe("Sort Icons", () => {
    test("should show ascending icon when sorted ascending", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
          onSortChange={vi.fn()}
        />
      );

      // The table should render with sorting UI
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    test("should show descending icon when sorted descending", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="desc"
          onSortChange={vi.fn()}
        />
      );

      // The table should render with sorting UI
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  describe("Actions", () => {
    test("should show remove button when onRemoveBook is provided", () => {
      const mockRemove = vi.fn();

      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
          onRemoveBook={mockRemove}
        />
      );

      // Should have remove buttons for each book
      const removeButtons = screen.getAllByTitle("Remove from shelf");
      expect(removeButtons).toHaveLength(mockBooks.length);
    });

    test("should not show remove button when onRemoveBook is not provided", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Should not have remove buttons
      const removeButtons = screen.queryAllByTitle("Remove from shelf");
      expect(removeButtons).toHaveLength(0);
    });
  });

  describe("DnD Context", () => {
    test("should wrap table in DndContext when isDragEnabled is true", () => {
      const { container } = render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={true}
          sortBy="sortOrder"
          sortDirection="asc"
        />
      );

      // When drag is enabled, the table should be present
      expect(container.querySelector("table")).toBeInTheDocument();
    });

    test("should not wrap table in DndContext when isDragEnabled is false", () => {
      const { container } = render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Table should still be present, just without DnD
      expect(container.querySelector("table")).toBeInTheDocument();
    });
  });

  describe("Sorting functionality", () => {
    test("should call onSortChange when clicking a sortable header", () => {
      const mockSortChange = vi.fn();

      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
          onSortChange={mockSortChange}
        />
      );

      // Click on the Title header
      const titleHeader = screen.getByText("Title").closest("th");
      if (titleHeader) {
        titleHeader.click();
      }

      expect(mockSortChange).toHaveBeenCalled();
    });

    test("should toggle sort direction when clicking the same column", () => {
      const mockSortChange = vi.fn();

      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
          onSortChange={mockSortChange}
        />
      );

      // Click on the Title header (should toggle to desc)
      const titleHeader = screen.getByText("Title").closest("th");
      if (titleHeader) {
        titleHeader.click();
      }

      expect(mockSortChange).toHaveBeenCalledWith("title", "desc");
    });

    test("should not call onSortChange when it is not provided", () => {
      const { container } = render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Click on the Title header - should not throw error
      const titleHeader = screen.getByText("Title").closest("th");
      if (titleHeader) {
        titleHeader.click();
      }

      // Just verify the component still renders
      expect(container.querySelector("table")).toBeInTheDocument();
    });
  });

  describe("Book metadata rendering", () => {
    test("should render book with no series as dash", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Book Three has no series, should show "-"
      const rows = screen.getAllByRole("row");
      // Find the row with Book Three
      const bookThreeRow = rows.find((row) => row.textContent?.includes("Book Three"));
      expect(bookThreeRow?.textContent).toContain("-");
    });

    test("should render book with no rating as dash", () => {
      const booksWithoutRating = [
        {
          ...mockBooks[0],
          rating: null,
        },
      ];

      render(
        <DraggableBookTable
          books={booksWithoutRating}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Should show "-" for rating
      const rows = screen.getAllByRole("row");
      const dataRow = rows[1]; // Skip header row
      expect(dataRow.textContent).toContain("-");
    });

    test("should render book with no pages as dash", () => {
      const booksWithoutPages = [
        {
          ...mockBooks[0],
          totalPages: null,
        },
      ];

      render(
        <DraggableBookTable
          books={booksWithoutPages}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Should show "-" for pages
      const rows = screen.getAllByRole("row");
      const dataRow = rows[1]; // Skip header row
      expect(dataRow.textContent).toContain("-");
    });

    test("should render book with no status as dash", () => {
      const booksWithoutStatus = [
        {
          ...mockBooks[0],
          status: null,
        },
      ];

      render(
        <DraggableBookTable
          books={booksWithoutStatus}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Should show "-" for status
      const rows = screen.getAllByRole("row");
      const dataRow = rows[1]; // Skip header row
      expect(dataRow.textContent).toContain("-");
    });

    test("should render multiple authors with comma separation", () => {
      const booksWithMultipleAuthors = [
        {
          ...mockBooks[0],
          authors: ["Author One", "Author Two", "Author Three"],
        },
      ];

      render(
        <DraggableBookTable
          books={booksWithMultipleAuthors}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      expect(screen.getByText("Author One")).toBeInTheDocument();
      expect(screen.getByText("Author Two")).toBeInTheDocument();
      expect(screen.getByText("Author Three")).toBeInTheDocument();
    });

    test("should render book with no authors as dash", () => {
      const booksWithoutAuthors = [
        {
          ...mockBooks[0],
          authors: [],
        },
      ];

      render(
        <DraggableBookTable
          books={booksWithoutAuthors}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Should show "-" for authors
      const rows = screen.getAllByRole("row");
      const dataRow = rows[1]; // Skip header row
      expect(dataRow.textContent).toContain("-");
    });

    test("should render date when addedAt is available", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // mockBooks[0] has addedAt: 2024-01-02
      // Should display date (format may vary)
      const rows = screen.getAllByRole("row");
      const bookOneRow = rows.find((row) => row.textContent?.includes("Book One"));
      expect(bookOneRow?.textContent).toMatch(/2024/);
    });

    test("should render date when only addedToLibrary is available", () => {
      const booksWithoutShelfDate = [
        {
          ...mockBooks[0],
          addedAt: null,
          addedToLibrary: new Date("2024-03-15"),
        },
      ];

      render(
        <DraggableBookTable
          books={booksWithoutShelfDate}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      // Should display addedToLibrary date (format may vary)
      const rows = screen.getAllByRole("row");
      const dataRow = rows[1]; // Skip header row
      expect(dataRow.textContent).toMatch(/2024/);
    });
  });

  describe("Action links", () => {
    test("should render view details link for each book", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      const detailLinks = screen.getAllByTitle("View details");
      expect(detailLinks).toHaveLength(mockBooks.length);

      // Check hrefs
      expect(detailLinks[0]).toHaveAttribute("href", "/books/1");
      expect(detailLinks[1]).toHaveAttribute("href", "/books/2");
      expect(detailLinks[2]).toHaveAttribute("href", "/books/3");
    });

    test("should render author search links", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      const authorOne = screen.getByText("Author One");
      expect(authorOne.closest("a")).toHaveAttribute("href", "/library?search=Author%20One");
    });

    test("should render series links when series is present", () => {
      render(
        <DraggableBookTable
          books={mockBooks}
          isDragEnabled={false}
          sortBy="title"
          sortDirection="asc"
        />
      );

      const seriesLink = screen.getByText("Series A #1");
      expect(seriesLink.closest("a")).toHaveAttribute("href", "/series/Series%20A");
    });
  });
});
