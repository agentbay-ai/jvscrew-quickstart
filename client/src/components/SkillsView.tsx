import { useCallback, useEffect, useState } from 'react';
import {
  listAllSkillPreferences,
  listSkills,
  listUserSkills,
  setSkillPreference,
} from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { SkillItem, SkillPreferenceValue, UserSkill } from '../types/api';

const USER_SKILL_PREFIX = 'user:';
const USER_SKILL_ICON = '🧩';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '加载技能列表失败';
}

function isEmojiIcon(icon: string): boolean {
  return !icon.startsWith('http');
}

function isUserSkill(skillId: string): boolean {
  return skillId.startsWith(USER_SKILL_PREFIX);
}

function userSkillToItem(skill: UserSkill): SkillItem {
  return {
    SkillId: `${USER_SKILL_PREFIX}${skill.id}`,
    SkillName: skill.name,
    Description: skill.description,
    Icon: USER_SKILL_ICON,
    Enabled: true,
    SkillStatus: 'AVAILABLE',
    GmtModified: '',
  };
}

function ToggleSwitch({
  enabled,
  pending,
  onToggle,
  size = 'md',
}: {
  enabled: boolean;
  pending: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 'w-9' : 'w-11';
  const h = size === 'sm' ? 'h-5' : 'h-6';
  const knob = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        if (!pending) onToggle();
      }}
      className={`relative inline-flex ${w} ${h} shrink-0 rounded-full transition
        ${enabled ? 'bg-[#2F3A80]' : 'bg-black/15'}
        ${pending ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:opacity-90'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 ${knob} bg-white rounded-full shadow transition-transform
          ${enabled ? translate : 'translate-x-0'}`}
      />
    </button>
  );
}

function SkillDetailModal({
  skill,
  effectiveEnabled,
  hasOverride,
  pending,
  onToggle,
  onRestoreDefault,
  onClose,
}: {
  skill: SkillItem;
  effectiveEnabled: boolean;
  hasOverride: boolean;
  pending: boolean;
  onToggle: () => void;
  onRestoreDefault: () => void;
  onClose: () => void;
}) {
  const userSkill = isUserSkill(skill.SkillId);
  const isMarket = !userSkill && (skill.SkillId.startsWith('market:') || skill.SkillId.startsWith('custom:'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-[480px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            {isEmojiIcon(skill.Icon) ? (
              <span className="w-12 h-12 rounded-xl bg-[#F5F6FA] flex items-center justify-center text-2xl shrink-0">
                {skill.Icon}
              </span>
            ) : (
              <img src={skill.Icon} alt={skill.SkillName} className="w-12 h-12 shrink-0" />
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-black">{skill.SkillName}</span>
                {skill.SkillId.startsWith('builtin:') && (
                  <span className="rounded-lg bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-2 text-xs leading-[22px] text-black/60">内置</span>
                )}
                {isMarket && (
                  <span className="rounded-lg bg-white shadow-[inset_0_0_0_1px_#00000014] px-2 text-xs leading-[22px] text-black/60">成长型</span>
                )}
                {userSkill && (
                  <span className="rounded-lg bg-[#EEF1FF] shadow-[inset_0_0_0_1px_#2F3A8033] px-2 text-xs leading-[22px] text-[#2F3A80]">个人</span>
                )}
              </div>
              <span className="text-xs text-black/40 font-mono">{skill.SkillId}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition shrink-0 self-start">
            <svg className="w-4 h-4 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="rounded-xl bg-[#F5F6FA] p-4">
            <p className="text-sm text-black/70 leading-relaxed whitespace-pre-wrap">{skill.Description || '暂无描述'}</p>
          </div>

          {!userSkill && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-black">在本次会话中启用</span>
                <span className="text-xs text-black/40">
                  {hasOverride ? '已使用你的自定义设置' : '当前跟随模板默认'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {hasOverride && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onRestoreDefault}
                    className="text-xs text-[#2F3A80] hover:underline disabled:opacity-50 disabled:cursor-wait"
                  >
                    恢复默认
                  </button>
                )}
                <ToggleSwitch enabled={effectiveEnabled} pending={pending} onToggle={onToggle} />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-black/40">
            {userSkill ? (
              <div className="flex items-center gap-1.5">
                <span>来源</span>
                <span className="text-black/60">用户自建</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span>状态</span>
                {effectiveEnabled ? (
                  <span className="text-[#48CD00] font-medium">已启用</span>
                ) : (
                  <span className="text-black/30">未启用</span>
                )}
              </div>
            )}
            {skill.GmtModified && (
              <div className="flex items-center gap-1.5">
                <span>更新时间</span>
                <span className="text-black/60">{skill.GmtModified}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  effectiveEnabled,
  hasOverride,
  pending,
  onToggle,
  onShowDetail,
}: {
  skill: SkillItem;
  effectiveEnabled: boolean;
  hasOverride: boolean;
  pending: boolean;
  onToggle: () => void;
  onShowDetail: () => void;
}) {
  const userSkill = isUserSkill(skill.SkillId);
  const disabled = !userSkill && !effectiveEnabled;
  const isMarket = !userSkill && (skill.SkillId.startsWith('market:') || skill.SkillId.startsWith('custom:'));

  return (
    <div
      onClick={onShowDetail}
      className={`rounded-[20px] flex flex-row items-center gap-3 px-4 min-h-[80px] overflow-hidden transition cursor-pointer
        ${disabled
          ? 'bg-white/60 shadow-[inset_0_0_0_1px_#2F3A801A] opacity-60'
          : userSkill
            ? 'bg-white shadow-[inset_0_0_0_1px_#2F3A8033] hover:shadow-[inset_0_0_0_1px_#2F3A8066]'
            : isMarket
              ? 'bg-white/60 shadow-[inset_0_0_0_1px_#E0E1F3] rounded-[24px] hover:shadow-[inset_0_0_0_1px_#B8BAD6]'
              : 'bg-white shadow-[inset_0_0_0_1px_#2F3A801A] hover:shadow-[inset_0_0_0_1px_#2F3A8040]'
        }`}
    >
      {isEmojiIcon(skill.Icon) ? (
        <span className="w-12 h-12 rounded-xl bg-[#F5F6FA] flex items-center justify-center text-2xl shrink-0">
          {skill.Icon}
        </span>
      ) : (
        <img src={skill.Icon} alt={skill.SkillName} className="w-12 h-12 shrink-0" />
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-black truncate">{skill.SkillName}</span>
          {skill.SkillId.startsWith('builtin:') && (
            <span className="shrink-0 rounded-lg bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-2 text-xs leading-[22px] text-black/60">
              内置
            </span>
          )}
          {isMarket && (
            <span className="shrink-0 rounded-lg bg-white shadow-[inset_0_0_0_1px_#00000014] px-2 text-xs leading-[22px] text-black/60">
              成长型
            </span>
          )}
          {userSkill && (
            <span className="shrink-0 rounded-lg bg-[#EEF1FF] shadow-[inset_0_0_0_1px_#2F3A8033] px-2 text-xs leading-[22px] text-[#2F3A80]">
              个人
            </span>
          )}
          {hasOverride && !userSkill && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#2F3A80]"
              title="你已自定义该技能开关，点击详情可恢复默认"
            />
          )}
        </div>
        <span className="text-xs text-black/60 truncate">{skill.Description || (userSkill ? '用户自建技能' : '')}</span>
      </div>

      {!userSkill && (
        <ToggleSwitch
          enabled={effectiveEnabled}
          pending={pending}
          onToggle={onToggle}
          size="sm"
        />
      )}
    </div>
  );
}

export default function SkillsView() {
  const templateId = useAuthStore((s) => s.config?.templateId);
  const externalUserId = useAuthStore((s) => s.config?.externalUserId);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [prefsMap, setPrefsMap] = useState<Map<string, SkillPreferenceValue>>(new Map());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailSkill, setDetailSkill] = useState<SkillItem | null>(null);

  const effectiveEnabled = useCallback(
    (skill: SkillItem) => {
      const pref = prefsMap.get(skill.SkillId);
      if (pref) return pref === 'Enabled';
      return skill.Enabled;
    },
    [prefsMap],
  );

  // Render order is frozen at load time so toggling preferences doesn't reshuffle the grid.
  // Reloading the view (templateId/user change, manual reload) recomputes the order.
  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = useAuthStore.getState().accessToken
        ?? (await useAuthStore.getState().refreshAccessToken());

      const [builtin, market, userListResult, prefsResult] = await Promise.all([
        listSkills('builtin', templateId),
        listSkills('market', templateId),
        externalUserId
          ? listUserSkills(externalUserId, templateId).catch((err) => {
              console.warn('[SkillsView] failed to load user skills', err);
              return { Success: false, Skills: [] as UserSkill[] };
            })
          : Promise.resolve({ Success: true, Skills: [] as UserSkill[] }),
        token
          ? listAllSkillPreferences(token, templateId).catch((err) => {
              console.warn('[SkillsView] failed to load skill preferences', err);
              return [];
            })
          : Promise.resolve([]),
      ]);

      const userItems = userListResult.Skills.map(userSkillToItem);
      const nextPrefs = new Map<string, SkillPreferenceValue>();
      for (const p of prefsResult) nextPrefs.set(p.SkillId, p.UserPreference);

      const merged = [...userItems, ...builtin.Skills, ...market.Skills];
      const initialEnabled = (s: SkillItem) => {
        const pref = nextPrefs.get(s.SkillId);
        if (pref) return pref === 'Enabled';
        return s.Enabled;
      };
      merged.sort((a, b) => {
        const aEn = initialEnabled(a);
        const bEn = initialEnabled(b);
        if (aEn !== bEn) return aEn ? -1 : 1;
        const aUser = isUserSkill(a.SkillId);
        const bUser = isUserSkill(b.SkillId);
        if (aUser !== bUser) return aUser ? -1 : 1;
        return 0;
      });

      setPrefsMap(nextPrefs);
      setSkills(merged);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [templateId, externalUserId]);

  const handleTogglePreference = useCallback(
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
        const token = useAuthStore.getState().accessToken
          ?? (await useAuthStore.getState().refreshAccessToken());
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

  const handleRestoreDefault = useCallback(
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
        const token = useAuthStore.getState().accessToken
          ?? (await useAuthStore.getState().refreshAccessToken());
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

  useEffect(() => {
    queueMicrotask(() => {
      void loadSkills();
    });
  }, [loadSkills]);

  return (
    <div className="h-full w-full overflow-auto bg-[#FAFBFF]">
      <div className="flex flex-col gap-4 p-4 max-w-[1440px]">
        {/* Tip banner */}
        <div className="px-2 py-2 text-sm leading-[22px]">
          <span>💡 </span>
          <span className="font-medium">成长型技能，</span>
          <span className="text-black">可查找或创建专业技能，在对话中输入：</span>
          <span className="font-medium">"如果你不会，请自行查找并创建skill"</span>
          <span className="text-black"> 即可主动调用。</span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
            {error}
            <button onClick={() => void loadSkills()} className="text-red-500 hover:text-red-700 underline text-xs ml-4">
              重试
            </button>
          </div>
        )}

        {isLoading && (
          <div className="rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-5 py-12 text-center text-sm text-black/40">
            加载技能列表中...
          </div>
        )}

        {!isLoading && skills.length === 0 && !error && (
          <div className="rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-5 py-16 text-center">
            <div className="text-sm text-black/40">暂无技能</div>
          </div>
        )}

        {!isLoading && skills.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <SkillCard
                key={skill.SkillId}
                skill={skill}
                effectiveEnabled={effectiveEnabled(skill)}
                hasOverride={prefsMap.has(skill.SkillId)}
                pending={pendingIds.has(skill.SkillId)}
                onToggle={() => void handleTogglePreference(skill)}
                onShowDetail={() => setDetailSkill(skill)}
              />
            ))}
          </div>
        )}
      </div>

      {detailSkill && (
        <SkillDetailModal
          skill={detailSkill}
          effectiveEnabled={effectiveEnabled(detailSkill)}
          hasOverride={prefsMap.has(detailSkill.SkillId)}
          pending={pendingIds.has(detailSkill.SkillId)}
          onToggle={() => void handleTogglePreference(detailSkill)}
          onRestoreDefault={() => void handleRestoreDefault(detailSkill)}
          onClose={() => setDetailSkill(null)}
        />
      )}
    </div>
  );
}
