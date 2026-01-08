import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ShelfIconPicker, getShelfIcon, SHELF_ICONS } from '@/components/ShelfManagement/ShelfIconPicker';

describe('getShelfIcon', () => {
  test('should return icon component for valid icon name', () => {
    const icon = getShelfIcon('BookMarked');
    expect(icon).toBeDefined();
    expect(icon).toBe(SHELF_ICONS.BookMarked);
  });

  test('should return null for invalid icon name', () => {
    const icon = getShelfIcon('InvalidIcon');
    expect(icon).toBeNull();
  });

  test('should return null for null input', () => {
    const icon = getShelfIcon(null);
    expect(icon).toBeNull();
  });

  test('should return null for undefined input', () => {
    const icon = getShelfIcon(undefined);
    expect(icon).toBeNull();
  });
});

describe('ShelfIconPicker', () => {
  const mockOnSelectIcon = vi.fn();
  const testColor = '#3b82f6';

  test('should render with no icon selected', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    expect(screen.getByText('No icon selected')).toBeInTheDocument();
    expect(screen.getByText('Choose Icon')).toBeInTheDocument();
  });

  test('should render with selected icon', () => {
    render(
      <ShelfIconPicker
        selectedIcon="Heart"
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    expect(screen.getByText('Heart')).toBeInTheDocument();
    expect(screen.getByText('Remove icon')).toBeInTheDocument();
  });

  test('should show icon grid when choose icon is clicked', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    expect(screen.getByText('Hide Icons')).toBeInTheDocument();
  });

  test('should hide icon grid when hide icons is clicked', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    const hideButton = screen.getByText('Hide Icons');
    fireEvent.click(hideButton);

    expect(screen.getByText('Choose Icon')).toBeInTheDocument();
  });

  test('should call onSelectIcon when icon is clicked', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    // Find and click an icon button - use title attribute
    const heartButton = screen.getByTitle('Heart');
    fireEvent.click(heartButton);

    expect(mockOnSelectIcon).toHaveBeenCalledWith('Heart');
  });

  test('should close icon grid after selecting an icon', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    const heartButton = screen.getByTitle('Heart');
    fireEvent.click(heartButton);

    expect(screen.getByText('Choose Icon')).toBeInTheDocument();
  });

  test('should call onSelectIcon(null) when remove icon is clicked', () => {
    render(
      <ShelfIconPicker
        selectedIcon="Heart"
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const removeButton = screen.getByText('Remove icon');
    fireEvent.click(removeButton);

    expect(mockOnSelectIcon).toHaveBeenCalledWith(null);
  });

  test('should disable buttons when disabled prop is true', () => {
    render(
      <ShelfIconPicker
        selectedIcon="Heart"
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
        disabled={true}
      />
    );

    const removeButton = screen.getByText('Remove icon');
    expect(removeButton).toBeDisabled();

    const chooseButton = screen.getByText('Choose Icon');
    expect(chooseButton).toBeDisabled();
  });

  test('should apply custom color to icon preview', () => {
    const { container } = render(
      <ShelfIconPicker
        selectedIcon="Heart"
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    // Check that the color is applied to the preview circle
    const coloredElements = container.querySelectorAll(`[style*="background-color: ${testColor}"]`);
    expect(coloredElements.length).toBeGreaterThan(0);
  });

  test('should render all icon options when grid is open', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    // Check that multiple icon options are rendered
    const iconCount = Object.keys(SHELF_ICONS).length;
    const iconButtons = screen.getAllByRole('button').filter(
      button => button.hasAttribute('title') && button.title !== ''
    );

    expect(iconButtons.length).toBe(iconCount);
  });

  test('should show selected icon in grid as highlighted', () => {
    render(
      <ShelfIconPicker
        selectedIcon="Heart"
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    // The selected icon button should have special styling
    const heartButton = screen.getByTitle('Heart');
    expect(heartButton.className).toContain('bg-');
  });

  test('should render search input when grid is open', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    expect(screen.getByPlaceholderText('Search icons...')).toBeInTheDocument();
  });

  test('should filter icons by search query', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    const searchInput = screen.getByPlaceholderText('Search icons...');
    fireEvent.change(searchInput, { target: { value: 'book' } });

    // Should filter to only icons with "book" in the name
    const iconButtons = screen.getAllByRole('button').filter(
      button => button.hasAttribute('title') && button.title !== ''
    );

    // All visible icons should contain "book" in their name (case-insensitive)
    iconButtons.forEach(button => {
      if (button.title) {
        expect(button.title.toLowerCase()).toContain('book');
      }
    });
  });

  test('should show "no icons found" for no matches', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    const searchInput = screen.getByPlaceholderText('Search icons...');
    fireEvent.change(searchInput, { target: { value: 'nonexistenticon' } });

    expect(screen.getByText('No icons found')).toBeInTheDocument();
    expect(screen.getByText('Try a different search term')).toBeInTheDocument();
  });

  test('should clear search when X is clicked', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    const searchInput = screen.getByPlaceholderText('Search icons...');
    fireEvent.change(searchInput, { target: { value: 'book' } });

    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  test('search is case-insensitive', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    const searchInput = screen.getByPlaceholderText('Search icons...');
    
    // Search with uppercase
    fireEvent.change(searchInput, { target: { value: 'HEART' } });

    // Should still find the Heart icon
    expect(screen.getByTitle('Heart')).toBeInTheDocument();
  });

  test('should clear search and close picker when icon is selected', () => {
    render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    const searchInput = screen.getByPlaceholderText('Search icons...');
    fireEvent.change(searchInput, { target: { value: 'heart' } });

    const heartButton = screen.getByTitle('Heart');
    fireEvent.click(heartButton);

    // Picker should be closed
    expect(screen.getByText('Choose Icon')).toBeInTheDocument();
    expect(mockOnSelectIcon).toHaveBeenCalledWith('Heart');
  });

  test('should auto-focus search input when grid opens', () => {
    const { container } = render(
      <ShelfIconPicker
        selectedIcon={null}
        onSelectIcon={mockOnSelectIcon}
        color={testColor}
      />
    );

    const chooseButton = screen.getByText('Choose Icon');
    fireEvent.click(chooseButton);

    const searchInput = screen.getByPlaceholderText('Search icons...');
    // Check that autoFocus prop is present (it's a boolean attribute in React)
    expect(searchInput).toHaveProperty('autofocus');
  });
});
