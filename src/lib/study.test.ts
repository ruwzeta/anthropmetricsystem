import { describe, expect, it } from 'vitest';
import type { Profile } from './profiles';
import { accuracySummary, buildSubmission, describeDevice, submissionsToCsv, type Submission, type Tester } from './study';

const profile: Profile = {
  id: 'p1',
  name: 'Test',
  createdAt: '2026-10-21T10:00:00.000Z',
  heightCm: 170,
  measured: { height: { cm: 170, confidence: 'high' }, chest: { cm: 92, confidence: 'high' }, waist: { cm: 80, confidence: 'low' } },
  final: { height: 170, chest: 93, waist: 80 },
  tapeVerified: false,
  notes: '',
  warnings: ['Side photo: arms hide the waist.'],
};

const tester: Tester = {
  userId: 'u1',
  displayName: 'Nimal, Perera',
  email: 'nimal@example.com',
  ageRange: '25–34',
  sex: 'Male',
  consentVersion: 'x',
  consentedAt: '2026-10-21T09:00:00.000Z',
};

function submission(overrides: Partial<Submission> = {}): Submission {
  const base = buildSubmission({
    id: 's1',
    userId: 'u1',
    profile,
    sidePhoto: true,
    tape: { chest: 90, waist: 83 },
    ease: 4,
    trust: null,
    feedback: 'fine',
    device: 'Android Chrome (phone)',
    appVersion: '2.0.0',
    now: new Date('2026-10-21T10:05:00.000Z'),
  });
  return { ...base, ...overrides };
}

describe('study', () => {
  it('keeps raw photo values and drops implausible or non-tape values', () => {
    const s = buildSubmission({
      id: 's1',
      userId: 'u1',
      profile,
      sidePhoto: false,
      tape: { chest: 90.04, waist: 3, height: 171, hip: Number.NaN },
      ease: null,
      trust: null,
      feedback: '  ok ',
      device: '',
      appVersion: '2.0.0',
    });
    expect(s.tape).toEqual({ chest: 90 });
    expect(s.measured.chest?.cm).toBe(92);
    expect(s.shown.chest).toBe(93);
    expect(s.feedback).toBe('ok');
  });

  it('summarises photo error against tape', () => {
    const rows = accuracySummary([submission(), submission({ id: 's2', tape: { chest: 95 } })]);
    const chest = rows.find((r) => r.key === 'chest')!;
    expect(chest.n).toBe(2);
    expect(chest.biasCm).toBeCloseTo((2 + -3) / 2);
    expect(chest.maeCm).toBeCloseTo(2.5);
    expect(chest.within2cm).toBe(0.5);
    expect(rows.find((r) => r.key === 'waist')?.n).toBe(1);
    expect(rows.find((r) => r.key === 'hip')).toBeUndefined();
  });

  it('exports an anonymous long-format CSV', () => {
    const csv = submissionsToCsv([submission()], [tester]);
    const lines = csv.trim().split('\n');
    expect(lines[0].startsWith('submission_id,tester_id,date,age_range,sex')).toBe(true);
    expect(csv).not.toContain('Nimal');
    expect(csv).not.toContain('example.com');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(',chest,92,high,93,90,2,4,,2.0.0,');
  });

  it('describes devices without identifying them', () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toBe('Android Chrome (phone)');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('iOS Safari (phone)');
  });
});
