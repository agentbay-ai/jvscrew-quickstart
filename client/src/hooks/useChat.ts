import { useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';
import { useSandboxStore } from '../stores/sandboxStore';
import { startChatSSE } from '../services/sse';
import type { SSEEvent, DisplayMessage, UploadedFileInput } from '../types/api';

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
  const {
    messages,
    currentSessionId,
    isStreaming,
    setSessionId,
    addMessage,
    appendToLastAssistant,
    updateLastAssistant,
    setStreaming,
    setAbortController,
    clearMessages,
    addToolCallToLastAssistant,
    updateLastToolCall,
    finalizeAllToolCalls,
  } = useChatStore();
  const upsertSession = useSessionStore((s) => s.upsertSession);

  const sendMessage = useCallback(
    async (text: string, files?: UploadedFileInput[]) => {
      if (!config) return;
      const token = await refreshAccessToken();
      if (!token) return;

      const isScheduleSession = currentSessionId?.startsWith('schedule:');
      let contextMessages: Array<{ Role: string; Content: Array<{ Type: string; Text: string }> }> | undefined;

      if (isScheduleSession) {
        const existingMessages = useChatStore.getState().messages;
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

        const systemMsg: DisplayMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
          content: '定时任务会话为只读，已为您开启新对话',
          timestamp: Date.now(),
        };
        addMessage(systemMsg);
      }

      const sessionId = isScheduleSession
        ? `session-${Date.now()}`
        : (currentSessionId || `session-${Date.now()}`);
      setSessionId(sessionId);

      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        files: files?.map((file) => ({ name: file.name, url: file.sandboxPath })),
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      const assistantMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        reasoning: '',
        isStreaming: true,
        timestamp: Date.now(),
      };
      addMessage(assistantMsg);

      setStreaming(true);
      const controller = new AbortController();
      setAbortController(controller);

      const { startPolling, currentResourceUrl } = useSandboxStore.getState();
      if (!currentResourceUrl) {
        startPolling(token, sessionId, config.templateId);
      }

      let currentPhase: 'reasoning' | 'message' | null = null;
      let resolvedSessionId = sessionId;

      const { includeReasoning, includeToolCalls } = useChatStore.getState();

      await startChatSSE({
        token,
        externalUserId: config.externalUserId,
        sessionId,
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

          handleFileOutput(event);

          if (obj === 'message' && (type === 'reasoning' || type === 'message')) {
            currentPhase = type;
          }

          if (obj === 'content' && type === 'text' && status === 'in_progress') {
            const txt = event.Text || '';
            if (currentPhase === 'reasoning') {
              appendToLastAssistant('reasoning', txt);
            } else if (currentPhase === 'message') {
              appendToLastAssistant('content', txt);
            }
          }

          if (obj === 'message' && (type === 'plugin_call' || type === 'tool_call')) {
            if (status === 'in_progress') {
              const data = event.Content?.[0] as unknown as { Data?: { name?: string; input?: string } } | undefined;
              const name = data?.Data?.name || type;
              const input = data?.Data?.input;
              addToolCallToLastAssistant({ name, status: 'calling', input });
            } else if (status === 'completed') {
              updateLastToolCall({ status: 'completed' });
            }
          }

          if (obj === 'message' && type === 'plugin_call_output' && status === 'completed') {
            const data = event.Content?.[0] as unknown as { Data?: { output?: string } } | undefined;
            if (data?.Data?.output) {
              updateLastToolCall({ status: 'completed', output: data.Data.output });
            }
          }

          if (obj === 'message' && status === 'completed' && event.SessionId) {
            resolvedSessionId = event.SessionId;
            setSessionId(event.SessionId);
          }

          if (obj === 'response' && status === 'failed') {
            const errText =
              (event as unknown as Record<string, unknown>).Error as string ||
              (event as unknown as Record<string, unknown>).Message as string ||
              JSON.stringify(event);
            updateLastAssistant({ content: `Error: ${errText}`, isStreaming: false });
          }

          if (obj === 'error') {
            const errText =
              (event as unknown as Record<string, unknown>).message as string ||
              (event as unknown as Record<string, unknown>).Message as string ||
              JSON.stringify(event);
            updateLastAssistant({ content: `Error: ${errText}`, isStreaming: false });
          }
        },

        onError: (err) => {
          updateLastAssistant({
            content: `Connection error: ${err.message}`,
            isStreaming: false,
          });
          setStreaming(false);
          setAbortController(null);
        },

        onDone: () => {
          if (!controller.signal.aborted) {
            const now = new Date().toISOString();
            upsertSession({
              Id: resolvedSessionId,
              Name: sessionNameFromMessage(text, files),
              SessionId: resolvedSessionId,
              UserId: config.externalUserId,
              Channel: 'web',
              CreatedAt: now,
              UpdatedAt: now,
              Meta: {
                TemplateId: config.templateId,
              },
            });
          }
          finalizeAllToolCalls();
          updateLastAssistant({ isStreaming: false });
          setStreaming(false);
          setAbortController(null);
        },
      });
    },
    [
      addMessage,
      appendToLastAssistant,
      addToolCallToLastAssistant,
      updateLastToolCall,
      finalizeAllToolCalls,
      config,
      currentSessionId,
      refreshAccessToken,
      setAbortController,
      setSessionId,
      setStreaming,
      upsertSession,
      updateLastAssistant,
    ],
  );

  const stopChat = useCallback(() => {
    const ctrl = useChatStore.getState().abortController;
    ctrl?.abort();
    setStreaming(false);
    setAbortController(null);
    updateLastAssistant({ isStreaming: false });
  }, [setAbortController, setStreaming, updateLastAssistant]);

  const newChat = useCallback(() => {
    stopChat();
    clearMessages();
    useSandboxStore.getState().reset();
  }, [clearMessages, stopChat]);

  return {
    messages,
    isStreaming,
    currentSessionId,
    sendMessage,
    stopChat,
    newChat,
  };
}
