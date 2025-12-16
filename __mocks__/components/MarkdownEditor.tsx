import { forwardRef } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  id?: string;
  autoFocus?: boolean;
}

// Mock implementation for testing
const MarkdownEditor = forwardRef<MDXEditorMethods, MarkdownEditorProps>(
  ({ value, onChange, placeholder, height, id, autoFocus }, ref) => {
    return (
      <div data-testid="markdown-editor-mock">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          id={id}
          autoFocus={autoFocus}
          style={{ height: `${height}px` }}
        />
      </div>
    );
  }
);

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
