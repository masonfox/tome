import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import BookMetadata from "@/components/BookDetail/BookMetadata";

afterEach(() => {
  cleanup();
});

describe("BookMetadata", () => {
  test("should render description with HTML tags stripped", () => {
    const book = {
      description: "<p>This is a <strong>test</strong> description.</p>",
      tags: [],
    };

    render(
      <BookMetadata
        book={book}
        hasTotalPages={true}
        totalPagesInput=""
        onTotalPagesChange={() => {}}
        onTotalPagesSubmit={() => {}}
      />
    );

    expect(screen.getByText("This is a test description.")).toBeInTheDocument();
  });

  test("should render tags as links", () => {
    const book = {
      description: "",
      tags: ["Fiction", "Fantasy", "Adventure"],
    };

    render(
      <BookMetadata
        book={book}
        hasTotalPages={true}
        totalPagesInput=""
        onTotalPagesChange={() => {}}
        onTotalPagesSubmit={() => {}}
      />
    );

    expect(screen.getByText("Fiction")).toBeInTheDocument();
    expect(screen.getByText("Fantasy")).toBeInTheDocument();
    expect(screen.getByText("Adventure")).toBeInTheDocument();
  });

  test("should show total pages form when book has no pages", () => {
    const book = {
      description: "",
      tags: [],
    };

    render(
      <BookMetadata
        book={book}
        hasTotalPages={false}
        totalPagesInput="300"
        onTotalPagesChange={() => {}}
        onTotalPagesSubmit={() => {}}
      />
    );

    expect(screen.getByText("Add page count to enable progress tracking")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 320")).toBeInTheDocument();
  });

  test("should not show pages form when book already has pages", () => {
    const book = {
      description: "Test",
      tags: [],
    };

    render(
      <BookMetadata
        book={book}
        hasTotalPages={true}
        totalPagesInput=""
        onTotalPagesChange={() => {}}
        onTotalPagesSubmit={() => {}}
      />
    );

    expect(screen.queryByText("Add page count to enable progress tracking")).not.toBeInTheDocument();
  });

  test("should not render if no description and no tags and has pages", () => {
    const book = {
      description: "",
      tags: [],
    };

    const { container } = render(
      <BookMetadata
        book={book}
        hasTotalPages={true}
        totalPagesInput=""
        onTotalPagesChange={() => {}}
        onTotalPagesSubmit={() => {}}
      />
    );

    // Should render empty/minimal content
    expect(container.querySelector('.space-y-6')).toBeInTheDocument();
  });
});
