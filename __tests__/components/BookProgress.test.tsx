import { test, expect, describe, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// MarkdownEditor is mocked globally in test-setup.ts

import BookProgress from "@/components/BookDetail/BookProgress";

afterEach(() => {
  cleanup();
});

describe("BookProgress", () => {
  const mockBook = {
    totalPages: 300,
    latestProgress: {
      currentPage: 100,
      currentPercentage: 33.33,
    },
  };

  test("should show page input when in page mode", () => {
    render(
      <BookProgress
        book={mockBook}
        currentPage="150"
        currentPercentage="50"
        progressInputMode="page"
        notes=""
        progressDate="2024-01-15"
        onCurrentPageChange={() => {}}
        onCurrentPercentageChange={() => {}}
        onNotesChange={() => {}}
        onProgressDateChange={() => {}}
        onProgressInputModeChange={() => {}}
        onSubmit={() => {}}
        showProgressModeDropdown={false}
        setShowProgressModeDropdown={() => {}}
      />
    );

    expect(screen.getByPlaceholderText("Current page")).toBeInTheDocument();
  });

  test("should show percentage input when in percentage mode", () => {
    render(
      <BookProgress
        book={mockBook}
        currentPage="150"
        currentPercentage="50"
        progressInputMode="percentage"
        notes=""
        progressDate="2024-01-15"
        onCurrentPageChange={() => {}}
        onCurrentPercentageChange={() => {}}
        onNotesChange={() => {}}
        onProgressDateChange={() => {}}
        onProgressInputModeChange={() => {}}
        onSubmit={() => {}}
        showProgressModeDropdown={false}
        setShowProgressModeDropdown={() => {}}
      />
    );

    expect(screen.getByPlaceholderText("Percentage")).toBeInTheDocument();
  });

  test("should render notes section with markdown editor", () => {
    render(
      <BookProgress
        book={mockBook}
        currentPage="100"
        currentPercentage="33.33"
        progressInputMode="page"
        notes="Great chapter!"
        progressDate="2024-01-15"
        onCurrentPageChange={() => {}}
        onCurrentPercentageChange={() => {}}
        onNotesChange={() => {}}
        onProgressDateChange={() => {}}
        onProgressInputModeChange={() => {}}
        onSubmit={() => {}}
        showProgressModeDropdown={false}
        setShowProgressModeDropdown={() => {}}
      />
    );

    // Check for the Notes label
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  test("should show mode toggle button", () => {
    render(
      <BookProgress
        book={mockBook}
        currentPage="100"
        currentPercentage="33.33"
        progressInputMode="page"
        notes=""
        progressDate="2024-01-15"
        onCurrentPageChange={() => {}}
        onCurrentPercentageChange={() => {}}
        onNotesChange={() => {}}
        onProgressDateChange={() => {}}
        onProgressInputModeChange={() => {}}
        onSubmit={() => {}}
        showProgressModeDropdown={false}
        setShowProgressModeDropdown={() => {}}
      />
    );

    expect(screen.getByText("Page")).toBeInTheDocument();
  });

  test("should render date input with correct value", () => {
    const { container } = render(
      <BookProgress
        book={mockBook}
        currentPage="100"
        currentPercentage="33.33"
        progressInputMode="page"
        notes=""
        progressDate="2024-01-15"
        onCurrentPageChange={() => {}}
        onCurrentPercentageChange={() => {}}
        onNotesChange={() => {}}
        onProgressDateChange={() => {}}
        onProgressInputModeChange={() => {}}
        onSubmit={() => {}}
        showProgressModeDropdown={false}
        setShowProgressModeDropdown={() => {}}
      />
    );

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    expect(dateInput.value).toBe("2024-01-15");
  });
});
