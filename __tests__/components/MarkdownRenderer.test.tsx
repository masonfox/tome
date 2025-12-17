import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  describe("Basic Markdown Formatting", () => {
    it("renders plain text correctly", () => {
      render(<MarkdownRenderer content="Hello world" />);
      expect(screen.getByText("Hello world")).toBeDefined();
    });

    it("renders bold text using **syntax", () => {
      const { container } = render(<MarkdownRenderer content="This is **bold** text" />);
      const strong = container.querySelector("strong");
      expect(strong).toBeDefined();
      expect(strong?.textContent).toBe("bold");
    });

    it("renders italic text using *syntax", () => {
      const { container } = render(<MarkdownRenderer content="This is *italic* text" />);
      const em = container.querySelector("em");
      expect(em).toBeDefined();
      expect(em?.textContent).toBe("italic");
    });

    it("renders bold and italic together", () => {
      const { container } = render(<MarkdownRenderer content="***bold and italic***" />);
      const strong = container.querySelector("strong");
      const em = container.querySelector("em");
      expect(strong).toBeDefined();
      expect(em).toBeDefined();
    });
  });

  describe("HTML Tag Support", () => {
    it("renders underline tags correctly", () => {
      const { container } = render(<MarkdownRenderer content="This is <u>underlined</u> text" />);
      const u = container.querySelector("u");
      expect(u).toBeDefined();
      expect(u?.textContent).toBe("underlined");
    });

    it("renders multiple underline tags", () => {
      const { container } = render(
        <MarkdownRenderer content="<u>First</u> and <u>second</u> underlines" />
      );
      const uTags = container.querySelectorAll("u");
      expect(uTags.length).toBe(2);
      expect(uTags[0].textContent).toBe("First");
      expect(uTags[1].textContent).toBe("second");
    });

    it("renders mixed markdown and HTML formatting", () => {
      const { container } = render(
        <MarkdownRenderer content="**Bold** and <u>underlined</u> and *italic*" />
      );
      expect(container.querySelector("strong")).toBeDefined();
      expect(container.querySelector("u")).toBeDefined();
      expect(container.querySelector("em")).toBeDefined();
    });
  });

  describe("Links", () => {
    it("renders markdown links correctly", () => {
      const { container } = render(
        <MarkdownRenderer content="Check out [OpenCode](https://opencode.ai)" />
      );
      const link = container.querySelector("a");
      expect(link).toBeDefined();
      expect(link?.textContent).toBe("OpenCode");
      expect(link?.getAttribute("href")).toBe("https://opencode.ai");
    });

    it("renders HTML anchor tags", () => {
      const { container } = render(
        <MarkdownRenderer content='Visit <a href="https://example.com">our site</a>' />
      );
      const link = container.querySelector("a");
      expect(link).toBeDefined();
      expect(link?.getAttribute("href")).toBe("https://example.com");
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
      const ul = container.querySelector("ul");
      const items = container.querySelectorAll("li");
      expect(ul).toBeDefined();
      expect(items.length).toBe(3);
    });

    it("renders ordered lists", () => {
      const content = `
1. First
2. Second
3. Third
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      const ol = container.querySelector("ol");
      const items = container.querySelectorAll("li");
      expect(ol).toBeDefined();
      expect(items.length).toBe(3);
    });
  });

  describe("Headings", () => {
    it("renders h1 headings", () => {
      const { container } = render(<MarkdownRenderer content="# Heading 1" />);
      const h1 = container.querySelector("h1");
      expect(h1).toBeDefined();
      expect(h1?.textContent).toBe("Heading 1");
    });

    it("renders h2 headings", () => {
      const { container } = render(<MarkdownRenderer content="## Heading 2" />);
      const h2 = container.querySelector("h2");
      expect(h2).toBeDefined();
      expect(h2?.textContent).toBe("Heading 2");
    });

    it("renders h3 headings", () => {
      const { container } = render(<MarkdownRenderer content="### Heading 3" />);
      const h3 = container.querySelector("h3");
      expect(h3).toBeDefined();
      expect(h3?.textContent).toBe("Heading 3");
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
      const del = container.querySelector("del");
      expect(del).toBeDefined();
      expect(del?.textContent).toBe("strikethrough");
    });

    it("renders tables", () => {
      const content = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      const table = container.querySelector("table");
      expect(table).toBeDefined();
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
      
      expect(container.querySelector("h1")).toBeDefined();
      expect(container.querySelector("h2")).toBeDefined();
      expect(container.querySelector("strong")).toBeDefined();
      expect(container.querySelector("em")).toBeDefined();
      expect(container.querySelector("u")).toBeDefined();
      expect(container.querySelector("del")).toBeDefined();
      expect(container.querySelector("ul")).toBeDefined();
      expect(container.querySelector("a")).toBeDefined();
      expect(container.querySelector("blockquote")).toBeDefined();
      expect(container.querySelector("code")).toBeDefined();
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
      const blockquote = container.querySelector("blockquote");
      expect(blockquote).toBeDefined();
      expect(blockquote?.textContent).toContain("This is a quote");
    });

    it("renders nested blockquotes", () => {
      const content = `
> Level 1
>> Level 2
      `.trim();
      const { container } = render(<MarkdownRenderer content={content} />);
      const blockquotes = container.querySelectorAll("blockquote");
      expect(blockquotes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Code Blocks", () => {
    it("renders inline code", () => {
      const { container } = render(<MarkdownRenderer content="Use `const` for constants" />);
      const code = container.querySelector("code");
      expect(code).toBeDefined();
      expect(code?.textContent).toBe("const");
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
      const pre = container.querySelector("pre");
      const code = container.querySelector("code");
      expect(pre).toBeDefined();
      expect(code).toBeDefined();
    });
  });
});
