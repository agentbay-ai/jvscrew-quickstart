import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createScheduledTask,
  deleteScheduledTask,
  listScheduledTaskRuns,
  listScheduledTasks,
  updateScheduledTask,
} from './tasks';

function mockFetch(data: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => data,
  })) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

function readFetchRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const parsed = new URL(url, 'http://localhost');
  return {
    url,
    parsed,
    init,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scheduled task service', () => {
  it('lists scheduled tasks through the JWT POP JSON gateway', async () => {
    const fetchMock = mockFetch({ Tasks: [], RequestId: 'req-1' });

    const result = await listScheduledTasks('jwt-token', {
      ExternalUserId: 'user-1',
      TemplateId: 'template-1',
      PageNumber: 1,
      PageSize: 20,
    });

    expect(result).toEqual({ Tasks: [], TotalCount: 0, PageNumber: 1, PageSize: 20 });
    const request = readFetchRequest(fetchMock);
    expect(request.url).toContain('/jvs/');
    expect(request.parsed.searchParams.get('Authorization')).toBe('Bearer jwt-token');
    expect(request.parsed.searchParams.get('Format')).toBe('JSON');
    expect(request.parsed.searchParams.get('TemplateId')).toBe('template-1');
    expect(request.init.method).toBe('POST');
    expect(request.headers['x-acs-action']).toBe('ListScheduledTasks');
    expect(request.headers['x-acs-version']).toBe('2026-03-11');
    expect(request.headers.Accept).toBe('application/json');
    expect(request.body).toEqual({
      ExternalUserId: 'user-1',
      TemplateId: 'template-1',
      PageNumber: 1,
      PageSize: 20,
    });
  });

  it('creates and updates scheduled tasks with the required task payload', async () => {
    const task = {
      TaskId: 'task-1',
      Name: '每日简报',
      Instruction: '总结新闻',
      Status: 'active',
      Schedule: { Type: 'cron', Expr: '0 9 * * *', Timezone: 'Asia/Shanghai' },
      Sinks: [],
      TemplateId: 'template-1',
      ExternalUserId: 'user-1',
      CreatedAt: '2026-03-22T09:00:00',
      UpdatedAt: '2026-03-22T09:00:00',
    };
    const fetchMock = mockFetch(task);

    await createScheduledTask('jwt-token', {
      Name: '每日简报',
      Instruction: '总结新闻',
      Schedule: task.Schedule,
      ExternalUserId: 'user-1',
      TemplateId: 'template-1',
    });

    let request = readFetchRequest(fetchMock);
    expect(request.headers['x-acs-action']).toBe('CreateScheduledTask');
    expect(request.body).toMatchObject({
      Name: '每日简报',
      Instruction: '总结新闻',
      ExternalUserId: 'user-1',
      TemplateId: 'template-1',
      Schedule: task.Schedule,
    });

    await updateScheduledTask('jwt-token', {
      TaskId: 'task-1',
      Name: '每日简报',
      Instruction: '总结新闻',
      Schedule: task.Schedule,
      ExternalUserId: 'user-1',
      TemplateId: 'template-1',
    });

    request = readFetchRequest(fetchMock);
    expect(request.headers['x-acs-action']).toBe('CreateScheduledTask');
    const secondCall = fetchMock.mock.calls[1] as [string, RequestInit];
    const secondHeaders = secondCall[1].headers as Record<string, string>;
    const secondBody = JSON.parse(String(secondCall[1].body));
    expect(secondHeaders['x-acs-action']).toBe('UpdateScheduledTask');
    expect(secondBody).toMatchObject({
      TaskId: 'task-1',
      TemplateId: 'template-1',
      Schedule: task.Schedule,
    });
  });

  it('deletes scheduled tasks with TaskId body', async () => {
    const fetchMock = mockFetch({ Deleted: true });

    await expect(deleteScheduledTask('jwt-token', 'task-1')).resolves.toBe(true);

    const request = readFetchRequest(fetchMock);
    expect(request.headers['x-acs-action']).toBe('DeleteScheduledTask');
    expect(request.body).toEqual({ TaskId: 'task-1' });
  });

  it('lists scheduled task runs for a specific task id', async () => {
    const fetchMock = mockFetch({ Runs: [], NextCursor: null });

    await listScheduledTaskRuns('jwt-token', {
      ExternalUserId: 'user-1',
      TemplateId: 'template-1',
      TaskId: 'task-1',
      Since: '1777543200000',
      PageSize: 50,
    });

    const request = readFetchRequest(fetchMock);
    expect(request.headers['x-acs-action']).toBe('ListScheduledTaskRuns');
    expect(request.parsed.searchParams.get('TemplateId')).toBe('template-1');
    expect(request.body).toEqual({
      ExternalUserId: 'user-1',
      TemplateId: 'template-1',
      TaskId: 'task-1',
      Since: '1777543200000',
      PageSize: 50,
    });
  });

  it('does not send unsupported Status when updating scheduled tasks', async () => {
    const fetchMock = mockFetch({
      TaskId: 'task-1',
      Status: 'active',
      Schedule: { Type: 'cron', Expr: '0 9 * * *', Timezone: 'Asia/Shanghai' },
    });

    await updateScheduledTask('jwt-token', {
      TaskId: 'task-1',
      Name: '每日简报',
      Instruction: '总结新闻',
      Schedule: { Type: 'cron', Expr: '0 9 * * *', Timezone: 'Asia/Shanghai' },
      Status: 'paused',
    });

    const request = readFetchRequest(fetchMock);
    expect(request.body).not.toHaveProperty('Status');
  });
});
