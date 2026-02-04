'use client';

import { Plus } from 'lucide-react';
import { FloatingActionButton } from '@/components/Utilities/FloatingActionButton';

interface NewShelfFABProps {
  onClick: () => void;
  isHidden?: boolean;
}

export function NewShelfFAB({ onClick, isHidden = false }: NewShelfFABProps) {
  if (isHidden) return null;
  
  return (
    <FloatingActionButton
      icon={Plus}
      onClick={onClick}
      ariaLabel="Create new shelf"
      visibility="lg:hidden"
      zIndex="z-40"
    />
  );
}
