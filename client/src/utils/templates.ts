import type { TemplateItem } from '../types/api';

export interface ExpertCard {
  id: string;
  name: string;
  subtitle: string;
  tenantId: string;
}

export function toExpertCards(templates: TemplateItem[]): ExpertCard[] {
  return templates.map((template) => {
    const id = template.TemplateId || template.TemplateKey;
    return {
      id,
      name: template.TemplateKey || id,
      subtitle: template.TemplateId || template.TemplateKey,
      tenantId: template.TenantId,
    };
  });
}
