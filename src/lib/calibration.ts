import type { MeasurementKey } from './definitions';

/** A per-measurement correction: corrected = scale × measured + offset. */
export interface LinearCorrection {
  scale: number;
  offset: number;
  samples: number;
}

export type Calibration = Partial<Record<MeasurementKey, LinearCorrection>>;

export interface CalibrationPair {
  key: MeasurementKey;
  /** What the app measured from the photos, in cm. */
  measuredCm: number;
  /** What the tailor measured with a tape, in cm. */
  tapeCm: number;
}

/**
 * Fits `tape ≈ scale × measured + offset` by regularised least squares.
 *
 * This generalises the 2019 translation algorithm, w = yxᵀ(xxᵀ + λI)⁻¹, from a
 * fixed camera distance to any photo: the regulariser pulls the fit towards
 * "no correction" (scale 1, offset 0), so one or two tape measurements nudge
 * the result instead of overfitting it. λ = 0.5 matches the paper.
 */
export function fitCorrection(pairs: { x: number; y: number }[], lambda = 0.5): LinearCorrection {
  const n = pairs.length;
  if (n === 0) return { scale: 1, offset: 0, samples: 0 };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const { x, y } of pairs) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  // Penalty on (scale − 1) is weighted by the mean x² so λ is unit-free.
  const lambdaScale = lambda * (sxx / n);
  const a11 = sxx + lambdaScale;
  const a12 = sx;
  const a22 = n + lambda;
  const b1 = sxy + lambdaScale;
  const b2 = sy;
  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-12) return { scale: 1, offset: 0, samples: n };
  return {
    scale: (b1 * a22 - a12 * b2) / det,
    offset: (a11 * b2 - a12 * b1) / det,
    samples: n,
  };
}

export function buildCalibration(pairs: CalibrationPair[], lambda = 0.5): Calibration {
  const byKey = new Map<MeasurementKey, { x: number; y: number }[]>();
  for (const p of pairs) {
    if (!(p.measuredCm > 0 && p.tapeCm > 0) || p.key === 'height') continue;
    const list = byKey.get(p.key) ?? [];
    list.push({ x: p.measuredCm, y: p.tapeCm });
    byKey.set(p.key, list);
  }
  const calibration: Calibration = {};
  for (const [key, list] of byKey) calibration[key] = fitCorrection(list, lambda);
  return calibration;
}

export function applyCorrection(cm: number, correction: LinearCorrection | undefined): number {
  return correction ? correction.scale * cm + correction.offset : cm;
}
