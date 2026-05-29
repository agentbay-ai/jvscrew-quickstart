import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  clearUserMcpCredential,
  createUserMcp,
  deleteUserMcp,
  getUserMcp,
  listUserMcps,
  setUserMcpCredential,
  setUserMcpPreference,
  updateUserMcp,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type {
  CreateUserMcpInput,
  McpItem,
  McpPreference,
  McpSourceFilter,
  McpTransport,
  UpdateUserMcpInput,
  UserMcpDetail,
} from '../types/api';
import { usePopoverPosition } from '../utils/usePopoverPosition';

interface McpPopoverProps {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

type Mode =
  | { type: 'list' }
  | { type: 'form'; mcp?: McpItem }
  | { type: 'credential'; mcpId: string; mcpName: string };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '操作失败';
}

async function ensureToken(): Promise<string | null> {
  const s = useAuthStore.getState();
  return s.accessToken ?? (await s.refreshAccessToken());
}

function headersToPairs(h?: Record<string, string> | null): Array<[string, string]> {
  if (!h) return [];
  return Object.entries(h);
}

function pairsToHeaders(pairs: Array<[string, string]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of pairs) {
    const kk = k.trim();
    if (kk) out[kk] = v;
  }
  return out;
}

function HeadersEditor({
  value,
  onChange,
  placeholderKey = 'Authorization',
  placeholderValue = 'Bearer xxx',
}: {
  value: Array<[string, string]>;
  onChange: (next: Array<[string, string]>) => void;
  placeholderKey?: string;
  placeholderValue?: string;
}) {
  const update = (idx: number, side: 0 | 1, val: string) => {
    const next = value.map((pair, i) => (i === idx ? (side === 0 ? [val, pair[1]] as [string, string] : [pair[0], val] as [string, string]) : pair));
    onChange(next);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => onChange([...value, ['', '']]);

  return (
    <div className="flex flex-col gap-1.5">
      {value.length === 0 && (
        <div className="text-[11px] text-black/40 px-1">未设置 Headers</div>
      )}
      {value.map(([k, v], idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            type="text"
            value={k}
            onChange={(e) => update(idx, 0, e.target.value)}
            placeholder={placeholderKey}
            spellCheck={false}
            className="flex-1 min-w-0 px-2 py-1 rounded-md border border-gray-200 text-[11px] font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
          />
          <input
            type="text"
            value={v}
            onChange={(e) => update(idx, 1, e.target.value)}
            placeholder={placeholderValue}
            spellCheck={false}
            className="flex-[1.4] min-w-0 px-2 py-1 rounded-md border border-gray-200 text-[11px] font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-black/40 hover:text-red-600 hover:bg-red-50 transition shrink-0"
            title="删除"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start mt-0.5 text-[11px] text-primary hover:underline"
      >
        + 添加 Header
      </button>
    </div>
  );
}

export default function McpPopover({ onClose, anchorRef }: McpPopoverProps) {
  const pos = usePopoverPosition(anchorRef);
  const templateId = useAuthStore((s) => s.config?.templateId);

  const [mcps, setMcps] = useState<McpItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [filter, setFilter] = useState<McpSourceFilter>('all');
  const [busyMcpId, setBusyMcpId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      const data = await listUserMcps(token, templateId, 'all');
      setMcps(data.Mcps);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!pendingDeleteId) return;
    const t = setTimeout(() => setPendingDeleteId(null), 2500);
    return () => clearTimeout(t);
  }, [pendingDeleteId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return mcps;
    return mcps.filter((m) => m.Source === filter);
  }, [mcps, filter]);

  const counts = useMemo(() => ({
    all: mcps.length,
    template: mcps.filter((m) => m.Source === 'template').length,
    user_persistent: mcps.filter((m) => m.Source === 'user_persistent').length,
  }), [mcps]);

  // Optimistic preference toggle for template MCPs
  const handleTogglePreference = useCallback(async (item: McpItem) => {
    setBusyMcpId(item.McpId);
    setError('');
    const next: McpPreference = item.IsEffective ? 'disabled' : 'enabled';
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await setUserMcpPreference(token, item.McpId, next, templateId);
      setMcps((prev) => prev.map((m) =>
        m.McpId === item.McpId
          ? { ...m, Preference: next, IsEffective: next === 'enabled' }
          : m,
      ));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyMcpId(null);
    }
  }, [templateId]);

  const handleSetPreferenceDefault = useCallback(async (item: McpItem) => {
    setBusyMcpId(item.McpId);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await setUserMcpPreference(token, item.McpId, 'default', templateId);
      await reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyMcpId(null);
    }
  }, [templateId, reload]);

  // For user_persistent MCPs — toggle IsEnabled via UpdateUserMcp
  const handleToggleUserMcpEnabled = useCallback(async (item: McpItem) => {
    setBusyMcpId(item.McpId);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await updateUserMcp(token, item.McpId, { IsEnabled: !item.IsEffective }, templateId);
      setMcps((prev) => prev.map((m) =>
        m.McpId === item.McpId ? { ...m, IsEffective: !item.IsEffective } : m,
      ));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyMcpId(null);
    }
  }, [templateId]);

  const handleDelete = useCallback(async (mcpId: string) => {
    setBusyMcpId(mcpId);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await deleteUserMcp(token, mcpId, templateId);
      setMcps((prev) => prev.filter((m) => m.McpId !== mcpId));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyMcpId(null);
      setPendingDeleteId(null);
    }
  }, [templateId]);

  const isForm = mode.type === 'form';
  const isCredential = mode.type === 'credential';

  if (!pos) return null;

  return createPortal(
    <div
      data-popover-portal="mcp"
      style={{ position: 'fixed', left: pos.left, bottom: pos.bottom }}
      className="w-[440px] bg-white rounded-2xl border border-gray-200 shadow-xl z-[60] flex flex-col overflow-hidden max-h-[560px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {(isForm || isCredential) && (
            <button
              onClick={() => setMode({ type: 'list' })}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 transition text-black/60 shrink-0"
              title="返回"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-black truncate">
                {mode.type === 'list' && 'MCP 工具'}
                {mode.type === 'form' && (mode.mcp ? `编辑「${mode.mcp.Name}」` : '新建用户 MCP')}
                {mode.type === 'credential' && `凭证 · ${mode.mcpName}`}
              </span>
              {mode.type === 'list' && mcps.length > 0 && (
                <span className="px-1.5 py-px rounded-full bg-gray-100 text-[10px] text-black/60 font-medium leading-tight">
                  {mcps.length}
                </span>
              )}
            </div>
            <span className="text-[11px] text-black/40 mt-0.5 truncate">
              {mode.type === 'list' && '调整启用偏好与凭证 · 下次会话生效'}
              {mode.type === 'form' && 'URL/凭证由你完全控制，不与模板共享'}
              {mode.type === 'credential' && '为模板 MCP 绑定专属 Headers，覆盖共享 token'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {mode.type === 'list' && (
            <button
              onClick={() => setMode({ type: 'form' })}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-primary/10 hover:text-primary transition text-black/60"
              title="新建用户专属 MCP"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition text-black/40"
            title="关闭"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter pills (list mode only) */}
      {mode.type === 'list' && mcps.length > 0 && (
        <div className="flex items-center gap-1 px-3.5 pb-2">
          {(['all', 'template', 'user_persistent'] as const).map((src) => {
            const active = filter === src;
            const label = src === 'all' ? '全部' : src === 'template' ? '模板' : '我的';
            return (
              <button
                key={src}
                onClick={() => setFilter(src)}
                className={`px-2.5 h-6 rounded-full text-[11px] font-medium transition ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-50 text-black/55 hover:bg-gray-100'
                }`}
              >
                {label} {counts[src] > 0 && <span className="opacity-70">· {counts[src]}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-3.5 mb-2 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 text-[11px] text-red-600 flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 mt-px shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1 break-all">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0" title="关闭">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto px-3.5 pb-3">
        {mode.type === 'list' && (
          isLoading ? (
            <div className="py-8 text-center text-xs text-black/40">加载中...</div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreate={() => setMode({ type: 'form' })} />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filtered.map((item) => (
                <McpRow
                  key={item.McpId}
                  item={item}
                  busy={busyMcpId === item.McpId}
                  pendingDelete={pendingDeleteId === item.McpId}
                  onToggle={() =>
                    item.Source === 'template' ? handleTogglePreference(item) : handleToggleUserMcpEnabled(item)
                  }
                  onSetDefault={() => handleSetPreferenceDefault(item)}
                  onEdit={() => setMode({ type: 'form', mcp: item })}
                  onCredential={() => setMode({ type: 'credential', mcpId: item.McpId, mcpName: item.Name })}
                  onDeleteRequest={() => setPendingDeleteId(item.McpId)}
                  onDeleteConfirm={() => handleDelete(item.McpId)}
                  onDeleteCancel={() => setPendingDeleteId(null)}
                />
              ))}
            </ul>
          )
        )}

        {mode.type === 'form' && (
          <UserMcpForm
            initial={mode.mcp}
            templateId={templateId}
            onCancel={() => setMode({ type: 'list' })}
            onSaved={async () => {
              setMode({ type: 'list' });
              await reload();
            }}
            onError={(msg) => setError(msg)}
          />
        )}

        {mode.type === 'credential' && (
          <CredentialForm
            mcpId={mode.mcpId}
            templateId={templateId}
            isBound={!!mcps.find((m) => m.McpId === mode.mcpId)?.IsCredentialBound}
            onCancel={() => setMode({ type: 'list' })}
            onSaved={async () => {
              setMode({ type: 'list' });
              await reload();
            }}
            onError={(msg) => setError(msg)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="py-8 flex flex-col items-center gap-2 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
        </svg>
      </div>
      <div className="text-xs text-black/50">尚未配置任何 MCP</div>
      <button
        onClick={onCreate}
        className="mt-1 px-3 py-1 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition"
      >
        新建 MCP
      </button>
    </div>
  );
}

function McpRow({
  item, busy, pendingDelete,
  onToggle, onSetDefault, onEdit, onCredential, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: {
  item: McpItem;
  busy: boolean;
  pendingDelete: boolean;
  onToggle: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onCredential: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const isTemplate = item.Source === 'template';
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="group rounded-lg px-2.5 py-2 hover:bg-gray-50/70 transition">
      <div className="flex items-start gap-2">
        <span className={`shrink-0 mt-0.5 px-1.5 h-5 rounded-md text-[10px] font-medium leading-5 inline-flex items-center ${
          isTemplate ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'
        }`}>
          {isTemplate ? '模板' : '我的'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-black truncate">{item.Name}</span>
            <span className="text-[10px] text-black/35 font-mono">{item.Transport}</span>
          </div>
          <div className="text-[11px] text-black/45 truncate font-mono mt-0.5">{item.Url}</div>
          {item.Description && (
            <div className="text-[11px] text-black/55 truncate mt-0.5">{item.Description}</div>
          )}
          {isTemplate && item.Preference && item.Preference !== 'default' && (
            <button
              onClick={onSetDefault}
              disabled={busy}
              className="mt-1 text-[10px] text-primary/70 hover:underline disabled:opacity-50"
              title="恢复为模板默认"
            >
              · 用户偏好已覆盖（{item.Preference === 'enabled' ? '启用' : '禁用'}），点此恢复默认
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {pendingDelete ? (
            <>
              <span className="text-[11px] text-red-600 mr-0.5">确认?</span>
              <button
                onClick={onDeleteConfirm}
                disabled={busy}
                className="px-2 py-0.5 rounded-md bg-red-500 text-white text-[11px] font-medium hover:bg-red-600 disabled:opacity-50 transition"
              >
                {busy ? '删除中' : '删除'}
              </button>
              <button
                onClick={onDeleteCancel}
                className="px-1.5 py-0.5 rounded-md text-[11px] text-black/50 hover:bg-gray-100 transition"
              >
                取消
              </button>
            </>
          ) : (
            <>
              <ToggleSwitch
                checked={item.IsEffective}
                disabled={busy}
                onChange={onToggle}
                title={item.IsEffective ? '点击禁用' : '点击启用'}
              />
              {isTemplate ? (
                <button
                  onClick={onCredential}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-black/50 hover:text-primary hover:bg-primary/10 transition"
                  title={item.IsCredentialBound ? '已绑定凭证 · 点击修改' : '绑定凭证'}
                >
                  <svg className={`w-3.5 h-3.5 ${item.IsCredentialBound ? 'text-emerald-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={onEdit}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-black/50 hover:text-primary hover:bg-primary/10 transition"
                  title="编辑"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setExpanded((e) => !e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-black/40 hover:text-black/70 hover:bg-gray-100 transition"
                title="详情"
              >
                <svg className={`w-3.5 h-3.5 transition ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!isTemplate && (
                <button
                  onClick={onDeleteRequest}
                  disabled={busy}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-black/50 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                  title="删除"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-2 ml-7 px-2.5 py-2 bg-gray-50 rounded-md text-[11px] text-black/60 space-y-0.5">
          <div><span className="text-black/40">McpId · </span><span className="font-mono">{item.McpId}</span></div>
          <div><span className="text-black/40">URL · </span><span className="font-mono break-all">{item.Url}</span></div>
          {isTemplate && (
            <>
              <div><span className="text-black/40">模板默认 · </span>{item.TemplateDefault ? '启用' : '禁用'}</div>
              <div><span className="text-black/40">凭证 · </span>{item.IsCredentialBound ? '已绑定专属凭证' : '使用模板共享凭证'}</div>
            </>
          )}
          {!isTemplate && item.Headers && Object.keys(item.Headers).length > 0 && (
            <div>
              <span className="text-black/40">Headers · </span>
              <span className="font-mono">{Object.keys(item.Headers).join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ToggleSwitch({
  checked, onChange, disabled, title,
}: { checked: boolean; onChange: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={(e) => { e.preventDefault(); onChange(); }}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent cursor-pointer transition-colors duration-200 disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function UserMcpForm({
  initial, templateId, onCancel, onSaved, onError,
}: {
  initial?: McpItem;
  templateId?: string;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.Name ?? '');
  const [transport, setTransport] = useState<McpTransport>(initial?.Transport ?? 'streamable_http');
  const [url, setUrl] = useState(initial?.Url ?? '');
  const [description, setDescription] = useState(initial?.Description ?? '');
  const [timeout, setTimeoutVal] = useState<string>('30');
  const [sseTimeout, setSseTimeout] = useState<string>('300');
  const [isEnabled, setIsEnabled] = useState<boolean>(initial?.IsEffective ?? true);
  const [headers, setHeaders] = useState<Array<[string, string]>>(headersToPairs(initial?.Headers));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(isEdit);

  // 编辑模式下补拉详情，因为 ListUserMcps 不返回 Timeout/SseReadTimeout/IsEnabled
  useEffect(() => {
    if (!isEdit || !initial) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await ensureToken();
        if (!token) throw new Error('未获取到访问令牌');
        const detail: UserMcpDetail = await getUserMcp(token, initial.McpId, templateId);
        if (cancelled) return;
        setName(detail.Name ?? '');
        setTransport(detail.Transport);
        setUrl(detail.Url ?? '');
        setDescription(detail.Description ?? '');
        setTimeoutVal(String(detail.Timeout ?? 30));
        setSseTimeout(String(detail.SseReadTimeout ?? 300));
        setIsEnabled(detail.IsEnabled);
        setHeaders(headersToPairs(detail.Headers));
      } catch (err) {
        if (!cancelled) onError(errorText(err));
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, initial, templateId, onError]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const trimmedDesc = description.trim();
    if (!trimmedName) return onError('Name 不能为空');
    if (!trimmedUrl) return onError('URL 不能为空');
    setIsSaving(true);
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      const headerMap = pairsToHeaders(headers);
      if (isEdit && initial) {
        // 编辑模式：description 即使是空也必须发送，让后端把已有描述清掉
        const partial: UpdateUserMcpInput = {
          Name: trimmedName,
          Transport: transport,
          Url: trimmedUrl,
          Description: trimmedDesc,
          Headers: headerMap,
          IsEnabled: isEnabled,
        };
        const t = parseInt(timeout, 10); if (!Number.isNaN(t) && t > 0) partial.Timeout = t;
        const s = parseInt(sseTimeout, 10); if (!Number.isNaN(s) && s > 0) partial.SseReadTimeout = s;
        await updateUserMcp(token, initial.McpId, partial, templateId);
      } else {
        const payload: CreateUserMcpInput = {
          Name: trimmedName,
          Transport: transport,
          Url: trimmedUrl,
          Description: trimmedDesc || undefined,
          Headers: Object.keys(headerMap).length > 0 ? headerMap : undefined,
        };
        const t = parseInt(timeout, 10); if (!Number.isNaN(t) && t > 0) payload.Timeout = t;
        const s = parseInt(sseTimeout, 10); if (!Number.isNaN(s) && s > 0) payload.SseReadTimeout = s;
        await createUserMcp(token, payload, templateId);
      }
      await onSaved();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingDetail) {
    return <div className="py-8 text-center text-xs text-black/40">加载详情...</div>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 mt-1">
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：企业 OA"
          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
        />
      </Field>
      <Field label="Transport">
        <div className="flex gap-1.5">
          {(['streamable_http', 'sse'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTransport(t)}
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
                transport === t
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-gray-50 text-black/55 border border-transparent hover:bg-gray-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>
      <Field label="URL">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://my-mcp.example.com/sse"
          spellCheck={false}
          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
        />
      </Field>
      <Field label={<span>Headers <span className="text-black/35 font-normal">(可选)</span></span>}>
        <HeadersEditor value={headers} onChange={setHeaders} />
      </Field>
      <Field label={<span>描述 <span className="text-black/35 font-normal">(可选)</span></span>}>
        <input
          type="text"
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
        />
      </Field>
      <div className="flex gap-2">
        <Field label="Timeout (s)" inline>
          <input
            type="number"
            min={1}
            value={timeout}
            onChange={(e) => setTimeoutVal(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
          />
        </Field>
        <Field label="SSE Read (s)" inline>
          <input
            type="number"
            min={1}
            value={sseTimeout}
            onChange={(e) => setSseTimeout(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
          />
        </Field>
      </div>
      {isEdit && (
        <label className="flex items-center justify-between px-1 cursor-pointer">
          <span className="text-[11px] font-medium text-black/55">启用</span>
          <ToggleSwitch checked={isEnabled} onChange={() => setIsEnabled((v) => !v)} />
        </label>
      )}
      <div className="flex items-center justify-end gap-1.5 mt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-black/60 hover:bg-gray-100 transition"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait transition"
        >
          {isSaving ? '保存中...' : (isEdit ? '保存' : '创建')}
        </button>
      </div>
    </form>
  );
}

function CredentialForm({
  mcpId, templateId, isBound, onCancel, onSaved, onError,
}: {
  mcpId: string;
  templateId?: string;
  isBound: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  // 模板 MCP 的 Headers 服务端不下发，所以无法 prefill 真实值；用户需要重新输入
  const [headers, setHeaders] = useState<Array<[string, string]>>([['Authorization', '']]);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const map = pairsToHeaders(headers);
    if (Object.keys(map).length === 0) return onError('Headers 不能为空');
    setIsSaving(true);
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await setUserMcpCredential(token, mcpId, map, templateId);
      await onSaved();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setIsSaving(false);
    }
  };

  const clear = async () => {
    setIsClearing(true);
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await clearUserMcpCredential(token, mcpId, templateId);
      await onSaved();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-2.5 mt-1">
      <div className="text-[11px] text-black/55 px-1 leading-relaxed">
        Headers 会替代模板共享 token，仅当前用户可见。URL 仍由模板控制。
      </div>
      <Field label="Headers">
        <HeadersEditor value={headers} onChange={setHeaders} />
      </Field>
      <div className="flex items-center justify-between gap-1.5 mt-1">
        {isBound ? (
          <button
            type="button"
            onClick={clear}
            disabled={isClearing}
            className="px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
          >
            {isClearing ? '解绑中...' : '解绑凭证'}
          </button>
        ) : <div />}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs text-black/60 hover:bg-gray-100 transition"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait transition"
          >
            {isSaving ? '保存中...' : '保存凭证'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children, inline }: { label: React.ReactNode; children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={inline ? 'flex-1' : ''}>
      <label className="block text-[11px] font-medium text-black/55 mb-1">{label}</label>
      {children}
    </div>
  );
}
