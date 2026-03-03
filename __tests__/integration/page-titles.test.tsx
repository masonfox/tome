import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

// Simple test component
function TestPage({ title }: { title?: string }) {
  usePageTitle(title);
  return <div>Test Page</div>;
}

describe("Page Title Integration Tests", () => {
  let originalTitle: string;

  beforeEach(() => {
    originalTitle = document.title;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  describe("static pages", () => {
    it("should render Dashboard title", () => {
      render(<TestPage title="Dashboard" />);
      expect(document.title).toBe("Tome - Dashboard");
    });

    it("should render Library title", () => {
      render(<TestPage title="Library" />);
      expect(document.title).toBe("Tome - Library");
    });

    it("should render Series title", () => {
      render(<TestPage title="Series" />);
      expect(document.title).toBe("Tome - Series");
    });

    it("should render Reading Statistics title", () => {
      render(<TestPage title="Reading Statistics" />);
      expect(document.title).toBe("Tome - Reading Statistics");
    });

    it("should render Reading Journal title", () => {
      render(<TestPage title="Reading Journal" />);
      expect(document.title).toBe("Tome - Reading Journal");
    });

    it("should render Reading Goals title", () => {
      render(<TestPage title="Reading Goals" />);
      expect(document.title).toBe("Tome - Reading Goals");
    });

    it("should render Read Next Queue title", () => {
      render(<TestPage title="Read Next Queue" />);
      expect(document.title).toBe("Tome - Read Next Queue");
    });

    it("should render Shelves title", () => {
      render(<TestPage title="Shelves" />);
      expect(document.title).toBe("Tome - Shelves");
    });

    it("should render Tags title", () => {
      render(<TestPage title="Tags" />);
      expect(document.title).toBe("Tome - Tags");
    });

    it("should render Reading Streak title", () => {
      render(<TestPage title="Reading Streak" />);
      expect(document.title).toBe("Tome - Reading Streak");
    });

    it("should render Settings title", () => {
      render(<TestPage title="Settings" />);
      expect(document.title).toBe("Tome - Settings");
    });

    it("should render Login title", () => {
      render(<TestPage title="Login" />);
      expect(document.title).toBe("Tome - Login");
    });
  });

  describe("dynamic pages", () => {
    it("should render book detail title with author", () => {
      const bookTitle = "The Fellowship of the Ring by J.R.R. Tolkien";
      render(<TestPage title={bookTitle} />);
      expect(document.title).toBe(`Tome - ${bookTitle}`);
    });

    it("should render book detail title without author", () => {
      const bookTitle = "Some Book";
      render(<TestPage title={bookTitle} />);
      expect(document.title).toBe(`Tome - ${bookTitle}`);
    });

    it("should render series detail title", () => {
      const seriesName = "The Lord of the Rings";
      render(<TestPage title={seriesName} />);
      expect(document.title).toBe(`Tome - ${seriesName}`);
    });

    it("should render shelf detail title", () => {
      const shelfName = "My Favorites";
      render(<TestPage title={shelfName} />);
      expect(document.title).toBe(`Tome - ${shelfName}`);
    });

    it("should handle loading state (undefined title)", () => {
      render(<TestPage title={undefined} />);
      expect(document.title).toBe("Tome");
    });

    it("should update from loading to loaded state", () => {
      const { rerender } = render(<TestPage title={undefined} />);
      expect(document.title).toBe("Tome");

      rerender(<TestPage title="The Fellowship of the Ring by J.R.R. Tolkien" />);
      expect(document.title).toBe("Tome - The Fellowship of the Ring by J.R.R. Tolkien");
    });
  });

  describe("navigation between pages", () => {
    it("should update title when navigating between pages", () => {
      const { rerender } = render(<TestPage title="Dashboard" />);
      expect(document.title).toBe("Tome - Dashboard");

      rerender(<TestPage title="Library" />);
      expect(document.title).toBe("Tome - Library");

      rerender(<TestPage title="The Fellowship of the Ring by J.R.R. Tolkien" />);
      expect(document.title).toBe("Tome - The Fellowship of the Ring by J.R.R. Tolkien");

      rerender(<TestPage title="Series" />);
      expect(document.title).toBe("Tome - Series");
    });

    it("should reset to Tome on unmount", () => {
      const { unmount } = render(<TestPage title="Dashboard" />);
      expect(document.title).toBe("Tome - Dashboard");

      unmount();
      expect(document.title).toBe("Tome");
    });

    it("should handle rapid navigation", () => {
      const { rerender } = render(<TestPage title="Dashboard" />);
      
      rerender(<TestPage title="Library" />);
      rerender(<TestPage title="Series" />);
      rerender(<TestPage title="Settings" />);
      rerender(<TestPage title="Dashboard" />);

      expect(document.title).toBe("Tome - Dashboard");
    });
  });

  describe("edge cases", () => {
    it("should handle titles with special characters", () => {
      const title = "Harry Potter & the Philosopher's Stone by J.K. Rowling";
      render(<TestPage title={title} />);
      expect(document.title).toBe(`Tome - ${title}`);
    });

    it("should handle titles with unicode characters", () => {
      const title = "Tokyo Ghoul Vol. 1 by 石田スイ";
      render(<TestPage title={title} />);
      expect(document.title).toBe(`Tome - ${title}`);
    });

    it("should handle titles with quotes", () => {
      const title = '"Surely You\'re Joking, Mr. Feynman!" by Richard Feynman';
      render(<TestPage title={title} />);
      expect(document.title).toBe(`Tome - ${title}`);
    });

    it("should handle titles with commas in authors", () => {
      const title = "10% Happier by Dan Harris, Jeffrey Warren, Carlye Adler";
      render(<TestPage title={title} />);
      expect(document.title).toBe(`Tome - ${title}`);
    });

    it("should handle very long titles", () => {
      const title = "A".repeat(200) + " by Author Name";
      render(<TestPage title={title} />);
      expect(document.title).toBe(`Tome - ${title}`);
    });
  });
});
