import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { listAllSkillPreferences, listSkills, setSkillPreference } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { TemplateItem } from '../types/api';
import { usePopoverPosition } from '../utils/usePopoverPosition';

interface Props {
  anchorRef: RefObject<HTMLElement | null>;
  templates: TemplateItem[];
  skillId: string;
  onClose: () => void;
  onChanged?: (template: TemplateItem, enabled: boolean) => void;
}

interface RowState {
  available: boolean;          // 模板是否含该技能
  enabled: boolean;            // 当前有效启用状态
  templateDefault: boolean;    // 模板默认 Enabled
  hasUserOverride: boolean;    // 用户是否已设过偏好
}

async function ensureToken(): Promise<string | null> {
  const s = useAuthStore.getState();
  return s.accessToken ?? (await s.refreshAccessToken());
}

export default function SkillTemplatePicker({ anchorRef, templates, skillId, onClose, onChanged }: Props) {
  const pos = usePopoverPosition(anchorRef);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-popover-portal="skill-template-picker"]')) return;
      if (anchorRef.current?.contains(t as Node | null)) return;
      onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose, anchorRef]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const token = await ensureToken();
        if (!token) throw new Error('未获取到访问令牌');

        const results = await Promise.all(
          templates.map(async (t) => {
            try {
              const [builtin, market, prefs] = await Promise.all([
                listSkills('builtin', t.TemplateId),
                listSkills('market', t.TemplateId),
                listAllSkillPreferences(token, t.TemplateId).catch(() => []),
              ]);
              const all = [...builtin.Skills, ...market.Skills];
              const skill = all.find((s) => s.SkillId === skillId);
              if (!skill) {
                return {
                  tid: t.TemplateId,
                  state: { available: false, enabled: false, templateDefault: false, hasUserOverride: false } as RowState,
                };
              }
              const userPref = prefs.find((p) => p.SkillId === skillId);
              const enabled = userPref ? userPref.UserPreference === 'Enabled' : !!skill.Enabled;
              return {
                tid: t.TemplateId,
                state: {
                  available: true,
                  enabled,
                  templateDefault: !!skill.Enabled,
                  hasUserOverride: !!userPref,
                } as RowState,
              };
            } catch {
              return {
                tid: t.TemplateId,
                state: { available: false, enabled: false, templateDefault: false, hasUserOverride: false } as RowState,
              };
            }
          }),
        );
        if (cancelled) return;
        const map: Record<string, RowState> = {};
        for (const r of results) map[r.tid] = r.state;
        setRows(map);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [templates, skillId]);

  const handleToggle = async (template: TemplateItem) => {
    const tid = template.TemplateId;
    const cur = rows[tid];
    if (!cur || !cur.available) return;
    const targetEnabled = !cur.enabled;
    const action: 'Enabled' | 'Disabled' = targetEnabled ? 'Enabled' : 'Disabled';

    setBusyId(tid);
    setError('');
    setRows((prev) => ({
      ...prev,
      [tid]: { ...cur, enabled: targetEnabled, hasUserOverride: true },
    })); // 乐观更新

    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await setSkillPreference(token, skillId, action, tid);
      onChanged?.(template, targetEnabled);
    } catch (err) {
      setRows((prev) => ({ ...prev, [tid]: cur })); // 回滚
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  };

  if (!pos) return null;

  return createPortal(
    <div
      data-popover-portal="skill-template-picker"
      style={{ position: 'fixed', right: pos.right, top: pos.top }}
      className="w-[320px] bg-white rounded-xl border border-gray-200 shadow-xl z-[60] overflow-hidden flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-black/70">在每个模板上的启用状态</span>
          <span className="text-[10px] text-black/40 mt-0.5">已综合「模板默认」+「用户偏好」</span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-black/40 hover:bg-gray-100 transition shrink-0"
          title="关闭"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mx-2.5 mb-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-600 break-all">
          {error}
        </div>
      )}

      <div className="overflow-auto max-h-72 px-1.5 pb-1.5">
        {loading ? (
          <div className="py-6 text-center text-[11px] text-black/40">加载状态...</div>
        ) : templates.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-black/40">无可用模板</div>
        ) : (
          <ul className="flex flex-col gap-px">
            {templates.map((t) => {
              const row = rows[t.TemplateId];
              const busy = busyId === t.TemplateId;
              if (!row || !row.available) {
                return (
                  <li key={t.TemplateId}>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md opacity-50">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs text-black/60 truncate">{t.TemplateKey || '(no key)'}</span>
                        <span className="text-[10px] text-black/35 truncate">该模板不包含此技能</span>
                      </div>
                    </div>
                  </li>
                );
              }
              return (
                <li key={t.TemplateId}>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-gray-50">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs text-black/80 truncate">{t.TemplateKey || '(no key)'}</span>
                        {row.hasUserOverride ? (
                          <span
                            className="shrink-0 text-[9px] text-primary px-1 rounded bg-primary/10"
                            title="当前是用户自定义偏好"
                          >
                            自定义
                          </span>
                        ) : (
                          <span
                            className="shrink-0 text-[9px] text-black/40 px-1 rounded bg-gray-100"
                            title={row.templateDefault ? '当前是模板默认开启' : '当前是模板默认关闭'}
                          >
                            默认
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-black/35 font-mono truncate">{t.TemplateId}</span>
                    </div>
                    <ToggleSwitch
                      checked={row.enabled}
                      disabled={busy}
                      onChange={() => void handleToggle(t)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ToggleSwitch({
  checked, onChange, disabled,
}: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(); }}
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
