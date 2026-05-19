import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTemplate, listSkills, listTemplates } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type {
  ExpertTemplate,
  SkillItem,
  TemplateDetailResponse,
  TemplateMcpClient,
  TemplateItem,
} from '../types/api';

const AVATARS = [
  'https://img.alicdn.com/imgextra/i2/6000000006913/O1CN017tneP620wD8kVZFDn_!!6000000006913-2-gg_dtc.png',
  'https://img.alicdn.com/imgextra/i4/6000000005580/O1CN01AVtvcn1r5hBVIkwET_!!6000000005580-2-gg_dtc.png',
  'https://img.alicdn.com/imgextra/i4/6000000003494/O1CN01wRFHmI1bgIzVwQs2S_!!6000000003494-2-gg_dtc.png',
  'https://img.alicdn.com/imgextra/i4/6000000001106/O1CN01hnqFxM1K2bBd0IzJt_!!6000000001106-2-gg_dtc.png',
];

interface ExpertsViewProps {
  onStartChat: (expert: ExpertTemplate) => void;
}

function templateToExpert(template: TemplateItem, index: number): ExpertTemplate | null {
  const id = template.TemplateId || template.TemplateKey;
  if (!id) return null;
  return {
    id,
    name: template.TemplateKey || id,
    description: template.TemplateId || undefined,
    avatar: AVATARS[index % AVATARS.length],
    status: 'online',
    tags: ['云端'],
    templateId: template.TemplateId,
    templateKey: template.TemplateKey,
    tenantId: template.TenantId,
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '加载专家列表失败';
}

function StatusBadge({ status }: { status?: ExpertTemplate['status'] }) {
  if (status === 'online') {
    return <span className="text-xs font-medium text-[#48CD00]">在线</span>;
  }
  return <span className="text-xs font-medium text-black/40">--</span>;
}

function isEmojiIcon(icon: string): boolean {
  return !icon.startsWith('http');
}

function formatDateTime(value?: string): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function templateSkillCount(detail?: TemplateDetailResponse | null): number {
  return detail?.Skills?.Enabled?.length ?? 0;
}

function templateMcpCount(detail?: TemplateDetailResponse | null): number {
  return detail?.Mcp?.Clients?.length ?? 0;
}

function isMcpClientEnabled(client: TemplateMcpClient): boolean {
  if (typeof client.Enabled === 'boolean') return client.Enabled;
  return client.Enabled?.toLowerCase() === 'true';
}

function mcpClientName(client: TemplateMcpClient, index: number): string {
  return client.Name?.trim() || client.Url?.trim() || `MCP ${index + 1}`;
}

function templateModelText(detail?: TemplateDetailResponse | null): string {
  const model = detail?.ProviderPolicy?.ActiveLlm?.Model?.trim();
  const tier = detail?.ModelTier?.trim();
  if (model && tier && model !== tier) return `${model} · ${tier}`;
  return model || tier || '待配置';
}

function DetailTile({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="min-h-[70px] rounded-[14px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-4 py-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-xs text-black/50">{title}</div>
        <div className="mt-1 text-base font-semibold text-black truncate">{value}</div>
      </div>
    </div>
  );
}

function DetailActionTile({
  title,
  value,
  ariaLabel,
  onClick,
}: {
  title: string;
  value: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="min-h-[70px] rounded-[14px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:shadow-[inset_0_0_0_1px_#3550FF66] transition"
    >
      <div className="min-w-0">
        <div className="text-xs text-black/50">{title}</div>
        <div className="mt-1 text-base font-semibold text-[#3550FF]">{value}</div>
      </div>
      <svg className="w-4 h-4 text-black/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export function TemplateDetailSheet({
  expert,
  detail,
  isLoading,
  error,
  onClose,
  onRetry,
  onShowMcp,
  onShowSkills,
}: {
  expert: ExpertTemplate;
  detail: TemplateDetailResponse | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onShowMcp: () => void;
  onShowSkills: () => void;
}) {
  const displayName = detail?.Template?.TemplateKey || expert.name;
  const mcpCount = templateMcpCount(detail);
  const skillCount = templateSkillCount(detail);

  return (
    <div
      className="relative bg-white rounded-[24px] shadow-2xl w-[460px] max-w-[calc(100vw-32px)] max-h-[86vh] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-6 pt-6 pb-4 flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {expert.avatar ? (
            <img src={expert.avatar} alt={displayName} className="w-12 h-12 rounded-full shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#EEEFFF] text-[#3550FF] flex items-center justify-center shrink-0">
              AI
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-black truncate">{displayName}</h2>
              <span className="text-black/45 text-sm">✎</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md bg-black/[0.06] px-1.5 leading-5 text-xs text-black/75">云端</span>
              <span className="text-xs font-medium text-[#48CD00]">在线</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-black/45 hover:bg-black/[0.04] transition"
          aria-label="关闭详情"
          title="关闭详情"
        >
          ×
        </button>
      </div>

      <div className="px-6 pb-6 overflow-auto max-h-[calc(86vh-96px)]">
        {isLoading && (
          <div className="rounded-[16px] bg-[#F7F8FC] px-4 py-10 text-center text-sm text-black/45">
            加载专家详情中...
          </div>
        )}

        {error && (
          <div className="rounded-[16px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={onRetry} className="text-xs underline">重试</button>
          </div>
        )}

        {!isLoading && !error && detail && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailActionTile
                title="MCP"
                value={`${mcpCount} 个`}
                ariaLabel="查看 MCP"
                onClick={onShowMcp}
              />
              <DetailActionTile
                title="技能"
                value={`${skillCount} 个`}
                ariaLabel="查看技能"
                onClick={onShowSkills}
              />
            </div>

            <DetailTile
              title="模型配置"
              value={templateModelText(detail)}
            />

            <div className="rounded-[14px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-4 py-4">
              <h3 className="text-sm font-semibold text-black">时间信息</h3>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-black/50">创建时间</span>
                  <span className="text-black/70">{formatDateTime(detail.CreatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateDetailModal({
  expert,
  onClose,
}: {
  expert: ExpertTemplate;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<TemplateDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMcp, setShowMcp] = useState(false);
  const [showSkills, setShowSkills] = useState(false);

  const load = useCallback(async () => {
    const templateId = expert.templateId || expert.id;
    if (!templateId) {
      setError('缺少 TemplateId');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const data = await getTemplate(templateId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载专家详情失败');
    } finally {
      setIsLoading(false);
    }
  }, [expert.id, expert.templateId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
        <TemplateDetailSheet
          expert={expert}
          detail={detail}
          isLoading={isLoading}
          error={error}
          onClose={onClose}
          onRetry={() => void load()}
          onShowMcp={() => setShowMcp(true)}
          onShowSkills={() => setShowSkills(true)}
        />
      </div>
      {showMcp && (
        <McpModal
          expert={expert}
          clients={detail?.Mcp?.Clients ?? []}
          onClose={() => setShowMcp(false)}
        />
      )}
      {showSkills && (
        <SkillsModal expert={expert} onClose={() => setShowSkills(false)} />
      )}
    </>
  );
}

export function McpModal({
  expert,
  clients,
  onClose,
}: {
  expert: ExpertTemplate;
  clients: TemplateMcpClient[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {expert.avatar && (
              <img src={expert.avatar} alt={expert.name} className="w-8 h-8 rounded-lg" />
            )}
            <span className="text-base font-medium text-black">{expert.name}</span>
            <span className="text-sm text-black/40">的 MCP</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition">
            <svg className="w-4 h-4 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {clients.length === 0 ? (
            <div className="text-center py-12 text-sm text-black/40">该专家暂无 MCP</div>
          ) : (
            <div className="flex flex-col gap-3">
              {clients.map((client, index) => (
                <div
                  key={`${mcpClientName(client, index)}-${index}`}
                  className={`rounded-[16px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-4 py-3 transition
                    ${isMcpClientEnabled(client) ? 'hover:shadow-[inset_0_0_0_1px_#2F3A8040]' : 'opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-black truncate">
                          {mcpClientName(client, index)}
                        </span>
                        {client.Transport && (
                          <span className="shrink-0 rounded-md bg-black/[0.04] px-1.5 text-[11px] leading-[18px] text-black/50">
                            {client.Transport}
                          </span>
                        )}
                      </div>
                      {client.Description && (
                        <div className="mt-1 text-xs text-black/50 line-clamp-2">
                          {client.Description}
                        </div>
                      )}
                    </div>
                    {isMcpClientEnabled(client) ? (
                      <span className="shrink-0 text-xs text-[#48CD00] font-medium">已启用</span>
                    ) : (
                      <span className="shrink-0 text-xs text-black/30">未启用</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5 text-xs text-black/50">
                    {client.Url && (
                      <div className="flex gap-2">
                        <span className="shrink-0 text-black/35">URL</span>
                        <span className="min-w-0 flex-1 truncate text-black/60">{client.Url}</span>
                      </div>
                    )}
                    {typeof client.Timeout === 'number' && (
                      <div className="flex gap-2">
                        <span className="shrink-0 text-black/35">Timeout</span>
                        <span className="text-black/60">{client.Timeout}s</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 shrink-0 flex justify-between items-center">
          <span className="text-xs text-black/40">{clients.length} 个 MCP</span>
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-full bg-[#EDEEF6] text-sm font-medium text-black hover:bg-[#e2e3f0] transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillsModal({
  expert,
  onClose,
}: {
  expert: ExpertTemplate;
  onClose: () => void;
}) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [builtin, market] = await Promise.all([
        listSkills('builtin', expert.templateId),
        listSkills('market', expert.templateId),
      ]);
      setSkills([...builtin.Skills, ...market.Skills]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载技能失败');
    } finally {
      setIsLoading(false);
    }
  }, [expert.templateId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {expert.avatar && (
              <img src={expert.avatar} alt={expert.name} className="w-8 h-8 rounded-lg" />
            )}
            <span className="text-base font-medium text-black">{expert.name}</span>
            <span className="text-sm text-black/40">的技能</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition">
            <svg className="w-4 h-4 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isLoading && (
            <div className="text-center py-12 text-sm text-black/40">加载技能中...</div>
          )}
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
              {error}
              <button onClick={() => void load()} className="text-red-500 hover:text-red-700 underline text-xs ml-4">重试</button>
            </div>
          )}
          {!isLoading && skills.length === 0 && !error && (
            <div className="text-center py-12 text-sm text-black/40">该专家暂无技能</div>
          )}
          {!isLoading && skills.length > 0 && (
            <div className="flex flex-col gap-3">
              {skills.map((skill) => (
                <div
                  key={skill.SkillId}
                  className={`rounded-[16px] flex flex-row items-center gap-3 px-4 min-h-[64px] transition
                    ${skill.Enabled
                      ? 'bg-white shadow-[inset_0_0_0_1px_#2F3A801A] hover:shadow-[inset_0_0_0_1px_#2F3A8040]'
                      : 'bg-white/60 shadow-[inset_0_0_0_1px_#2F3A801A] opacity-50'
                    }`}
                >
                  {isEmojiIcon(skill.Icon) ? (
                    <span className="w-10 h-10 rounded-lg bg-[#F5F6FA] flex items-center justify-center text-xl shrink-0">
                      {skill.Icon}
                    </span>
                  ) : (
                    <img src={skill.Icon} alt={skill.SkillName} className="w-10 h-10 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black truncate">{skill.SkillName}</span>
                      {skill.SkillId.startsWith('builtin:') && (
                        <span className="shrink-0 rounded-md bg-black/[0.04] px-1.5 text-[11px] leading-[18px] text-black/50">内置</span>
                      )}
                    </div>
                    <span className="text-xs text-black/50 truncate">{skill.Description}</span>
                  </div>
                  {skill.Enabled ? (
                    <span className="shrink-0 text-xs text-[#48CD00] font-medium">已启用</span>
                  ) : (
                    <span className="shrink-0 text-xs text-black/30">未启用</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 shrink-0 flex justify-between items-center">
          <span className="text-xs text-black/40">{skills.length} 个技能</span>
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-full bg-[#EDEEF6] text-sm font-medium text-black hover:bg-[#e2e3f0] transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExpertCard({
  expert,
  selected,
  skillCount,
  onChat,
  onShowDetail,
}: {
  expert: ExpertTemplate;
  selected: boolean;
  skillCount?: number;
  onChat: () => void;
  onShowDetail: () => void;
}) {
  return (
    <div
      className={`rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] flex flex-col gap-5 p-4 overflow-hidden min-h-[172px] transition
        ${selected ? 'ring-2 ring-[#3550FF]/30' : 'hover:shadow-[inset_0_0_0_1px_#2F3A8040]'}`}
    >
      <div className="w-full flex items-start gap-4">
        <img src={expert.avatar} alt={expert.name} className="w-[52px] h-[52px] rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-medium text-black truncate">{expert.name}</span>
                <span className="text-xs font-medium text-black/80 bg-black/[0.06] rounded-lg px-1.5 leading-5 shrink-0">
                  云端
                </span>
              </div>
              {typeof skillCount === 'number' && (
                <p className="text-xs text-black/70 mt-1 font-medium truncate">
                  {skillCount} 个 Skill
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <StatusBadge status={expert.status} />
              {selected && (
                <span className="text-[10px] font-medium text-[#3550FF]">当前</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex items-center gap-2 mt-auto">
        <button
          onClick={onChat}
          className="flex-1 h-10 rounded-[20px] bg-[#EDEEF6] flex items-center justify-center gap-2 hover:bg-[#e2e3f0] transition"
        >
          <svg className="w-4 h-4 text-black/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-medium text-black">对话</span>
        </button>
        <button
          onClick={onShowDetail}
          className="w-10 h-10 rounded-full bg-[#EDEEF6] flex items-center justify-center text-2xl leading-none text-black hover:bg-[#e2e3f0] transition"
          aria-label="查看专家详情"
          title="查看专家详情"
        >
          ⋮
        </button>
      </div>
    </div>
  );
}

export default function ExpertsView({ onStartChat }: ExpertsViewProps) {
  const selectedTemplateId = useAuthStore((s) => s.config?.templateId);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [skillCounts, setSkillCounts] = useState<Record<string, number>>({});
  const [detailExpert, setDetailExpert] = useState<ExpertTemplate | null>(null);

  const experts = useMemo(
    () => templates.map(templateToExpert).filter((expert): expert is ExpertTemplate => Boolean(expert)),
    [templates],
  );

  const loadExperts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setSkillCounts({});
    try {
      const data = await listTemplates();
      setTemplates(data.Items);
      setIsLoading(false);
      const countResults = await Promise.allSettled(
        data.Items.map(async (template) => {
          const templateId = template.TemplateId;
          if (!templateId) return null;
          const detail = await getTemplate(templateId);
          return [templateId, templateSkillCount(detail)] as const;
        }),
      );
      const nextCounts: Record<string, number> = {};
      for (const result of countResults) {
        if (result.status === 'fulfilled' && result.value) {
          const [templateId, count] = result.value;
          nextCounts[templateId] = count;
        }
      }
      setSkillCounts(nextCounts);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadExperts();
    });
  }, [loadExperts]);

  return (
    <div className="h-full w-full overflow-auto bg-[#FAFBFF]">
      <div className="p-6 flex flex-col gap-4 max-w-[1440px]">
        <div className="flex flex-col gap-4 px-1">
          <h1 className="text-xl font-semibold text-black">我的专家</h1>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-black/60">我的专家</span>
              <button
                onClick={() => void loadExperts()}
                className="w-7 h-7 rounded-full flex items-center justify-center text-black/50 hover:bg-white hover:shadow-sm transition"
                aria-label="刷新专家列表"
                title="刷新专家列表"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <span className="text-sm text-black/40">{experts.length} 个专家</span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-5 py-12 text-center text-sm text-black/40">
            加载专家列表中...
          </div>
        )}

        {!isLoading && experts.length === 0 && !error && (
          <div className="rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-5 py-16 text-center">
            <div className="text-sm text-black/40">暂无专家</div>
          </div>
        )}

        {!isLoading && experts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {experts.map((expert) => (
              <ExpertCard
                key={expert.id}
                expert={expert}
                selected={selectedTemplateId === expert.id}
                skillCount={expert.templateId ? skillCounts[expert.templateId] : undefined}
                onChat={() => onStartChat(expert)}
                onShowDetail={() => setDetailExpert(expert)}
              />
            ))}
          </div>
        )}
      </div>

      {detailExpert && (
        <TemplateDetailModal expert={detailExpert} onClose={() => setDetailExpert(null)} />
      )}
    </div>
  );
}
