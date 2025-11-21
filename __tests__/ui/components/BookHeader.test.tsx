import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import BookHeader from "@/components/BookDetail/BookHeader";

afterEach(() => {
  cleanup();
});

describe("BookHeader", () => {
  const mockBook = {
    id: 123,
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    series: "Test Series #1",
    publisher: "Test Publisher",
    pubDate: "2024-01-01",
    totalPages: 300,
    totalReads: 2,
    tags: [],
  };

  test("should render book title and author", () => {
    render(
      <BookHeader
        book={mockBook}
        selectedStatus="to-read"
        imageError={false}
        onImageError={() => {}}
        onStatusChange={() => {}}
        onRatingClick={() => {}}
        onRereadClick={() => {}}
        showStatusDropdown={false}
        setShowStatusDropdown={() => {}}
        rating={null}
        hasCompletedReads={false}
        hasActiveSession={true}
      />
    );

    expect(screen.getByText("Test Book")).toBeInTheDocument();
    expect(screen.getByText("Test Author")).toBeInTheDocument();
  });

  test("should display series information", () => {
    render(
      <BookHeader
        book={mockBook}
        selectedStatus="to-read"
        imageError={false}
        onImageError={() => {}}
        onStatusChange={() => {}}
        onRatingClick={() => {}}
        onRereadClick={() => {}}
        showStatusDropdown={false}
        setShowStatusDropdown={() => {}}
        rating={null}
        hasCompletedReads={false}
        hasActiveSession={true}
      />
    );

    expect(screen.getByText("Test Series #1")).toBeInTheDocument();
  });

  test("should show total pages when available", () => {
    render(
      <BookHeader
        book={mockBook}
        selectedStatus="to-read"
        imageError={false}
        onImageError={() => {}}
        onStatusChange={() => {}}
        onRatingClick={() => {}}
        onRereadClick={() => {}}
        showStatusDropdown={false}
        setShowStatusDropdown={() => {}}
        rating={null}
        hasCompletedReads={false}
        hasActiveSession={true}
      />
    );

    expect(screen.getByText(/300 pages/)).toBeInTheDocument();
  });

  test("should show publisher and publication year", () => {
    render(
      <BookHeader
        book={mockBook}
        selectedStatus="to-read"
        imageError={false}
        onImageError={() => {}}
        onStatusChange={() => {}}
        onRatingClick={() => {}}
        onRereadClick={() => {}}
        showStatusDropdown={false}
        setShowStatusDropdown={() => {}}
        rating={null}
        hasCompletedReads={false}
        hasActiveSession={true}
      />
    );

    expect(screen.getByText("Test Publisher")).toBeInTheDocument();
    expect(screen.getByText(/Published 2024/)).toBeInTheDocument();
  });
});
