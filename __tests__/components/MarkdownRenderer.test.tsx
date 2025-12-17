import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { render, screen, cleanup, within } from "@testing-library/react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  // Ensure cleanup before and after each test
  beforeEach(() => {
    cleanup();
  });
  
  afterEach(() => {
    cleanup();
  });
  describe("Basic Markdown Formatting", () => {
    it("renders plain text correctly", () => {
      const { container } = render(<MarkdownRenderer content="Hello world" />);
      expect(within(container).getByText("Hello world")).toBeDefined();
    });

    it("renders bold text using **syntax", () => {
      const { container } = render(<MarkdownRenderer content="This is **bold** text" />);
      const boldText = within(container).getByText("bold");
      expect(boldText.tagName.toLowerCase()).toBe("strong");
    });

    it("renders italic text using *syntax", () => {
      const { container } = render(<MarkdownRenderer content="This is *italic* text" />);
      const italicText = within(container).getByText("italic");
      expect(italicText.tagName.toLowerCase()).toBe("em");
    });

    it("renders bold and italic together", () => {
      const { container } = render(<MarkdownRenderer content="***bold and italic***" />);
      const text = within(container).getByText("bold and italic");
      // Should be wrapped in both em and strong tags
      expect(text.tagName.toLowerCase()).toMatch(/em|strong/);
    });
  });

  describe("HTML Tag Support", () => {
    it("renders underline tags correctly", () => {
      const { container } = render(<MarkdownRenderer content="This is <u>underlined</u> text" />);
      const underlinedText = within(container).getByText("underlined");
      expect(underlinedText.tagName.toLowerCase()).toBe("u");
    });

    it("renders multiple underline tags", () => {
      const { container } = render(<MarkdownRenderer content="<u>First</u> and <u>second</u> underlines" />);
      const first = within(container).getByText("First");
      const second = within(container).getByText("second");
      expect(first.tagName.toLowerCase()).toBe("u");
      expect(second.tagName.toLowerCase()).toBe("u");
    });

    it("renders mixed markdown and HTML formatting", () => {
      const { container } = render(<MarkdownRenderer content="**Bold** and <u>underlined</u> and *italic*" />);
      expect(within(container).getByText("Bold").tagName.toLowerCase()).toBe("strong");
      expect(within(container).getByText("underlined").tagName.toLowerCase()).toBe("u");
      expect(within(container).getByText("italic").tagName.toLowerCase()).toBe("em");
    });
  });

  describe("Links", () => {
    it("renders markdown links correctly", () => {
      const { container } = render(<MarkdownRenderer content="Check out [OpenCode](https://opencode.ai)" />);
      const link = within(container).getByText("OpenCode");
      expect(link.tagName.toLowerCase()).toBe("a");
      expect(link.getAttribute("href")).toBe("https://opencode.ai");
    });

    it("renders HTML anchor tags", () => {
      const { container } = render(<MarkdownRenderer content='Visit <a href="https://example.com">our site</a>' />);
      const link = within(container).getByText("our site");
      expect(link.tagName.toLowerCase()).toBe("a");
      expect(link.getAttribute("href")).toBe("https://example.com");
    });
  });

  describe("Lists", () => {
    it("renders unordered lists", () => {
      const content = `
- Item 1
- Item 2
- Item 3
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      expect(within(container).getByText("Item 1")).toBeDefined();
      expect(within(container).getByText("Item 2")).toBeDefined();
      expect(within(container).getByText("Item 3")).toBeDefined();
    });

    it("renders ordered lists", () => {
      const content = `
1. First
2. Second
3. Third
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      expect(within(container).getByText("First")).toBeDefined();
      expect(within(container).getByText("Second")).toBeDefined();
      expect(within(container).getByText("Third")).toBeDefined();
    });
  });

  describe("Headings", () => {
    it("renders h1 headings", () => {
      const { container } = render(<MarkdownRenderer content="# Heading 1" />);
      const heading = within(container).getByText("Heading 1");
      expect(heading.tagName.toLowerCase()).toBe("h1");
    });

    it("renders h2 headings", () => {
      const { container } = render(<MarkdownRenderer content="## Heading 2" />);
      const heading = within(container).getByText("Heading 2");
      expect(heading.tagName.toLowerCase()).toBe("h2");
    });

    it("renders h3 headings", () => {
      const { container } = render(<MarkdownRenderer content="### Heading 3" />);
      const heading = within(container).getByText("Heading 3");
      expect(heading.tagName.toLowerCase()).toBe("h3");
    });
  });

  describe("Security - XSS Prevention", () => {
    it("sanitizes script tags", () => {
      const { container } = render(
        <MarkdownRenderer content="<script>alert('xss')</script>Safe content" />
      );
      const script = container.querySelector("script");
      expect(script).toBeNull();
      expect(container.textContent).toContain("Safe content");
    });

    it("sanitizes onclick attributes", () => {
      const content = `<div onclick="alert('xss')">Click me</div>`;
      const { container } = render(<MarkdownRenderer content={content} />);
      const div = container.querySelector("div");
      // The div might be sanitized completely or the onclick removed
      if (div) {
        expect(div.getAttribute("onclick")).toBeNull();
      }
    });

    it("sanitizes onerror in img tags", () => {
      const content = `<img src="x" onerror="alert('xss')" />`;
      const { container } = render(<MarkdownRenderer content={content} />);
      const img = container.querySelector("img");
      if (img) {
        expect(img.getAttribute("onerror")).toBeNull();
      }
    });

    it("sanitizes javascript: protocol in links", () => {
      const content = `<a href="javascript:alert('xss')">Click</a>`;
      const { container } = render(<MarkdownRenderer content={content} />);
      const link = container.querySelector("a");
      if (link) {
        const href = link.getAttribute("href");
        // href should either be null (sanitized) or not contain javascript:
        if (href) {
          expect(href).not.toContain("javascript:");
        }
      }
    });

    it("sanitizes style tags", () => {
      const { container } = render(
        <MarkdownRenderer content="<style>body { background: red; }</style>Safe" />
      );
      const style = container.querySelector("style");
      expect(style).toBeNull();
    });

    it("sanitizes iframe tags", () => {
      const { container } = render(
        <MarkdownRenderer content='<iframe src="https://evil.com"></iframe>Safe' />
      );
      const iframe = container.querySelector("iframe");
      expect(iframe).toBeNull();
    });
  });

  describe("GitHub Flavored Markdown (GFM)", () => {
    it("renders strikethrough text", () => {
      const { container } = render(<MarkdownRenderer content="~~strikethrough~~" />);
      const strikeText = within(container).getByText("strikethrough");
      expect(strikeText.tagName.toLowerCase()).toBe("del");
    });

    it("renders tables", () => {
      const content = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      expect(within(container).getByText("Header 1")).toBeDefined();
      expect(within(container).getByText("Cell 1")).toBeDefined();
    });

    it("renders task lists", () => {
      const content = `
- [x] Completed task
- [ ] Incomplete task
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
    });
  });

  describe("Custom className", () => {
    it("applies custom className when provided", () => {
      const { container } = render(
        <MarkdownRenderer content="Test" className="custom-class" />
      );
      const div = container.querySelector("div");
      expect(div?.className).toContain("custom-class");
    });

    it("applies default prose classes when no className provided", () => {
      const { container } = render(<MarkdownRenderer content="Test" />);
      const div = container.querySelector("div");
      expect(div?.className).toContain("prose");
      expect(div?.className).toContain("prose-sm");
    });
  });

  describe("Complex Content", () => {
    it("renders complex markdown with multiple formatting types", () => {
      const content = `
# Main Heading

This is a paragraph with **bold**, *italic*, <u>underline</u>, and ~~strikethrough~~.

## Subheading

- List item 1
- List item 2 with [a link](https://example.com)

> This is a blockquote

Some \`inline code\` here.
      `.trim();

      const { container } = render(<MarkdownRenderer content={content} />);
      
      expect(within(container).getByText("Main Heading").tagName.toLowerCase()).toBe("h1");
      expect(within(container).getByText("Subheading").tagName.toLowerCase()).toBe("h2");
      expect(within(container).getByText("bold").tagName.toLowerCase()).toBe("strong");
      expect(within(container).getByText("italic").tagName.toLowerCase()).toBe("em");
      expect(within(container).getByText("underline").tagName.toLowerCase()).toBe("u");
      expect(within(container).getByText("strikethrough").tagName.toLowerCase()).toBe("del");
      expect(within(container).getByText("a link").tagName.toLowerCase()).toBe("a");
      expect(within(container).getByText("inline code").tagName.toLowerCase()).toBe("code");
      expect(within(container).getByText("This is a blockquote")).toBeDefined();
    });

    it("handles empty content gracefully", () => {
      const { container } = render(<MarkdownRenderer content="" />);
      expect(container).toBeDefined();
    });

    it("handles whitespace-only content", () => {
      const { container } = render(<MarkdownRenderer content="   \n\n   " />);
      expect(container).toBeDefined();
    });
  });

  describe("Blockquotes", () => {
    it("renders blockquotes correctly", () => {
      const { container } = render(<MarkdownRenderer content="> This is a quote" />);
      const quote = within(container).getByText("This is a quote");
      expect(quote).toBeDefined();
    });

    it("renders nested blockquotes", () => {
      const content = `
> Level 1
>> Level 2
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      expect(within(container).getByText(/Level 1/)).toBeDefined();
      expect(within(container).getByText(/Level 2/)).toBeDefined();
    });
  });

  describe("Code Blocks", () => {
    it("renders inline code", () => {
      const { container } = render(<MarkdownRenderer content="Use `const` for constants" />);
      const code = within(container).getByText("const");
      expect(code.tagName.toLowerCase()).toBe("code");
    });

    it("renders code blocks", () => {
      const content = `
\`\`\`
function hello() {
  return "world";
}
\`\`\`
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      expect(within(container).getByText(/function hello/)).toBeDefined();
    });
  });
});
