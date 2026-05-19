export type ViewMode = 'default' | 'chat-fullscreen' | 'node-fullscreen';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const modes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  {
    id: 'default',
    label: '默认视图',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    id: 'chat-fullscreen',
    label: '对话全屏',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: 'node-fullscreen',
    label: '节点全屏',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    ),
  },
];

export default function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-4">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-1 text-xs transition
            ${mode === m.id ? 'text-primary' : 'text-text-secondary hover:text-text'}`}
        >
          {m.icon}
          {m.label}
        </button>
      ))}
    </div>
  );
}
