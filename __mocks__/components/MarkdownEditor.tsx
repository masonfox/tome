import { forwardRef, useImperativeHandle, useState } from "react";
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
    const [internalValue, setInternalValue] = useState(value);
    
    // Implement the MDXEditor imperative methods
    useImperativeHandle(ref, () => ({
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
          style={{ height: `${height}px` }}
        />
      </div>
    );
  }
);

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
