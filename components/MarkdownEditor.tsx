"use client";

import type { ForwardedRef } from "react";
import { forwardRef, useState, useEffect } from "react";
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  directivesPlugin,
  toolbarPlugin,
  MDXEditor,
  type MDXEditorMethods,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
  Separator,
  ButtonWithTooltip,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2 } from "lucide-react";

interface MarkdownEditorComponentProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  id?: string;
  autoFocus?: boolean;
  editorRef?: ForwardedRef<MDXEditorMethods> | null;
}

// Fullscreen toggle button component
function FullscreenButton({ isFullscreen, onToggle }: { isFullscreen: boolean; onToggle: () => void }) {
  return (
    <ButtonWithTooltip
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      onClick={onToggle}
    >
      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
    </ButtonWithTooltip>
  );
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFullscreen]);

  return (
    <div
      className={isFullscreen ? 'tome-editor-fullscreen' : ''}
      style={{
        height: isFullscreen ? '100vh' : `${height}px`,
        border: '1px solid var(--border-color)',
        borderRadius: isFullscreen ? 0 : '0.5rem',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...(isFullscreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: 'var(--background)',
        }),
      }}
    >
      <MDXEditor
        markdown={value}
        onChange={onChange}
        autoFocus={autoFocus}
        ref={editorRef}
        className="tome-editor"
        contentEditableClassName="prose prose-sm max-w-none"
        plugins={[
          // Core formatting plugins for rich text experience
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          markdownShortcutPlugin(),
          directivesPlugin(),
          // Toolbar with rich text controls
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <FullscreenButton
                  isFullscreen={isFullscreen}
                  onToggle={() => setIsFullscreen(!isFullscreen)}
                />
                <Separator />
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <CreateLink />
                <Separator />
                <ListsToggle options={['bullet', 'number']} />
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
