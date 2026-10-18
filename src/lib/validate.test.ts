import { describe, expect, it } from 'vitest';
import { BinaryMask } from './mask';
import { checkPhoto } from './validate';
import { syntheticFront, syntheticSide } from './testing/syntheticBody';

describe('checkPhoto', () => {
  it('accepts well-framed front and side photos', () => {
    expect(checkPhoto(syntheticFront(), 'front')).toEqual([]);
    expect(checkPhoto(syntheticSide(), 'side')).toEqual([]);
  });

  it('flags a front photo used as a side photo and vice versa', () => {
    expect(checkPhoto(syntheticFront(), 'side').join(' ')).toMatch(/side-on/);
    expect(checkPhoto(syntheticSide(), 'front').join(' ')).toMatch(/Face the camera/);
  });

  it('flags a cropped head', () => {
    const frame = syntheticFront();
    const cropped = new BinaryMask(frame.mask.width, frame.mask.height, frame.mask.data.slice());
    for (let x = 0; x < cropped.width; x++) cropped.set(x, 0);
    expect(checkPhoto({ ...frame, mask: cropped }, 'front').join(' ')).toMatch(/head is cut off/);
  });
});
