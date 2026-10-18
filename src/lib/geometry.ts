export interface Point {
  x: number;
  y: number;
}

export const CM_PER_INCH = 2.54;

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** x position of the segment a→b at row y (clamped to the segment's ends). */
export function xAtY(a: Point, b: Point, y: number): number {
  if (a.y === b.y) return (a.x + b.x) / 2;
  const t = Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y)));
  return lerp(a.x, b.x, t);
}

/**
 * Perimeter of an ellipse from its full width and full depth, using
 * Ramanujan's second approximation (error well under 0.01% for body shapes).
 * This is the "ellipse model" for girths: width comes from the front photo,
 * depth from the side photo.
 */
export function ellipsePerimeter(width: number, depth: number): number {
  const a = width / 2;
  const b = depth / 2;
  if (a <= 0 || b <= 0) return 0;
  const h = ((a - b) * (a - b)) / ((a + b) * (a + b));
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}
