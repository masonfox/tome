"use client";

import React, { useState } from "react";
import { Archive } from "lucide-react";
import type { ArchiveNode } from "@/lib/utils/archive-builder";
import { ArchiveTreeNode } from "./ArchiveTreeNode";

interface JournalArchiveTreeProps {
  archiveData: ArchiveNode[];
  currentDateRange: string | null;
  onNavigate: (dateKey: string) => void;
  loading: boolean;
  showHeader?: boolean;
}

export function JournalArchiveTree({
  archiveData,
  currentDateRange,
  onNavigate,
  loading,
  showHeader = true,
}: JournalArchiveTreeProps) {
  // Initialize with current year expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const currentYear = new Date().getFullYear().toString();
    return new Set([currentYear]);
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="sticky top-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4">
        {showHeader && (
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-[var(--heading-text)]">Archive</h2>
          </div>
        )}
        <div className="text-sm text-[var(--subheading-text)]">Loading archive...</div>
      </div>
    );
  }

  if (!archiveData || archiveData.length === 0) {
    return (
      <div className="sticky top-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4">
        {showHeader && (
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-[var(--heading-text)]">Archive</h2>
          </div>
        )}
        <div className="text-sm text-[var(--subheading-text)]">No entries yet</div>
      </div>
    );
  }

  return (
    <div className="sticky top-5 mt-11 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      {showHeader && (
        <div className="flex items-center gap-2 mb-4">
          <Archive className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--heading-text)]">Archive</h2>
        </div>
      )}

      <div role="tree" className="space-y-1">
        {archiveData.map((yearNode) => (
          <YearNodeWrapper
            key={yearNode.id}
            node={yearNode}
            currentDateRange={currentDateRange}
            expandedNodes={expandedNodes}
            onToggle={toggleNode}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

// Wrapper for year nodes to handle their expanded state
interface YearNodeWrapperProps {
  node: ArchiveNode;
  currentDateRange: string | null;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onNavigate: (dateKey: string) => void;
}

function YearNodeWrapper({
  node,
  currentDateRange,
  expandedNodes,
  onToggle,
  onNavigate,
}: YearNodeWrapperProps) {
  const isExpanded = expandedNodes.has(node.id);
  const isActive = currentDateRange === node.dateKey;

  return (
    <ArchiveTreeNode
      node={node}
      level={0}
      isActive={isActive}
      isExpanded={isExpanded}
      onToggle={onToggle}
      onNavigate={onNavigate}
      expandedNodes={expandedNodes}
      currentDateRange={currentDateRange}
    />
  );
}
