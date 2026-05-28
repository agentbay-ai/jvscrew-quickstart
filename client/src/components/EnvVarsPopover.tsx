import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteAgentEnvVars,
  listAllAgentEnvVars,
  setAgentEnvVars,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { AgentEnvVarSummary } from '../types/api';

interface EnvVarsPopoverProps {
  onClose: () => void;
}

type Mode = { type: 'list' } | { type: 'form'; presetKey?: string; presetDesc?: string };

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}

async function ensureToken(): Promise<string | null> {
  const state = useAuthStore.getState();
  return state.accessToken ?? (await state.refreshAccessToken());
}

export default function EnvVarsPopover({ onClose }: EnvVarsPopoverProps) {
  const templateId = useAuthStore((s) => s.config?.templateId);
  const [vars, setVars] = useState<AgentEnvVarSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const keyInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      const list = await listAllAgentEnvVars(token, templateId);
      list.sort((a, b) => a.Key.localeCompare(b.Key));
      setVars(list);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(null), 2500);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  useEffect(() => {
    if (mode.type !== 'form') return;
    const target = mode.presetKey ? valueInputRef.current : keyInputRef.current;
    target?.focus();
  }, [mode]);

  const openForm = useCallback((preset?: AgentEnvVarSummary) => {
    setNewKey(preset?.Key ?? '');
    setNewDesc(preset?.Description ?? '');
    setNewValue('');
    setShowValue(false);
    setError('');
    setMode({ type: 'form', presetKey: preset?.Key, presetDesc: preset?.Description });
  }, []);

  const exitForm = useCallback(() => {
    setMode({ type: 'list' });
    setError('');
    setNewKey('');
    setNewValue('');
    setNewDesc('');
    setShowValue(false);
  }, []);

  const handleSave = useCallback(async () => {
    const key = newKey.trim();
    const value = newValue;
    const desc = newDesc.trim();
    if (!key) { setError('Key 不能为空'); return; }
    if (!KEY_PATTERN.test(key)) {
      setError('Key 仅支持字母/数字/下划线，且不能以数字开头');
      return;
    }
    if (!value) { setError('Value 不能为空'); return; }

    setIsSaving(true);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await setAgentEnvVars(
        token,
        [{ Key: key, Value: value, Description: desc || undefined }],
        templateId,
      );
      await reload();
      exitForm();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsSaving(false);
    }
  }, [newKey, newValue, newDesc, templateId, reload, exitForm]);

  const handleDelete = useCallback(async (key: string) => {
    setPendingKey(key);
    setConfirmDelete(null);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) throw new Error('未获取到访问令牌');
      await deleteAgentEnvVars(token, [key], templateId);
      setVars((prev) => prev.filter((v) => v.Key !== key));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPendingKey(null);
    }
  }, [templateId]);

  const isForm = mode.type === 'form';

  return (
    <div className="absolute bottom-full left-0 mb-2 w-[380px] bg-white rounded-2xl border border-gray-200 shadow-xl z-50 flex flex-col overflow-hidden max-h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {isForm && (
            <button
              onClick={exitForm}
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
              <span className="text-sm font-medium text-black">
                {isForm ? (mode.presetKey ? '覆盖变量' : '新增变量') : '环境变量'}
              </span>
              {!isForm && vars.length > 0 && (
                <span className="px-1.5 py-px rounded-full bg-gray-100 text-[10px] text-black/60 font-medium leading-tight">
                  {vars.length}
                </span>
              )}
            </div>
            <span className="text-[11px] text-black/40 mt-0.5 truncate">
              {isForm ? '保存后下次对话生效 · 仅写入，不回显' : '注入到沙箱进程，下次对话生效'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {!isForm && (
            <button
              onClick={() => openForm()}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-primary/10 hover:text-primary transition text-black/60"
              title="新增变量"
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

      {/* Error banner */}
      {error && (
        <div className="mx-3.5 mb-2 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 text-[11px] text-red-600 flex items-start gap-1.5">
          <svg className="w-3.5 h-3.5 mt-px shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        {!isForm ? (
          isLoading ? (
            <div className="py-8 text-center text-xs text-black/40">加载中...</div>
          ) : vars.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-xs text-black/50">尚未配置环境变量</div>
              <button
                onClick={() => openForm()}
                className="mt-1 px-3 py-1 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition"
              >
                添加变量
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {vars.map((v) => {
                const isConfirming = confirmDelete === v.Key;
                const isPending = pendingKey === v.Key;
                return (
                  <li
                    key={v.Key}
                    className="group relative rounded-lg px-2.5 py-2 hover:bg-gray-50 transition flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-medium text-black truncate">{v.Key}</div>
                      {v.Description && (
                        <div className="text-[11px] text-black/45 truncate mt-0.5">{v.Description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isConfirming ? (
                        <>
                          <span className="text-[11px] text-red-600 mr-0.5">确认?</span>
                          <button
                            onClick={() => void handleDelete(v.Key)}
                            disabled={isPending}
                            className="px-2 py-0.5 rounded-md bg-red-500 text-white text-[11px] font-medium hover:bg-red-600 disabled:opacity-50 transition"
                          >
                            {isPending ? '删除中' : '删除'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-1.5 py-0.5 rounded-md text-[11px] text-black/50 hover:bg-gray-100 transition"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openForm(v)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-black/50 hover:text-primary hover:bg-primary/10 transition"
                            title="覆盖"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmDelete(v.Key)}
                            disabled={isPending}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-black/50 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                            title="删除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
            className="flex flex-col gap-2.5 mt-1"
          >
            <div>
              <label className="block text-[11px] font-medium text-black/55 mb-1">Key</label>
              <input
                ref={keyInputRef}
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="GITHUB_TOKEN"
                disabled={!!mode.presetKey}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition disabled:bg-gray-50 disabled:text-black/60"
                spellCheck={false}
                autoCapitalize="characters"
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-[11px] font-medium text-black/55 mb-1">
                <span>Value</span>
                <span className="text-[10px] text-black/35 font-normal">不会回显</span>
              </label>
              <div className="relative">
                <input
                  ref={valueInputRef}
                  type={showValue ? 'text' : 'password'}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={mode.presetKey ? '输入新值以覆盖' : '••••••'}
                  className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowValue((s) => !s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-black/40 hover:text-black/70 hover:bg-gray-100 transition"
                  title={showValue ? '隐藏' : '显示'}
                >
                  {showValue ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-black/55 mb-1">
                描述 <span className="text-black/35 font-normal">(可选)</span>
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="用于 GitHub MCP 调用"
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
              />
            </div>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <button
                type="button"
                onClick={exitForm}
                className="px-3 py-1.5 rounded-lg text-xs text-black/60 hover:bg-gray-100 transition"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait transition"
              >
                {isSaving ? '保存中...' : (mode.presetKey ? '覆盖' : '保存')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
