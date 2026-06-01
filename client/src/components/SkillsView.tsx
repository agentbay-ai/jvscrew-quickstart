import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listSkills, listTemplates, listUserSkills } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { SkillItem, TemplateItem, UserSkill } from '../types/api';
import SkillTemplatePicker from './SkillTemplatePicker';

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

function SkillDetailModal({ skill, onClose }: { skill: SkillItem; onClose: () => void }) {
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

          <div className="mt-4 flex items-center gap-4 text-xs text-black/40">
            {userSkill ? (
              <div className="flex items-center gap-1.5">
                <span>来源</span>
                <span className="text-black/60">用户自建</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span>模板默认</span>
                {skill.Enabled ? (
                  <span className="text-[#48CD00] font-medium">启用</span>
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

          {!userSkill && (
            <div className="mt-3 text-[11px] text-black/40">
              在「专家」中可针对单个专家开关此技能。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  templates,
  onShowDetail,
  onPreferenceChanged,
}: {
  skill: SkillItem;
  templates: TemplateItem[];
  onShowDetail: () => void;
  onPreferenceChanged?: (skill: SkillItem, template: TemplateItem, enabled: boolean) => void;
}) {
  const userSkill = isUserSkill(skill.SkillId);
  const isMarket = !userSkill && (skill.SkillId.startsWith('market:') || skill.SkillId.startsWith('custom:'));
  const isBuiltin = skill.SkillId.startsWith('builtin:');
  const [showPicker, setShowPicker] = useState(false);
  const enableBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] flex flex-col gap-4 p-4 overflow-hidden min-h-[172px] transition hover:shadow-[inset_0_0_0_1px_#2F3A8040]">
      {/* Top: avatar + meta */}
      <div className="w-full flex items-start gap-3">
        {isEmojiIcon(skill.Icon) ? (
          <span className="w-[52px] h-[52px] rounded-xl bg-[#F5F6FA] flex items-center justify-center text-2xl shrink-0">
            {skill.Icon}
          </span>
        ) : (
          <img src={skill.Icon} alt={skill.SkillName} className="w-[52px] h-[52px] rounded-xl shrink-0 object-contain bg-[#F5F6FA] p-1" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-medium text-black truncate">{skill.SkillName}</span>
            {isBuiltin && (
              <span className="shrink-0 rounded-lg bg-black/[0.06] px-1.5 leading-5 text-xs text-black/70">
                内置
              </span>
            )}
            {isMarket && (
              <span className="shrink-0 rounded-lg bg-black/[0.06] px-1.5 leading-5 text-xs text-black/70">
                成长型
              </span>
            )}
            {userSkill && (
              <span className="shrink-0 rounded-lg bg-[#EEF1FF] px-1.5 leading-5 text-xs text-[#2F3A80]">
                个人
              </span>
            )}
          </div>
          <p className="text-xs text-black/55 mt-1.5 leading-relaxed line-clamp-2">
            {skill.Description || (userSkill ? '用户自建技能' : '暂无描述')}
          </p>
        </div>
      </div>

      {/* Bottom: actions */}
      <div className="w-full flex items-center gap-2 mt-auto">
        {!userSkill ? (
          <>
            <button
              ref={enableBtnRef}
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className={`flex-1 h-10 rounded-[20px] flex items-center justify-center gap-2 transition ${
                showPicker
                  ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(53,80,255,0.25)]'
                  : 'bg-[#EDEEF6] hover:bg-[#e2e3f0] text-black'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs font-medium">在模板上启用</span>
            </button>
            <button
              type="button"
              onClick={onShowDetail}
              className="w-10 h-10 rounded-full bg-[#EDEEF6] flex items-center justify-center text-2xl leading-none text-black hover:bg-[#e2e3f0] transition"
              aria-label="查看技能详情"
              title="查看技能详情"
            >
              ⋮
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onShowDetail}
            className="flex-1 h-10 rounded-[20px] bg-[#EDEEF6] flex items-center justify-center gap-2 hover:bg-[#e2e3f0] transition text-black"
          >
            <svg className="w-4 h-4 text-black/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <span className="text-xs font-medium">查看详情</span>
          </button>
        )}
      </div>

      {showPicker && !userSkill && (
        <SkillTemplatePicker
          anchorRef={enableBtnRef}
          templates={templates}
          skillId={skill.SkillId}
          onClose={() => setShowPicker(false)}
          onChanged={(template, enabled) => onPreferenceChanged?.(skill, template, enabled)}
        />
      )}
    </div>
  );
}

export default function SkillsView() {
  const templateId = useAuthStore((s) => s.config?.templateId);
  const externalUserId = useAuthStore((s) => s.config?.externalUserId);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailSkill, setDetailSkill] = useState<SkillItem | null>(null);
  const [toast, setToast] = useState<{ skillName: string; templateName: string; enabled: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listTemplates().then((data) => {
      if (cancelled) return;
      setTemplates(data.Items);
    }).catch(() => { /* 模板拉不到不阻塞主流程 */ });
    return () => { cancelled = true; };
  }, []);

  const handlePreferenceChanged = useCallback((skill: SkillItem, template: TemplateItem, enabled: boolean) => {
    setToast({
      skillName: skill.SkillName,
      templateName: template.TemplateKey || template.TemplateId,
      enabled,
    });
    setTimeout(() => setToast(null), 2200);
  }, []);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [builtin, market, userListResult] = await Promise.all([
        listSkills('builtin', templateId),
        listSkills('market', templateId),
        externalUserId
          ? listUserSkills(externalUserId, templateId).catch((err) => {
              console.warn('[SkillsView] failed to load user skills', err);
              return { Success: false, Skills: [] as UserSkill[] };
            })
          : Promise.resolve({ Success: true, Skills: [] as UserSkill[] }),
      ]);

      const userItems = userListResult.Skills.map(userSkillToItem);
      const merged = [...userItems, ...builtin.Skills, ...market.Skills];
      // Order: 个人 first, then template-default-enabled, then template-default-disabled.
      merged.sort((a, b) => {
        const aUser = isUserSkill(a.SkillId);
        const bUser = isUserSkill(b.SkillId);
        if (aUser !== bUser) return aUser ? -1 : 1;
        if (a.Enabled !== b.Enabled) return a.Enabled ? -1 : 1;
        return 0;
      });
      setSkills(merged);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [templateId, externalUserId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSkills();
    });
  }, [loadSkills]);

  const userSkillCount = useMemo(() => skills.filter((s) => isUserSkill(s.SkillId)).length, [skills]);
  const builtinCount = useMemo(() => skills.filter((s) => s.SkillId.startsWith('builtin:')).length, [skills]);
  const marketCount = useMemo(
    () => skills.filter((s) => !isUserSkill(s.SkillId) && (s.SkillId.startsWith('market:') || s.SkillId.startsWith('custom:'))).length,
    [skills],
  );

  return (
    <div className="h-full w-full overflow-auto bg-[#FAFBFF]">
      <div className="flex flex-col gap-5 p-6 max-w-[1440px]">
        {/* Page header */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-medium text-black">技能</h2>
            {!isLoading && skills.length > 0 && (
              <span className="text-xs text-black/40">
                共 {skills.length} 项
                {userSkillCount > 0 && <span className="ml-2">· 个人 {userSkillCount}</span>}
                {builtinCount > 0 && <span className="ml-2">· 内置 {builtinCount}</span>}
                {marketCount > 0 && <span className="ml-2">· 成长型 {marketCount}</span>}
              </span>
            )}
          </div>
          <button
            onClick={() => void loadSkills()}
            disabled={isLoading}
            className="text-[11px] text-[#2F3A80] hover:underline disabled:opacity-50"
          >
            {isLoading ? '加载中...' : '刷新'}
          </button>
        </div>

        {/* Tip banner */}
        <div className="rounded-xl bg-[#EEF1FF]/60 shadow-[inset_0_0_0_1px_#2F3A8014] px-4 py-2.5 text-xs text-black/70 leading-relaxed flex items-start gap-2">
          <svg className="w-4 h-4 text-[#2F3A80] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <span>这里展示当前可见的技能全集。点击「在模板上启用」可在多个模板间快速切换偏好；如需为单个专家开关技能，请到「专家」页面操作。</span>
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
          <div className="rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] py-16 flex flex-col items-center gap-2">
            <svg className="w-6 h-6 animate-spin text-[#2F3A80]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-black/45">加载技能列表中...</span>
          </div>
        )}

        {!isLoading && skills.length === 0 && !error && (
          <div className="rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] py-20 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-2xl">⚡</div>
            <div className="text-sm text-black/45">暂无技能</div>
          </div>
        )}

        {!isLoading && skills.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <SkillCard
                key={skill.SkillId}
                skill={skill}
                templates={templates}
                onShowDetail={() => setDetailSkill(skill)}
                onPreferenceChanged={handlePreferenceChanged}
              />
            ))}
          </div>
        )}
      </div>

      {detailSkill && (
        <SkillDetailModal skill={detailSkill} onClose={() => setDetailSkill(null)} />
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] text-white text-xs px-3.5 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
          toast.enabled ? 'bg-emerald-600' : 'bg-gray-700'
        }`}>
          {toast.enabled ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 12H6" />
            </svg>
          )}
          {toast.enabled
            ? `已在「${toast.templateName}」启用「${toast.skillName}」`
            : `已解除「${toast.templateName}」的「${toast.skillName}」偏好`}
        </div>
      )}
    </div>
  );
}
