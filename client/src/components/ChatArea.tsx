import { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import { useFileUpload } from '../hooks/useFileUpload';
import { useAuthStore } from '../stores/authStore';
import { useChatStore, type PendingFile } from '../stores/chatStore';
import { listAllSkillPreferences, listSkills, listUserSkills } from '../services/api';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import QuickActions from './QuickActions';
import { SandboxMiniFloat } from './SandboxPanel';
import type { SkillItem, UserSkill } from '../types/api';

const USER_SKILL_PREFIX = 'user:';
const USER_SKILL_ICON = '🧩';

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

function downloadPendingFile(file: PendingFile) {
  const byteChars = atob(file.base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: file.mediaType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ChatArea() {
  const { messages, isStreaming, currentSessionId, sendMessage, stopChat } = useChat();
  const isLoadingHistory = useChatStore((s) => s.isLoadingHistory);
  const pendingFiles = useChatStore((s) => s.pendingFiles);
  const removePendingFile = useChatStore((s) => s.removePendingFile);
  const includeReasoning = useChatStore((s) => s.includeReasoning);
  const setIncludeReasoning = useChatStore((s) => s.setIncludeReasoning);
  const includeToolCalls = useChatStore((s) => s.includeToolCalls);
  const setIncludeToolCalls = useChatStore((s) => s.setIncludeToolCalls);
  const { uploadFile, isUploading, progress } = useFileUpload();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const config = useAuthStore((s) => s.config);

  useEffect(() => {
    if (!config?.templateId || !config?.externalUserId) {
      setSkills([]);
      return;
    }
    const templateId = config.templateId;
    const externalUserId = config.externalUserId;
    let cancelled = false;
    (async () => {
      try {
        const token = useAuthStore.getState().accessToken
          ?? (await useAuthStore.getState().refreshAccessToken());
        const [builtin, market, userListResult, prefs] = await Promise.all([
          listSkills('builtin', templateId),
          listSkills('market', templateId),
          listUserSkills(externalUserId, templateId).catch(() => ({ Success: false, Skills: [] as UserSkill[] })),
          token
            ? listAllSkillPreferences(token, templateId).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const userItems = userListResult.Skills.map(userSkillToItem);
        const templateSkills = [...builtin.Skills, ...market.Skills].map((s) => {
          const pref = prefs.find((p) => p.SkillId === s.SkillId);
          if (!pref) return s;
          return { ...s, Enabled: pref.UserPreference === 'Enabled' };
        });
        setSkills([...userItems, ...templateSkills]);
      } catch {
        if (!cancelled) setSkills([]);
      }
    })();
    return () => { cancelled = true; };
  }, [config?.templateId, config?.externalUserId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, pendingFiles]);

  // Reset stickiness whenever the user switches sessions.
  useEffect(() => {
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [currentSessionId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 40;
    stickToBottomRef.current = atBottom;
    setShowJumpToBottom(!atBottom);
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
  };

  const handleSend = async (text: string, files?: File[]) => {
    if (files && files.length > 0) {
      const results = [];
      for (const file of files) {
        const result = await uploadFile(file);
        if (result) {
          results.push({ name: file.name, sandboxPath: result.sandboxPath });
        }
      }

      if (results.length > 0) {
        sendMessage(text || '请结合已同步到沙箱的附件内容协助我。', results);
      } else if (text) {
        sendMessage(text);
      }
    } else {
      sendMessage(text);
    }
  };

  const isEmpty = messages.length === 0 && !isLoadingHistory;

  return (
    <>
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Upload progress bar */}
      {isUploading && (
        <div className="px-6 py-2 bg-primary-light text-xs text-primary flex items-center gap-2">
          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {progress}
        </div>
      )}

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-[28px] font-normal text-text">
              嗨~ 我能为你做什么？
            </h2>
          </div>

          <div className="w-full max-w-[628px] flex flex-col gap-5">
            <ChatInput
              onSend={handleSend}
              disabled={isStreaming || isUploading}
              isStreaming={isStreaming}
              onStop={stopChat}
              skills={skills}
              includeReasoning={includeReasoning}
              includeToolCalls={includeToolCalls}
              onToggleReasoning={() => setIncludeReasoning(!includeReasoning)}
              onToggleToolCalls={() => setIncludeToolCalls(!includeToolCalls)}
            />
            <QuickActions onSelect={(text) => sendMessage(text)} />
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-transparent px-6 py-4 space-y-4 relative">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center h-32 text-sm text-text-muted">
                加载历史消息中...
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {pendingFiles.map((file) => (
                  <div key={file.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-medium bg-primary/10 text-primary">
                      AI
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-gray-50 border border-gray-100 rounded-tl-md">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-black truncate">{file.filename}</div>
                          <div className="text-xs text-black/50 mt-0.5">智能体发送了文件，点击下载</div>
                        </div>
                        <button
                          onClick={() => {
                            downloadPendingFile(file);
                            removePendingFile(file.id);
                          }}
                          className="h-8 px-4 rounded-full bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shrink-0"
                        >
                          下载
                        </button>
                        <button
                          onClick={() => removePendingFile(file.id)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-black/30 hover:text-black/60 hover:bg-gray-100 transition shrink-0"
                          title="忽略"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="relative p-4 border-t border-gray-100">
            {showJumpToBottom && (
              <button
                onClick={jumpToBottom}
                className="absolute -top-5 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-text-muted hover:text-text transition"
                title="回到底部"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            <SandboxMiniFloat />
            <ChatInput
              onSend={handleSend}
              disabled={isStreaming || isUploading}
              isStreaming={isStreaming}
              onStop={stopChat}
              skills={skills}
              includeReasoning={includeReasoning}
              includeToolCalls={includeToolCalls}
              onToggleReasoning={() => setIncludeReasoning(!includeReasoning)}
              onToggleToolCalls={() => setIncludeToolCalls(!includeToolCalls)}
            />
          </div>
        </>
      )}
    </div>
    </>
  );
}
