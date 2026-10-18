import { describe, expect, it } from 'vitest';
import { ellipsePerimeter } from './geometry';
import { computeMeasurements, MeasureError } from './measure';
import { BODY, syntheticFront, syntheticSide } from './testing/syntheticBody';

const front = syntheticFront();
const side = syntheticSide();

function expectNear(actual: number | undefined, expected: number, tolerancePct: number) {
  expect(actual).toBeDefined();
  expect(Math.abs((actual as number) - expected) / expected).toBeLessThan(tolerancePct / 100);
}

describe('computeMeasurements on a synthetic body', () => {
  const result = computeMeasurements({ front, side, heightCm: BODY.heightCm });
  const v = result.values;

  it('reports the entered height', () => {
    expect(v.height?.cm).toBe(170);
  });

  it('measures shoulder width across the shoulders', () => {
    // The silhouette includes the top of the upper arm, as a deltoid would.
    expectNear(v.shoulderWidth?.cm, 45, 3);
  });

  it('measures girths from front width and side depth', () => {
    expectNear(v.chest?.cm, ellipsePerimeter(32, 24), 3);
    expectNear(v.waist?.cm, ellipsePerimeter(28, 20), 3);
    expectNear(v.hip?.cm, ellipsePerimeter(36, 26), 3);
    expectNear(v.neck?.cm, ellipsePerimeter(12, 12), 5);
  });

  it('measures leg lengths from the crotch and waist', () => {
    expectNear(v.inseam?.cm, 80, 2);
    expectNear(v.outseam?.cm, 104, 2);
  });

  it('measures the arm along shoulder, elbow and wrist', () => {
    const j = BODY.joints;
    const joints = Math.hypot(j.elbow.x - j.shoulder.x, j.elbow.h - j.shoulder.h) + Math.hypot(j.wrist.x - j.elbow.x, j.wrist.h - j.elbow.h);
    expectNear(v.armLength?.cm, joints + (44 - 36) / 4, 3);
    expectNear(v.sleeveLength?.cm, 22 + joints + (44 - 36) / 4, 3);
    expect(v.sleeveInseam!.cm).toBeLessThan(v.armLength!.cm);
  });

  it('gives high confidence and no warnings for a clean pose', () => {
    expect(result.warnings).toEqual([]);
    expect(v.chest?.confidence).toBe('high');
  });

  it('draws guide lines on both photos', () => {
    expect(result.guides.front.map((g) => g.key)).toEqual(expect.arrayContaining(['chest', 'waist', 'hip', 'inseam']));
    expect(result.guides.side.length).toBeGreaterThanOrEqual(4);
  });
});

describe('computeMeasurements with a poor pose', () => {
  it('falls back to body proportions without a side photo', () => {
    const { values, warnings } = computeMeasurements({ front, heightCm: BODY.heightCm });
    expect(values.chest?.confidence).toBe('low');
    expectNear(values.chest?.cm, ellipsePerimeter(32, 24), 10);
    expect(warnings.join(' ')).toMatch(/side photo/);
  });

  it('warns and estimates the crotch when the legs are together', () => {
    const { values, warnings } = computeMeasurements({ front: syntheticFront({ legsTogether: true }), side, heightCm: BODY.heightCm });
    expect(values.inseam?.confidence).toBe('low');
    expect(warnings.join(' ')).toMatch(/legs/);
  });

  it('warns when the arms touch the body', () => {
    const { warnings } = computeMeasurements({ front: syntheticFront({ armsDown: true }), side, heightCm: BODY.heightCm });
    expect(warnings.join(' ')).toMatch(/Arms/);
  });

  it('scales with the entered height', () => {
    const tall = computeMeasurements({ front, side, heightCm: 187 });
    expectNear(tall.values.inseam?.cm, 88, 2);
  });

  it('rejects an impossible height', () => {
    expect(() => computeMeasurements({ front, heightCm: 20 })).toThrow(MeasureError);
  });
});

describe('plausibility', () => {
  it('marks a value that is impossible for a human body', () => {
    // Something wide (a bag, a chair) merged into the silhouette at thigh height.
    const cluttered = syntheticFront();
    for (let y = 510; y < 535; y++) for (let x = 100; x < 900; x++) cluttered.mask.set(x, y);
    const { values } = computeMeasurements({ front: cluttered, side, heightCm: BODY.heightCm });
    expect(values.thigh?.confidence).toBe('low');
    expect(values.thigh?.note).toMatch(/Unusual/);
    expect(values.chest?.confidence).toBe('high');
  });
});
