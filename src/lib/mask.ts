/** A binary person/background mask in image pixel coordinates. */
export class BinaryMask {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number, data?: Uint8Array) {
    this.width = width;
    this.height = height;
    this.data = data ?? new Uint8Array(width * height);
  }

  /** Builds a mask from per-pixel confidences (e.g. a segmentation output). */
  static fromConfidence(width: number, height: number, values: ArrayLike<number>, threshold = 0.5): BinaryMask {
    const data = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) data[i] = values[i] >= threshold ? 1 : 0;
    return new BinaryMask(width, height, data);
  }

  get(x: number, y: number): boolean {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return false;
    return this.data[yi * this.width + xi] === 1;
  }

  set(x: number, y: number, on = true): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[y * this.width + x] = on ? 1 : 0;
  }

  /** First row (from the top) that contains any foreground pixel, or -1. */
  topRow(): number {
    for (let y = 0; y < this.height; y++) if (this.rowHasPixels(y)) return y;
    return -1;
  }

  /** Last row (from the top) that contains any foreground pixel, or -1. */
  bottomRow(): number {
    for (let y = this.height - 1; y >= 0; y--) if (this.rowHasPixels(y)) return y;
    return -1;
  }

  private rowHasPixels(y: number): boolean {
    const start = y * this.width;
    for (let x = 0; x < this.width; x++) if (this.data[start + x]) return true;
    return false;
  }

  /**
   * The contiguous horizontal run of foreground pixels on row `y` that contains
   * column `x`. If `x` itself is background, the nearest foreground pixel within
   * `searchRadius` columns is used. Returns null when nothing is found.
   */
  runAt(y: number, x: number, searchRadius = 8): Run | null {
    const yi = Math.round(y);
    if (yi < 0 || yi >= this.height) return null;
    let xi = Math.round(x);
    if (!this.get(xi, yi)) {
      let found = -1;
      for (let d = 1; d <= searchRadius && found < 0; d++) {
        if (this.get(xi - d, yi)) found = xi - d;
        else if (this.get(xi + d, yi)) found = xi + d;
      }
      if (found < 0) return null;
      xi = found;
    }
    let left = xi;
    let right = xi;
    while (left > 0 && this.get(left - 1, yi)) left--;
    while (right < this.width - 1 && this.get(right + 1, yi)) right++;
    return { left, right, width: right - left + 1, y: yi };
  }
}

export interface Run {
  left: number;
  right: number;
  /** Width in pixels, inclusive of both ends. */
  width: number;
  y: number;
}
