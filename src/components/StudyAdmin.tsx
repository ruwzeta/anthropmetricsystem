import { useEffect, useState } from 'react';
import { downloadFile } from '../lib/profiles';
import { accuracySummary, submissionsToCsv, type Submission, type Tester } from '../lib/study';
import type { StudyBackend } from '../lib/studyBackend';

interface Props {
  backend: StudyBackend;
}

const cm = (n: number, signed = false) => `${signed && n >= 0 ? '+' : ''}${n.toFixed(1)} cm`;
const mean = (values: number[]) => (values.length ? values.reduce((a, v) => a + v, 0) / values.length : null);

export function StudyAdmin({ backend }: Props) {
  const [data, setData] = useState<{ testers: Tester[]; submissions: Submission[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    backend
      .allResults()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load results.'));
  };
  useEffect(load, [backend]);

  if (error) return <section className="card error">{error}</section>;
  if (!data) return <section className="card muted">Loading study results…</section>;

  const { testers, submissions } = data;
  const rows = accuracySummary(submissions);
  const names = new Map(testers.map((t) => [t.userId, t.displayName]));
  const ease = mean(submissions.flatMap((s) => (s.ease ? [s.ease] : [])));
  const trust = mean(submissions.flatMap((s) => (s.trust ? [s.trust] : [])));
  const comments = submissions.filter((s) => s.feedback.trim());
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <section className="card">
      <header className="results-head">
        <div>
          <h2>Study results</h2>
          <p className="muted">
            {testers.length} tester{testers.length === 1 ? '' : 's'} · {submissions.length} test{submissions.length === 1 ? '' : 's'}
            {ease !== null && ` · ease ${ease.toFixed(1)}/5`}
            {trust !== null && ` · fit ${trust.toFixed(1)}/5`}
          </p>
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={load}>
            Refresh
          </button>
          <button type="button" className="secondary" disabled={!submissions.length} onClick={() => downloadFile(`bodymeasure-study-${stamp}.csv`, submissionsToCsv(submissions, testers), 'text/csv')}>
            CSV
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!submissions.length}
            onClick={() => downloadFile(`bodymeasure-study-${stamp}.json`, JSON.stringify({ testers, submissions }, null, 2), 'application/json')}
          >
            JSON
          </button>
        </div>
      </header>

      <h3>Accuracy against tape</h3>
      {rows.length === 0 ? (
        <p className="muted">No tests with tape values yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="measurements">
          <thead>
            <tr>
              <th>Measurement</th>
              <th className="num">Tests</th>
              <th className="num">Bias</th>
              <th className="num">Mean error</th>
              <th className="num">Within ±2</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num">{r.n}</td>
                <td className="num">{cm(r.biasCm, true)}</td>
                <td className="num">{cm(r.maeCm)}</td>
                <td className="num">{Math.round(r.within2cm * 100)}%</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        Compares the raw photo estimate with the tester’s tape value, before any calibration. Bias above zero means the app measures too large. The CSV has one row per test and measurement,
        with testers identified only by an id.
      </p>

      <h3>Feedback</h3>
      {comments.length === 0 ? (
        <p className="muted">No comments yet.</p>
      ) : (
        <ul className="feedback">
          {comments.map((s) => (
            <li key={s.id}>
              <p>{s.feedback}</p>
              <p className="muted small">
                {names.get(s.userId) ?? 'Tester'} · {new Date(s.createdAt).toLocaleDateString()} · {s.device}
                {s.ease && ` · ease ${s.ease}/5`}
                {s.trust && ` · fit ${s.trust}/5`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
