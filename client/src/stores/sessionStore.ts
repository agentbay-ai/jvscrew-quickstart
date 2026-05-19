import { create } from 'zustand';
import type { SessionItem } from '../types/api';

interface SessionState {
  sessions: SessionItem[];
  isLoading: boolean;

  setSessions: (sessions: SessionItem[]) => void;
  setLoading: (loading: boolean) => void;
  upsertSession: (session: SessionItem) => void;
  removeSession: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  isLoading: false,

  setSessions: (sessions) => set({ sessions }),
  setLoading: (loading) => set({ isLoading: loading }),
  upsertSession: (session) =>
    set((s) => ({
      sessions: [
        session,
        ...s.sessions.filter((item) => item.SessionId !== session.SessionId),
      ],
    })),
  removeSession: (sessionId) =>
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.SessionId !== sessionId),
    })),
}));
