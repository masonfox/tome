'use client';

import { Plus } from 'lucide-react';
import { FloatingActionButton } from '@/components/Utilities/FloatingActionButton';

interface AddBooksToShelfFABProps {
  onClick: () => void;
  isHidden?: boolean;
}

export function AddBooksToShelfFAB({ onClick, isHidden = false }: AddBooksToShelfFABProps) {
  if (isHidden) return null;
  
  return (
    <FloatingActionButton
      icon={Plus}
      onClick={onClick}
      ariaLabel="Add books to shelf"
      visibility="lg:hidden"
      zIndex="z-[60]"
      bottom="bottom-32"
    />
  );
}
