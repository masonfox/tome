import { describe, test, expect } from 'vitest';
import {
  getAccessibleTextColor,
  getContrastRatio,
  meetsContrastRequirement
} from '@/utils/color-contrast';

describe('color-contrast utilities', () => {
  describe('getAccessibleTextColor', () => {
    test('returns white for black background', () => {
      expect(getAccessibleTextColor('#000000')).toBe('white');
    });

    test('returns black for white background', () => {
      expect(getAccessibleTextColor('#ffffff')).toBe('black');
    });

    test('returns black for light yellow background', () => {
      expect(getAccessibleTextColor('#ffffcc')).toBe('black');
    });

    test('returns black for light pink background', () => {
      expect(getAccessibleTextColor('#ffcccc')).toBe('black');
    });

    test('returns black for light green background', () => {
      expect(getAccessibleTextColor('#ccffcc')).toBe('black');
    });

    test('returns white for dark blue background', () => {
      expect(getAccessibleTextColor('#1e40af')).toBe('white'); // Darker blue
    });

    test('returns white for dark gray background', () => {
      expect(getAccessibleTextColor('#333333')).toBe('white');
    });

    test('returns white for saddle brown background', () => {
      expect(getAccessibleTextColor('#8b4513')).toBe('white');
    });

    test('handles 3-digit hex codes', () => {
      expect(getAccessibleTextColor('#fff')).toBe('black');
      expect(getAccessibleTextColor('#000')).toBe('white');
    });

    test('handles hex without # prefix', () => {
      expect(getAccessibleTextColor('ffffff')).toBe('black');
      expect(getAccessibleTextColor('000000')).toBe('white');
    });

    test('handles medium gray (boundary case)', () => {
      const result = getAccessibleTextColor('#808080');
      expect(result).toMatch(/^(white|black)$/);
    });
  });

  describe('getContrastRatio', () => {
    test('returns 21 for white vs black', () => {
      const ratio = getContrastRatio(1, 0);
      expect(ratio).toBeCloseTo(21, 1);
    });

    test('returns same value regardless of order', () => {
      const ratio1 = getContrastRatio(1, 0.5);
      const ratio2 = getContrastRatio(0.5, 1);
      expect(ratio1).toBe(ratio2);
    });

    test('returns 1 for identical colors', () => {
      const ratio = getContrastRatio(0.5, 0.5);
      expect(ratio).toBe(1);
    });

    test('returns value greater than 1', () => {
      const ratio = getContrastRatio(0.8, 0.2);
      expect(ratio).toBeGreaterThan(1);
    });
  });

  describe('meetsContrastRequirement', () => {
    test('white on black meets AA requirement', () => {
      expect(meetsContrastRequirement('#ffffff', '#000000', 'AA')).toBe(true);
    });

    test('white on black meets AAA requirement', () => {
      expect(meetsContrastRequirement('#ffffff', '#000000', 'AAA')).toBe(true);
    });

    test('light gray on white fails AA requirement', () => {
      expect(meetsContrastRequirement('#dddddd', '#ffffff', 'AA')).toBe(false);
    });

    test('black on white meets AA requirement', () => {
      expect(meetsContrastRequirement('#000000', '#ffffff', 'AA')).toBe(true);
    });

    test('uses AA as default level', () => {
      const resultWithDefault = meetsContrastRequirement('#ffffff', '#000000');
      const resultWithAA = meetsContrastRequirement('#ffffff', '#000000', 'AA');
      expect(resultWithDefault).toBe(resultWithAA);
    });
  });
});
