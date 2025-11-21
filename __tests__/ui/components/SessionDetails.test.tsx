import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import SessionDetails from "@/components/BookDetail/SessionDetails";

afterEach(() => {
  cleanup();
});

describe("SessionDetails", () => {
  test("should render started date when not editing", () => {
    render(
      <SessionDetails
        startedDate="2024-01-01"
        isEditingStartDate={false}
        editStartDate=""
        onStartEditingDate={() => {}}
        onEditStartDateChange={() => {}}
        onCancelEdit={() => {}}
        onSaveStartDate={() => {}}
      />
    );

    expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
  });

  test("should show 'Not set' when no started date", () => {
    render(
      <SessionDetails
        startedDate={null}
        isEditingStartDate={false}
        editStartDate=""
        onStartEditingDate={() => {}}
        onEditStartDateChange={() => {}}
        onCancelEdit={() => {}}
        onSaveStartDate={() => {}}
      />
    );

    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  test("should show date input when editing", () => {
    render(
      <SessionDetails
        startedDate="2024-01-01"
        isEditingStartDate={true}
        editStartDate="2024-01-05"
        onStartEditingDate={() => {}}
        onEditStartDateChange={() => {}}
        onCancelEdit={() => {}}
        onSaveStartDate={() => {}}
      />
    );

    const input = screen.getByDisplayValue("2024-01-05") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("date");
  });

  test("should show Cancel and Save buttons when editing", () => {
    render(
      <SessionDetails
        startedDate="2024-01-01"
        isEditingStartDate={true}
        editStartDate="2024-01-05"
        onStartEditingDate={() => {}}
        onEditStartDateChange={() => {}}
        onCancelEdit={() => {}}
        onSaveStartDate={() => {}}
      />
    );

    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});
