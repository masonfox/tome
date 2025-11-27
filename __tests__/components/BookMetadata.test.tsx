import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import BookMetadata from "@/components/BookDetail/BookMetadata";

afterEach(() => {
  cleanup();
});

describe("BookMetadata", () => {
  test("should show total pages form when book has no pages", () => {
    render(
      <BookMetadata
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
    const { container } = render(
      <BookMetadata
        hasTotalPages={true}
        totalPagesInput=""
        onTotalPagesChange={() => {}}
        onTotalPagesSubmit={() => {}}
      />
    );

    expect(screen.queryByText("Add page count to enable progress tracking")).not.toBeInTheDocument();
    // Component returns null when hasTotalPages is true
    expect(container.firstChild).toBeNull();
  });

  test("should render input with correct value", () => {
    render(
      <BookMetadata
        hasTotalPages={false}
        totalPagesInput="450"
        onTotalPagesChange={() => {}}
        onTotalPagesSubmit={() => {}}
      />
    );

    const input = screen.getByPlaceholderText("e.g. 320") as HTMLInputElement;
    expect(input.value).toBe("450");
  });
});
