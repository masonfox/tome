import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ColorPicker } from '@/components/Utilities/ColorPicker';

describe('ColorPicker', () => {
  const mockOnChange = vi.fn();
  const testColor = '#3b82f6';

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  test('renders with initial color value', () => {
    render(
      <ColorPicker
        value={testColor}
        onChange={mockOnChange}
        label="Test Color"
      />
    );

    expect(screen.getByLabelText('Test Color')).toBeInTheDocument();
    
    // Check the text input specifically by placeholder
    const textInput = screen.getByPlaceholderText('#3b82f6');
    expect(textInput).toHaveValue(testColor);
  });

  test('updates color when picker input changes', () => {
    const { container } = render(
      <ColorPicker value={testColor} onChange={mockOnChange} />
    );

    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    expect(colorInput).toBeInTheDocument();

    fireEvent.change(colorInput, { target: { value: '#ff0000' } });

    expect(mockOnChange).toHaveBeenCalledWith('#ff0000');
  });

  test('updates color when HEX text input changes with valid value', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '#ff5733' } });

    expect(mockOnChange).toHaveBeenCalledWith('#ff5733');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('validates HEX format - requires # prefix', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: 'ff5733' } });

    expect(screen.getByRole('alert')).toHaveTextContent('HEX color must start with #');
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  test('validates HEX format - accepts 3 digit format', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '#f00' } });

    // Should expand #f00 to #ff0000
    expect(mockOnChange).toHaveBeenCalledWith('#ff0000');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('validates HEX format - accepts 6 digit format', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '#ff5733' } });

    expect(mockOnChange).toHaveBeenCalledWith('#ff5733');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('shows error for invalid HEX length', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '#ff' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid HEX format');
  });

  test('shows error for invalid HEX characters', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '#gggggg' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid HEX format');
  });

  test('shows error for empty input', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '' } });

    expect(screen.getByRole('alert')).toHaveTextContent('HEX color cannot be empty');
  });

  test('expands short HEX format #RGB to #RRGGBB', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '#abc' } });

    expect(mockOnChange).toHaveBeenCalledWith('#aabbcc');
  });

  test('converts HEX to lowercase', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '#FF5733' } });

    expect(mockOnChange).toHaveBeenCalledWith('#ff5733');
  });

  test('syncs text input with color picker changes', () => {
    const { container } = render(
      <ColorPicker value={testColor} onChange={mockOnChange} />
    );

    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#00ff00' } });

    const textInput = screen.getByDisplayValue('#00ff00');
    expect(textInput).toBeInTheDocument();
  });

  test('reverts to last valid value on blur with invalid input', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    
    // Enter invalid value
    fireEvent.change(textInput, { target: { value: '#invalid' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Blur should revert to original valid value
    fireEvent.blur(textInput);
    
    expect(textInput).toHaveValue(testColor);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('respects disabled prop', () => {
    const { container } = render(
      <ColorPicker value={testColor} onChange={mockOnChange} disabled={true} />
    );

    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    const textInput = screen.getByPlaceholderText('#3b82f6');

    expect(colorInput).toBeDisabled();
    expect(textInput).toBeDisabled();
  });

  test('uses custom id and label', () => {
    render(
      <ColorPicker
        value={testColor}
        onChange={mockOnChange}
        id="custom-color"
        label="Custom Label"
      />
    );

    expect(screen.getByLabelText('Custom Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom Label')).toHaveAttribute('id', 'custom-color');
  });

  test('displays color preview circle with correct background', () => {
    const { container } = render(
      <ColorPicker value="#ff0000" onChange={mockOnChange} />
    );

    // Find the preview circle by its title attribute
    const previewCircle = container.querySelector('[title="Current color: #ff0000"]');
    expect(previewCircle).toBeInTheDocument();
    expect(previewCircle).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  test('shows helper text when no error', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    expect(screen.getByText(/Enter HEX color/i)).toBeInTheDocument();
  });

  test('hides helper text when error is shown', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(textInput, { target: { value: '#invalid' } });

    expect(screen.queryByText(/Enter HEX color/i)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('updates when value prop changes externally', () => {
    const { rerender } = render(
      <ColorPicker value="#ff0000" onChange={mockOnChange} />
    );

    const textInput = screen.getByPlaceholderText('#3b82f6');
    expect(textInput).toHaveValue('#ff0000');

    rerender(<ColorPicker value="#00ff00" onChange={mockOnChange} />);

    expect(textInput).toHaveValue('#00ff00');
  });

  test('calls onChange with valid colors only', () => {
    render(<ColorPicker value={testColor} onChange={mockOnChange} />);

    const textInput = screen.getByPlaceholderText('#3b82f6');

    // Valid change
    fireEvent.change(textInput, { target: { value: '#ff5733' } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('#ff5733');

    mockOnChange.mockClear();

    // Invalid change
    fireEvent.change(textInput, { target: { value: '#gg0000' } });
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
