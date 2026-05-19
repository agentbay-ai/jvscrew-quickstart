import { describe, expect, it } from 'vitest';
import {
  getAppendableTaskRunMessages,
  taskIdFromScheduleSession,
} from './scheduledRuns';
import type { TaskRun } from '../types/tasks';

function run(overrides: Partial<TaskRun>): TaskRun {
  return {
    RunId: overrides.RunId ?? 'run-1',
    TaskId: overrides.TaskId ?? 'task-1',
    TemplateId: overrides.TemplateId ?? 'template-a',
    ExternalUserId: overrides.ExternalUserId ?? 'user-1',
    Status: overrides.Status ?? 'succeeded',
    ResultPayload: overrides.ResultPayload ?? '定时任务结果',
    StartedAt: overrides.StartedAt ?? '2026-04-30T10:00:01.000Z',
    FinishedAt: overrides.FinishedAt ?? '2026-04-30T10:00:05.000Z',
    CreatedAt: overrides.CreatedAt ?? '2026-04-30T10:00:00.000Z',
  };
}

describe('scheduled run helpers', () => {
  it('returns messages only for unseen completed runs after the cursor time in the current template', () => {
    const seenRunIds = new Set(['seen-run']);
    const since = Date.parse('2026-04-30T10:00:00.000Z');

    const messages = getAppendableTaskRunMessages({
      runs: [
        run({ RunId: 'seen-run', ResultPayload: '已处理' }),
        run({ RunId: 'old-run', FinishedAt: '2026-04-30T09:59:59.000Z', ResultPayload: '旧结果' }),
        run({ RunId: 'other-template', TemplateId: 'template-b', ResultPayload: '其他模板' }),
        run({ RunId: 'running-run', Status: 'running', ResultPayload: '运行中' }),
        run({ RunId: 'new-run', ResultPayload: '新的定时任务结果' }),
      ],
      templateId: 'template-a',
      since,
      seenRunIds,
    });

    expect(messages).toEqual([
      {
        id: 'task-run-new-run',
        role: 'assistant',
        content: '新的定时任务结果',
        timestamp: Date.parse('2026-04-30T10:00:05.000Z'),
      },
    ]);
    expect(seenRunIds.has('new-run')).toBe(true);
  });

  it('extracts the task id from scheduled task session ids', () => {
    expect(taskIdFromScheduleSession('schedule:task-1')).toBe('task-1');
    expect(taskIdFromScheduleSession('regular-session')).toBeNull();
    expect(taskIdFromScheduleSession(null)).toBeNull();
  });

  it('returns messages only for runs that belong to the current scheduled task session', () => {
    const seenRunIds = new Set<string>();
    const since = Date.parse('2026-04-30T10:00:00.000Z');

    const messages = getAppendableTaskRunMessages({
      runs: [
        run({ RunId: 'current-session-run', TaskId: 'task-current' }),
        run({ RunId: 'other-session-run', TaskId: 'task-other', ResultPayload: '其他会话结果' }),
        run({ RunId: 'unbound-run', TaskId: 'task-unbound', ResultPayload: '未绑定结果' }),
      ],
      templateId: 'template-a',
      since,
      seenRunIds,
      currentSessionId: 'schedule:task-current',
    });

    expect(messages).toEqual([
      {
        id: 'task-run-current-session-run',
        role: 'assistant',
        content: '定时任务结果',
        timestamp: Date.parse('2026-04-30T10:00:05.000Z'),
      },
    ]);
  });

  it('does not return scheduled task runs in regular chat sessions', () => {
    const messages = getAppendableTaskRunMessages({
      runs: [run({ RunId: 'regular-session-run', TaskId: 'task-1' })],
      templateId: 'template-a',
      since: Date.parse('2026-04-30T10:00:00.000Z'),
      seenRunIds: new Set<string>(),
      currentSessionId: 'regular-session',
    });

    expect(messages).toEqual([]);
  });
});
