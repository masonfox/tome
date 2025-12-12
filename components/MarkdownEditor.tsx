"use client";

import dynamic from "next/dynamic";
import { commands } from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  { ssr: false }
);

// Custom toolbar commands (excluding image, comment, code, codeBlock, checkedList)
const customCommands = [
  commands.bold,
  commands.italic,
  commands.strikethrough,
  commands.hr,
  commands.group([commands.title1, commands.title2, commands.title3, commands.title4, commands.title5, commands.title6], {
    name: 'title',
    groupName: 'title',
    buttonProps: { 'aria-label': 'Insert title' }
  }),
  commands.divider,
  commands.link,
  commands.quote,
  commands.table,
  commands.divider,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.divider,
  commands.help,
];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  id?: string;
  autoFocus?: boolean;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  height = 200,
  id,
  autoFocus = false,
}: MarkdownEditorProps) {
  return (
    <MDEditor
      value={value}
      onChange={(val) => onChange(val || "")}
      preview="edit"
      height={height}
      visibleDragbar={false}
      overflow={false}
      commands={customCommands}
      textareaProps={{
        placeholder,
        id,
        autoFocus,
      }}
    />
  );
}
