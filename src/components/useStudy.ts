import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONSENT_VERSION, type Tester } from '../lib/study';
import { createStudyBackend, type StudyBackend, type StudyUser } from '../lib/studyBackend';

export interface StudyState {
  backend: StudyBackend;
  loading: boolean;
  user: StudyUser | null;
  /** Set once the signed-in user has agreed to the current consent text. */
  tester: Tester | null;
  isAdmin: boolean;
  setTester: (tester: Tester | null) => void;
}

/** Tester sign-in state, shared by the Testing tab and the results screen. */
export function useStudy(): StudyState {
  const backend = useMemo(createStudyBackend, []);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<StudyUser | null>(null);
  const [tester, setTester] = useState<Tester | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const userId = useRef<string | null | undefined>(undefined);

  const load = useCallback(
    async (u: StudyUser | null) => {
      userId.current = u?.id ?? null;
      setUser(u);
      if (!u) {
        setTester(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const [t, admin] = await Promise.all([backend.getTester(), backend.isAdmin()]);
        setTester(t && t.consentVersion === CONSENT_VERSION ? t : null);
        setIsAdmin(admin);
      } catch {
        setTester(null);
        setIsAdmin(false);
      }
      setLoading(false);
    },
    [backend],
  );

  useEffect(() => {
    let active = true;
    backend
      .getUser()
      .then((u) => {
        if (active) void load(u);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    const unsubscribe = backend.onAuthChange((u) => {
      // Supabase calls back with the same session on token refresh; only reload on a real change.
      if ((u?.id ?? null) !== userId.current) void load(u);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [backend, load]);

  return { backend, loading, user, tester, isAdmin, setTester };
}
