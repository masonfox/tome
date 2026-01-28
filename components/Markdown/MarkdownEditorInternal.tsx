"use client";

import type { ForwardedRef } from "react";
import { forwardRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
import { Maximize2, Minimize2 } from "lucide-react";

interface MarkdownEditorInternalProps {
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
export const InitializedMDXEditor = forwardRef<MDXEditorMethods, MarkdownEditorInternalProps>(
  function InitializedMDXEditor(
    {
      value,
      onChange,
      placeholder = "Start typing...",
      height = 200,
      autoFocus = false,
      editorRef,
    },
    ref
  ) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    // Create portal container on mount
    useEffect(() => {
      if (typeof window !== 'undefined') {
        setPortalContainer(document.body);
      }
    }, []);

    // Handle ESC key to exit fullscreen
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isFullscreen) {
          setIsFullscreen(false);
        }
      };

      if (isFullscreen) {
        document.addEventListener('keydown', handleEscape);
        // Prevent body scroll when fullscreen
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }, [isFullscreen]);

    // Handle clicks on the wrapper to focus the editor
    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      
      // Don't interfere with toolbar clicks
      if (target.closest('.mdxeditor-toolbar')) {
        return;
      }
      
      const contentEditable = e.currentTarget.querySelector('[contenteditable="true"]') as HTMLElement;
      
      // Focus the editor if clicking in the editor area
      if (contentEditable) {
        contentEditable.focus();
      }
    };

    // Shared editor component
    const editorComponent = (
      <div
        className={isFullscreen ? 'tome-editor-fullscreen' : ''}
        onClick={handleWrapperClick}
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
          ref={editorRef || ref}
          className="tome-editor"
          contentEditableClassName="prose max-w-none"
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

    // Use portal for fullscreen mode to escape parent stacking contexts
    if (isFullscreen && portalContainer) {
      return createPortal(editorComponent, portalContainer);
    }

    return editorComponent;
  }
);
