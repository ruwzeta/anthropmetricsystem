export type MeasurementKey =
  | 'height'
  | 'neck'
  | 'chest'
  | 'waist'
  | 'hip'
  | 'thigh'
  | 'shoulderWidth'
  | 'sleeveLength'
  | 'armLength'
  | 'sleeveInseam'
  | 'backLength'
  | 'inseam'
  | 'outseam';

export type MeasurementKind = 'girth' | 'length';

export interface MeasurementDefinition {
  key: MeasurementKey;
  label: string;
  kind: MeasurementKind;
  /** How a tailor takes this measurement with a tape, shown next to the value. */
  howToMeasure: string;
  /** Which garment groups the measurement is used for. */
  group: 'Upper body' | 'Lower body' | 'General';
}

/** Measurements in the order a tailor usually writes them down. */
export const MEASUREMENTS: readonly MeasurementDefinition[] = [
  { key: 'height', label: 'Height', kind: 'length', group: 'General', howToMeasure: 'Top of the head to the floor, standing straight without shoes.' },
  { key: 'neck', label: 'Neck', kind: 'girth', group: 'Upper body', howToMeasure: 'Around the base of the neck, where a shirt collar sits.' },
  { key: 'chest', label: 'Chest / bust', kind: 'girth', group: 'Upper body', howToMeasure: 'Around the fullest part of the chest, just under the armpits, tape level.' },
  { key: 'waist', label: 'Waist', kind: 'girth', group: 'Upper body', howToMeasure: 'Around the natural waist, the narrowest part of the torso.' },
  { key: 'shoulderWidth', label: 'Shoulder width', kind: 'length', group: 'Upper body', howToMeasure: 'Across the back from one shoulder point to the other.' },
  { key: 'sleeveLength', label: 'Sleeve length', kind: 'length', group: 'Upper body', howToMeasure: 'From the centre back of the neck, over the shoulder point, down to the wrist.' },
  { key: 'armLength', label: 'Arm length', kind: 'length', group: 'Upper body', howToMeasure: 'From the shoulder point, past the elbow, to the wrist bone.' },
  { key: 'sleeveInseam', label: 'Sleeve inseam', kind: 'length', group: 'Upper body', howToMeasure: 'From the armpit along the inside of the arm to the wrist.' },
  { key: 'backLength', label: 'Back length', kind: 'length', group: 'Upper body', howToMeasure: 'From the base of the neck down the spine to the natural waist.' },
  { key: 'hip', label: 'Hip / seat', kind: 'girth', group: 'Lower body', howToMeasure: 'Around the fullest part of the hips and seat, feet together.' },
  { key: 'thigh', label: 'Thigh', kind: 'girth', group: 'Lower body', howToMeasure: 'Around the fullest part of one thigh, just below the crotch.' },
  { key: 'inseam', label: 'Inseam', kind: 'length', group: 'Lower body', howToMeasure: 'From the crotch straight down the inside leg to the floor.' },
  { key: 'outseam', label: 'Outseam', kind: 'length', group: 'Lower body', howToMeasure: 'From the natural waist down the outside of the leg to the floor.' },
];

export const MEASUREMENT_BY_KEY: Record<MeasurementKey, MeasurementDefinition> = Object.fromEntries(
  MEASUREMENTS.map((m) => [m.key, m]),
) as Record<MeasurementKey, MeasurementDefinition>;
