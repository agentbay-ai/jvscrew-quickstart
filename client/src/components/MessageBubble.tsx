import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DisplayMessage, ToolCallInfo } from '../types/api';

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
  const isReasoningPhase = message.isStreaming && message.reasoning && !message.content;
  const [showReasoning, setShowReasoning] = useState(isReasoningPhase ?? false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const parsed = parseSandboxPathSection(message.content);
  const content = parsed.content;
  const files = mergeFiles(message.files, parsed.files);

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

  useEffect(() => {
    if (isReasoningPhase) {
      setShowReasoning(true);
    } else if (!message.isStreaming && message.reasoning) {
      setShowReasoning(false);
    }
  }, [isReasoningPhase, message.isStreaming, message.reasoning]);

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
        {/* Reasoning toggle */}
        {message.reasoning && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="text-xs text-text-hint hover:text-text-muted flex items-center gap-1 transition"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showReasoning ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Thinking...
          </button>
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

        {/* Main content */}
        {(content || message.isStreaming) && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              ${isUser
                ? 'bg-primary text-white rounded-tr-md'
                : 'bg-gray-50 text-text border border-gray-100 rounded-tl-md'
              }`}
          >
            {content ? (
              isUser ? (
                <div className="whitespace-pre-wrap">{content}</div>
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              )
            ) : (
              <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse rounded-sm" />
            )}
          </div>
        )}

        {/* Copy button for AI messages */}
        {!isUser && content && !message.isStreaming && (
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

function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const isCalling = toolCall.status === 'calling';

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
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
          {isCalling ? '调用中: ' : '已调用: '}{toolCall.name}
        </span>
        {(toolCall.input || toolCall.output) && (
          <svg
            className={`w-3 h-3 text-blue-400 ml-auto shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
      {expanded && (toolCall.input || toolCall.output) && (
        <div className="mt-2 space-y-1.5">
          {toolCall.input && (
            <div>
              <span className="text-blue-500 font-medium">输入:</span>
              <pre className="mt-0.5 whitespace-pre-wrap text-black/60 bg-white rounded px-2 py-1 border border-blue-100 max-h-32 overflow-auto">
                {formatToolData(toolCall.input)}
              </pre>
            </div>
          )}
          {toolCall.output && (
            <div>
              <span className="text-green-600 font-medium">输出:</span>
              <pre className="mt-0.5 whitespace-pre-wrap text-black/60 bg-white rounded px-2 py-1 border border-blue-100 max-h-32 overflow-auto">
                {formatToolData(toolCall.output)}
              </pre>
            </div>
          )}
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
