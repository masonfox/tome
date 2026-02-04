"use client";

import { forwardRef } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import dynamic from "next/dynamic";

// Skeleton loader component shown while editor loads
function EditorSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div 
      className="animate-pulse border border-[var(--border-color)] rounded-lg bg-[var(--background)] overflow-hidden"
      style={{ height: `${height}px` }}
    >
      {/* Toolbar skeleton */}
      <div className="border-b border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 flex gap-2">
        <div className="w-6 h-6 bg-[var(--border-color)] rounded"></div>
        <div className="w-6 h-6 bg-[var(--border-color)] rounded"></div>
        <div className="w-6 h-6 bg-[var(--border-color)] rounded"></div>
        <div className="w-px h-6 bg-[var(--border-color)]"></div>
        <div className="w-20 h-6 bg-[var(--border-color)] rounded"></div>
        <div className="w-px h-6 bg-[var(--border-color)]"></div>
        <div className="w-6 h-6 bg-[var(--border-color)] rounded"></div>
        <div className="w-6 h-6 bg-[var(--border-color)] rounded"></div>
      </div>
      {/* Editor content skeleton */}
      <div className="p-4 space-y-3">
        <div className="h-4 bg-[var(--border-color)] rounded w-3/4"></div>
        <div className="h-4 bg-[var(--border-color)] rounded w-full"></div>
        <div className="h-4 bg-[var(--border-color)] rounded w-5/6"></div>
        <div className="h-4 bg-[var(--border-color)] rounded w-2/3"></div>
      </div>
    </div>
  );
}

// Dynamic import with SSR disabled and loading skeleton
const DynamicEditor = dynamic(
  () => import('./MarkdownEditorInternal').then(mod => mod.InitializedMDXEditor),
  { 
    ssr: false,
    loading: ({ height }: any) => <EditorSkeleton height={height} />
  }
);

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
