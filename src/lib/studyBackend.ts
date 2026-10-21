import type { SupabaseClient } from '@supabase/supabase-js';
import type { MeasurementKey } from './definitions';
import type { MeasuredValue } from './measure';
import { newId } from './profiles';
import type { Submission, Tester } from './study';

export interface StudyUser {
  id: string;
  email: string;
}

/**
 * Where tester accounts and test results live.
 * `cloud` is a Supabase project shared by every tester; `local` keeps everything on this device,
 * so the testing flow still works (and can be tried out) before a Supabase project is set up.
 */
export interface StudyBackend {
  mode: 'cloud' | 'local';
  getUser(): Promise<StudyUser | null>;
  /** Called with the new user whenever someone signs in or out. Returns an unsubscribe function. */
  onAuthChange(callback: (user: StudyUser | null) => void): () => void;
  /** Cloud: emails a sign-in link and code. Local: signs in at once. */
  requestSignIn(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  getTester(): Promise<Tester | null>;
  saveTester(tester: Tester): Promise<void>;
  submit(submission: Submission): Promise<void>;
  mySubmissions(): Promise<Submission[]>;
  isAdmin(): Promise<boolean>;
  allResults(): Promise<{ testers: Tester[]; submissions: Submission[] }>;
  /** Withdraw from the study: removes the tester record and every submission. */
  deleteMyData(): Promise<void>;
}

export function cloudConfig(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function createStudyBackend(): StudyBackend {
  const config = cloudConfig();
  return config ? new CloudBackend(config.url, config.key) : new LocalBackend();
}

/* ---------- Local (this device only) ---------- */

interface LocalState {
  user: StudyUser | null;
  testers: Tester[];
  submissions: Submission[];
}

const LOCAL_KEY = 'bodymeasure.study.v1';

export class LocalBackend implements StudyBackend {
  mode = 'local' as const;
  private listeners = new Set<(user: StudyUser | null) => void>();
  /** The last state written, so the session keeps working when storage is unavailable. */
  private memory: LocalState | null = null;

  private read(): LocalState {
    if (this.memory) return this.memory;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw) as LocalState;
    } catch {
      // Fall through to an empty state.
    }
    return { user: null, testers: [], submissions: [] };
  }

  private write(state: LocalState): void {
    this.memory = state;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode); the state then lasts until the page closes.
    }
  }

  private requireUser(): StudyUser {
    const user = this.read().user;
    if (!user) throw new Error('Sign in first.');
    return user;
  }

  async getUser() {
    return this.read().user;
  }

  onAuthChange(callback: (user: StudyUser | null) => void) {
    this.listeners.add(callback);
    return () => void this.listeners.delete(callback);
  }

  async requestSignIn(email: string) {
    const state = this.read();
    const existing = state.testers.find((t) => t.email === email);
    const user = { id: existing?.userId ?? newId(), email };
    this.write({ ...state, user });
    this.listeners.forEach((l) => l(user));
  }

  async verifyCode() {
    // Local sign-in needs no code.
  }

  async signOut() {
    this.write({ ...this.read(), user: null });
    this.listeners.forEach((l) => l(null));
  }

  async getTester() {
    const state = this.read();
    return state.testers.find((t) => t.userId === state.user?.id) ?? null;
  }

  async saveTester(tester: Tester) {
    const state = this.read();
    this.write({ ...state, testers: [...state.testers.filter((t) => t.userId !== tester.userId), tester] });
  }

  async submit(submission: Submission) {
    const state = this.read();
    this.write({ ...state, submissions: [...state.submissions, submission] });
  }

  async mySubmissions() {
    const user = this.requireUser();
    return this.read().submissions.filter((s) => s.userId === user.id);
  }

  async isAdmin() {
    // Everything stored locally belongs to whoever holds the device.
    return true;
  }

  async allResults() {
    const { testers, submissions } = this.read();
    return { testers, submissions };
  }

  async deleteMyData() {
    const user = this.requireUser();
    const state = this.read();
    this.write({
      user: state.user,
      testers: state.testers.filter((t) => t.userId !== user.id),
      submissions: state.submissions.filter((s) => s.userId !== user.id),
    });
  }
}

/* ---------- Cloud (Supabase) ---------- */

interface TesterRow {
  user_id: string;
  display_name: string;
  email: string;
  age_range: string | null;
  sex: string | null;
  consent_version: string;
  consented_at: string;
}

interface SubmissionRow {
  id: string;
  user_id: string;
  created_at: string;
  app_version: string;
  height_cm: number;
  side_photo: boolean;
  measured: Partial<Record<MeasurementKey, MeasuredValue>>;
  shown: Partial<Record<MeasurementKey, number>>;
  tape: Partial<Record<MeasurementKey, number>>;
  warnings: string[];
  ease: number | null;
  trust: number | null;
  feedback: string;
  device: string;
}

const testerFromRow = (r: TesterRow): Tester => ({
  userId: r.user_id,
  displayName: r.display_name,
  email: r.email,
  ageRange: r.age_range,
  sex: r.sex,
  consentVersion: r.consent_version,
  consentedAt: r.consented_at,
});

const testerToRow = (t: Tester): TesterRow => ({
  user_id: t.userId,
  display_name: t.displayName,
  email: t.email,
  age_range: t.ageRange,
  sex: t.sex,
  consent_version: t.consentVersion,
  consented_at: t.consentedAt,
});

const submissionFromRow = (r: SubmissionRow): Submission => ({
  id: r.id,
  userId: r.user_id,
  createdAt: r.created_at,
  appVersion: r.app_version,
  heightCm: Number(r.height_cm),
  sidePhoto: r.side_photo,
  measured: r.measured,
  shown: r.shown,
  tape: r.tape,
  warnings: r.warnings,
  ease: r.ease,
  trust: r.trust,
  feedback: r.feedback,
  device: r.device,
});

const submissionToRow = (s: Submission): SubmissionRow => ({
  id: s.id,
  user_id: s.userId,
  created_at: s.createdAt,
  app_version: s.appVersion,
  height_cm: s.heightCm,
  side_photo: s.sidePhoto,
  measured: s.measured,
  shown: s.shown,
  tape: s.tape,
  warnings: s.warnings,
  ease: s.ease,
  trust: s.trust,
  feedback: s.feedback,
  device: s.device,
});

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

class CloudBackend implements StudyBackend {
  mode = 'cloud' as const;
  private client: Promise<SupabaseClient>;

  constructor(url: string, key: string) {
    // Loaded on demand, so the app never downloads the Supabase client when no project is configured.
    this.client = import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key));
  }

  async getUser() {
    const supabase = await this.client;
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    return user ? { id: user.id, email: user.email ?? '' } : null;
  }

  onAuthChange(callback: (user: StudyUser | null) => void) {
    let unsubscribe = () => {};
    let cancelled = false;
    void this.client.then((supabase) => {
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  async requestSignIn(email: string) {
    const supabase = await this.client;
    // The query string survives the redirect; Supabase puts its tokens in the hash.
    const redirect = window.location.origin + window.location.pathname + '?tab=testing';
    check(await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }));
  }

  async verifyCode(email: string, code: string) {
    const supabase = await this.client;
    check(await supabase.auth.verifyOtp({ email, token: code, type: 'email' }));
  }

  async signOut() {
    const supabase = await this.client;
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  async getTester() {
    const supabase = await this.client;
    const user = await this.getUser();
    if (!user) return null;
    const row = check(await supabase.from('testers').select('*').eq('user_id', user.id).maybeSingle<TesterRow>());
    return row ? testerFromRow(row) : null;
  }

  async saveTester(tester: Tester) {
    const supabase = await this.client;
    check(await supabase.from('testers').upsert(testerToRow(tester)));
  }

  async submit(submission: Submission) {
    const supabase = await this.client;
    check(await supabase.from('test_submissions').insert(submissionToRow(submission)));
  }

  async mySubmissions() {
    const supabase = await this.client;
    const user = await this.getUser();
    if (!user) return [];
    const rows = check(await supabase.from('test_submissions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).returns<SubmissionRow[]>());
    return (rows ?? []).map(submissionFromRow);
  }

  async isAdmin() {
    const supabase = await this.client;
    const { data, error } = await supabase.rpc('is_study_admin');
    return !error && data === true;
  }

  async allResults() {
    const supabase = await this.client;
    const testers = check(await supabase.from('testers').select('*').returns<TesterRow[]>());
    const submissions = check(await supabase.from('test_submissions').select('*').order('created_at', { ascending: false }).returns<SubmissionRow[]>());
    return { testers: (testers ?? []).map(testerFromRow), submissions: (submissions ?? []).map(submissionFromRow) };
  }

  async deleteMyData() {
    const supabase = await this.client;
    const user = await this.getUser();
    if (!user) return;
    // Submissions are removed with the tester row (on delete cascade).
    check(await supabase.from('testers').delete().eq('user_id', user.id));
  }
}
