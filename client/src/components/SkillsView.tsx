import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [showPicker, setShowPicker] = useState(false);
  const plusBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      onClick={onShowDetail}
      className={`relative rounded-[20px] flex flex-row items-center gap-3 px-4 min-h-[80px] overflow-visible transition cursor-pointer
        ${userSkill
          ? 'bg-white shadow-[inset_0_0_0_1px_#2F3A8033] hover:shadow-[inset_0_0_0_1px_#2F3A8066]'
          : isMarket
            ? 'bg-white/80 shadow-[inset_0_0_0_1px_#E0E1F3] rounded-[24px] hover:shadow-[inset_0_0_0_1px_#B8BAD6]'
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
        </div>
        <span className="text-xs text-black/60 truncate">{skill.Description || (userSkill ? '用户自建技能' : '')}</span>
      </div>

      {!userSkill && (
        <button
          ref={plusBtnRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowPicker((v) => !v); }}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition ${
            showPicker
              ? 'bg-primary/10 text-primary'
              : 'bg-[#F5F6FA] text-black/55 hover:bg-primary/10 hover:text-primary'
          }`}
          title="在其他模板上启用此技能"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {showPicker && !userSkill && (
        <SkillTemplatePicker
          anchorRef={plusBtnRef}
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

  return (
    <div className="h-full w-full overflow-auto bg-[#FAFBFF]">
      <div className="flex flex-col gap-4 p-4 max-w-[1440px]">
        {/* Tip banner */}
        <div className="px-2 py-2 text-sm leading-[22px]">
          <span>💡 </span>
          <span className="text-black">这里展示当前可见的技能全集；如需为某位专家单独开关技能，请到「专家」页面操作。</span>
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
