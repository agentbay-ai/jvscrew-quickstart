import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';
import { useSandboxStore } from '../stores/sandboxStore';
import { startChatSSE } from '../services/sse';
import type { SSEEvent, DisplayMessage, UploadedFileInput } from '../types/api';

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

      const assistantMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        reasoning: '',
        isStreaming: true,
        timestamp: Date.now(),
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

      const finishStreaming = () => {
        if (!streamingFlagged) return;
        streamingFlagged = false;
        const s = useChatStore.getState();
        s.finalizeAllToolCallsOf(activeSessionId);
        s.updateLastAssistantOf(activeSessionId, { isStreaming: false });
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

        onEvent: (event: SSEEvent) => {
          const obj = event.Object;
          const type = event.Type;
          const status = event.Status;
          const s = useChatStore.getState();

          handleFileOutput(event);

          if (obj === 'message' && (type === 'reasoning' || type === 'message')) {
            currentPhase = type;
          }

          if (obj === 'content' && type === 'text' && status === 'in_progress') {
            const txt = event.Text || '';
            if (currentPhase === 'reasoning') {
              s.appendToLastAssistantOf(activeSessionId, 'reasoning', txt);
            } else if (currentPhase === 'message') {
              s.appendToLastAssistantOf(activeSessionId, 'content', txt);
            }
          }

          if (obj === 'message' && (type === 'plugin_call' || type === 'tool_call')) {
            if (status === 'in_progress') {
              const data = event.Content?.[0] as unknown as { Data?: { name?: string; input?: string } } | undefined;
              const name = data?.Data?.name || type;
              const input = data?.Data?.input;
              s.addToolCallTo(activeSessionId, { name, status: 'calling', input });
            } else if (status === 'completed') {
              s.updateLastToolCallOf(activeSessionId, { status: 'completed' });
            }
          }

          if (obj === 'message' && type === 'plugin_call_output' && status === 'completed') {
            const data = event.Content?.[0] as unknown as { Data?: { output?: string } } | undefined;
            if (data?.Data?.output) {
              s.updateLastToolCallOf(activeSessionId, { status: 'completed', output: data.Data.output });
            }
          }

          if (obj === 'message' && status === 'completed' && event.SessionId && event.SessionId !== activeSessionId) {
            s.renameSession(activeSessionId, event.SessionId);
            activeSessionId = event.SessionId;
          }

          if (obj === 'response' && status === 'completed') {
            finishStreaming();
          }

          if (obj === 'response' && status === 'failed') {
            const errText =
              (event as unknown as Record<string, unknown>).Error as string ||
              (event as unknown as Record<string, unknown>).Message as string ||
              JSON.stringify(event);
            s.updateLastAssistantOf(activeSessionId, { content: `Error: ${errText}`, isStreaming: false });
            finishStreaming();
          }

          if (obj === 'error') {
            const errText =
              (event as unknown as Record<string, unknown>).message as string ||
              (event as unknown as Record<string, unknown>).Message as string ||
              JSON.stringify(event);
            s.updateLastAssistantOf(activeSessionId, { content: `Error: ${errText}`, isStreaming: false });
            finishStreaming();
          }
        },

        onError: (err) => {
          useChatStore.getState().updateLastAssistantOf(activeSessionId, {
            content: `Connection error: ${err.message}`,
            isStreaming: false,
          });
          finishStreaming();
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

  const stopChat = useCallback(() => {
    const s = useChatStore.getState();
    const id = s.currentSessionId;
    if (!id) return;
    const ctrl = s.abortControllers[id];
    ctrl?.abort();
    s.finalizeAllToolCallsOf(id);
    s.updateLastAssistantOf(id, { isStreaming: false });
    s.setStreamingFor(id, false);
    s.setAbortControllerFor(id, null);
  }, []);

  const newChat = useCallback(() => {
    setSessionId(null);
    useSandboxStore.getState().reset();
  }, [setSessionId]);

  return {
    messages,
    isStreaming,
    currentSessionId,
    sendMessage,
    stopChat,
    newChat,
  };
}
