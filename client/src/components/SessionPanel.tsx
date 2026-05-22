import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import { useSession } from '../hooks/useSession';
import TemplateSelector from './TemplateSelector';
import { scheduleSessionListAutoRefresh } from '../utils/sessionRefresh';

interface SessionPanelProps {
  onNewChat: () => void;
  onOpenTasks?: () => void;
  onOpenFiles?: () => void;
}

function isScheduledTaskSession(sessionId: string): boolean {
  return sessionId.startsWith('schedule:');
}

export default function SessionPanel({ onNewChat, onOpenTasks, onOpenFiles }: SessionPanelProps) {
  const { config, selectedExpert } = useAuthStore();
  const { sessions, isLoading } = useSessionStore();
  const sortedSessions = useMemo(() => {
    const ts = (s: typeof sessions[number]) =>
      new Date(s.UpdatedAt || s.CreatedAt || 0).getTime();
    return [...sessions].sort((a, b) => ts(b) - ts(a));
  }, [sessions]);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const { refreshSessions, loadHistory, removeChat } = useSession();
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  useEffect(() => {
    if (config) void refreshSessions();
  }, [config, refreshSessions]);

  useEffect(() => {
    if (!config) return undefined;
    return scheduleSessionListAutoRefresh(refreshSessions);
  }, [config, refreshSessions]);

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu(contextMenu === sessionId ? null : sessionId);
  };

  const handleDelete = async (sessionId: string) => {
    setContextMenu(null);
    await removeChat(sessionId);
  };

  return (
    <div className="w-[210px] h-full p-4 pl-4 pr-0 shrink-0">
      <div className="h-full rounded-2xl bg-white border border-border shadow-sm flex flex-col gap-5 p-3">
        {/* Agent card */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={selectedExpert?.avatar || 'https://img.alicdn.com/imgextra/i2/6000000006913/O1CN017tneP620wD8kVZFDn_!!6000000006913-2-gg_dtc.png'}
              alt="avatar"
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-[#48CD00] ring-2 ring-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] leading-4 font-semibold text-text break-words [overflow-wrap:anywhere]">
              {config?.templateName || 'JVS Crew Agent'}
            </div>
          </div>
          <TemplateSelector variant="icon" dropdownAlign="left" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onNewChat}
            className="flex-1 h-9 rounded-full bg-primary-light flex items-center justify-center gap-1 text-xs font-medium text-text hover:bg-primary/15 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新对话
          </button>
        </div>

        <div className="space-y-1">
          <button
            onClick={onOpenTasks}
            className="w-full h-9 rounded-xl flex items-center justify-between px-2 text-xs font-medium text-text-secondary hover:bg-gray-50 hover:text-text transition"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              定时任务
            </span>
            <svg className="w-3.5 h-3.5 text-text-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 5 7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={onOpenFiles}
            className="w-full h-9 rounded-xl flex items-center justify-between px-2 text-xs font-medium text-text-secondary hover:bg-gray-50 hover:text-text transition"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>
              文件空间
            </span>
            <svg className="w-3.5 h-3.5 text-text-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Sessions */}
        <div className="flex-1 flex flex-col gap-1 min-h-0 overflow-hidden">
          <div className="px-2 text-xs font-medium text-text-hint">最近对话</div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {isLoading && (
              <div className="text-xs text-text-hint text-center py-4">Loading...</div>
            )}
            {!isLoading && sortedSessions.length === 0 && (
              <div className="text-xs text-text-hint text-center py-4">暂无对话</div>
            )}
            {sortedSessions.map((session) => (
              <div key={session.SessionId} className="relative group">
                <div
                  className={`w-full text-left px-2 py-2 rounded-xl text-xs transition truncate flex items-center justify-between
                    ${currentSessionId === session.SessionId
                      ? 'bg-primary-light font-medium text-text'
                      : 'text-text-secondary hover:bg-gray-50'
                    }`}
                  onContextMenu={(e) => handleContextMenu(e, session.SessionId)}
                >
                  <button
                    onClick={() => loadHistory(session.SessionId)}
                    className="min-w-0 flex-1 text-left flex items-center gap-1.5"
                  >
                    <span className="min-w-0 truncate">{session.Name || session.SessionId}</span>
                    {isScheduledTaskSession(session.SessionId) && (
                      <span
                        aria-label="定时任务会话"
                        title="定时任务会话"
                        className="shrink-0 rounded-full border border-[#D7DAE2] bg-[#F5F6F8] px-1.5 py-0.5 text-[10px] leading-3 font-semibold text-black/55"
                      >
                        任务
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, session.SessionId); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded transition shrink-0"
                    aria-label="打开会话菜单"
                    title="打开会话菜单"
                  >
                    <svg className="w-3 h-3 text-text-muted" fill="currentColor" viewBox="0 0 16 16">
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </button>
                </div>

                {contextMenu === session.SessionId && (
                  <div ref={menuRef} className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-border shadow-lg py-1 z-50 min-w-[100px]">
                    <button
                      onClick={() => handleDelete(session.SessionId)}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
