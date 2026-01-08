'use client';

import { Plus } from 'lucide-react';
import { FloatingActionButton } from '@/components/Utilities/FloatingActionButton';

interface AddBooksToShelfFABProps {
  onClick: () => void;
}

export function AddBooksToShelfFAB({ onClick }: AddBooksToShelfFABProps) {
  return (
    <FloatingActionButton
      icon={Plus}
      onClick={onClick}
      ariaLabel="Add books to shelf"
      visibility="lg:hidden"
      zIndex="z-[60]"
    />
  );
}
