import { create } from 'zustand';
import type { DisplayMessage, TaskConflict, ToolCallInfo } from '../types/api';

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
  isReconnectingMap: Record<string, true>;
  taskConflictMap: Record<string, TaskConflict>;
  abortControllers: Record<string, AbortController>;
  isLoadingHistory: boolean;
  pendingFiles: PendingFile[];
  attachedFiles: File[];
  draftText: string;
  includeReasoning: boolean;
  includeToolCalls: boolean;

  setSessionId: (id: string | null) => void;
  setLoadingHistory: (loading: boolean) => void;

  // Session-scoped writes (used by SSE callbacks)
  addMessageTo: (sessionId: string, msg: DisplayMessage) => void;
  setMessagesTo: (sessionId: string, msgs: DisplayMessage[]) => void;
  appendToLastAssistantOf: (sessionId: string, field: 'content' | 'reasoning', text: string) => void;
  flushContentToReasoningOf: (sessionId: string) => void;
  updateLastAssistantOf: (sessionId: string, partial: Partial<DisplayMessage>) => void;
  addToolCallTo: (sessionId: string, toolCall: ToolCallInfo) => void;
  updateLastToolCallOf: (sessionId: string, partial: Partial<ToolCallInfo>) => void;
  updateToolCallByCallId: (sessionId: string, callId: string, partial: Partial<ToolCallInfo>) => void;
  finalizeAllToolCallsOf: (sessionId: string) => void;
  setStreamingFor: (sessionId: string, streaming: boolean) => void;
  setReconnectingFor: (sessionId: string, reconnecting: boolean) => void;
  setTaskConflict: (sessionId: string, conflict: TaskConflict | null) => void;
  setAbortControllerFor: (sessionId: string, ctrl: AbortController | null) => void;
  renameSession: (oldId: string, newId: string) => void;
  removeSessionMessages: (sessionId: string) => void;

  // Convenience for current-session writes
  addMessage: (msg: DisplayMessage) => void;
  setMessages: (msgs: DisplayMessage[]) => void;

  addPendingFile: (file: PendingFile) => void;
  removePendingFile: (id: string) => void;

  addAttachedFiles: (files: File[]) => void;
  removeAttachedFile: (idx: number) => void;
  clearAttachedFiles: () => void;

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
  isReconnectingMap: {},
  taskConflictMap: {},
  abortControllers: {},
  isLoadingHistory: false,
  pendingFiles: [],
  attachedFiles: [],
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

  // 把已有的 content 沉淀到 reasoning：
  // 一次 Agent 响应可能包含多段 message + 多次 tool_call，只有"最后一段 message"才算正文，
  // 中间叙述都应折进"思考"面板。在 plugin_call 开始或新 message 段开始时调用。
  flushContentToReasoningOf: (sessionId) =>
    set((s) => {
      const list = s.sessionMessages[sessionId];
      if (!list) return {};
      const next = updateLastAssistantInList(list, (m) => {
        if (!m.content) return m;
        const sep = m.reasoning ? '\n\n---\n\n' : '';
        return {
          ...m,
          reasoning: (m.reasoning || '') + sep + m.content,
          content: '',
        };
      });
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

  updateToolCallByCallId: (sessionId, callId, partial) =>
    set((s) => {
      const list = s.sessionMessages[sessionId];
      if (!list) return {};
      const next = updateLastAssistantInList(list, (m) => {
        if (!m.toolCalls?.length) return m;
        const calls = [...m.toolCalls];
        let targetIdx = calls.findIndex((tc) => tc.callId === callId);
        if (targetIdx === -1) {
          // 没匹配上，回落到老逻辑（最后一个 calling，否则最后一条）
          for (let j = calls.length - 1; j >= 0; j--) {
            if (calls[j].status === 'calling') { targetIdx = j; break; }
          }
          if (targetIdx === -1) targetIdx = calls.length - 1;
        }
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

  setReconnectingFor: (sessionId, reconnecting) =>
    set((s) => {
      if (reconnecting) {
        if (s.isReconnectingMap[sessionId]) return {};
        return { isReconnectingMap: { ...s.isReconnectingMap, [sessionId]: true } };
      }
      if (!s.isReconnectingMap[sessionId]) return {};
      const next = { ...s.isReconnectingMap };
      delete next[sessionId];
      return { isReconnectingMap: next };
    }),

  setTaskConflict: (sessionId, conflict) =>
    set((s) => {
      const next = { ...s.taskConflictMap };
      if (conflict) {
        next[sessionId] = conflict;
      } else {
        delete next[sessionId];
      }
      return { taskConflictMap: next };
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
      const isReconnectingMap = { ...s.isReconnectingMap };
      delete isReconnectingMap[sessionId];
      const taskConflictMap = { ...s.taskConflictMap };
      delete taskConflictMap[sessionId];
      const abortControllers = { ...s.abortControllers };
      const ctrl = abortControllers[sessionId];
      if (ctrl) {
        try { ctrl.abort(); } catch { /* ignore */ }
        delete abortControllers[sessionId];
      }
      return { sessionMessages, isStreamingMap, isReconnectingMap, taskConflictMap, abortControllers };
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

  addAttachedFiles: (files) => set((s) => ({ attachedFiles: [...s.attachedFiles, ...files] })),
  removeAttachedFile: (idx) => set((s) => ({ attachedFiles: s.attachedFiles.filter((_, i) => i !== idx) })),
  clearAttachedFiles: () => set({ attachedFiles: [] }),

  setDraftText: (text) => set({ draftText: text }),

  clearMessages: () => set({
    sessionMessages: {},
    currentSessionId: null,
    isStreamingMap: {},
    isReconnectingMap: {},
    taskConflictMap: {},
    abortControllers: {},
    pendingFiles: [],
    attachedFiles: [],
    draftText: '',
  }),

  setIncludeReasoning: (v) => set({ includeReasoning: v }),
  setIncludeToolCalls: (v) => set({ includeToolCalls: v }),
}));
