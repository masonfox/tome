import { test, expect, describe, afterEach, mock } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import BookHeader from "@/components/BookDetail/BookHeader";

// Mock Next.js Image component
mock.module("next/image", () => ({
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

  test("should render status dropdown with current status", () => {
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
        hasActiveSession={false}
      />
    );

    expect(screen.getByText("Want to Read")).toBeInTheDocument();
  });

  test("should show rating display when book has rating", () => {
    render(
      <BookHeader
        book={mockBook}
        selectedStatus="read"
        imageError={false}
        onImageError={() => {}}
        onStatusChange={() => {}}
        onRatingClick={() => {}}
        onRereadClick={() => {}}
        showStatusDropdown={false}
        setShowStatusDropdown={() => {}}
        rating={4}
        hasCompletedReads={true}
        hasActiveSession={false}
      />
    );

    expect(screen.getByText("4 stars")).toBeInTheDocument();
  });

  test("should show re-read button when book has completed reads and no active session", () => {
    render(
      <BookHeader
        book={mockBook}
        selectedStatus="read"
        imageError={false}
        onImageError={() => {}}
        onStatusChange={() => {}}
        onRatingClick={() => {}}
        onRereadClick={() => {}}
        showStatusDropdown={false}
        setShowStatusDropdown={() => {}}
        rating={null}
        hasCompletedReads={true}
        hasActiveSession={false}
      />
    );

    expect(screen.getByText("Start Re-reading")).toBeInTheDocument();
  });

  test("should not show re-read button when book has active session", () => {
    render(
      <BookHeader
        book={mockBook}
        selectedStatus="reading"
        imageError={false}
        onImageError={() => {}}
        onStatusChange={() => {}}
        onRatingClick={() => {}}
        onRereadClick={() => {}}
        showStatusDropdown={false}
        setShowStatusDropdown={() => {}}
        rating={null}
        hasCompletedReads={true}
        hasActiveSession={true}
      />
    );

    expect(screen.queryByText("Start Re-reading")).not.toBeInTheDocument();
  });
});
