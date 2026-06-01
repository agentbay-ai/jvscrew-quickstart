import { type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { MessageLatency } from '../types/api';
import { usePopoverPosition } from '../utils/usePopoverPosition';

interface Props {
  latency: MessageLatency;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

function fmtSeconds(end?: number, start?: number): string {
  if (start == null || end == null) return '—';
  const sec = Math.max(0, end - start) / 1000;
  return `${sec.toFixed(2)} s`;
}

const ROWS: Array<{ key: keyof MessageLatency; label: string; tip: string; abbr: string }> = [
  { key: 'firstAnyAt',       label: '首字符延迟', tip: '用户发送 → 收到第一个有效内容（reasoning / tool_use / message 任一）', abbr: 'TTFT' },
  { key: 'firstAnswerAt',    label: '首正文延迟', tip: '用户发送 → 收到第一个最终回答正文字节（剔除 reasoning / tool）', abbr: 'TTFAT' },
  { key: 'endAt',            label: '整体响应',   tip: '用户发送 → 最后一个可见字节（不依赖后端 completed 事件）', abbr: 'TTLB' },
];

export default function LatencyPopover({ latency, anchorRef, onClose }: Props) {
  const pos = usePopoverPosition(anchorRef);
  if (!pos) return null;

  return createPortal(
    <div
      data-popover-portal="latency"
      style={{ position: 'fixed', left: pos.left, bottom: pos.bottom }}
      className="w-[260px] bg-white rounded-xl border border-gray-200 shadow-xl z-[60] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[11px] font-medium text-black/70">耗时统计</span>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-black/40 hover:bg-gray-100 transition"
          title="关闭"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ul className="px-2.5 pb-2.5 flex flex-col gap-px">
        {ROWS.map(({ key, label, tip, abbr }) => (
          <li
            key={key}
            title={tip}
            className="flex items-center justify-between px-1.5 py-1.5 rounded hover:bg-gray-50"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-mono text-primary/70 shrink-0">{abbr}</span>
              <span className="text-[11px] text-black/70 truncate">{label}</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-black">
              {fmtSeconds(latency[key] as number | undefined, latency.startAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
