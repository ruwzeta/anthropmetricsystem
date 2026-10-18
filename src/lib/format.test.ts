import { describe, expect, it } from 'vitest';
import { formatLength, toUnit } from './format';

describe('formatLength', () => {
  it('rounds centimetres to half a centimetre', () => {
    expect(formatLength(88.74, 'cm')).toBe('88.5 cm');
    expect(formatLength(88.76, 'cm')).toBe('89.0 cm');
  });

  it('writes inches to the nearest quarter', () => {
    expect(formatLength(2.54 * 34.25, 'in')).toBe('34 ¼″');
    expect(formatLength(2.54 * 32, 'in')).toBe('32″');
    expect(formatLength(2.54 * 15.5, 'in')).toBe('15 ½″');
  });
});

describe('toUnit', () => {
  it('converts to one decimal place', () => {
    expect(toUnit(100, 'in')).toBe(39.4);
    expect(toUnit(99.96, 'cm')).toBe(100);
  });
});
