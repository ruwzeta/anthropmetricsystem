import { MEASUREMENTS, type MeasurementKey } from './definitions';
import type { MeasuredValue } from './measure';
import type { Profile } from './profiles';

/** Bump when the consent text changes, so testers are asked to agree again. */
export const CONSENT_VERSION = '2026-10-21';

export const AGE_RANGES = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'] as const;
export const SEXES = ['Female', 'Male', 'Other'] as const;

/** A person who agreed to take part in the accuracy study. */
export interface Tester {
  userId: string;
  displayName: string;
  email: string;
  ageRange: string | null;
  sex: string | null;
  consentVersion: string;
  consentedAt: string;
}

/** One test: what the photos gave, what the tape gave, and what the tester thought. */
export interface Submission {
  id: string;
  userId: string;
  createdAt: string;
  appVersion: string;
  heightCm: number;
  sidePhoto: boolean;
  /** Raw photo estimates, before calibration or edits. These are what the study evaluates. */
  measured: Partial<Record<MeasurementKey, MeasuredValue>>;
  /** The values the app showed after calibration and any edits on the card. */
  shown: Partial<Record<MeasurementKey, number>>;
  /** The tester's own tape measurements in cm. */
  tape: Partial<Record<MeasurementKey, number>>;
  warnings: string[];
  /** 1–5: how easy the app was to use. */
  ease: number | null;
  /** 1–5: how close the values felt to the tester's own clothes sizes. */
  trust: number | null;
  feedback: string;
  device: string;
}

/** Measurements a tester can check with a tape; height is already typed in. */
export const TAPE_MEASUREMENTS = MEASUREMENTS.filter((m) => m.key !== 'height');

/** Tape values outside this range are typing mistakes, not body measurements. */
export const TAPE_RANGE_CM = { min: 10, max: 200 } as const;

export function isPlausibleTape(cm: number): boolean {
  return Number.isFinite(cm) && cm >= TAPE_RANGE_CM.min && cm <= TAPE_RANGE_CM.max;
}

export interface SubmissionInput {
  id: string;
  userId: string;
  profile: Profile;
  sidePhoto: boolean;
  tape: Partial<Record<MeasurementKey, number>>;
  ease: number | null;
  trust: number | null;
  feedback: string;
  device: string;
  appVersion: string;
  now?: Date;
}

/** Builds a submission from a measurement card, keeping only plausible tape values. */
export function buildSubmission(input: SubmissionInput): Submission {
  const tape: Submission['tape'] = {};
  for (const m of TAPE_MEASUREMENTS) {
    const v = input.tape[m.key];
    if (v !== undefined && isPlausibleTape(v)) tape[m.key] = Math.round(v * 10) / 10;
  }
  return {
    id: input.id,
    userId: input.userId,
    createdAt: (input.now ?? new Date()).toISOString(),
    appVersion: input.appVersion,
    heightCm: input.profile.heightCm,
    sidePhoto: input.sidePhoto,
    measured: input.profile.measured,
    shown: input.profile.final,
    tape,
    warnings: input.profile.warnings,
    ease: input.ease,
    trust: input.trust,
    feedback: input.feedback.trim(),
    device: input.device,
  };
}

export interface AccuracyRow {
  key: MeasurementKey;
  label: string;
  /** Submissions with both a photo value and a tape value. */
  n: number;
  /** Mean of photo − tape: positive means the app measures too large. */
  biasCm: number;
  /** Mean absolute error. */
  maeCm: number;
  /** Share of submissions within ±2 cm of the tape. */
  within2cm: number;
}

/** Per-measurement error of the raw photo estimates against tape, for measurements with data. */
export function accuracySummary(submissions: Submission[]): AccuracyRow[] {
  const rows: AccuracyRow[] = [];
  for (const m of TAPE_MEASUREMENTS) {
    const errors: number[] = [];
    for (const s of submissions) {
      const photo = s.measured[m.key]?.cm;
      const tape = s.tape[m.key];
      if (photo !== undefined && tape !== undefined) errors.push(photo - tape);
    }
    if (errors.length === 0) continue;
    const n = errors.length;
    rows.push({
      key: m.key,
      label: m.label,
      n,
      biasCm: errors.reduce((a, e) => a + e, 0) / n,
      maeCm: errors.reduce((a, e) => a + Math.abs(e), 0) / n,
      within2cm: errors.filter((e) => Math.abs(e) <= 2).length / n,
    });
  }
  return rows;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const round1 = (n: number | undefined) => (n === undefined ? '' : Math.round(n * 10) / 10);

/**
 * Long-format CSV for analysis: one row per submission and measurement, in cm.
 * Tester names and emails are left out; the tester id links rows from the same person.
 */
export function submissionsToCsv(submissions: Submission[], testers: Tester[]): string {
  const byId = new Map(testers.map((t) => [t.userId, t]));
  const header = ['submission_id', 'tester_id', 'date', 'age_range', 'sex', 'height_cm', 'side_photo', 'measurement', 'photo_cm', 'confidence', 'shown_cm', 'tape_cm', 'error_cm', 'ease', 'trust', 'app_version', 'device'];
  const rows: (string | number | null | undefined)[][] = [];
  for (const s of submissions) {
    const t = byId.get(s.userId);
    for (const m of TAPE_MEASUREMENTS) {
      const photo = s.measured[m.key];
      const tape = s.tape[m.key];
      if (!photo && tape === undefined) continue;
      rows.push([
        s.id,
        s.userId,
        s.createdAt,
        t?.ageRange,
        t?.sex,
        round1(s.heightCm),
        s.sidePhoto ? 'yes' : 'no',
        m.key,
        round1(photo?.cm),
        photo?.confidence,
        round1(s.shown[m.key]),
        round1(tape),
        photo && tape !== undefined ? round1(photo.cm - tape) : '',
        s.ease,
        s.trust,
        s.appVersion,
        s.device,
      ]);
    }
  }
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** A short, non-identifying description of the device, so results can be grouped by phone type. */
export function describeDevice(userAgent: string): string {
  const os = /iPhone|iPad/.test(userAgent) ? 'iOS' : /Android/.test(userAgent) ? 'Android' : /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : 'Other';
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /SamsungBrowser/.test(userAgent) ? 'Samsung Internet' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : 'Other';
  const mobile = /Mobi|Android|iPhone/.test(userAgent) ? 'phone' : 'desktop';
  return `${os} ${browser} (${mobile})`;
}
