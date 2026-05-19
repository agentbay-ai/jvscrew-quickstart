import type { SSEEvent, UploadedFileInput } from '../types/api';

const JVS_ENDPOINT = '/jvs';
const API_VERSION = '2026-03-11';

function nowUTC(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function buildChatApiText(input: string, files: UploadedFileInput[]): string {
  const text = input.trim();
  const paths = files
    .map((file) => file.sandboxPath)
    .filter((path) => path.trim());
  if (paths.length === 0) return text;
  return `${text}\n\n[附件沙箱路径]\n${paths.map((path) => `- ${path}`).join('\n')}`;
}

export interface ChatSSEOptions {
  token: string;
  externalUserId: string;
  sessionId: string;
  input: string;
  files?: UploadedFileInput[];
  templateId?: string;
  includeReasoning?: boolean;
  includeToolCalls?: boolean;
  contextMessages?: Array<{ Role: string; Content: Array<{ Type: string; Text: string }> }>;
  signal?: AbortSignal;
  onEvent: (event: SSEEvent) => void;
  onError: (error: Error) => void;
  onDone: () => void;
}

export async function startChatSSE(options: ChatSSEOptions) {
  const {
    token,
    externalUserId,
    sessionId,
    input,
    files = [],
    templateId,
    includeReasoning = true,
    includeToolCalls = true,
    contextMessages,
    signal,
    onEvent,
    onError,
    onDone,
  } = options;

  const authParam = encodeURIComponent(`Bearer ${token}`);
  let url = `${JVS_ENDPOINT}/api/agent/chat?Authorization=${authParam}`;
  if (templateId) url += `&TemplateId=${encodeURIComponent(templateId)}`;

  const apiText = buildChatApiText(input, files);

  const messages = [
    ...(contextMessages || []),
    {
      Role: 'user',
      Content: [{ Type: 'text', Text: apiText }],
    },
  ];

  const body: Record<string, unknown> = {
    ExternalUserId: externalUserId,
    SessionId: sessionId,
    Input: JSON.stringify(messages),
  };

  if (!includeReasoning || !includeToolCalls) {
    body.StreamOptions = {
      IncludeReasoning: includeReasoning,
      IncludeToolCalls: includeToolCalls,
    };
  }

  try {
    console.log('[SSE] POST', url);
    console.log('[SSE] body', JSON.stringify(body));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'x-acs-version': API_VERSION,
        'x-acs-action': 'Chat',
        'x-acs-date': nowUTC(),
      },
      body: JSON.stringify(body),
      signal,
    });

    console.log('[SSE] response status:', response.status);

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[SSE] error response:', errBody);
      throw new Error(`Chat request failed: ${response.status} - ${errBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data:')) continue;

        const raw = trimmed.slice(5).trim();
        if (raw === '[DONE]') {
          console.log('[SSE] received [DONE]');
          onDone();
          return;
        }

        try {
          const event = JSON.parse(raw) as SSEEvent;
          console.log('[SSE] event:', event.Object, event.Type, event.Status, raw.slice(0, 300));
          onEvent(event);
        } catch {
          console.warn('[SSE] malformed JSON:', raw.slice(0, 200));
        }
      }
    }

    console.log('[SSE] stream ended');
    onDone();
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.log('[SSE] aborted');
      onDone();
    } else {
      console.error('[SSE] error:', err);
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
