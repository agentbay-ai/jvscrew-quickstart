interface QuickActionsProps {
  onSelect: (text: string) => void;
}

const suggestions = [
  { emoji: '🤔', text: '你能做些什么？' },
  { emoji: '🔍', text: '帮我查一下现在全网最火的3个热点' },
  { emoji: '📂', text: '汇总今日国内AI领域重要发布' },
];

export default function QuickActions({ onSelect }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s.text)}
          className="px-4 py-1.5 rounded-full bg-white border border-border text-xs text-text-muted
                     hover:border-primary/30 hover:text-text-secondary transition"
        >
          <span className="text-sm">{s.emoji}</span>{' '}
          <span>{s.text}</span>
        </button>
      ))}
    </div>
  );
}
