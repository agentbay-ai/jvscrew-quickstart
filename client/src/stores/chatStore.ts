import { create } from 'zustand';
import type { DisplayMessage, ToolCallInfo } from '../types/api';

export interface PendingFile {
  id: string;
  filename: string;
  base64: string;
  mediaType: string;
}

interface ChatState {
  sessionMessages: Record<string, DisplayMessage[]>;
  currentSessionId: string | null;
  isStreamingMap: Record<string, true>;
  abortControllers: Record<string, AbortController>;
  isLoadingHistory: boolean;
  pendingFiles: PendingFile[];
  draftText: string;
  includeReasoning: boolean;
  includeToolCalls: boolean;

  setSessionId: (id: string | null) => void;
  setLoadingHistory: (loading: boolean) => void;

  // Session-scoped writes (used by SSE callbacks)
  addMessageTo: (sessionId: string, msg: DisplayMessage) => void;
  setMessagesTo: (sessionId: string, msgs: DisplayMessage[]) => void;
  appendToLastAssistantOf: (sessionId: string, field: 'content' | 'reasoning', text: string) => void;
  updateLastAssistantOf: (sessionId: string, partial: Partial<DisplayMessage>) => void;
  addToolCallTo: (sessionId: string, toolCall: ToolCallInfo) => void;
  updateLastToolCallOf: (sessionId: string, partial: Partial<ToolCallInfo>) => void;
  finalizeAllToolCallsOf: (sessionId: string) => void;
  setStreamingFor: (sessionId: string, streaming: boolean) => void;
  setAbortControllerFor: (sessionId: string, ctrl: AbortController | null) => void;
  renameSession: (oldId: string, newId: string) => void;
  removeSessionMessages: (sessionId: string) => void;

  // Convenience for current-session writes
  addMessage: (msg: DisplayMessage) => void;
  setMessages: (msgs: DisplayMessage[]) => void;

  addPendingFile: (file: PendingFile) => void;
  removePendingFile: (id: string) => void;

  setDraftText: (text: string) => void;

  clearMessages: () => void;

  setIncludeReasoning: (v: boolean) => void;
  setIncludeToolCalls: (v: boolean) => void;
}

function updateLastAssistantInList(
  list: DisplayMessage[],
  mutator: (msg: DisplayMessage) => DisplayMessage,
): DisplayMessage[] {
  const msgs = [...list];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') {
      msgs[i] = mutator(msgs[i]);
      break;
    }
  }
  return msgs;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessionMessages: {},
  currentSessionId: null,
  isStreamingMap: {},
  abortControllers: {},
  isLoadingHistory: false,
  pendingFiles: [],
  draftText: '',
  includeReasoning: true,
  includeToolCalls: true,

  setSessionId: (id) => set({ currentSessionId: id }),
  setLoadingHistory: (loading) => set({ isLoadingHistory: loading }),

  addMessageTo: (sessionId, msg) =>
    set((s) => ({
      sessionMessages: {
        ...s.sessionMessages,
        [sessionId]: [...(s.sessionMessages[sessionId] ?? []), msg],
      },
    })),

  setMessagesTo: (sessionId, msgs) =>
    set((s) => ({
      sessionMessages: { ...s.sessionMessages, [sessionId]: msgs },
    })),

  appendToLastAssistantOf: (sessionId, field, text) =>
    set((s) => {
      const list = s.sessionMessages[sessionId];
      if (!list) return {};
      const next = updateLastAssistantInList(list, (m) => ({
        ...m,
        [field]: (m[field] || '') + text,
      }));
      return { sessionMessages: { ...s.sessionMessages, [sessionId]: next } };
    }),

  updateLastAssistantOf: (sessionId, partial) =>
    set((s) => {
      const list = s.sessionMessages[sessionId];
      if (!list) return {};
      const next = updateLastAssistantInList(list, (m) => ({ ...m, ...partial }));
      return { sessionMessages: { ...s.sessionMessages, [sessionId]: next } };
    }),

  addToolCallTo: (sessionId, toolCall) =>
    set((s) => {
      const list = s.sessionMessages[sessionId];
      if (!list) return {};
      const next = updateLastAssistantInList(list, (m) => ({
        ...m,
        toolCalls: [...(m.toolCalls || []), toolCall],
      }));
      return { sessionMessages: { ...s.sessionMessages, [sessionId]: next } };
    }),

  updateLastToolCallOf: (sessionId, partial) =>
    set((s) => {
      const list = s.sessionMessages[sessionId];
      if (!list) return {};
      const next = updateLastAssistantInList(list, (m) => {
        if (!m.toolCalls?.length) return m;
        const calls = [...m.toolCalls];
        let targetIdx = -1;
        for (let j = calls.length - 1; j >= 0; j--) {
          if (calls[j].status === 'calling') {
            targetIdx = j;
            break;
          }
        }
        if (targetIdx === -1) targetIdx = calls.length - 1;
        calls[targetIdx] = { ...calls[targetIdx], ...partial };
        return { ...m, toolCalls: calls };
      });
      return { sessionMessages: { ...s.sessionMessages, [sessionId]: next } };
    }),

  finalizeAllToolCallsOf: (sessionId) =>
    set((s) => {
      const list = s.sessionMessages[sessionId];
      if (!list) return {};
      const next = list.map((msg) => {
        if (msg.role !== 'assistant' || !msg.toolCalls?.length) return msg;
        if (!msg.toolCalls.some((tc) => tc.status === 'calling')) return msg;
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc) =>
            tc.status === 'calling' ? { ...tc, status: 'completed' as const } : tc,
          ),
        };
      });
      return { sessionMessages: { ...s.sessionMessages, [sessionId]: next } };
    }),

  setStreamingFor: (sessionId, streaming) =>
    set((s) => {
      if (streaming) {
        if (s.isStreamingMap[sessionId]) return {};
        return { isStreamingMap: { ...s.isStreamingMap, [sessionId]: true } };
      }
      if (!s.isStreamingMap[sessionId]) return {};
      const next = { ...s.isStreamingMap };
      delete next[sessionId];
      return { isStreamingMap: next };
    }),

  setAbortControllerFor: (sessionId, ctrl) =>
    set((s) => {
      const next = { ...s.abortControllers };
      if (ctrl) next[sessionId] = ctrl;
      else delete next[sessionId];
      return { abortControllers: next };
    }),

  renameSession: (oldId, newId) =>
    set((s) => {
      if (oldId === newId) return {};
      const sessionMessages = { ...s.sessionMessages };
      if (sessionMessages[oldId]) {
        sessionMessages[newId] = sessionMessages[oldId];
        delete sessionMessages[oldId];
      }
      const isStreamingMap = { ...s.isStreamingMap };
      if (isStreamingMap[oldId]) {
        isStreamingMap[newId] = true;
        delete isStreamingMap[oldId];
      }
      const abortControllers = { ...s.abortControllers };
      if (abortControllers[oldId]) {
        abortControllers[newId] = abortControllers[oldId];
        delete abortControllers[oldId];
      }
      const currentSessionId = s.currentSessionId === oldId ? newId : s.currentSessionId;
      return { sessionMessages, isStreamingMap, abortControllers, currentSessionId };
    }),

  removeSessionMessages: (sessionId) =>
    set((s) => {
      const sessionMessages = { ...s.sessionMessages };
      delete sessionMessages[sessionId];
      const isStreamingMap = { ...s.isStreamingMap };
      delete isStreamingMap[sessionId];
      const abortControllers = { ...s.abortControllers };
      const ctrl = abortControllers[sessionId];
      if (ctrl) {
        try { ctrl.abort(); } catch { /* ignore */ }
        delete abortControllers[sessionId];
      }
      return { sessionMessages, isStreamingMap, abortControllers };
    }),

  addMessage: (msg) => {
    const id = get().currentSessionId;
    if (!id) return;
    get().addMessageTo(id, msg);
  },

  setMessages: (msgs) => {
    const id = get().currentSessionId;
    if (!id) return;
    get().setMessagesTo(id, msgs);
  },

  addPendingFile: (file) => set((s) => ({ pendingFiles: [...s.pendingFiles, file] })),
  removePendingFile: (id) => set((s) => ({ pendingFiles: s.pendingFiles.filter((f) => f.id !== id) })),

  setDraftText: (text) => set({ draftText: text }),

  clearMessages: () => set({
    sessionMessages: {},
    currentSessionId: null,
    isStreamingMap: {},
    abortControllers: {},
    pendingFiles: [],
    draftText: '',
  }),

  setIncludeReasoning: (v) => set({ includeReasoning: v }),
  setIncludeToolCalls: (v) => set({ includeToolCalls: v }),
}));
