import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';
import { useSandboxStore } from '../stores/sandboxStore';
import { startChatSSE } from '../services/sse';
import { stopSession, listSessionHistoryWithStatus } from '../services/api';
import type { SSEEvent, DisplayMessage, ToolCallInfo, UploadedFileInput, SessionMessage } from '../types/api';

// Object=message + plugin_call/plugin_call_output 时 Content[0].Data 的形状
type ToolPayload = {
  name?: string;
  input?: string;
  arguments?: string;
  output?: string;
  call_id?: string;
};

function extractToolData(event: SSEEvent): ToolPayload | null {
  const item = event.Content?.[0] as unknown as { Data?: ToolPayload } | undefined;
  return item?.Data ?? null;
}

function readErrorText(event: SSEEvent): string {
  const e = event as unknown as Record<string, unknown>;
  return (
    (e.Error as string) ||
    (e.Message as string) ||
    (e.message as string) ||
    JSON.stringify(event)
  );
}

const EMPTY_MESSAGES: DisplayMessage[] = [];

function sessionNameFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '新会话';
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}...` : trimmed;
}

const handledCallIds = new Set<string>();

function handleFileOutput(event: SSEEvent) {
  if (event.Object !== 'message' || event.Status !== 'completed') return;
  if (event.Type !== 'plugin_call_output') return;

  const content = event.Content;
  if (!content?.length) return;

  const { addPendingFile, pendingFiles } = useChatStore.getState();

  for (const item of content) {
    const data = item as unknown as { Data?: { name?: string; output?: string; call_id?: string } };
    if (data.Data?.name !== 'sandbox_send_file_to_user' || !data.Data?.output) continue;

    const callId = data.Data.call_id || data.Data.output.slice(0, 64);
    if (handledCallIds.has(callId)) continue;
    handledCallIds.add(callId);

    try {
      const files = JSON.parse(data.Data.output) as Array<{
        type: string;
        source?: { type: string; media_type: string; data: string };
        filename?: string;
      }>;
      for (const file of files) {
        if (file.type !== 'file' || file.source?.type !== 'base64' || !file.source.data) continue;
        const filename = file.filename || 'download';
        const alreadyPending = pendingFiles.some((p) => p.filename === filename && p.base64 === file.source!.data);
        if (alreadyPending) continue;

        addPendingFile({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          filename,
          base64: file.source.data,
          mediaType: file.source.media_type || 'application/octet-stream',
        });
      }
    } catch {
      // malformed output, skip
    }
  }
}

function sessionNameFromMessage(text: string, files?: UploadedFileInput[]): string {
  if (text.trim()) return sessionNameFromText(text);
  const fileNames = files?.map((file) => file.name).filter(Boolean).join(', ');
  return sessionNameFromText(fileNames || '');
}

function historyToDisplayMessages(messages: SessionMessage[]): DisplayMessage[] {
  return messages
    .filter((m) => m.Type === 'message' && (m.Role === 'user' || m.Role === 'assistant'))
    .map((m) => ({
      id: m.Id,
      role: m.Role as 'user' | 'assistant',
      content: m.Content?.map((c) => c.Text).filter(Boolean).join('') || '',
      timestamp: Date.now(),
    }))
    .filter((m) => m.content.trim() !== '');
}

const RECONNECT_POLL_INTERVAL = 30_000;

export function useChat() {
  const { config, refreshAccessToken } = useAuthStore();

  const messages = useChatStore((s) =>
    s.currentSessionId ? (s.sessionMessages[s.currentSessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const isStreaming = useChatStore((s) =>
    s.currentSessionId ? !!s.isStreamingMap[s.currentSessionId] : false,
  );

  const setSessionId = useChatStore((s) => s.setSessionId);
  const upsertSession = useSessionStore((s) => s.upsertSession);

  const sendMessage = useCallback(
    async (text: string, files?: UploadedFileInput[]) => {
      if (!config) return;
      const token = await refreshAccessToken();
      if (!token) return;

      const store = useChatStore.getState();
      const liveSessionId = store.currentSessionId;
      const isScheduleSession = liveSessionId?.startsWith('schedule:');
      let contextMessages: Array<{ Role: string; Content: Array<{ Type: string; Text: string }> }> | undefined;

      if (isScheduleSession && liveSessionId) {
        const existingMessages = store.sessionMessages[liveSessionId] ?? [];
        const taskResultContent = existingMessages
          .filter((m) => m.role === 'assistant')
          .map((m) => m.content)
          .join('\n');

        if (taskResultContent) {
          contextMessages = [{
            Role: 'assistant',
            Content: [{ Type: 'text', Text: taskResultContent }],
          }];
        }
      }

      const streamSessionId = isScheduleSession || !liveSessionId
        ? `session-${Date.now()}`
        : liveSessionId;

      // Always view the session we're sending to
      setSessionId(streamSessionId);

      if (isScheduleSession) {
        const systemMsg: DisplayMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
          content: '定时任务会话为只读，已为您开启新对话',
          timestamp: Date.now(),
        };
        useChatStore.getState().addMessageTo(streamSessionId, systemMsg);
      }

      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        files: files?.map((file) => ({ name: file.name, url: file.sandboxPath })),
        timestamp: Date.now(),
      };
      useChatStore.getState().addMessageTo(streamSessionId, userMsg);

      const sentAt = Date.now();
      const latency = { startAt: sentAt } as {
        startAt: number;
        firstAnyAt?: number;
        firstAnswerAt?: number;
        endAt?: number;
      };
      let lastByteAt: number | null = null;
      const assistantMsg: DisplayMessage = {
        id: `assistant-${sentAt}`,
        role: 'assistant',
        content: '',
        reasoning: '',
        isStreaming: true,
        timestamp: sentAt,
        latency: { ...latency },
      };
      useChatStore.getState().addMessageTo(streamSessionId, assistantMsg);

      useChatStore.getState().setStreamingFor(streamSessionId, true);
      const controller = new AbortController();
      useChatStore.getState().setAbortControllerFor(streamSessionId, controller);

      const { startPolling, currentResourceUrl } = useSandboxStore.getState();
      if (!currentResourceUrl) {
        startPolling(token, streamSessionId, config.templateId);
      }

      let currentPhase: 'reasoning' | 'message' | null = null;
      let activeSessionId = streamSessionId;
      let streamingFlagged = true;

      const markLatency = (key: 'firstAnyAt' | 'firstAnswerAt') => {
        if (latency[key] != null) return;
        latency[key] = Date.now();
        useChatStore.getState().updateLastAssistantOf(activeSessionId, { latency: { ...latency } });
      };

      // 每个真实 byte 到达时刷新；finishStreaming 时把它作为 TTLB，避免被后端 completed 事件的延迟污染
      const touchLastByte = () => { lastByteAt = Date.now(); };

      // 把当前 content 沉淀到 reasoning，并重置 firstAnswerAt
      // —— 沉淀意味着"这段不是最终答案"，TTFAT 应改由下一段 message 重新计时
      const flushContentSegment = () => {
        useChatStore.getState().flushContentToReasoningOf(activeSessionId);
        if (latency.firstAnswerAt != null) {
          latency.firstAnswerAt = undefined;
          useChatStore.getState().updateLastAssistantOf(activeSessionId, { latency: { ...latency } });
        }
      };

      // 任务真正结束：定格耗时、收口工具调用、设置 message.isStreaming = false、释放 Send 锁、清理 controller。
      // 一次响应可能包含多段 message + 多次 tool_call，必须等到 response:completed 才解锁
      // —— 否则 Stop 按钮会在中间错误地变回 Send（不符合"任务进行中按钮始终为 Stop"的要求）。
      const finishStreaming = () => {
        if (!streamingFlagged) return;
        streamingFlagged = false;
        latency.endAt = lastByteAt ?? Date.now();
        const s = useChatStore.getState();
        s.finalizeAllToolCallsOf(activeSessionId);
        s.updateLastAssistantOf(activeSessionId, { isStreaming: false, latency: { ...latency } });
        s.setStreamingFor(activeSessionId, false);
        s.setAbortControllerFor(activeSessionId, null);
      };

      const { includeReasoning, includeToolCalls } = useChatStore.getState();

      await startChatSSE({
        token,
        externalUserId: config.externalUserId,
        sessionId: streamSessionId,
        input: text,
        files,
        templateId: config.templateId,
        includeReasoning,
        includeToolCalls,
        contextMessages,
        signal: controller.signal,

        // ============================================================
        //  Chat SSE 事件处理
        //  按官方文档把事件分四类：
        //   ① 思考  reasoning：message/reasoning/*  +  归属为 reasoning 的 content/text/*
        //   ② 工具  plugin_call (assistant) + plugin_call_output (tool)
        //   ③ 正文  message/message/*  +  归属为 message 的 content/text/*
        //   ④ 生命周期  response/*  +  error
        //
        //  关键规则：
        //  - content/text/in_progress 是增量；content/text/completed 是聚合校验，丢弃
        //  - content/data/completed 是占位，真实 Data 在下一条 message/plugin_call*:completed
        //  - 工具配对靠 Data.call_id；并发时不能只看"最后一个 calling"
        //  - 一次响应可能有多段 message + 多次工具，只有 response/completed 才是真结束
        // ============================================================
        onEvent: (event: SSEEvent) => {
          const obj = event.Object;
          const type = event.Type;
          const status = event.Status;
          const s = useChatStore.getState();

          // 旁路：sandbox_send_file_to_user 的 base64 文件下发独立处理
          handleFileOutput(event);

          // ---------- ④ 生命周期 ----------
          if (obj === 'response') {
            if (status === 'completed') {
              finishStreaming();
            } else if (status === 'failed') {
              const errText = readErrorText(event);
              s.updateLastAssistantOf(activeSessionId, {
                content: `Error: ${errText}`, isStreaming: false,
              });
              finishStreaming();
            }
            // created / in_progress 不需要处理
            return;
          }

          if (obj === 'error') {
            const errText = readErrorText(event);
            s.updateLastAssistantOf(activeSessionId, {
              content: `Error: ${errText}`, isStreaming: false,
            });
            finishStreaming();
            return;
          }

          // ---------- content：思考/正文文本增量 ----------
          if (obj === 'content') {
            // content/text/in_progress 才是真增量；text/completed 是聚合校验，data 是占位，均丢弃
            if (type !== 'text' || status !== 'in_progress') return;
            const txt = event.Text || '';
            if (!txt) return;
            markLatency('firstAnyAt');
            touchLastByte();
            // 归属由"最近一条 message 事件的 Type"决定（currentPhase）
            if (currentPhase === 'reasoning') {
              s.appendToLastAssistantOf(activeSessionId, 'reasoning', txt);
            } else if (currentPhase === 'message') {
              markLatency('firstAnswerAt');
              s.appendToLastAssistantOf(activeSessionId, 'content', txt);
            }
            return;
          }

          // ---------- message 系列 ----------
          if (obj !== 'message') return;

          // 后端可能在流中纠正 SessionId（如新建会话），任何 message 事件都同步一次
          if (event.SessionId && event.SessionId !== activeSessionId) {
            s.renameSession(activeSessionId, event.SessionId);
            activeSessionId = event.SessionId;
          }

          // ① 思考
          if (type === 'reasoning') {
            if (status === 'in_progress') {
              currentPhase = 'reasoning';
            }
            // reasoning:completed —— 阶段标记，无需特殊处理
            return;
          }

          // ③ 正文
          if (type === 'message') {
            if (status === 'in_progress') {
              // 新 message 段开始：把上一段 content 沉淀到 reasoning
              // —— 只把"最后一段 message"留作正文，中间叙述折进思考面板
              flushContentSegment();
              currentPhase = 'message';
            }
            // message:completed —— 此段写完，但响应未结束（后面可能还有 tool/message），不要解锁
            return;
          }

          // ② 工具调用（assistant 发起）
          if (type === 'plugin_call' || type === 'tool_call') {
            const data = extractToolData(event);
            const realName = data?.name;
            const realInput = data?.arguments ?? data?.input;
            const callId = data?.call_id;

            if (status === 'in_progress') {
              // 工具开始 = 当前 content 必非最终答案，沉淀
              flushContentSegment();
              markLatency('firstAnyAt');
              touchLastByte();
              // in_progress 时 Content 缺失，先用占位创建，后续 completed 通过 callId 回填
              s.addToolCallTo(activeSessionId, {
                name: realName || type,
                status: 'calling',
                input: realInput,
                callId,
              });
            } else if (status === 'completed') {
              touchLastByte();
              const partial: Partial<ToolCallInfo> = {
                status: 'completed',
                ...(realName ? { name: realName } : {}),
                ...(realInput !== undefined ? { input: realInput } : {}),
                ...(callId ? { callId } : {}),
              };
              // 优先按 callId 精确匹配；缺失时回落到"最后一个 calling"
              if (callId) {
                s.updateToolCallByCallId(activeSessionId, callId, partial);
              } else {
                s.updateLastToolCallOf(activeSessionId, partial);
              }
            }
            return;
          }

          // ② 工具返回（tool 角色）
          if (type === 'plugin_call_output') {
            // in_progress 此时无数据，跳过；只在 completed 时拿到 output
            if (status !== 'completed') return;
            const data = extractToolData(event);
            const out = data?.output;
            if (!out) return;
            touchLastByte();
            if (data?.call_id) {
              s.updateToolCallByCallId(activeSessionId, data.call_id, {
                status: 'completed', output: out,
              });
            } else {
              s.updateLastToolCallOf(activeSessionId, {
                status: 'completed', output: out,
              });
            }
            return;
          }
        },

        onHttpError: (status, body) => {
          if (status === 409) {
            console.log('[chat] HTTP 409 TaskInProgress for session:', activeSessionId);
            const s = useChatStore.getState();
            s.updateLastAssistantOf(activeSessionId, {
              content: '',
              isStreaming: false,
            });
            s.setStreamingFor(activeSessionId, false);
            s.setAbortControllerFor(activeSessionId, null);
            s.setTaskConflict(activeSessionId, {
              pendingText: text,
              pendingFiles: files,
            });
          } else {
            useChatStore.getState().updateLastAssistantOf(activeSessionId, {
              content: `Error: ${status} - ${body}`,
              isStreaming: false,
            });
            finishStreaming();
          }
        },

        onError: (err) => {
          const isDisconnect = (err as Error & { isDisconnect?: boolean }).isDisconnect;
          if (isDisconnect && config) {
            console.log('[chat] SSE disconnected, starting reconnect polling for:', activeSessionId);
            const s = useChatStore.getState();
            s.setReconnectingFor(activeSessionId, true);
            s.updateLastAssistantOf(activeSessionId, {
              content: '连接已断开，Agent 仍在执行中，正在等待结果...',
              isStreaming: true,
            });
            s.setAbortControllerFor(activeSessionId, null);

            const pollSessionId = activeSessionId;
            const poll = async () => {
              if (!useChatStore.getState().isReconnectingMap[pollSessionId]) return;
              try {
                const freshToken = await refreshAccessToken();
                if (!freshToken) return;
                const result = await listSessionHistoryWithStatus(
                  freshToken, pollSessionId, config.externalUserId, config.templateId,
                );
                if (!useChatStore.getState().isReconnectingMap[pollSessionId]) return;

                if (result.Status === 'idle') {
                  const displayMsgs = historyToDisplayMessages(result.Messages);
                  const cs = useChatStore.getState();
                  cs.setMessagesTo(pollSessionId, displayMsgs);
                  cs.setReconnectingFor(pollSessionId, false);
                  cs.setStreamingFor(pollSessionId, false);
                  return;
                }
              } catch (pollErr) {
                console.warn('[chat] reconnect poll error:', pollErr);
              }
              setTimeout(poll, RECONNECT_POLL_INTERVAL);
            };
            setTimeout(poll, 3000);
          } else {
            useChatStore.getState().updateLastAssistantOf(activeSessionId, {
              content: `Connection error: ${err.message}`,
              isStreaming: false,
            });
            finishStreaming();
          }
        },

        onDone: () => {
          if (!controller.signal.aborted) {
            const now = new Date().toISOString();
            upsertSession({
              Id: activeSessionId,
              Name: sessionNameFromMessage(text, files),
              SessionId: activeSessionId,
              UserId: config.externalUserId,
              Channel: 'web',
              CreatedAt: now,
              UpdatedAt: now,
              Meta: {
                TemplateId: config.templateId,
              },
            });
          }
          finishStreaming();
        },
      });
    },
    [config, refreshAccessToken, setSessionId, upsertSession],
  );

  const isReconnecting = useChatStore((s) =>
    s.currentSessionId ? !!s.isReconnectingMap[s.currentSessionId] : false,
  );
  const taskConflict = useChatStore((s) =>
    s.currentSessionId ? s.taskConflictMap[s.currentSessionId] ?? null : null,
  );

  const waitForTaskCompletion = useCallback(async () => {
    if (!config) return;
    const s = useChatStore.getState();
    const id = s.currentSessionId;
    if (!id) return;

    s.setTaskConflict(id, null);
    s.setReconnectingFor(id, true);
    s.setStreamingFor(id, true);

    const systemMsg: DisplayMessage = {
      id: `system-wait-${Date.now()}`,
      role: 'system',
      content: '正在等待当前任务完成...',
      timestamp: Date.now(),
    };
    s.addMessageTo(id, systemMsg);

    const poll = async () => {
      if (!useChatStore.getState().isReconnectingMap[id]) return;
      try {
        const token = await refreshAccessToken();
        if (!token) return;
        const result = await listSessionHistoryWithStatus(
          token, id, config.externalUserId, config.templateId,
        );
        if (!useChatStore.getState().isReconnectingMap[id]) return;

        if (result.Status === 'idle') {
          const displayMsgs = historyToDisplayMessages(result.Messages);
          const cs = useChatStore.getState();
          cs.setMessagesTo(id, displayMsgs);
          cs.setReconnectingFor(id, false);
          cs.setStreamingFor(id, false);
          return;
        }
      } catch (pollErr) {
        console.warn('[chat] conflict poll error:', pollErr);
      }
      setTimeout(poll, RECONNECT_POLL_INTERVAL);
    };
    setTimeout(poll, 3000);
  }, [config, refreshAccessToken]);

  const stopAndResend = useCallback(async () => {
    if (!config) return;
    const s = useChatStore.getState();
    const id = s.currentSessionId;
    if (!id) return;

    const conflict = s.taskConflictMap[id];
    s.setTaskConflict(id, null);

    try {
      const token = await refreshAccessToken();
      if (token) await stopSession(token, id, config.templateId);
    } catch (err) {
      console.warn('[chat] stopSession for resend failed:', err);
    }

    if (conflict) {
      sendMessage(conflict.pendingText, conflict.pendingFiles);
    }
  }, [config, refreshAccessToken, sendMessage]);

  const dismissConflict = useCallback(() => {
    const s = useChatStore.getState();
    const id = s.currentSessionId;
    if (!id) return;
    s.setTaskConflict(id, null);
  }, []);

  const stopChat = useCallback(async () => {
    const s = useChatStore.getState();
    const id = s.currentSessionId;
    if (!id) return;

    const ctrl = s.abortControllers[id];
    ctrl?.abort();
    s.finalizeAllToolCallsOf(id);
    s.updateLastAssistantOf(id, { isStreaming: false });
    s.setStreamingFor(id, false);
    s.setReconnectingFor(id, false);
    s.setTaskConflict(id, null);
    s.setAbortControllerFor(id, null);

    if (!config) return;
    try {
      const token = await refreshAccessToken();
      if (token) await stopSession(token, id, config.templateId);
    } catch (err) {
      console.warn('[chat] stopSession failed:', err);
    }
  }, [config, refreshAccessToken]);

  const newChat = useCallback(() => {
    setSessionId(null);
    useSandboxStore.getState().reset();
  }, [setSessionId]);

  return {
    messages,
    isStreaming,
    isReconnecting,
    taskConflict,
    currentSessionId,
    sendMessage,
    stopChat,
    newChat,
    waitForTaskCompletion,
    stopAndResend,
    dismissConflict,
  };
}
