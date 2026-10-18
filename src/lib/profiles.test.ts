import { describe, expect, it } from 'vitest';
import { calibrationFromProfiles, initialFinalValues, profilesToCsv, type Profile } from './profiles';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '1',
    name: 'Nimal, Perera',
    createdAt: '2026-10-18T10:00:00.000Z',
    heightCm: 170,
    measured: { height: { cm: 170, confidence: 'high' }, chest: { cm: 90, confidence: 'high' } },
    final: { height: 170, chest: 94 },
    tapeVerified: true,
    notes: '',
    warnings: [],
    ...overrides,
  };
}

describe('profiles', () => {
  it('learns a calibration only from tape-verified profiles', () => {
    expect(calibrationFromProfiles([profile({ tapeVerified: false })])).toEqual({});
    const cal = calibrationFromProfiles([profile()]);
    expect(cal.chest?.samples).toBe(1);
    const final = initialFinalValues({ chest: { cm: 90, confidence: 'high' } }, cal);
    expect(final.chest).toBeGreaterThan(90);
  });

  it('exports CSV with quoted names and unit headers', () => {
    const csv = profilesToCsv([profile()], 'cm');
    const [header, row] = csv.trim().split('\n');
    expect(header).toContain('Chest / bust (cm)');
    expect(row.startsWith('"Nimal, Perera",2026-10-18,170,,94')).toBe(true);
  });
});
