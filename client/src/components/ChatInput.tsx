import { useState, useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';
import type { SkillItem } from '../types/api';
import EnvVarsPopover from './EnvVarsPopover';
import McpPopover from './McpPopover';
import WechatBindPopover from './WechatBindPopover';

const MAX_TEXTAREA_HEIGHT = 240;
const MIN_TEXTAREA_HEIGHT = 22;

interface ChatInputProps {
  onSend: (text: string, files?: File[]) => void;
  disabled?: boolean;
  onStop?: () => void;
  isStreaming?: boolean;
  skills?: SkillItem[];
  includeReasoning?: boolean;
  includeToolCalls?: boolean;
  onToggleReasoning?: () => void;
  onToggleToolCalls?: () => void;
  isDragOver?: boolean;
}

export default function ChatInput({
  onSend, disabled, onStop, isStreaming, skills,
  includeReasoning, includeToolCalls, onToggleReasoning, onToggleToolCalls,
  isDragOver,
}: ChatInputProps) {
  const text = useChatStore((s) => s.draftText);
  const setText = useChatStore((s) => s.setDraftText);
  const attachedFiles = useChatStore((s) => s.attachedFiles);
  const addAttachedFiles = useChatStore((s) => s.addAttachedFiles);
  const removeAttachedFile = useChatStore((s) => s.removeAttachedFile);
  const clearAttachedFiles = useChatStore((s) => s.clearAttachedFiles);
  const [showOptions, setShowOptions] = useState(false);
  const [showSkillsMenu, setShowSkillsMenu] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [showMcp, setShowMcp] = useState(false);
  const [showWechat, setShowWechat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const skillsRef = useRef<HTMLDivElement>(null);
  const envVarsRef = useRef<HTMLDivElement>(null);
  const mcpRef = useRef<HTMLDivElement>(null);
  const wechatRef = useRef<HTMLDivElement>(null);

  // Auto-grow textarea based on content height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
    el.style.height = `${next}px`;
  }, [text]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    onSend(trimmed, attachedFiles.length > 0 ? attachedFiles : undefined);
    setText('');
    clearAttachedFiles();
  }, [text, attachedFiles, onSend, setText, clearAttachedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    // 输入法（中文拼音、日文等）正在合成候选词时不要发送：
    // 1) React 17+ 的 isComposing 标志
    // 2) 浏览器在 IME 期间统一上报 keyCode 229
    // 3) 自维护 ref（兼容部分浏览器在选词回车时 isComposing 已变 false 但事件链仍属于合成尾的情况）
    const native = e.nativeEvent as KeyboardEvent;
    if (native.isComposing || native.keyCode === 229 || isComposingRef.current) return;
    e.preventDefault();
    handleSubmit();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length === 0) return;
    e.preventDefault();
    const named = files.map((f) => {
      if (f.name && f.name !== 'image.png') return f;
      const ext = f.type.split('/')[1] || 'png';
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      return new File([f], `pasted-${ts}.${ext}`, { type: f.type });
    });
    addAttachedFiles(named);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addAttachedFiles(files);
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    removeAttachedFile(idx);
  };

  useEffect(() => {
    if (!showOptions && !showSkillsMenu && !showEnvVars && !showMcp && !showWechat) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // 通过 portal 渲染到 body 的弹层不在原始 ref 容器内，需要单独排除
      const inPortal = target?.closest?.('[data-popover-portal]');
      if (showOptions && optionsRef.current && !optionsRef.current.contains(target)) {
        setShowOptions(false);
      }
      if (showSkillsMenu && skillsRef.current && !skillsRef.current.contains(target)) {
        setShowSkillsMenu(false);
      }
      if (showEnvVars && envVarsRef.current && !envVarsRef.current.contains(target) && inPortal?.getAttribute('data-popover-portal') !== 'env-vars') {
        setShowEnvVars(false);
      }
      if (showMcp && mcpRef.current && !mcpRef.current.contains(target) && inPortal?.getAttribute('data-popover-portal') !== 'mcp') {
        setShowMcp(false);
      }
      if (showWechat && wechatRef.current && !wechatRef.current.contains(target)) {
        setShowWechat(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOptions, showSkillsMenu, showEnvVars, showMcp, showWechat]);

  const handleSelectSkill = useCallback((skill: SkillItem) => {
    const prev = useChatStore.getState().draftText;
    const prefix = prev.trim() ? `${prev.trim()} ` : '';
    setText(`${prefix}使用${skill.SkillName}技能 `);
    setShowSkillsMenu(false);
    textareaRef.current?.focus();
  }, [setText]);

  const hasAnyOption = onToggleReasoning || onToggleToolCalls;
  const anyEnabled = includeReasoning || includeToolCalls;

  return (
    <div className="w-full max-w-[628px] mx-auto">
      <div className="relative rounded-2xl bg-white border border-border-strong shadow-sm">
        {/* Drag-and-drop overlay (input-box scoped) */}
        {isDragOver && (
          <div className="absolute inset-0 z-30 rounded-2xl flex items-center justify-center pointer-events-none animate-dropzone-in overflow-hidden">
            <div className="absolute inset-0 rounded-2xl bg-white/80 backdrop-blur-[2px] border-2 border-dashed border-primary/60" />
            <div className="relative flex items-center gap-3 text-primary px-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5v9" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-medium leading-tight">松开以添加附件</div>
                <div className="text-[11px] text-text-muted leading-tight mt-0.5">支持图片、文档等本地文件</div>
              </div>
            </div>
          </div>
        )}

        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-light text-xs text-text-secondary"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {file.name}
                <button onClick={() => removeFile(idx)} className="hover:text-red-500">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text input */}
        <div className="px-4 py-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder="你想让我做什么"
            rows={1}
            disabled={disabled}
            className="w-full resize-none text-sm text-text placeholder:text-text-hint
                       focus:outline-none disabled:opacity-50 bg-transparent overflow-y-auto"
            style={{ minHeight: MIN_TEXTAREA_HEIGHT, maxHeight: MAX_TEXTAREA_HEIGHT }}
          />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-text-muted"
              title="上传文件"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {skills && skills.length > 0 && (
              <div className="relative" ref={skillsRef}>
                <button
                  onClick={() => setShowSkillsMenu(!showSkillsMenu)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition text-text-muted"
                  title="选择技能"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
                {showSkillsMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-50 max-h-72 overflow-auto">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-black/40 uppercase tracking-wider">选择技能</div>
                    {skills.filter((s) => s.Enabled).map((skill) => (
                      <button
                        key={skill.SkillId}
                        onClick={() => handleSelectSkill(skill)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-gray-50 transition text-left"
                      >
                        <span className="w-7 h-7 rounded-md bg-[#F5F6FA] flex items-center justify-center text-sm shrink-0">
                          {skill.Icon && !skill.Icon.startsWith('http') ? skill.Icon : '⚡'}
                        </span>
                        <span className="text-xs text-black/80 truncate">{skill.SkillName}</span>
                      </button>
                    ))}
                    {skills.filter((s) => s.Enabled).length === 0 && (
                      <div className="px-3 py-3 text-xs text-black/40 text-center">暂无可用技能</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="relative" ref={mcpRef}>
              <button
                onClick={() => setShowMcp(!showMcp)}
                className={`p-1.5 rounded-lg transition ${
                  showMcp
                    ? 'text-primary bg-primary/10'
                    : 'text-text-muted hover:bg-gray-100'
                }`}
                title="MCP 工具"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M14.7 6.3a3 3 0 0 1 4.243 4.243l-7.07 7.07a4.5 4.5 0 0 1-6.364-6.364l7.778-7.778a6 6 0 0 1 8.485 8.485L13.06 20.475" />
                </svg>
              </button>
              {showMcp && (
                <McpPopover onClose={() => setShowMcp(false)} anchorRef={mcpRef} />
              )}
            </div>

            <div className="relative" ref={envVarsRef}>
              <button
                onClick={() => setShowEnvVars(!showEnvVars)}
                className={`p-1.5 rounded-lg transition ${
                  showEnvVars
                    ? 'text-primary bg-primary/10'
                    : 'text-text-muted hover:bg-gray-100'
                }`}
                title="环境变量"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M8 4H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1" />
                </svg>
              </button>
              {showEnvVars && (
                <EnvVarsPopover onClose={() => setShowEnvVars(false)} anchorRef={envVarsRef} />
              )}
            </div>

            <div className="relative" ref={wechatRef}>
              <button
                onClick={() => setShowWechat(!showWechat)}
                className={`p-1.5 rounded-lg transition ${
                  showWechat
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-text-muted hover:bg-gray-100'
                }`}
                title="绑定微信"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 7a4 4 0 014-4h6a4 4 0 014 4v4a4 4 0 01-4 4h-2l-3 3v-3H7a4 4 0 01-4-4V7z" />
                  <circle cx="8.5" cy="8.5" r="0.75" fill="currentColor" />
                  <circle cx="12" cy="8.5" r="0.75" fill="currentColor" />
                </svg>
              </button>
              {showWechat && (
                <WechatBindPopover onClose={() => setShowWechat(false)} />
              )}
            </div>

            {/* Stream options button */}
            {hasAnyOption && (
              <div className="relative" ref={optionsRef}>
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className={`p-1.5 rounded-lg transition ${
                    anyEnabled
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-text-muted hover:bg-gray-100'
                  }`}
                  title="输出选项"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {showOptions && (
                  <div className="absolute bottom-full left-0 mb-2 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-2 z-50">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-black/40 uppercase tracking-wider">输出选项</div>
                    {onToggleReasoning && (
                      <label className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                          </svg>
                          <span className="text-xs text-black/70">显示推理过程</span>
                        </div>
                        <ToggleSwitch checked={!!includeReasoning} onChange={() => onToggleReasoning()} />
                      </label>
                    )}
                    {onToggleToolCalls && (
                      <label className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M11.42 15.17l-5.384-3.19A.75.75 0 005.25 12.69v6.62a.75.75 0 00.786.71l5.384-.32a.75.75 0 00.67-.51l.33-1.01m0 0l.24-.75m-.24.75l3.056-1.018a.75.75 0 00.42-.51l.72-2.88a.75.75 0 00-.42-.87L11.42 15.17z" />
                          </svg>
                          <span className="text-xs text-black/70">显示工具调用</span>
                        </div>
                        <ToggleSwitch checked={!!includeToolCalls} onChange={() => onToggleToolCalls()} />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium
                           hover:bg-red-100 transition flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={disabled || (!text.trim() && attachedFiles.length === 0)}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium
                           hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed
                           transition flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(); }}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent cursor-pointer transition-colors duration-200 ${
        checked ? 'bg-primary' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
