import { describe, expect, it } from 'vitest';
import { applyCorrection, buildCalibration, fitCorrection } from './calibration';

describe('fitCorrection', () => {
  it('is the identity with no samples', () => {
    expect(fitCorrection([])).toEqual({ scale: 1, offset: 0, samples: 0 });
  });

  it('moves part of the way towards a single tape measurement', () => {
    const c = fitCorrection([{ x: 100, y: 105 }]);
    const corrected = applyCorrection(100, c);
    expect(corrected).toBeGreaterThan(100);
    expect(corrected).toBeLessThan(105);
  });

  it('recovers a consistent bias from many samples', () => {
    const pairs = Array.from({ length: 30 }, (_, i) => {
      const x = 60 + i * 2;
      return { x, y: 1.05 * x + 2 };
    });
    const c = fitCorrection(pairs, 0.01);
    expect(applyCorrection(90, c)).toBeCloseTo(1.05 * 90 + 2, 0);
  });
});

describe('buildCalibration', () => {
  it('fits each measurement separately and ignores height', () => {
    const cal = buildCalibration([
      { key: 'chest', measuredCm: 90, tapeCm: 95 },
      { key: 'waist', measuredCm: 80, tapeCm: 78 },
      { key: 'height', measuredCm: 170, tapeCm: 172 },
    ]);
    expect(Object.keys(cal).sort()).toEqual(['chest', 'waist']);
    expect(applyCorrection(90, cal.chest)).toBeGreaterThan(90);
    expect(applyCorrection(80, cal.waist)).toBeLessThan(80);
  });
});
