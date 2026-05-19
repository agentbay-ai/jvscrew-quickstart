import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useSandboxStore } from '../stores/sandboxStore';
import { listTemplates } from '../services/api';
import type { TemplateItem } from '../types/api';

interface TemplateSelectorProps {
  variant?: 'name' | 'icon';
  dropdownAlign?: 'left' | 'right';
}

export default function TemplateSelector({
  variant = 'name',
  dropdownAlign = 'left',
}: TemplateSelectorProps) {
  const { config, setConfig, setSelectedExpert } = useAuthStore();
  const clearMessages = useChatStore((s) => s.clearMessages);
  const resetSandbox = useSandboxStore((s) => s.reset);
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadTemplateItems = async () => {
    if (!config) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await listTemplates();
      setTemplates(data.Items);
      const selected = data.Items.find((template) => template.TemplateId === config.templateId);
      if (selected && config.templateName !== selected.TemplateKey) {
        setConfig({
          ...config,
          templateName: selected.TemplateKey || selected.TemplateId,
        });
      } else if (!config.templateId && data.Items[0]) {
        const first = data.Items[0];
        const newConfig = {
          ...config,
          templateId: first.TemplateId,
          templateName: first.TemplateKey || first.TemplateId,
        };
        setConfig(newConfig);
        setSelectedExpert({
          id: first.TemplateId,
          name: first.TemplateKey || first.TemplateId,
          description: first.TemplateId,
          status: 'online',
          templateId: first.TemplateId,
          templateKey: first.TemplateKey,
          tenantId: first.TenantId,
        });
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) void loadTemplateItems();
  };

  const switchToTemplate = (templateId: string, templateName?: string) => {
    if (!config || !templateId.trim()) return;
    if (templateId.trim() === config.templateId) {
      setIsOpen(false);
      return;
    }
    const matched = templates.find((template) => template.TemplateId === templateId.trim());
    const name = templateName || matched?.TemplateKey || templateId.trim();
    const newConfig = {
      ...config,
      templateId: templateId.trim(),
      templateName: name,
    };
    setConfig(newConfig);
    setSelectedExpert({
      id: templateId.trim(),
      name,
      description: matched?.TemplateId || templateId.trim(),
      status: 'online',
      templateId: matched?.TemplateId || templateId.trim(),
      templateKey: matched?.TemplateKey || name,
      tenantId: matched?.TenantId,
    });
    clearMessages();
    resetSandbox();
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={handleToggle}
        aria-label="切换模板"
        title="切换模板"
        className={
          variant === 'icon'
            ? 'w-10 h-10 rounded-xl border border-[#e5e7ef] bg-white flex items-center justify-center text-text hover:bg-gray-50 hover:border-border-strong transition'
            : 'flex items-center gap-1 rounded px-1 hover:bg-gray-50 transition'
        }
      >
        {variant === 'icon' ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3" />
          </svg>
        ) : (
          <>
            <span className="text-base font-medium text-text">
              {config?.templateName || config?.templateId || '选择模板'}
            </span>
            <svg className="w-2 h-1.5 text-text-muted" fill="currentColor" viewBox="0 0 8 5">
              <path d="M0 0l4 5 4-5z" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-2 w-72 bg-white rounded-xl border border-border shadow-lg p-2 z-50 ${
          dropdownAlign === 'right' ? 'right-0' : 'left-0'
        }`}>
          <TemplateMenu
            templates={templates}
            selectedTemplateId={config?.templateId}
            isLoading={isLoading}
            loadError={loadError}
            onSelect={(template) => switchToTemplate(template.TemplateId, template.TemplateKey)}
          />
        </div>
      )}
    </div>
  );
}

interface TemplateMenuProps {
  templates: TemplateItem[];
  selectedTemplateId?: string;
  isLoading: boolean;
  loadError: string;
  onSelect: (template: TemplateItem) => void;
}

export function TemplateMenu({
  templates,
  selectedTemplateId,
  isLoading,
  loadError,
  onSelect,
}: TemplateMenuProps) {
  if (isLoading) {
    return (
      <div className="text-xs text-text-hint text-center py-3">Loading templates...</div>
    );
  }

  if (loadError) {
    return (
      <div className="text-xs text-red-500 bg-red-50 rounded-lg px-2 py-2">
        {loadError}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-xs text-text-hint text-center py-3">No templates</div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto">
      {templates.map((template) => (
        <button
          key={template.TemplateId || template.TemplateKey}
          onClick={() => onSelect(template)}
          className={`w-full text-left rounded-lg px-3 py-2.5 transition
            ${selectedTemplateId === template.TemplateId ? 'bg-primary-light' : 'hover:bg-gray-50'}`}
        >
          <div className="text-sm font-medium text-text truncate">
            {template.TemplateKey || template.TemplateId}
          </div>
          <div className="mt-0.5 text-xs text-text-hint truncate">
            {template.TemplateId}
          </div>
        </button>
      ))}
    </div>
  );
}
