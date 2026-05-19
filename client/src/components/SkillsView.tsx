import { useCallback, useEffect, useMemo, useState } from 'react';
import { listSkills } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { SkillItem } from '../types/api';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '加载技能列表失败';
}

function isEmojiIcon(icon: string): boolean {
  return !icon.startsWith('http');
}

function SkillDetailModal({ skill, onClose }: { skill: SkillItem; onClose: () => void }) {
  const isMarket = skill.SkillId.startsWith('market:') || skill.SkillId.startsWith('custom:');

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
            <div className="flex items-center gap-1.5">
              <span>状态</span>
              {skill.Enabled ? (
                <span className="text-[#48CD00] font-medium">已启用</span>
              ) : (
                <span className="text-black/30">未启用</span>
              )}
            </div>
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

function SkillCard({ skill, onShowDetail }: { skill: SkillItem; onShowDetail: () => void }) {
  const disabled = !skill.Enabled;
  const isMarket = skill.SkillId.startsWith('market:') || skill.SkillId.startsWith('custom:');

  return (
    <div
      onClick={onShowDetail}
      className={`rounded-[20px] flex flex-row items-center gap-3 px-4 min-h-[80px] overflow-hidden transition cursor-pointer
        ${disabled
          ? 'bg-white/60 shadow-[inset_0_0_0_1px_#2F3A801A] opacity-60'
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
        </div>
        <span className="text-xs text-black/60 truncate">{skill.Description}</span>
      </div>

      {disabled && (
        <span className="shrink-0 text-xs text-black/30">未启用</span>
      )}
    </div>
  );
}

export default function SkillsView() {
  const templateId = useAuthStore((s) => s.config?.templateId);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailSkill, setDetailSkill] = useState<SkillItem | null>(null);

  const sortedSkills = useMemo(() => {
    return [...skills].sort((a, b) => {
      if (a.Enabled !== b.Enabled) return a.Enabled ? -1 : 1;
      return 0;
    });
  }, [skills]);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [builtin, market] = await Promise.all([
        listSkills('builtin', templateId),
        listSkills('market', templateId),
      ]);
      setSkills([...builtin.Skills, ...market.Skills]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

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

        {!isLoading && sortedSkills.length === 0 && !error && (
          <div className="rounded-[20px] bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-5 py-16 text-center">
            <div className="text-sm text-black/40">暂无技能</div>
          </div>
        )}

        {!isLoading && sortedSkills.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedSkills.map((skill) => (
              <SkillCard key={skill.SkillId} skill={skill} onShowDetail={() => setDetailSkill(skill)} />
            ))}
          </div>
        )}
      </div>

      {detailSkill && (
        <SkillDetailModal skill={detailSkill} onClose={() => setDetailSkill(null)} />
      )}
    </div>
  );
}
