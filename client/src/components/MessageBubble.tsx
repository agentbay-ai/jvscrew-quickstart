import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DisplayMessage, ToolCallInfo } from '../types/api';
import LatencyPopover from './LatencyPopover';

interface MessageBubbleProps {
  message: DisplayMessage;
}

function fileNameFromPath(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

function parseSandboxPathSection(content: string): {
  content: string;
  files: Array<{ name: string; url: string }>;
} {
  const marker = '[附件沙箱路径]';
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) return { content, files: [] };

  const visibleContent = content.slice(0, markerIndex).trimEnd();
  const paths = content
    .slice(markerIndex + marker.length)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^-\s*/, '').trim())
    .filter(Boolean);

  return {
    content: visibleContent,
    files: paths.map((path) => ({
      name: fileNameFromPath(path),
      url: path,
    })),
  };
}

function mergeFiles(
  existing: DisplayMessage['files'],
  parsed: Array<{ name: string; url: string }>,
): Array<{ name: string; url: string }> {
  const seen = new Set<string>();
  return [...(existing ?? []), ...parsed].filter((file) => {
    const key = file.url || file.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  // 思考区域：始终默认折叠，由用户主动展开查看
  const [showReasoning, setShowReasoning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLatency, setShowLatency] = useState(false);
  const latencyBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showLatency) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-popover-portal="latency"]')) return;
      if (latencyBtnRef.current?.contains(t)) return;
      setShowLatency(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showLatency]);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const parsed = parseSandboxPathSection(message.content);
  const content = parsed.content;
  const files = mergeFiles(message.files, parsed.files);

  // 是否处于"正在思考"阶段：还在 streaming 且尚未开始输出最终正文。
  // 工具调用、reasoning 事件、中间 message 段都算"思考中"——它们的文本会被
  // useChat 沉淀进 message.reasoning，content 维持为空直到最后一段 message。
  const isThinking = !!message.isStreaming && !content;

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-700">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {message.content}
        </span>
      </div>
    );
  }

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-medium
          ${isUser ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Reasoning badge：默认折叠，思考中有动态指示，结束后可展开看详细过程 */}
        {(isThinking || message.reasoning) && (
          <ReasoningBadge
            isThinking={isThinking}
            reasoning={message.reasoning}
            expanded={showReasoning}
            onToggle={() => setShowReasoning((v) => !v)}
          />
        )}

        {/* Reasoning content */}
        {showReasoning && message.reasoning && (
          <div className="text-xs text-text-hint bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 max-w-full">
            <pre className="whitespace-pre-wrap font-sans">{message.reasoning}</pre>
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1 w-full">
            {message.toolCalls.map((tc, i) => (
              <ToolCallCard key={i} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Main content - 只在有正文时渲染气泡；思考/工具阶段由 Thinking 徽章 + 工具卡片承担指示 */}
        {content && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              ${isUser
                ? 'bg-primary text-white rounded-tr-md'
                : 'bg-gray-50 text-text border border-gray-100 rounded-tl-md'
              }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap">{content}</div>
            ) : (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Copy + latency buttons for AI messages */}
        {!isUser && content && !message.isStreaming && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-hint hover:text-text-muted hover:bg-gray-100 transition"
              title="复制原始文本"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>已复制</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                  </svg>
                  <span>复制</span>
                </>
              )}
            </button>
            {message.latency?.endAt != null && (
              <button
                ref={latencyBtnRef}
                onClick={() => setShowLatency((v) => !v)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition ${
                  showLatency ? 'text-primary bg-primary/10' : 'text-text-hint hover:text-text-muted hover:bg-gray-100'
                }`}
                title="耗时统计"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>耗时</span>
                <span className="font-mono tabular-nums text-[10px] opacity-70">
                  {((message.latency.endAt - message.latency.startAt) / 1000).toFixed(2)}s
                </span>
              </button>
            )}
            {showLatency && message.latency && (
              <LatencyPopover
                latency={message.latency}
                anchorRef={latencyBtnRef}
                onClose={() => setShowLatency(false)}
              />
            )}
          </div>
        )}

        {/* Files */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-light text-xs text-primary"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {f.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReasoningBadge({
  isThinking,
  reasoning,
  expanded,
  onToggle,
}: {
  isThinking: boolean;
  reasoning?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const canExpand = !!reasoning;
  return (
    <button
      onClick={() => canExpand && onToggle()}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition
        ${isThinking
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-gray-50 border-gray-200 text-text-muted hover:bg-gray-100'}
        ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {isThinking ? (
        <span className="relative flex w-2 h-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-amber-400 opacity-60 animate-ping" />
          <span className="relative rounded-full w-2 h-2 bg-amber-500" />
        </span>
      ) : (
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M12 18v-5.25m0 0a6 6 0 0 0 1.5-.19m-1.5.19a6 6 0 0 1-1.5-.19m3.75 7.5a12 12 0 0 1-4.5 0M14.25 18v-.19c0-.98.66-1.82 1.51-2.32a7.5 7.5 0 1 0-7.52 0c.85.5 1.51 1.34 1.51 2.32V18" />
        </svg>
      )}
      <span>{isThinking ? '思考中' : '已思考'}</span>
      {isThinking && <ThinkingDots />}
      {canExpand && (
        <svg
          className={`w-3 h-3 ml-0.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5">
      <span className="w-1 h-1 rounded-full bg-amber-500 animate-thinking-dot" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 rounded-full bg-amber-500 animate-thinking-dot" style={{ animationDelay: '160ms' }} />
      <span className="w-1 h-1 rounded-full bg-amber-500 animate-thinking-dot" style={{ animationDelay: '320ms' }} />
    </span>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const isCalling = toolCall.status === 'calling';
  // name 兜底：在拿到真实工具名前后端会用 plugin_call/tool_call 这种通用占位
  const placeholderName = toolCall.name === 'plugin_call' || toolCall.name === 'tool_call';
  const displayName = placeholderName ? '工具' : toolCall.name;

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left cursor-pointer"
      >
        {isCalling ? (
          <svg className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span className="font-medium text-blue-700 truncate">
          调用 <span className="font-mono">{displayName}</span>{isCalling ? ' 中...' : ''}
        </span>
        <svg
          className={`w-3 h-3 text-blue-400 ml-auto shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-2 bg-white rounded-md border border-blue-100 overflow-hidden">
          <ToolDataSection label="输入" tone="blue" value={toolCall.input} />
          <div className="border-t border-dashed border-blue-100" />
          <ToolDataSection label="输出" tone="green" value={toolCall.output} loading={isCalling} />
        </div>
      )}
    </div>
  );
}

function ToolDataSection({
  label, tone, value, loading,
}: { label: string; tone: 'blue' | 'green'; value?: string; loading?: boolean }) {
  const labelColor = tone === 'blue' ? 'text-blue-500' : 'text-green-600';
  return (
    <div className="px-2.5 py-1.5">
      <div className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${labelColor}`}>{label}</div>
      {value ? (
        <pre className="whitespace-pre-wrap text-[11px] text-black/70 max-h-40 overflow-auto m-0 font-mono">
          {formatToolData(value)}
        </pre>
      ) : (
        <div className="text-[11px] text-black/30 italic">
          {loading ? '等待返回...' : '（空）'}
        </div>
      )}
    </div>
  );
}

function formatToolData(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
