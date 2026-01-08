'use client';

import { Plus } from 'lucide-react';
import { FloatingActionButton } from '@/components/Utilities/FloatingActionButton';

interface NewShelfFABProps {
  onClick: () => void;
}

export function NewShelfFAB({ onClick }: NewShelfFABProps) {
  return (
    <FloatingActionButton
      icon={Plus}
      onClick={onClick}
      ariaLabel="Create new shelf"
      visibility="lg:hidden"
      zIndex="z-[60]"
    />
  );
}
