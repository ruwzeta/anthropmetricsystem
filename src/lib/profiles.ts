import { applyCorrection, buildCalibration, type Calibration, type CalibrationPair } from './calibration';
import { MEASUREMENTS, type MeasurementKey } from './definitions';
import { toUnit, type Unit } from './format';
import type { MeasuredValue } from './measure';

/** A saved measurement card for one customer. */
export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  heightCm: number;
  /** What the photos gave, before any calibration or manual edits. */
  measured: Partial<Record<MeasurementKey, MeasuredValue>>;
  /** The values the tailor will use: calibrated, then possibly edited by hand. */
  final: Partial<Record<MeasurementKey, number>>;
  /** The final values were checked with a tape, so they can teach the calibration. */
  tapeVerified: boolean;
  notes: string;
  warnings: string[];
}

export interface Settings {
  unit: Unit;
  useCalibration: boolean;
}

const PROFILES_KEY = 'bodymeasure.profiles.v1';
const SETTINGS_KEY = 'bodymeasure.settings.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the app still works for the current session.
  }
}

export function loadProfiles(): Profile[] {
  return read<Profile[]>(PROFILES_KEY, []);
}

export function saveProfiles(profiles: Profile[]): void {
  write(PROFILES_KEY, profiles);
}

export function loadSettings(): Settings {
  return { unit: 'cm', useCalibration: true, ...read<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, settings);
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Calibration pairs from every tape-verified profile. */
export function calibrationFromProfiles(profiles: Profile[]): Calibration {
  const pairs: CalibrationPair[] = [];
  for (const p of profiles) {
    if (!p.tapeVerified) continue;
    for (const [key, value] of Object.entries(p.measured) as [MeasurementKey, MeasuredValue][]) {
      const tape = p.final[key];
      if (tape !== undefined) pairs.push({ key, measuredCm: value.cm, tapeCm: tape });
    }
  }
  return buildCalibration(pairs);
}

export function initialFinalValues(measured: Profile['measured'], calibration: Calibration | null): Profile['final'] {
  const final: Profile['final'] = {};
  for (const [key, value] of Object.entries(measured) as [MeasurementKey, MeasuredValue][]) {
    final[key] = key === 'height' ? value.cm : applyCorrection(value.cm, calibration?.[key]);
  }
  return final;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per customer, one column per measurement, in the chosen unit. */
export function profilesToCsv(profiles: Profile[], unit: Unit): string {
  const header = ['Name', 'Date', ...MEASUREMENTS.map((m) => `${m.label} (${unit})`), 'Tape verified', 'Notes'];
  const rows = profiles.map((p) => [
    p.name,
    p.createdAt.slice(0, 10),
    ...MEASUREMENTS.map((m) => (p.final[m.key] !== undefined ? toUnit(p.final[m.key] as number, unit) : '')),
    p.tapeVerified ? 'yes' : 'no',
    p.notes,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
