import { useState } from 'react';
import { version as appVersion } from '../../package.json';
import type { MeasurementKey } from '../lib/definitions';
import type { Unit } from '../lib/format';
import { inchesToCm } from '../lib/geometry';
import { newId, type Profile } from '../lib/profiles';
import { buildSubmission, describeDevice, isPlausibleTape, TAPE_MEASUREMENTS } from '../lib/study';
import type { StudyState } from './useStudy';

interface Props {
  study: StudyState;
  profile: Profile;
  sidePhoto: boolean;
  unit: Unit;
  onNewTest: () => void;
}

function Rating({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} className={value === n ? 'on' : ''} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <span className="muted small">
        1 = {low}, 5 = {high}
      </span>
    </fieldset>
  );
}

/** Shown under the results while a tester is signed in: tape values, ratings and comments for the study. */
export function TestSubmit({ study, profile, sidePhoto, unit, onNewTest }: Props) {
  const { backend, tester } = study;
  const [tape, setTape] = useState<Partial<Record<MeasurementKey, string>>>({});
  const [ease, setEase] = useState<number | null>(null);
  const [trust, setTrust] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'sent'>('editing');
  const [error, setError] = useState<string | null>(null);
  if (!tester) return null;

  const toCm = (text: string | undefined) => {
    if (!text?.trim()) return undefined;
    const n = Number(text);
    return unit === 'cm' ? n : inchesToCm(n);
  };
  const invalid = TAPE_MEASUREMENTS.filter((m) => {
    const v = toCm(tape[m.key]);
    return v !== undefined && !isPlausibleTape(v);
  });
  const tapeCount = TAPE_MEASUREMENTS.filter((m) => toCm(tape[m.key]) !== undefined).length;
  const canSend = state === 'editing' && invalid.length === 0 && (tapeCount > 0 || feedback.trim().length > 0);

  if (state === 'sent') {
    return (
      <section className="card no-print">
        <h2>Thank you</h2>
        <p>Your test was sent. Each test makes the accuracy figures more reliable.</p>
        <div className="row">
          <button type="button" className="primary" onClick={onNewTest}>
            Run another test
          </button>
        </div>
      </section>
    );
  }

  const send = () => {
    setState('sending');
    setError(null);
    const submission = buildSubmission({
      id: newId(),
      userId: tester.userId,
      profile,
      sidePhoto,
      tape: Object.fromEntries(TAPE_MEASUREMENTS.flatMap((m) => (toCm(tape[m.key]) !== undefined ? [[m.key, toCm(tape[m.key])]] : []))),
      ease,
      trust,
      feedback,
      device: describeDevice(navigator.userAgent),
      appVersion,
    });
    backend
      .submit(submission)
      .then(() => setState('sent'))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not send. Check your connection and try again.');
        setState('editing');
      });
  };

  return (
    <section className="card no-print test-submit">
      <h2>Send this test</h2>
      <p className="muted">
        Enter the values you measured with a tape, in {unit === 'cm' ? 'centimetres' : 'inches'}. Leave out any you did not measure. Use the tape values you wrote down before seeing the
        app’s numbers.
      </p>
      <div className="tape-grid">
        {TAPE_MEASUREMENTS.map((m) => {
          const bad = invalid.includes(m);
          return (
            <label key={m.key} title={m.howToMeasure}>
              {m.label}
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={tape[m.key] ?? ''}
                aria-invalid={bad}
                className={bad ? 'invalid' : undefined}
                onChange={(e) => setTape((t) => ({ ...t, [m.key]: e.target.value }))}
              />
            </label>
          );
        })}
      </div>
      {invalid.length > 0 && <p className="error small">Check {invalid.map((m) => m.label.toLowerCase()).join(', ')}: that value does not look like a body measurement.</p>}

      <div className="row two">
        <Rating label="How easy was the app to use?" low="very hard" high="very easy" value={ease} onChange={setEase} />
        <Rating label="How close were the values to your tape?" low="far off" high="very close" value={trust} onChange={setTrust} />
      </div>
      <label className="notes">
        <span>Comments</span>
        <textarea rows={3} value={feedback} maxLength={4000} placeholder="What was confusing? Which values looked wrong? Anything else?" onChange={(e) => setFeedback(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="button" className="primary" disabled={!canSend} onClick={send}>
          {state === 'sending' ? 'Sending…' : 'Send test'}
        </button>
        <span className="muted small">
          {tapeCount} tape value{tapeCount === 1 ? '' : 's'} · photos are not sent
        </span>
      </div>
    </section>
  );
}
