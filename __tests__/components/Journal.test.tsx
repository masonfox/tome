import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import Journal from "@/components/BookDetail/Journal";

// NOTE: We let MarkdownRenderer render for real in these tests
// This ensures no global mock pollution affects MarkdownRenderer's own tests

afterEach(() => {
  cleanup();
});

describe("Journal", () => {
  const mockProgressEntries = [
    {
      id: 1,
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: "2024-01-01T00:00:00Z",
      pagesRead: 50,
      notes: "Great start!",
    },
    {
      id: 2,
      currentPage: 100,
      currentPercentage: 33.33,
      progressDate: "2024-01-02T00:00:00Z",
      pagesRead: 50,
      notes: "",
    },
  ];

  test("should render progress entries", () => {
    render(
      <Journal
        progress={mockProgressEntries}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  test("should display notes when present", () => {
    render(
      <Journal
        progress={mockProgressEntries}
        onEdit={() => {}}
      />
    );

    // Check for the markdown preview with notes
    expect(screen.getByText("Great start!")).toBeInTheDocument();
  });

  test("should show pages read", () => {
    render(
      <Journal
        progress={mockProgressEntries}
        onEdit={() => {}}
      />
    );

    const pagesReadElements = screen.getAllByText(/50 pages/);
    expect(pagesReadElements.length).toBe(2);
  });

  test("should render empty state when no progress", () => {
    render(
      <Journal
        progress={[]}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("Journal")).toBeInTheDocument();
    expect(screen.getByText("No progress logged yet")).toBeInTheDocument();
  });

  test("should format dates correctly", () => {
    render(
      <Journal
        progress={mockProgressEntries}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
    expect(screen.getByText("Jan 2, 2024")).toBeInTheDocument();
  });
});
