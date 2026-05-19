import { afterEach, describe, expect, it, vi } from 'vitest';
import { startChatSSE } from './sse';

function doneStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startChatSSE', () => {
  it('sends uploaded file sandbox paths as text with the selected template id', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: doneStream(),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await startChatSSE({
      token: 'access-token',
      externalUserId: 'user-1',
      sessionId: 'session-1',
      input: '请分析这个文件',
      templateId: 'template-1',
      files: [
        {
          name: 'report.pdf',
          sandboxPath: '/home/wuying/jvscrew/uploads/report.pdf',
        },
      ],
      onEvent: vi.fn(),
      onError: vi.fn(),
      onDone: vi.fn(),
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('TemplateId=template-1');

    const body = JSON.parse(String(init?.body));
    const messages = JSON.parse(body.Input);
    expect(messages[0].Content).toEqual([
      {
        Type: 'text',
        Text: '请分析这个文件\n\n[附件沙箱路径]\n- /home/wuying/jvscrew/uploads/report.pdf',
      },
    ]);
  });
});
