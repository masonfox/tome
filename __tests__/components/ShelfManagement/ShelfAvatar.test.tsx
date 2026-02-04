import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ShelfAvatar } from '@/components/ShelfManagement/ShelfAvatar';

describe('ShelfAvatar', () => {
  describe('basic rendering', () => {
    test('renders with default props', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="BookMarked" />
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    test('renders fallback icon when icon is null', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon={null} />
      );
      // Should render FolderOpen by default
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    test('applies custom className', () => {
      const { container } = render(
        <ShelfAvatar
          color="#3b82f6"
          icon="Heart"
          className="shadow-lg"
        />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('shadow-lg');
    });

    test('applies aria-label', () => {
      const { container } = render(
        <ShelfAvatar
          color="#3b82f6"
          icon="Heart"
          aria-label="Favorites shelf"
        />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveAttribute('aria-label', 'Favorites shelf');
    });
  });

  describe('size variants', () => {
    test('renders md size by default', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('w-10');
      expect(avatar).toHaveClass('h-10');
    });

    test('renders xs size', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" size="xs" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('w-5');
      expect(avatar).toHaveClass('h-5');
    });

    test('renders sm size', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" size="sm" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('w-8');
      expect(avatar).toHaveClass('h-8');
    });

    test('renders lg size', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" size="lg" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('w-12');
      expect(avatar).toHaveClass('h-12');
    });

    test('renders xl size', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" size="xl" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('w-16');
      expect(avatar).toHaveClass('h-16');
    });

    test('renders 2xl size', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" size="2xl" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('w-20');
      expect(avatar).toHaveClass('h-20');
    });
  });

  describe('shape variants', () => {
    test('renders circle shape by default', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('rounded-full');
    });

    test('renders rounded shape', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" shape="rounded" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveClass('rounded-lg');
    });
  });

  describe('color contrast', () => {
    test('applies correct background color', () => {
      const { container } = render(
        <ShelfAvatar color="#ff0000" icon="Heart" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveStyle({ backgroundColor: '#ff0000' });
    });

    test('handles null color with default', () => {
      const { container } = render(
        <ShelfAvatar color={null} icon="Heart" />
      );
      const avatar = container.firstChild as HTMLElement;
      expect(avatar).toHaveStyle({ backgroundColor: '#3b82f6' });
    });

    test('icon has inline color style', () => {
      const { container } = render(
        <ShelfAvatar color="#ffffff" icon="Heart" />
      );
      const icon = container.querySelector('svg') as SVGElement;
      const color = icon.style.color;
      expect(['#000000', '#ffffff'].includes(color)).toBe(true);
    });

    test('uses black text on light background', () => {
      const { container } = render(
        <ShelfAvatar color="#ffffff" icon="Heart" />
      );
      const icon = container.querySelector('svg') as SVGElement;
      expect(icon).toHaveStyle({ color: '#000000' });
    });

    test('uses white text on dark background', () => {
      const { container } = render(
        <ShelfAvatar color="#000000" icon="Heart" />
      );
      const icon = container.querySelector('svg') as SVGElement;
      expect(icon).toHaveStyle({ color: '#ffffff' });
    });

    test('uses black text on light yellow', () => {
      const { container } = render(
        <ShelfAvatar color="#ffffcc" icon="Heart" />
      );
      const icon = container.querySelector('svg') as SVGElement;
      expect(icon).toHaveStyle({ color: '#000000' });
    });

    test('uses black text on light pink', () => {
      const { container } = render(
        <ShelfAvatar color="#ffcccc" icon="Heart" />
      );
      const icon = container.querySelector('svg') as SVGElement;
      expect(icon).toHaveStyle({ color: '#000000' });
    });
  });

  describe('accessibility', () => {
    test('icon has aria-hidden attribute', () => {
      const { container } = render(
        <ShelfAvatar color="#3b82f6" icon="Heart" />
      );
      const icon = container.querySelector('svg') as SVGElement;
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
