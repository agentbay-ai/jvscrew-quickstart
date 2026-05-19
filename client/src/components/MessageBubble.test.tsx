import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import MessageBubble from './MessageBubble';

describe('MessageBubble', () => {
  it('hides sandbox path protocol text and shows the attached file name', () => {
    const html = renderToString(
      <MessageBubble
        message={{
          id: 'user-1',
          role: 'user',
          content: '这是什么文档\n\n[附件沙箱路径]\n- /home/wuying/jvscrew/uploads/api_292b74f1.md',
          timestamp: 1,
        }}
      />,
    );

    expect(html).toContain('这是什么文档');
    expect(html).toContain('api_292b74f1.md');
    expect(html).not.toContain('[附件沙箱路径]');
    expect(html).not.toContain('/home/wuying/jvscrew/uploads');
  });
});
