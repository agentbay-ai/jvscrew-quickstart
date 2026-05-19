import { afterEach, describe, expect, it } from 'vitest';
import { useSessionStore } from './sessionStore';
import type { SessionItem } from '../types/api';

function session(overrides: Partial<SessionItem>): SessionItem {
  return {
    Id: overrides.Id ?? overrides.SessionId ?? 'session-1',
    Name: overrides.Name ?? '会话',
    SessionId: overrides.SessionId ?? 'session-1',
    UserId: overrides.UserId ?? 'user-1',
    Channel: overrides.Channel ?? 'web',
    CreatedAt: overrides.CreatedAt ?? '2026-04-30T10:00:00.000Z',
    UpdatedAt: overrides.UpdatedAt ?? '2026-04-30T10:00:00.000Z',
    Meta: overrides.Meta ?? {},
  };
}

afterEach(() => {
  useSessionStore.setState({ sessions: [], isLoading: false });
});

describe('session store', () => {
  it('upserts the completed current session at the top of recent sessions', () => {
    useSessionStore.getState().setSessions([
      session({ SessionId: 'old-session', Name: '旧会话' }),
    ]);

    useSessionStore.getState().upsertSession(
      session({ SessionId: 'new-session', Name: '新的会话' }),
    );
    useSessionStore.getState().upsertSession(
      session({ SessionId: 'new-session', Name: '新的会话更新' }),
    );

    expect(useSessionStore.getState().sessions.map((item) => item.SessionId)).toEqual([
      'new-session',
      'old-session',
    ]);
    expect(useSessionStore.getState().sessions[0].Name).toBe('新的会话更新');
  });
});
