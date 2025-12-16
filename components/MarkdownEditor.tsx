"use client";

import type { ForwardedRef } from "react";
import { useState, useEffect } from "react";
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  toolbarPlugin,
  MDXEditor,
  type MDXEditorMethods,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  Separator,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { forwardRef } from "react";
import dynamic from "next/dynamic";

interface MarkdownEditorComponentProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  id?: string;
  autoFocus?: boolean;
  editorRef?: ForwardedRef<MDXEditorMethods> | null;
}

// Internal component with all plugins initialized
function InitializedMDXEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  height = 200,
  autoFocus = false,
  editorRef,
}: MarkdownEditorComponentProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    const theme = document.documentElement.getAttribute("data-theme");
    setIsDark(theme === "dark");

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute("data-theme");
      setIsDark(theme === "dark");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{
        height: `${height}px`,
        border: '1px solid var(--border-color)',
        borderRadius: '0.5rem',
        overflow: 'hidden',
      }}
    >
      <MDXEditor
        markdown={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        ref={editorRef}
        className={isDark ? "dark-theme" : ""}
        contentEditableClassName="prose prose-sm max-w-none"
        plugins={[
          // Core formatting plugins for rich text experience
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          tablePlugin(),
          markdownShortcutPlugin(),
          // Toolbar with rich text controls
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <CreateLink />
                <Separator />
                <ListsToggle />
                <Separator />
                <InsertTable />
                <Separator />
                <InsertThematicBreak />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}

// Dynamic import with SSR disabled for Next.js
const DynamicEditor = dynamic(() => Promise.resolve(InitializedMDXEditor), {
  ssr: false,
});

// Main export component
interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  id?: string;
  autoFocus?: boolean;
}

const MarkdownEditor = forwardRef<MDXEditorMethods, MarkdownEditorProps>(
  (props, ref) => <DynamicEditor {...props} editorRef={ref} />
);

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
