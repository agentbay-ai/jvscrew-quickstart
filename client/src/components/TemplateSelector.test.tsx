import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TemplateMenu } from './TemplateSelector';

describe('TemplateSelector', () => {
  it('renders template choices without the manual switch form', () => {
    const html = renderToString(
      <TemplateMenu
        templates={[
          { TenantId: 'tenant-1', TemplateId: 'template-1', TemplateKey: '助理Agent' },
          { TenantId: 'tenant-1', TemplateId: 'template-2', TemplateKey: '默认Agent模板' },
        ]}
        selectedTemplateId="template-1"
        isLoading={false}
        loadError=""
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain('助理Agent');
    expect(html).toContain('默认Agent模板');
    expect(html).not.toContain('Switch Template');
    expect(html).not.toContain('template-abc123');
    expect(html).not.toContain('>Switch</button>');
  });
});
