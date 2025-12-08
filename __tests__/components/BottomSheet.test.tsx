import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BottomSheet } from "@/components/BottomSheet";

afterEach(() => {
  cleanup();
});

describe("BottomSheet", () => {
  test("should not render when closed", () => {
    render(
      <BottomSheet isOpen={false} onClose={() => {}}>
        <div>Test Content</div>
      </BottomSheet>
    );

    expect(screen.queryByText("More")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Content")).not.toBeInTheDocument();
  });

  test("should render when open", () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}}>
        <div>Test Content</div>
      </BottomSheet>
    );

    expect(screen.getByText("More")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("should focus close button when opened", async () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}}>
        <div>Test Content</div>
      </BottomSheet>
    );

    const closeButton = screen.getByLabelText("Close");
    
    // Wait for the focus to be applied (100ms timeout in component)
    await waitFor(
      () => {
        expect(closeButton).toHaveFocus();
      },
      { timeout: 200 }
    );
  });

  test("should render backdrop", () => {
    const { container } = render(
      <BottomSheet isOpen={true} onClose={() => {}}>
        <div>Test Content</div>
      </BottomSheet>
    );

    // Check for backdrop element with the expected classes
    const backdrop = container.querySelector(".fixed.inset-0.bg-black");
    expect(backdrop).toBeInTheDocument();
  });
});
