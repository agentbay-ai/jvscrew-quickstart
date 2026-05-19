import type { DisplayMessage } from '../types/api';
import type { TaskRun } from '../types/tasks';

interface AppendableTaskRunOptions {
  runs: TaskRun[];
  templateId?: string;
  since: number;
  seenRunIds: Set<string>;
  currentSessionId?: string | null;
}

const SCHEDULE_SESSION_PREFIX = 'schedule:';

export function taskIdFromScheduleSession(sessionId?: string | null): string | null {
  if (!sessionId?.startsWith(SCHEDULE_SESSION_PREFIX)) return null;
  const taskId = sessionId.slice(SCHEDULE_SESSION_PREFIX.length).trim();
  return taskId || null;
}

function runTimestamp(run: TaskRun): number {
  const raw = run.FinishedAt || run.CreatedAt || run.StartedAt;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getLastMessageTimestamp(messages: DisplayMessage[]): number {
  return messages.reduce((latest, message) => Math.max(latest, message.timestamp), 0);
}

export function getAppendableTaskRunMessages({
  runs,
  templateId,
  since,
  seenRunIds,
  currentSessionId,
}: AppendableTaskRunOptions): DisplayMessage[] {
  const currentTaskId = currentSessionId === undefined
    ? undefined
    : taskIdFromScheduleSession(currentSessionId);

  return runs
    .filter((run) => {
      if (seenRunIds.has(run.RunId)) return false;
      if (templateId && run.TemplateId !== templateId) return false;
      if (currentSessionId !== undefined && run.TaskId !== currentTaskId) return false;
      if (run.Status !== 'succeeded' || !run.ResultPayload) return false;
      return runTimestamp(run) > since;
    })
    .sort((a, b) => runTimestamp(a) - runTimestamp(b))
    .map((run) => {
      seenRunIds.add(run.RunId);
      return {
        id: `task-run-${run.RunId}`,
        role: 'assistant',
        content: run.ResultPayload ?? '',
        timestamp: runTimestamp(run),
      };
    });
}
