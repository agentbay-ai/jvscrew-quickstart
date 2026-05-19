import type { RefreshSessionsOptions } from '../hooks/useSession';

export const SESSION_AUTO_REFRESH_INTERVAL_MS = 60_000;

interface SessionRefreshTimers {
  setInterval: (handler: () => void, timeout: number) => number;
  clearInterval: (handle: number) => void;
}

export function scheduleSessionListAutoRefresh(
  refreshSessions: (options?: RefreshSessionsOptions) => void | Promise<void>,
  timers: SessionRefreshTimers = window,
): () => void {
  const timer = timers.setInterval(() => {
    void refreshSessions({ silent: true });
  }, SESSION_AUTO_REFRESH_INTERVAL_MS);
  return () => timers.clearInterval(timer);
}
