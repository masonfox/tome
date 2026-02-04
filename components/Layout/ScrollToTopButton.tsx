'use client';

import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { FloatingActionButton } from '@/components/Utilities/FloatingActionButton';

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <FloatingActionButton
      icon={ChevronUp}
      onClick={scrollToTop}
      ariaLabel="Scroll to top"
    />
  );
}
