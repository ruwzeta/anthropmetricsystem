import { cmToInches } from './geometry';

export type Unit = 'cm' | 'in';

const FRACTIONS = ['', '¼', '½', '¾'];

/** Formats a length the way a tailor writes it: 0.5 cm steps, or inches to the nearest quarter. */
export function formatLength(cm: number, unit: Unit): string {
  if (!Number.isFinite(cm)) return '—';
  if (unit === 'cm') return `${(Math.round(cm * 2) / 2).toFixed(1)} cm`;
  const quarters = Math.round(cmToInches(cm) * 4);
  const whole = Math.floor(quarters / 4);
  const frac = FRACTIONS[quarters % 4];
  return `${whole}${frac ? ` ${frac}` : ''}″`;
}

/** Plain number in the chosen unit, for editing and CSV. */
export function toUnit(cm: number, unit: Unit): number {
  const v = unit === 'cm' ? cm : cmToInches(cm);
  return Math.round(v * 10) / 10;
}
