import { useEffect, useState } from 'react';
import { formatLength, type Unit } from '../lib/format';
import { AGE_RANGES, CONSENT_VERSION, SEXES, type Submission } from '../lib/study';
import { StudyAdmin } from './StudyAdmin';
import type { StudyState } from './useStudy';

interface Props {
  study: StudyState;
  unit: Unit;
  onStartTest: () => void;
}

export function TestingView({ study, unit, onStartTest }: Props) {
  const { backend, loading, user, tester, isAdmin } = study;
  if (loading) return <section className="card muted">Loading…</section>;
  return (
    <>
      {backend.mode === 'local' && (
        <p className="issues no-print">
          Test mode: tester accounts are not connected to a server yet, so sign-ins and results stay on this device. The app owner can connect Supabase to collect results from every tester.
        </p>
      )}
      {!user ? <SignIn study={study} /> : !tester ? <Consent study={study} /> : <TesterHome study={study} unit={unit} onStartTest={onStartTest} />}
      {user && isAdmin && (tester || backend.mode === 'cloud') && <StudyAdmin backend={backend} />}
    </>
  );
}

function SignIn({ study }: { study: StudyState }) {
  const { backend } = study;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
    setBusy(false);
  };

  return (
    <section className="card step">
      <h2>Help test BodyMeasure</h2>
      <p>
        We are checking how close the app’s measurements are to a tape measure. As a tester you take your own measurements with the app, measure yourself with a tape, and tell us how it
        went. It takes about 15 minutes.
      </p>
      {!sent ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await backend.requestSignIn(email.trim());
              setSent(backend.mode === 'cloud');
            });
          }}
        >
          <label>
            Email
            <input type="email" required value={email} autoComplete="email" placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button type="submit" className="primary" disabled={busy || !email.trim()}>
              {backend.mode === 'cloud' ? 'Email me a sign-in link' : 'Sign in on this device'}
            </button>
          </div>
          <p className="muted small">No password needed. We only use your email to sign you in and to contact you about the study.</p>
        </form>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => backend.verifyCode(email.trim(), code.trim()));
          }}
        >
          <p className="ok">Check your email ({email}).</p>
          <p className="muted small">Open the link on this device, or type the code from the email here.</p>
          <label>
            Code
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button type="submit" className="primary" disabled={busy || code.trim().length < 6}>
              Sign in
            </button>
            <button type="button" className="secondary" onClick={() => setSent(false)}>
              Use another email
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Consent({ study }: { study: StudyState }) {
  const { backend, user, setTester } = study;
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [sex, setSex] = useState('');
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  return (
    <section className="card step">
      <h2>Before you start</h2>
      <div className="prose consent">
        <p>Please read what we collect and why.</p>
        <ul>
          <li>
            <strong>Your photos stay on your phone.</strong> The body points are found inside the browser. Photos are never uploaded or stored by us.
          </li>
          <li>
            <strong>What we store:</strong> your email and name, the age range and sex you choose to give, your height, the measurements the app calculated, the tape measurements you enter,
            your ratings and comments, and the type of device and browser.
          </li>
          <li>
            <strong>Why:</strong> to measure the app’s accuracy for a research study on photo-based body measurement and to improve the app. Results are reported without names.
          </li>
          <li>
            <strong>Who can see it:</strong> only you and the study team.
          </li>
          <li>
            <strong>You can stop at any time.</strong> “Withdraw and delete my data” on the Testing page removes everything you sent.
          </li>
        </ul>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const tester = {
            userId: user.id,
            email: user.email,
            displayName: name.trim(),
            ageRange: ageRange || null,
            sex: sex || null,
            consentVersion: CONSENT_VERSION,
            consentedAt: new Date().toISOString(),
          };
          backend
            .saveTester(tester)
            .then(() => setTester(tester))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not save. Try again.'))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Name
          <input required value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="row two">
          <label>
            Age range (optional)
            <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
              <option value="">Prefer not to say</option>
              {AGE_RANGES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Sex (optional)
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="">Prefer not to say</option>
              {SEXES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted small">Age range and sex help us check whether accuracy differs between groups of people.</p>
        <label className="check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />I am 18 or older.
        </label>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I agree to take part and for the data above to be stored and used for the study.
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" className="primary" disabled={busy || !adult || !agree || !name.trim()}>
            I agree, continue
          </button>
          <button type="button" className="secondary" onClick={() => void backend.signOut()}>
            Not now
          </button>
        </div>
      </form>
    </section>
  );
}

function TesterHome({ study, unit, onStartTest }: Props) {
  const { backend, tester, setTester } = study;
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    backend
      .mySubmissions()
      .then((s) => active && setSubmissions(s))
      .catch(() => active && setError('Could not load your tests.'));
    return () => {
      active = false;
    };
  }, [backend]);

  if (!tester) return null;
  const sorted = [...(submissions ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="card">
      <header className="results-head">
        <div>
          <h2>Hi {tester.displayName}</h2>
          <p className="muted">Signed in as {tester.email}</p>
        </div>
        <button type="button" className="link" onClick={() => void backend.signOut()}>
          Sign out
        </button>
      </header>

      <h3>How to run a test</h3>
      <ol className="prose">
        <li>
          <strong>Measure yourself with a tape first</strong>, before you look at the app’s numbers, and write the values down. Ask someone to help; the “How to measure” text on the
          results card says where each measurement goes.
        </li>
        <li>Take the front and side photos in the app, in fitted clothes.</li>
        <li>On the results screen, enter your tape values, rate the app and send the test.</li>
      </ol>
      <div className="row">
        <button type="button" className="primary" onClick={onStartTest}>
          Start a test
        </button>
      </div>

      <h3>Your tests</h3>
      {error && <p className="error">{error}</p>}
      {submissions === null && !error ? (
        <p className="muted">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul className="customers">
          {sorted.map((s) => {
            const taped = Object.keys(s.tape).length;
            return (
              <li key={s.id}>
                <span className="customer">
                  <span className="label">{new Date(s.createdAt).toLocaleString()}</span>
                  <span className="muted small">
                    height {formatLength(s.heightCm, unit)} · {taped} tape value{taped === 1 ? '' : 's'}
                    {s.sidePhoto ? '' : ' · no side photo'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="row">
        <button
          type="button"
          className="link danger"
          onClick={() => {
            if (!confirm('Withdraw from the study and delete your details and every test you sent?')) return;
            backend
              .deleteMyData()
              .then(() => {
                setTester(null);
                return backend.signOut();
              })
              .catch(() => setError('Could not delete your data. Try again.'));
          }}
        >
          Withdraw and delete my data
        </button>
      </div>
    </section>
  );
}
