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

const tsOf = (s: SessionItem): number =>
  new Date(s.UpdatedAt || s.CreatedAt || 0).getTime();

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  isLoading: false,

  /**
   * 写入逻辑：
   * - 空数组 `[]` 视为"显式清空"（模板切换 / 切用户 / 手动 refresh 前的 reset
   *   都会先 setSessions([])），直接置空，不保留任何本地条目
   * - 非空数组走合并：以服务端列表为基线（保证增删能同步），但若同一 SessionId
   *   在本地有更新的 UpdatedAt（刚 onDone 完一轮对话），保留本地版本，避免 60s
   *   静默轮询把"刚刚活跃"的会话往下挤；本地有、服务端没有的会话（刚创建未同步）
   *   也保留
   */
  setSessions: (incoming) =>
    set((s) => {
      if (incoming.length === 0) return { sessions: [] };

      const localBySid = new Map<string, SessionItem>();
      for (const it of s.sessions) if (it.SessionId) localBySid.set(it.SessionId, it);

      const merged: SessionItem[] = incoming.map((srv) => {
        const local = srv.SessionId ? localBySid.get(srv.SessionId) : undefined;
        return local && tsOf(local) > tsOf(srv) ? local : srv;
      });

      const incomingIds = new Set(incoming.map((it) => it.SessionId).filter(Boolean));
      for (const it of s.sessions) {
        if (it.SessionId && !incomingIds.has(it.SessionId)) merged.push(it);
      }
      return { sessions: merged };
    }),
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
