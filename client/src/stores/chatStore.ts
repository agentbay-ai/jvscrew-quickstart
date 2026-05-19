import { create } from 'zustand';
import type { DisplayMessage, ToolCallInfo } from '../types/api';

export interface PendingFile {
  id: string;
  filename: string;
  base64: string;
  mediaType: string;
}

interface ChatState {
  messages: DisplayMessage[];
  currentSessionId: string | null;
  isStreaming: boolean;
  isLoadingHistory: boolean;
  abortController: AbortController | null;
  pendingFiles: PendingFile[];
  includeReasoning: boolean;
  includeToolCalls: boolean;

  setSessionId: (id: string | null) => void;
  addMessage: (msg: DisplayMessage) => void;
  updateLastAssistant: (partial: Partial<DisplayMessage>) => void;
  appendToLastAssistant: (field: 'content' | 'reasoning', text: string) => void;
  setMessages: (msgs: DisplayMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  setLoadingHistory: (loading: boolean) => void;
  setAbortController: (ctrl: AbortController | null) => void;
  addPendingFile: (file: PendingFile) => void;
  removePendingFile: (id: string) => void;
  addToolCallToLastAssistant: (toolCall: ToolCallInfo) => void;
  updateLastToolCall: (partial: Partial<ToolCallInfo>) => void;
  finalizeAllToolCalls: () => void;
  clearMessages: () => void;
  setIncludeReasoning: (v: boolean) => void;
  setIncludeToolCalls: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  currentSessionId: null,
  isStreaming: false,
  isLoadingHistory: false,
  abortController: null,
  pendingFiles: [],
  includeReasoning: true,
  includeToolCalls: true,

  setSessionId: (id) => set({ currentSessionId: id }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateLastAssistant: (partial) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], ...partial };
          break;
        }
      }
      return { messages: msgs };
    }),

  appendToLastAssistant: (field, text) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], [field]: (msgs[i][field] || '') + text };
          break;
        }
      }
      return { messages: msgs };
    }),

  setMessages: (msgs) => set({ messages: msgs }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setLoadingHistory: (loading) => set({ isLoadingHistory: loading }),

  setAbortController: (ctrl) => set({ abortController: ctrl }),

  addPendingFile: (file) => set((s) => ({ pendingFiles: [...s.pendingFiles, file] })),

  removePendingFile: (id) => set((s) => ({ pendingFiles: s.pendingFiles.filter((f) => f.id !== id) })),

  addToolCallToLastAssistant: (toolCall) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], toolCalls: [...(msgs[i].toolCalls || []), toolCall] };
          break;
        }
      }
      return { messages: msgs };
    }),

  updateLastToolCall: (partial) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant' && msgs[i].toolCalls?.length) {
          const calls = [...msgs[i].toolCalls!];
          // Find the last tool call still in 'calling' state
          let targetIdx = -1;
          for (let j = calls.length - 1; j >= 0; j--) {
            if (calls[j].status === 'calling') {
              targetIdx = j;
              break;
            }
          }
          if (targetIdx === -1) targetIdx = calls.length - 1;
          calls[targetIdx] = { ...calls[targetIdx], ...partial };
          msgs[i] = { ...msgs[i], toolCalls: calls };
          break;
        }
      }
      return { messages: msgs };
    }),

  finalizeAllToolCalls: () =>
    set((s) => {
      const msgs = s.messages.map((msg) => {
        if (msg.role !== 'assistant' || !msg.toolCalls?.length) return msg;
        const hasCallingCalls = msg.toolCalls.some((tc) => tc.status === 'calling');
        if (!hasCallingCalls) return msg;
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc) =>
            tc.status === 'calling' ? { ...tc, status: 'completed' as const } : tc,
          ),
        };
      });
      return { messages: msgs };
    }),

  clearMessages: () => set({ messages: [], currentSessionId: null, pendingFiles: [] }),

  setIncludeReasoning: (v) => set({ includeReasoning: v }),
  setIncludeToolCalls: (v) => set({ includeToolCalls: v }),
}));
