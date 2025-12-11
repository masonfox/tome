import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProgressHistory from "@/components/BookDetail/ProgressHistory";

afterEach(() => {
  cleanup();
});

describe("ProgressHistory", () => {
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
      <ProgressHistory
        progress={mockProgressEntries}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("Page 50")).toBeInTheDocument();
    expect(screen.getByText("Page 100")).toBeInTheDocument();
  });

  test("should display notes when present", () => {
    render(
      <ProgressHistory
        progress={mockProgressEntries}
        onEdit={() => {}}
      />
    );

    // Check for the markdown container with the notes
    const notesContainer = document.querySelector('.border-l-2.border-\\[var\\(--accent\\)\\]\\/30');
    expect(notesContainer).toBeInTheDocument();
  });

  test("should show pages read", () => {
    render(
      <ProgressHistory
        progress={mockProgressEntries}
        onEdit={() => {}}
      />
    );

    const pagesReadElements = screen.getAllByText(/\+50 pages/);
    expect(pagesReadElements.length).toBe(2);
  });

  test("should render empty state when no progress", () => {
    render(
      <ProgressHistory
        progress={[]}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("Current Progress History")).toBeInTheDocument();
  });

  test("should format dates correctly", () => {
    render(
      <ProgressHistory
        progress={mockProgressEntries}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
    expect(screen.getByText("Jan 2, 2024")).toBeInTheDocument();
  });
});
