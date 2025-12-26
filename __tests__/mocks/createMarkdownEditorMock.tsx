import { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";

/**
 * Shared MarkdownEditor mock for all tests.
 *
 * This mock provides a simple textarea-based implementation that works for all test scenarios:
 * - MarkdownEditor component tests (comprehensive prop testing)
 * - FinishBookModal tests (simple textarea interaction)
 * - Any other component that uses MarkdownEditor
 *
 * Features:
 * - Supports all MarkdownEditor props (value, onChange, placeholder, height, id, autoFocus)
 * - Implements forwardRef with MDXEditorMethods interface
 * - Handles both `ref` and `editorRef` props (for dynamic loading)
 * - Provides dual testids for flexibility
 */

interface MarkdownEditorMockProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  id?: string;
  autoFocus?: boolean;
  editorRef?: React.ForwardedRef<MDXEditorMethods> | null;
}

export const MarkdownEditorMock = forwardRef<MDXEditorMethods, MarkdownEditorMockProps>(
  ({ value, onChange, placeholder, height, id, autoFocus, editorRef }, ref) => {
    const [internalValue, setInternalValue] = useState(value);

    // Forward the ref or editorRef (the actual component uses editorRef when loaded via next/dynamic)
    const actualRef = editorRef || ref;

    // Sync internal value with prop value (for controlled component behavior)
    useEffect(() => {
      if (value !== internalValue) {
        setInternalValue(value);
      }
    }, [value]);

    useImperativeHandle(actualRef, () => ({
      setMarkdown: (markdown: string) => {
        setInternalValue(markdown);
        onChange(markdown);
      },
      getMarkdown: () => internalValue,
      focus: () => {},
      insertMarkdown: () => {},
      getContentEditableHTML: () => internalValue,
      getSelectionMarkdown: () => "",
    } as MDXEditorMethods));

    return (
      <div data-testid="markdown-editor-mock">
        <textarea
          value={internalValue}
          onChange={(e) => {
            setInternalValue(e.target.value);
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          id={id}
          autoFocus={autoFocus}
          data-testid="markdown-editor"
          style={height !== undefined ? { height: `${height}px` } : undefined}
        />
      </div>
    );
  }
);

MarkdownEditorMock.displayName = "MarkdownEditor";
