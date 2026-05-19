import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ExpertCard, McpModal, TemplateDetailSheet } from './ExpertsView';
import type { ExpertTemplate, TemplateDetailResponse } from '../types/api';

const expert: ExpertTemplate = {
  id: 'template-1',
  name: '任务执行专家',
  templateId: 'template-1',
  templateKey: '任务执行专家',
  tenantId: 'tenant-1',
  status: 'online',
};

const detail: TemplateDetailResponse = {
  Success: true,
  Code: '200',
  TemplateId: 'template-1',
  TenantId: 'tenant-1',
  ModelTier: 'pro',
  CreatedAt: '2026-04-30T05:45:00.000Z',
  UpdatedAt: '2026-04-30T06:09:01.000Z',
  ProviderPolicy: {
    ActiveLlm: {
      ProviderId: 'provider-1',
      Model: 'qwen-max',
    },
  },
  Mcp: {
    Clients: [
      { Name: 'web-search', Enabled: 'true' },
      { Name: 'docs', Enabled: 'false' },
    ],
  },
  Skills: {
    Enabled: [
      { Type: 'builtin', SkillId: 'builtin:deep_web_search' },
      { Type: 'market', SkillId: 'market:report' },
    ],
  },
  Workspace: {
    Files: [{ Path: 'AGENTS.md', Version: 1 }],
  },
};

describe('ExpertsView detail sheet', () => {
  it('renders skill count on expert cards without tenant text', () => {
    const html = renderToString(
      <ExpertCard
        expert={expert}
        selected={false}
        skillCount={8}
        onChat={() => undefined}
        onShowSkills={() => undefined}
        onShowDetail={() => undefined}
      />,
    );

    expect(html).toContain('8');
    expect(html).toContain('个 Skill');
    expect(html).toContain('text-black/70');
    expect(html).not.toContain('Tenant');
    expect(html).not.toContain('tenant-1');
  });

  it('hides skill count on expert cards before the count is loaded', () => {
    const html = renderToString(
      <ExpertCard
        expert={expert}
        selected={false}
        onChat={() => undefined}
        onShowSkills={() => undefined}
        onShowDetail={() => undefined}
      />,
    );

    expect(html).not.toContain('Skill 加载中');
    expect(html).not.toContain('个 Skill');
  });

  it('renders template detail summary from GetTemplate response', () => {
    const html = renderToString(
      <TemplateDetailSheet
        expert={expert}
        detail={detail}
        isLoading={false}
        error=""
        onClose={() => undefined}
        onRetry={() => undefined}
        onShowMcp={() => undefined}
        onShowSkills={() => undefined}
      />,
    );

    expect(html).toContain('任务执行专家');
    expect(html).toContain('MCP');
    expect(html).toContain('2 个');
    expect(html).toContain('查看 MCP');
    expect(html).toContain('技能');
    expect(html).toContain('qwen-max');
    expect(html).toContain('pro');
    expect(html).toContain('时间信息');
    expect(html).not.toContain('资源配置');
    expect(html).not.toContain('更新时间');
    expect(html).not.toContain('›');
  });

  it('does not duplicate the model tier when it matches the active model', () => {
    const html = renderToString(
      <TemplateDetailSheet
        expert={expert}
        detail={{
          ...detail,
          ModelTier: 'ultra',
          ProviderPolicy: {
            ActiveLlm: {
              Model: 'ultra',
            },
          },
        }}
        isLoading={false}
        error=""
        onClose={() => undefined}
        onRetry={() => undefined}
        onShowMcp={() => undefined}
        onShowSkills={() => undefined}
      />,
    );

    expect(html).toContain('ultra');
    expect(html).not.toContain('ultra · ultra');
  });

  it('renders MCP clients from GetTemplate without exposing headers', () => {
    const html = renderToString(
      <McpModal
        expert={expert}
        clients={[
          {
            Name: 'web-search',
            Description: '联网搜索',
            Enabled: 'true',
            Transport: 'sse',
            Url: 'https://example.com/sse',
            Timeout: 30,
            Headers: { Authorization: 'Bearer secret-token' },
          },
          {
            Name: 'docs',
            Enabled: 'false',
            Transport: 'stdio',
          },
        ]}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('任务执行专家');
    expect(html).toContain('的 MCP');
    expect(html).toContain('web-search');
    expect(html).toContain('联网搜索');
    expect(html).toContain('sse');
    expect(html).toContain('https://example.com/sse');
    expect(html).toContain('Timeout');
    expect(html).toContain('30');
    expect(html).toContain('已启用');
    expect(html).toContain('未启用');
    expect(html).not.toContain('secret-token');
    expect(html).not.toContain('Authorization');
  });
});
