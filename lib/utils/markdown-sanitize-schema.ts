import { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

/**
 * Custom sanitize schema for ReactMarkdown that extends the default schema
 * to allow specific HTML elements that are safe and needed for rich text formatting.
 * 
 * Security considerations:
 * - Maintains XSS protection by using rehype-sanitize as the base
 * - Only allows specific whitelisted HTML tags with no dangerous attributes
 * - All user-generated content is still sanitized through this schema
 * 
 * Allowed additional HTML elements:
 * - <u>: Underline text (used by MDXEditor's BoldItalicUnderlineToggles)
 * 
 * The default schema already includes common safe elements like:
 * - Text formatting: <strong>, <em>, <code>, <del>, <s>
 * - Semantic: <p>, <h1>-<h6>, <blockquote>
 * - Lists: <ul>, <ol>, <li>
 * - Links: <a> (with href attribute restrictions)
 */
export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'u', // Underline text
  ],
  attributes: {
    ...defaultSchema.attributes,
    // Underline tag requires no attributes
    u: [],
  },
};
