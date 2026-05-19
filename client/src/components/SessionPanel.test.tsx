import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import SessionPanel from './SessionPanel';
import {
  SESSION_AUTO_REFRESH_INTERVAL_MS,
  scheduleSessionListAutoRefresh,
} from '../utils/sessionRefresh';
import type { SessionItem } from '../types/api';

const mockState = vi.hoisted(() => ({
  sessions: [] as SessionItem[],
  isLoading: false,
  currentSessionId: null as string | null,
}));

vi.mock('../stores/authStore', () => {
  const state = {
    config: {
      externalUserId: 'user-1',
      templateId: 'template-1',
      templateName: '任务执行专家',
    },
    accessToken: 'jwt-token',
    isAuthenticated: true,
  };
  return {
    useAuthStore: (selector?: (value: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});

vi.mock('../stores/sessionStore', () => ({
  useSessionStore: () => ({
    sessions: mockState.sessions,
    isLoading: mockState.isLoading,
  }),
}));

vi.mock('../stores/chatStore', () => ({
  useChatStore: (selector?: (value: { currentSessionId: string | null }) => unknown) => {
    const state = { currentSessionId: mockState.currentSessionId };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../hooks/useSession', () => ({
  useSession: () => ({
    refreshSessions: vi.fn(),
    loadHistory: vi.fn(),
    removeChat: vi.fn(),
    stopChat: vi.fn(),
  }),
}));

function session(overrides: Partial<SessionItem>): SessionItem {
  return {
    Id: overrides.Id ?? overrides.SessionId ?? 'session-1',
    Name: overrides.Name ?? '普通会话',
    SessionId: overrides.SessionId ?? 'session-1',
    UserId: overrides.UserId ?? 'user-1',
    Channel: overrides.Channel ?? 'web',
    CreatedAt: overrides.CreatedAt ?? '2026-05-01T00:00:00Z',
    UpdatedAt: overrides.UpdatedAt ?? '2026-05-01T00:00:00Z',
    Meta: overrides.Meta ?? {},
  };
}

afterEach(() => {
  mockState.sessions = [];
  mockState.isLoading = false;
  mockState.currentSessionId = null;
});

describe('SessionPanel', () => {
  it('renders a template switch button beside the current template name', () => {
    const html = renderToString(<SessionPanel onNewChat={() => undefined} />);

    expect(html).toContain('任务执行专家');
    expect(html).toContain('aria-label="切换模板"');
    expect(html).toContain('title="切换模板"');
  });

  it('marks schedule sessions with a compact task badge', () => {
    mockState.sessions = [
      session({ SessionId: 'schedule:task-1', Name: '提醒我喝水' }),
      session({ SessionId: 'session-2', Name: '普通会话' }),
    ];

    const html = renderToString(<SessionPanel onNewChat={() => undefined} />);

    expect(html).toContain('提醒我喝水');
    expect(html).toContain('任务');
    expect(html).toContain('aria-label="定时任务会话"');
    expect(html).toContain('bg-[#F5F6F8]');
    expect(html).toContain('border-[#D7DAE2]');
  });

  it('schedules silent recent-session refresh every minute and cleans it up', () => {
    const refreshSessions = vi.fn();
    let callback: (() => void) | undefined;
    const timers = {
      setInterval: vi.fn((cb: () => void, timeout: number) => {
        void timeout;
        callback = cb;
        return 42;
      }),
      clearInterval: vi.fn(),
    };

    const cleanup = scheduleSessionListAutoRefresh(refreshSessions, timers);

    expect(SESSION_AUTO_REFRESH_INTERVAL_MS).toBe(60_000);
    expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), 60_000);

    callback?.();
    expect(refreshSessions).toHaveBeenCalledWith({ silent: true });

    cleanup();
    expect(timers.clearInterval).toHaveBeenCalledWith(42);
  });
});
