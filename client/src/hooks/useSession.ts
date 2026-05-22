import { useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import {
  listSessions,
  listSessionHistory,
  deleteSession,
  stopSession,
} from '../services/api';
import type { AuthConfig, DisplayMessage, SessionItem } from '../types/api';

type RefreshAccessToken = () => Promise<string | null>;
export interface RefreshSessionsOptions {
  silent?: boolean;
}

export async function loadSessionsForConfig(
  config: AuthConfig,
  refreshAccessToken: RefreshAccessToken,
): Promise<SessionItem[]> {
  const token = await refreshAccessToken();
  if (!token) return [];
  return listSessions(
    token,
    config.externalUserId,
    config.templateId,
  );
}

export function useSession() {
  const { config, refreshAccessToken } = useAuthStore();
  const { setSessions, setLoading, removeSession } = useSessionStore();
  const { setSessionId, setMessagesTo, setLoadingHistory, removeSessionMessages } = useChatStore();
  const loadRequestId = useRef(0);

  const refreshSessions = useCallback(async (options: RefreshSessionsOptions = {}) => {
    const silent = Boolean(options.silent);
    if (!config) {
      if (!silent) setSessions([]);
      return;
    }
    if (!silent) {
      setLoading(true);
      setSessions([]);
    }
    try {
      const data = await loadSessionsForConfig(config, refreshAccessToken);
      setSessions(data);
    } catch {
      // silently fail
    } finally {
      if (!silent) setLoading(false);
    }
  }, [config, refreshAccessToken, setLoading, setSessions]);

  const loadHistory = useCallback(
    async (sessionId: string) => {
      if (!config) return;

      if (sessionId.startsWith('schedule:')) {
        const session = useSessionStore.getState().sessions.find((s) => s.SessionId === sessionId);
        const payload = (session?.Meta as Record<string, unknown>)?.resultPayload as string | undefined;
        if (payload) {
          setMessagesTo(sessionId, [{
            id: `task-result-${sessionId}-${Date.now()}`,
            role: 'assistant',
            content: payload,
            timestamp: Date.now(),
          }]);
          setSessionId(sessionId);
          setLoadingHistory(false);
          return;
        }
      }

      const requestId = ++loadRequestId.current;
      setSessionId(sessionId);

      // If we already have messages cached for this session (e.g. it's streaming),
      // skip the loading state and reuse what's there.
      const cached = useChatStore.getState().sessionMessages[sessionId];
      const isStreamingHere = !!useChatStore.getState().isStreamingMap[sessionId];
      if (cached && (cached.length > 0 || isStreamingHere)) {
        setLoadingHistory(false);
        return;
      }

      setLoadingHistory(true);

      const token = await refreshAccessToken();
      if (!token || requestId !== loadRequestId.current) {
        if (requestId === loadRequestId.current) setLoadingHistory(false);
        return;
      }

      try {
        const history = await listSessionHistory(
          token,
          sessionId,
          config.externalUserId,
          config.templateId,
        );
        if (requestId !== loadRequestId.current) return;
        // Don't overwrite if a stream began on this session while we were loading
        if (useChatStore.getState().isStreamingMap[sessionId]) return;
        const msgs: DisplayMessage[] = history
          .filter((m) => m.Type === 'message' && (m.Role === 'user' || m.Role === 'assistant'))
          .map((m) => ({
            id: m.Id,
            role: m.Role as 'user' | 'assistant',
            content: m.Content?.map((c) => c.Text).filter(Boolean).join('') || '',
            timestamp: Date.now(),
          }))
          .filter((m) => m.content.trim() !== '');
        setMessagesTo(sessionId, msgs);
      } catch {
        // silently fail
      } finally {
        if (requestId === loadRequestId.current) setLoadingHistory(false);
      }
    },
    [config, refreshAccessToken, setMessagesTo, setSessionId, setLoadingHistory],
  );

  const removeChat = useCallback(
    async (sessionId: string) => {
      if (!config) return;
      const token = await refreshAccessToken();
      if (!token) return;
      const ok = await deleteSession(token, sessionId, config.templateId);
      if (ok) {
        removeSession(sessionId);
        removeSessionMessages(sessionId);
      }
    },
    [config, refreshAccessToken, removeSession, removeSessionMessages],
  );

  const stopChat = useCallback(
    async (sessionId: string) => {
      if (!config) return;
      const token = await refreshAccessToken();
      if (!token) return;
      await stopSession(token, sessionId, config.templateId);
    },
    [config, refreshAccessToken],
  );

  return { refreshSessions, loadHistory, removeChat, stopChat };
}
