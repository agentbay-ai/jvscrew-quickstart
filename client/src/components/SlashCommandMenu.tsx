import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { SkillItem } from '../types/api';
import { usePopoverPosition } from '../utils/usePopoverPosition';

interface Props {
  skills: SkillItem[];
  highlight: number;
  anchorRef: RefObject<HTMLElement | null>;
  query: string;
  onSelect: (skill: SkillItem) => void;
}

export default function SlashCommandMenu({ skills, highlight, anchorRef, query, onSelect }: Props) {
  const pos = usePopoverPosition(anchorRef);
  const listRef = useRef<HTMLDivElement>(null);

  // 让高亮项始终在视图内
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-slash-idx="${highlight}"]`);
    if (node) node.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  if (!pos) return null;

  return createPortal(
    <div
      data-popover-portal="slash-skills"
      style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, width: pos.width }}
      className="bg-white rounded-xl border border-gray-200 shadow-xl z-[60] py-1.5 max-h-72 overflow-hidden flex flex-col"
    >
      <div className="px-3 py-1.5 text-[11px] font-medium text-black/40 uppercase tracking-wider flex items-center justify-between shrink-0">
        <span>技能 · 输入 / 触发</span>
        {query && <span className="text-black/35 font-mono normal-case">/{query}</span>}
      </div>
      <div ref={listRef} className="overflow-auto">
        {skills.map((skill, idx) => (
          <button
            key={skill.SkillId}
            data-slash-idx={idx}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(skill)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition ${
              idx === highlight ? 'bg-primary/10' : 'hover:bg-gray-50'
            }`}
          >
            <span className="w-7 h-7 rounded-md bg-[#F5F6FA] flex items-center justify-center text-sm shrink-0">
              {skill.Icon && !skill.Icon.startsWith('http') ? skill.Icon : '⚡'}
            </span>
            <span className="text-xs text-black/80 truncate flex-1">{skill.SkillName}</span>
            {skill.Description && (
              <span className="text-[10px] text-black/40 truncate max-w-[40%]">{skill.Description}</span>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
