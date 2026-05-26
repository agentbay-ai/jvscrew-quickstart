interface SkillToggleProps {
  enabled: boolean;
  pending: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}

export default function SkillToggle({ enabled, pending, onToggle, size = 'md' }: SkillToggleProps) {
  const w = size === 'sm' ? 'w-9' : 'w-11';
  const h = size === 'sm' ? 'h-5' : 'h-6';
  const knob = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        if (!pending) onToggle();
      }}
      className={`relative inline-flex ${w} ${h} shrink-0 rounded-full transition
        ${enabled ? 'bg-[#2F3A80]' : 'bg-black/15'}
        ${pending ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:opacity-90'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 ${knob} bg-white rounded-full shadow transition-transform
          ${enabled ? translate : 'translate-x-0'}`}
      />
    </button>
  );
}
