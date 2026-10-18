import { describe, expect, it } from 'vitest';
import { BinaryMask } from './mask';
import { checkPhoto, downgradeForPhotoIssues } from './validate';
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

describe('downgradeForPhotoIssues', () => {
  const values = { height: { cm: 170, confidence: 'high' as const }, armLength: { cm: 60, confidence: 'high' as const } };

  it('leaves values alone when the photo passed', () => {
    expect(downgradeForPhotoIssues(values, [])).toBe(values);
  });

  it('marks every measurement except height for a tape check', () => {
    const out = downgradeForPhotoIssues(values, ['The arms are raised.']);
    expect(out.height?.confidence).toBe('high');
    expect(out.armLength?.confidence).toBe('low');
    expect(out.armLength?.note).toMatch(/tape/);
  });
});
