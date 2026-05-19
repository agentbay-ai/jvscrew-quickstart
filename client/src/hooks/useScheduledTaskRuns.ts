import { useEffect, useRef } from 'react';
import { listScheduledTaskRuns } from '../services/tasks';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useTaskRunNotificationStore } from '../stores/taskRunNotificationStore';

const POLL_INTERVAL_MS = 60_000;
const STORAGE_KEY_SINCE = 'jvscrew_task_poll_since';
const STORAGE_KEY_SEEN = 'jvscrew_task_poll_seen';

function loadSince(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEY_SINCE);
    if (val) return Number(val);
  } catch { /* ignore */ }
  return 0;
}

function persistSince(ts: number) {
  try { localStorage.setItem(STORAGE_KEY_SINCE, String(ts)); } catch { /* ignore */ }
}

function loadSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEEN);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function persistSeenIds(ids: Set<string>) {
  try {
    const arr = [...ids].slice(-200);
    localStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify(arr));
  } catch { /* ignore */ }
}

export function useScheduledTaskRunPolling(enabled: boolean) {
  const configRef = useRef(useAuthStore.getState().config);
  const refreshAccessToken = useAuthStore((s) => s.refreshAccessToken);
  const addNotification = useTaskRunNotificationStore((s) => s.addNotification);

  const sinceRef = useRef(loadSince() || Date.now());
  const seenRef = useRef(loadSeenIds());

  useEffect(() => {
    const unsub = useAuthStore.subscribe((s) => { configRef.current = s.config; });
    return unsub;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;

    async function poll() {
      const config = configRef.current;
      if (!config || stopped) return;
      const token = await refreshAccessToken();
      if (!token || stopped) return;

      try {
        const params = {
          ExternalUserId: config.externalUserId,
          TemplateId: config.templateId,
          Since: sinceRef.current,
          PageSize: 50,
        };
        console.log('[TaskRunPoll] polling with params:', params);

        const data = await listScheduledTaskRuns(token, params);
        if (stopped) return;

        console.log('[TaskRunPoll] response:', {
          totalRuns: data.Runs?.length ?? 0,
          runs: data.Runs?.map((r) => ({
            RunId: r.RunId,
            TaskId: r.TaskId,
            Status: r.Status,
            FinishedAt: r.FinishedAt,
            hasPayload: !!r.ResultPayload,
          })),
        });

        const newRuns = (data.Runs ?? []).filter((run) => {
          if (seenRef.current.has(run.RunId)) return false;
          if (run.Status !== 'succeeded') return false;
          if (!run.ResultPayload) return false;
          return true;
        });

        if (newRuns.length === 0) {
          sinceRef.current = Date.now();
          persistSince(sinceRef.current);
          return;
        }

        console.log('[TaskRunPoll] new completed runs:', newRuns.length);

        for (const run of newRuns) {
          seenRef.current.add(run.RunId);
          const ts = Date.parse(run.FinishedAt || run.CreatedAt || run.StartedAt) || Date.now();
          const virtualSessionId = `schedule:${run.TaskId}`;

          useSessionStore.getState().upsertSession({
            Id: virtualSessionId,
            Name: `[定时] ${run.TaskId.slice(0, 8)}`,
            SessionId: virtualSessionId,
            UserId: config.externalUserId,
            Channel: 'scheduled_task',
            CreatedAt: run.CreatedAt || new Date(ts).toISOString(),
            UpdatedAt: run.FinishedAt || new Date(ts).toISOString(),
            Meta: { resultPayload: run.ResultPayload },
          });

          addNotification({
            id: run.RunId,
            taskId: run.TaskId,
            taskName: run.TaskId,
            content: run.ResultPayload!,
            timestamp: ts,
          });
        }

        sinceRef.current = Date.now();
        persistSince(sinceRef.current);
        persistSeenIds(seenRef.current);
      } catch (err) {
        console.error('[TaskRunPoll] poll error:', err);
      }
    }

    if (!sinceRef.current) {
      sinceRef.current = Date.now();
      persistSince(sinceRef.current);
    }

    void poll();
    const timer = window.setInterval(() => { void poll(); }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [enabled, refreshAccessToken, addNotification]);
}
