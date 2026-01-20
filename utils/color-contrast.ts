/**
 * Color contrast utility functions for WCAG 2.1 compliance
 * Determines optimal text color (black or white) for any background color
 */

/**
 * Convert hex color to RGB array
 * Supports both 3-digit and 6-digit hex codes, with or without # prefix
 */
function hexToRgb(hex: string): [number, number, number] {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Validate hex format
  if (!/^([0-9A-Fa-f]{3}){1,2}$/.test(cleanHex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  // Expand 3-digit hex to 6-digit
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(char => char + char).join('')
    : cleanHex;

  // Parse RGB values
  return [
    parseInt(fullHex.substring(0, 2), 16),
    parseInt(fullHex.substring(2, 4), 16),
    parseInt(fullHex.substring(4, 6), 16),
  ];
}

/**
 * Calculate relative luminance per WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);

  // Convert to sRGB
  const [r, g, b] = rgb.map(val => {
    const channel = val / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  // Calculate luminance using WCAG formula
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two luminance values
 * https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 */
export function getContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine if white or black text provides better contrast on a background
 * Returns 'white' or 'black' based on WCAG 2.1 contrast ratio calculations
 */
export function getAccessibleTextColor(backgroundColor: string): 'white' | 'black' {
  const bgLuminance = getRelativeLuminance(backgroundColor);
  const whiteLuminance = 1;
  const blackLuminance = 0;

  const whiteContrast = getContrastRatio(bgLuminance, whiteLuminance);
  const blackContrast = getContrastRatio(bgLuminance, blackLuminance);

  return whiteContrast > blackContrast ? 'white' : 'black';
}

/**
 * Check if a color provides sufficient contrast (4.5:1 ratio for normal text)
 * Useful for validation and testing
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  const fgLuminance = getRelativeLuminance(foreground);
  const bgLuminance = getRelativeLuminance(background);
  const ratio = getContrastRatio(fgLuminance, bgLuminance);

  const threshold = level === 'AAA' ? 7 : 4.5;
  return ratio >= threshold;
}
