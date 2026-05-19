import { describe, expect, it } from 'vitest';
import { toExpertCards } from './templates';
import type { TemplateItem } from '../types/api';

describe('template helpers', () => {
  it('maps templates into expert cards with stable display names', () => {
    const templates: TemplateItem[] = [
      { TenantId: 'tenant-1', TemplateId: 'template-a', TemplateKey: '任务执行专家' },
      { TenantId: 'tenant-1', TemplateId: 'template-b', TemplateKey: '' },
    ];

    expect(toExpertCards(templates)).toEqual([
      {
        id: 'template-a',
        name: '任务执行专家',
        subtitle: 'template-a',
        tenantId: 'tenant-1',
      },
      {
        id: 'template-b',
        name: 'template-b',
        subtitle: 'template-b',
        tenantId: 'tenant-1',
      },
    ]);
  });
});
