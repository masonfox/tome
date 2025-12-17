import React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { ArchiveNode } from "@/lib/utils/archive-builder";

interface ArchiveTreeNodeProps {
  node: ArchiveNode;
  level: number; // 0=year, 1=month, 2=week
  isActive: boolean;
  isExpanded: boolean;
  onToggle: (nodeId?: string) => void;
  onNavigate: (dateKey: string) => void;
  expandedNodes?: Set<string>;
  currentDateRange?: string | null;
}

export function ArchiveTreeNode({
  node,
  level,
  isActive,
  isExpanded,
  onToggle,
  onNavigate,
  expandedNodes,
  currentDateRange,
}: ArchiveTreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const indentPx = level * 12; // 12px indentation per level

  const handleClick = () => {
    if (hasChildren) {
      onToggle(node.id);
    } else {
      onNavigate(node.dateKey);
    }
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(node.dateKey);
  };

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-level={level + 1} aria-selected={isActive}>
      {/* Node header */}
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center justify-between px-3 py-2 text-sm transition-colors
          hover:bg-[var(--card-bg)] rounded
          ${isActive ? "bg-[var(--light-accent)] text-[var(--accent)]" : ""}
        `}
        style={{ paddingLeft: `${12 + indentPx}px` }}
        aria-label={`${node.label} (${node.count} ${node.count === 1 ? "entry" : "entries"})`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Expand/collapse icon for nodes with children */}
          {hasChildren ? (
            <span className="flex-shrink-0 text-[var(--subheading-text)]">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-[var(--subheading-text)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--subheading-text)]" />
              )}
            </span>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}

          {/* Label - style date ranges differently for weeks */}
          {node.type === 'week' && node.label.includes('(') ? (
            <span className="truncate">
              <span className="text-[var(--foreground)]">{node.label.split('(')[0]}</span>
              <span className="text-[var(--subheading-text)]">({node.label.split('(')[1]}</span>
            </span>
          ) : (
            <span className="truncate text-[var(--foreground)]">{node.label}</span>
          )}
        </div>

        {/* Entry count */}
        <span className="flex-shrink-0 ml-2 text-xs text-[var(--subheading-text)] bg-[var(--border-color)] px-2 py-0.5 rounded-full">
          {node.count}
        </span>
      </button>

      {/* Navigate button for parent nodes (year/month) */}
      {hasChildren && (
        <button
          onClick={handleNavigate}
          className="w-full text-left px-3 py-1 text-xs text-[var(--accent)] hover:underline"
          style={{ paddingLeft: `${36 + indentPx}px` }}
          aria-label={`View all entries for ${node.label}`}
        >
          View all
        </button>
      )}

      {/* Children (recursive) */}
      {hasChildren && isExpanded && expandedNodes && (
        <div role="group">
          {node.children!.map((child) => (
            <ArchiveTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              isActive={currentDateRange === child.dateKey}
              isExpanded={expandedNodes.has(child.id)}
              onToggle={onToggle}
              onNavigate={onNavigate}
              expandedNodes={expandedNodes}
              currentDateRange={currentDateRange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
