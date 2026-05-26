import { useCallback, useEffect, useState } from 'react';
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

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = useCallback(async () => {
    const key = newKey.trim();
    const value = newValue;
    const desc = newDesc.trim();
    if (!key) {
      setError('Key 不能为空');
      return;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      setError('Key 仅支持字母/数字/下划线，且不能以数字开头');
      return;
    }
    if (!value) {
      setError('Value 不能为空');
      return;
    }
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
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      await reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsSaving(false);
    }
  }, [newKey, newValue, newDesc, templateId, reload]);

  const handleDelete = useCallback(async (key: string) => {
    if (!window.confirm(`删除环境变量 ${key}?`)) return;
    setPendingKey(key);
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

  return (
    <div className="absolute bottom-full left-0 mb-2 w-[360px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 flex flex-col max-h-[440px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-black/80">环境变量</span>
          <span className="text-[11px] text-black/40">下次对话生效 · Value 不会返回，仅可重新覆盖</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 transition text-black/40"
          title="关闭"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto px-3 py-2 min-h-[60px]">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-black/40">加载中...</div>
        ) : vars.length === 0 ? (
          <div className="py-6 text-center text-xs text-black/40">暂无环境变量</div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {vars.map((v) => (
              <li
                key={v.Key}
                className="rounded-lg bg-[#F5F6FA] px-2.5 py-1.5 flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-black truncate">{v.Key}</div>
                  {v.Description && (
                    <div className="text-[11px] text-black/50 truncate">{v.Description}</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pendingKey === v.Key}
                  onClick={() => void handleDelete(v.Key)}
                  className="shrink-0 text-[11px] text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-wait"
                >
                  {pendingKey === v.Key ? '删除中...' : '删除'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-gray-100 px-3 py-2 flex flex-col gap-1.5 bg-gray-50/50">
        <div className="text-[11px] font-medium text-black/60">新增 / 覆盖</div>
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="KEY (e.g. GITHUB_TOKEN)"
          className="w-full px-2 py-1 rounded-md border border-gray-200 text-xs font-mono focus:outline-none focus:border-primary"
          spellCheck={false}
          autoCapitalize="characters"
        />
        <input
          type="password"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="VALUE"
          className="w-full px-2 py-1 rounded-md border border-gray-200 text-xs font-mono focus:outline-none focus:border-primary"
          spellCheck={false}
        />
        <input
          type="text"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="描述（可选）"
          className="w-full px-2 py-1 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-primary"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="px-3 py-1 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait transition"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
