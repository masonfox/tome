import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { markdownSanitizeSchema } from "@/lib/utils/markdown-sanitize-schema";
import { cn } from "@/utils/cn";

interface MarkdownRendererProps {
  /**
   * The markdown content to render
   */
  content: string;
  
  /**
   * Additional CSS classes to apply to the container
   * @default "prose prose-sm dark:prose-invert max-w-none"
   */
  className?: string;
}

/**
 * A centralized component for rendering markdown content with consistent
 * security and formatting across the application.
 * 
 * Security Features:
 * - Parses HTML tags using rehype-raw
 * - Sanitizes HTML to prevent XSS attacks using rehype-sanitize
 * - Only allows whitelisted safe HTML tags (bold, italic, underline, links, lists)
 * 
 * Formatting Features:
 * - GitHub Flavored Markdown (GFM) support
 * - Tailwind prose styling for consistent typography
 * - Dark mode support
 * 
 * @example
 * ```tsx
 * <MarkdownRenderer content="This is **bold** and <u>underlined</u>" />
 * ```
 */
export default function MarkdownRenderer({ 
  content, 
  className = "prose prose-sm dark:prose-invert max-w-none" 
}: MarkdownRendererProps) {
  return (
    <div className={cn("text-sm", className)}>
      <ReactMarkdown 
        rehypePlugins={[
          rehypeRaw,                                    // Parse HTML tags first
          [rehypeSanitize, markdownSanitizeSchema],     // Then sanitize for security
        ]}
        remarkPlugins={[remarkGfm]}                     // GitHub Flavored Markdown
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
