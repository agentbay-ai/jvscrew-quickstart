import { useCallback, useEffect, useState } from 'react';
import { listAllSkillPreferences, setSkillPreference } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { SkillItem, SkillPreferenceValue } from '../types/api';

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '操作失败';
}

async function ensureToken(): Promise<string | null> {
  const state = useAuthStore.getState();
  return state.accessToken ?? (await state.refreshAccessToken());
}

export interface SkillPreferencesApi {
  prefsMap: Map<string, SkillPreferenceValue>;
  pendingIds: Set<string>;
  isLoading: boolean;
  error: string;
  reload: () => Promise<void>;
  effectiveEnabled: (skill: SkillItem) => boolean;
  hasOverride: (skillId: string) => boolean;
  togglePreference: (skill: SkillItem) => Promise<void>;
  restoreDefault: (skill: SkillItem) => Promise<void>;
  clearError: () => void;
}

/** Manages per-user, per-template skill preferences with optimistic updates. */
export function useSkillPreferences(templateId: string | undefined): SkillPreferencesApi {
  const [prefsMap, setPrefsMap] = useState<Map<string, SkillPreferenceValue>>(new Map());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) {
        setPrefsMap(new Map());
        return;
      }
      const list = await listAllSkillPreferences(token, templateId);
      const next = new Map<string, SkillPreferenceValue>();
      for (const p of list) next.set(p.SkillId, p.UserPreference);
      setPrefsMap(next);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const effectiveEnabled = useCallback(
    (skill: SkillItem) => {
      const pref = prefsMap.get(skill.SkillId);
      if (pref) return pref === 'Enabled';
      return skill.Enabled;
    },
    [prefsMap],
  );

  const hasOverride = useCallback(
    (skillId: string) => prefsMap.has(skillId),
    [prefsMap],
  );

  const togglePreference = useCallback(
    async (skill: SkillItem) => {
      const skillId = skill.SkillId;
      const previous = prefsMap.get(skillId);
      const currentEnabled = previous ? previous === 'Enabled' : skill.Enabled;
      const next: SkillPreferenceValue = currentEnabled ? 'Disabled' : 'Enabled';

      setPrefsMap((prev) => {
        const m = new Map(prev);
        m.set(skillId, next);
        return m;
      });
      setPendingIds((prev) => {
        const s = new Set(prev);
        s.add(skillId);
        return s;
      });

      try {
        const token = await ensureToken();
        if (!token) throw new Error('未获取到访问令牌');
        await setSkillPreference(token, skillId, next, templateId);
      } catch (err) {
        setPrefsMap((prev) => {
          const m = new Map(prev);
          if (previous === undefined) m.delete(skillId);
          else m.set(skillId, previous);
          return m;
        });
        setError(errorText(err));
      } finally {
        setPendingIds((prev) => {
          const s = new Set(prev);
          s.delete(skillId);
          return s;
        });
      }
    },
    [prefsMap, templateId],
  );

  const restoreDefault = useCallback(
    async (skill: SkillItem) => {
      const skillId = skill.SkillId;
      const previous = prefsMap.get(skillId);
      if (previous === undefined) return;

      setPrefsMap((prev) => {
        const m = new Map(prev);
        m.delete(skillId);
        return m;
      });
      setPendingIds((prev) => {
        const s = new Set(prev);
        s.add(skillId);
        return s;
      });

      try {
        const token = await ensureToken();
        if (!token) throw new Error('未获取到访问令牌');
        await setSkillPreference(token, skillId, 'Default', templateId);
      } catch (err) {
        setPrefsMap((prev) => {
          const m = new Map(prev);
          m.set(skillId, previous);
          return m;
        });
        setError(errorText(err));
      } finally {
        setPendingIds((prev) => {
          const s = new Set(prev);
          s.delete(skillId);
          return s;
        });
      }
    },
    [prefsMap, templateId],
  );

  return {
    prefsMap,
    pendingIds,
    isLoading,
    error,
    reload,
    effectiveEnabled,
    hasOverride,
    togglePreference,
    restoreDefault,
    clearError: () => setError(''),
  };
}
