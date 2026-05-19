import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  createScheduledTask,
  deleteScheduledTask,
  listScheduledTasks,
  updateScheduledTask,
} from '../services/tasks';
import type { ScheduledTask } from '../types/tasks';
import {
  buildSchedule,
  describeSchedule,
  formFromSchedule,
  getDefaultScheduleForm,
  getScheduleTitle,
  validateScheduleForm,
  type IntervalUnit,
  type ScheduleFormState,
  type ScheduleFrequency,
} from '../utils/schedule';

interface TasksViewProps {
  onClose?: () => void;
  onRunTask?: (instruction: string) => void;
}

const frequencyOptions: Array<{ value: ScheduleFrequency; label: string }> = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'interval', label: '每隔一段时间' },
];

const weekdayOptions = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
];

const intervalUnits: Array<{ value: IntervalUnit; label: string }> = [
  { value: 'm', label: '分钟' },
  { value: 'h', label: '小时' },
  { value: 'd', label: '天' },
];

const statusMeta: Record<ScheduledTask['Status'], { text: string; className: string }> = {
  active: { text: '正常运行', className: 'text-[#28c840]' },
  running: { text: '正在运行', className: 'text-primary' },
  paused: { text: '已禁用', className: 'text-text-hint' },
  failed: { text: '异常', className: 'text-[#ff5f57]' },
};

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function selectedWeekdayText(days: number[]): string {
  const selected = weekdayOptions.filter((day) => days.includes(day.value));
  if (selected.length === 0) return '选择星期';
  if (selected.length === 5 && selected.every((day) => day.value >= 1 && day.value <= 5)) {
    return '周一，周二，周三，周四，周五';
  }
  return selected.map((day) => day.label).join('，');
}

export default function TasksView({ onClose, onRunTask }: TasksViewProps) {
  const { config, refreshAccessToken } = useAuthStore();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [instruction, setInstruction] = useState('');
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => getDefaultScheduleForm());
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [showWeekdays, setShowWeekdays] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [taskName, setTaskName] = useState('');

  const loadTasks = useCallback(async () => {
    if (!config) return;
    setIsLoading(true);
    setError('');
    try {
      const token = await refreshAccessToken();
      if (!token) return;
      const data = await listScheduledTasks(token, {
        ExternalUserId: config.externalUserId,
        TemplateId: config.templateId,
        PageNumber: 1,
        PageSize: 100,
      });
      setTasks(data.Tasks);
    } catch (err) {
      setError(errorText(err, '加载定时任务失败'));
    } finally {
      setIsLoading(false);
    }
  }, [config, refreshAccessToken]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadTasks();
    });
  }, [loadTasks]);

  function openCreate() {
    setEditingTask(null);
    setInstruction('');
    setScheduleForm(getDefaultScheduleForm());
    setEditorError('');
    setTaskName('');
    setEditorOpen(true);
  }

  function openEdit(task: ScheduledTask) {
    setEditingTask(task);
    setInstruction(task.Instruction);
    setScheduleForm(formFromSchedule(task.Schedule));
    setEditorError('');
    setTaskName(task.Name);
    setEditorOpen(true);
  }

  async function saveTask() {
    if (!config) return;
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
      setEditorError('请输入执行消息内容');
      return;
    }
    const scheduleError = validateScheduleForm(scheduleForm);
    if (scheduleError) {
      setEditorError(scheduleError);
      return;
    }

    setSaving(true);
    setEditorError('');
    const payload = {
      Name: taskName.trim() || getScheduleTitle(scheduleForm),
      Instruction: trimmedInstruction,
      Schedule: buildSchedule(scheduleForm),
      ExternalUserId: config?.externalUserId,
      TemplateId: config?.templateId,
      Sinks: editingTask?.Sinks,
    };

    try {
      const token = await refreshAccessToken();
      if (!token) throw new Error('获取 AccessToken 失败');
      const saved = editingTask
        ? await updateScheduledTask(token, {
            ...payload,
            TaskId: editingTask.TaskId,
          })
        : await createScheduledTask(token, payload);

      setTasks((prev) => {
        if (!editingTask) return [saved, ...prev];
        return prev.map((task) => (task.TaskId === saved.TaskId ? saved : task));
      });
      setEditorOpen(false);
      setEditingTask(null);
      setInstruction('');
      setTaskName('');
    } catch (err) {
      setEditorError(errorText(err, '保存任务失败'));
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(taskId: string) {
    if (!config) return;
    if (!window.confirm('确定删除这个任务吗？')) return;
    setBusyTaskId(taskId);
    setError('');
    try {
      const token = await refreshAccessToken();
      if (!token) throw new Error('获取 AccessToken 失败');
      const ok = await deleteScheduledTask(token, taskId);
      if (ok) setTasks((prev) => prev.filter((task) => task.TaskId !== taskId));
    } catch (err) {
      setError(errorText(err, '删除任务失败'));
    } finally {
      setBusyTaskId(null);
    }
  }

  function runTask(task: ScheduledTask) {
    if (!onRunTask) {
      setError('当前页面没有可运行的聊天窗口');
      return;
    }
    onRunTask(task.Instruction);
    onClose?.();
  }

  const title = config?.externalUserId ? `${config.externalUserId} 的任务` : '我的任务';
  const panel = (
    <section className="relative w-full max-w-[560px] h-[min(680px,calc(100vh-96px))] rounded-[20px] border border-[#e5e7ef] bg-white shadow-[0_18px_48px_rgba(20,22,40,0.16)] overflow-hidden flex flex-col">
      <header className="px-5 pt-5 pb-4 flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff5f57] via-[#ffd166] to-[#3550ff] flex items-center justify-center text-white text-sm font-semibold shadow-sm">
            J
          </div>
          <h2 className="text-base font-semibold text-text truncate">{title}</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-hint hover:bg-gray-100 hover:text-text transition"
            aria-label="关闭任务面板"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </header>

      <div className="px-5 pb-3 flex items-center justify-between">
        <span className="text-sm text-text-muted">{tasks.length} 个任务</span>
        <button
          onClick={openCreate}
          className="h-8 px-2 rounded-lg flex items-center gap-1.5 text-sm font-medium text-text hover:bg-gray-50 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
          </svg>
          添加任务
        </button>
      </div>

      {error && (
        <div className="mx-5 mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {isLoading && (
          <div className="h-full flex items-center justify-center text-sm text-text-hint">加载中...</div>
        )}

        {!isLoading && tasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#eef1f8] flex items-center justify-center text-[#c4cad8]">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM5 4h14a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Zm0 6v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9H5Zm10.5 2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm.5 1.5h-1v2.25l1.8 1.08.5-.84-1.3-.77V13.5Z" />
              </svg>
            </div>
            <div className="mt-4 text-sm text-text-muted">暂无任务，请添加任务</div>
            <button
              onClick={openCreate}
              className="mt-5 h-10 px-5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
            >
              添加任务
            </button>
          </div>
        )}

        {!isLoading && tasks.length > 0 && (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.TaskId}
                task={task}
                busy={busyTaskId === task.TaskId}
                onRun={() => runTask(task)}
                onEdit={() => openEdit(task)}
                onDelete={() => void removeTask(task.TaskId)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <>
      {onClose ? (
        <div className="fixed inset-0 z-50 bg-black/5 backdrop-blur-[1px] p-8 pt-20 flex items-start justify-center">
          {panel}
        </div>
      ) : (
        <div className="h-full min-h-0 bg-[#f7f8fb] p-6 flex items-start justify-center overflow-y-auto">
          {panel}
        </div>
      )}

      {editorOpen && (
        <TaskEditor
          editing={Boolean(editingTask)}
          instruction={instruction}
          taskName={taskName}
          scheduleForm={scheduleForm}
          saving={saving}
          error={editorError}
          showWeekdays={showWeekdays}
          onInstructionChange={setInstruction}
          onTaskNameChange={setTaskName}
          onScheduleChange={setScheduleForm}
          onWeekdayPickerChange={setShowWeekdays}
          onClose={() => {
            setEditorOpen(false);
            setShowWeekdays(false);
          }}
          onSave={() => void saveTask()}
        />
      )}
    </>
  );
}

interface TaskCardProps {
  task: ScheduledTask;
  busy: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TaskCard({ task, busy, onRun, onEdit, onDelete }: TaskCardProps) {
  const meta = statusMeta[task.Status] ?? statusMeta.active;
  return (
    <article className="group relative rounded-xl border border-[#e5e7ef] bg-white p-4 shadow-[0_4px_16px_rgba(20,22,40,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text truncate">{task.Name}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
            <span>{describeSchedule(task.Schedule)}</span>
            <span className="w-px h-3 bg-border" />
            <span className="truncate">执行指令 “{task.Instruction}”</span>
          </div>
        </div>
        <div className="relative shrink-0">
          <span className={cn('text-xs font-medium', meta.className)}>{meta.text}</span>
          {task.Status === 'failed' && task.LastError && (
            <div className="pointer-events-none absolute right-0 top-6 hidden w-64 rounded-xl bg-white px-4 py-3 text-xs leading-5 text-text-secondary shadow-[0_10px_32px_rgba(20,22,40,0.16)] ring-1 ring-border group-hover:block">
              <div className="mb-1 font-semibold text-text">任务异常</div>
              {task.LastError}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onRun}
            disabled={busy}
            className="h-8 px-3 rounded-full bg-[#f3f4f8] text-xs font-medium text-text hover:bg-[#e9ebf2] disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="m10 8 6 4-6 4V8Z" fill="currentColor" stroke="none" />
            </svg>
            立即运行
          </button>
          <IconButton label="编辑任务" onClick={onEdit}>
            <path d="m16.9 4.8 2.3 2.3M4 20h4.4L19.2 9.2a1.6 1.6 0 0 0 0-2.3l-2.1-2.1a1.6 1.6 0 0 0-2.3 0L4 15.6V20Z" />
          </IconButton>
          <IconButton label="删除任务" onClick={onDelete} disabled={busy}>
            <path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

interface IconButtonProps {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function IconButton({ label, disabled, onClick, children }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-8 h-8 rounded-full bg-[#f3f4f8] text-text flex items-center justify-center hover:bg-[#e9ebf2] disabled:opacity-50 transition"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {children}
      </svg>
    </button>
  );
}

interface TaskEditorProps {
  editing: boolean;
  instruction: string;
  taskName: string;
  scheduleForm: ScheduleFormState;
  saving: boolean;
  error: string;
  showWeekdays: boolean;
  onInstructionChange: (value: string) => void;
  onTaskNameChange: (value: string) => void;
  onScheduleChange: (value: ScheduleFormState) => void;
  onWeekdayPickerChange: (value: boolean) => void;
  onClose: () => void;
  onSave: () => void;
}

function TaskEditor({
  editing,
  instruction,
  taskName,
  scheduleForm,
  saving,
  error,
  showWeekdays,
  onInstructionChange,
  onTaskNameChange,
  onScheduleChange,
  onWeekdayPickerChange,
  onClose,
  onSave,
}: TaskEditorProps) {
  const scheduleDesc = useMemo(() => {
    if (scheduleForm.frequency === 'interval') {
      const unitLabel = { m: '分钟', h: '小时', d: '天' }[scheduleForm.intervalUnit];
      return `每 ${scheduleForm.intervalValue} ${unitLabel}`;
    }
    if (scheduleForm.frequency === 'weekly') {
      return `每周 · ${scheduleForm.time}`;
    }
    return `每天 · ${scheduleForm.time}`;
  }, [scheduleForm]);

  function updateForm(next: Partial<ScheduleFormState>) {
    onScheduleChange({ ...scheduleForm, ...next });
  }

  function toggleWeekday(day: number) {
    const exists = scheduleForm.weekdays.includes(day);
    const weekdays = exists
      ? scheduleForm.weekdays.filter((item) => item !== day)
      : [...scheduleForm.weekdays, day];
    updateForm({ weekdays });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-[1px] flex items-center justify-center p-6">
      <section className="w-full max-w-[560px] h-[min(620px,calc(100vh-64px))] rounded-[20px] border border-[#e5e7ef] bg-white shadow-[0_22px_56px_rgba(20,22,40,0.18)] flex flex-col overflow-hidden">
        <header className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">{editing ? '编辑任务' : '添加任务'}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-hint hover:bg-gray-100 hover:text-text transition"
            aria-label="关闭"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="px-5 py-4 flex-1 overflow-y-auto">
          <div className="pb-4 border-b border-[#dfe3ef]">
            <input
              value={taskName}
              onChange={(e) => onTaskNameChange(e.target.value)}
              placeholder={scheduleDesc}
              className="w-full text-sm font-semibold text-text outline-none bg-transparent placeholder:text-text-hint"
            />
          </div>

          <label className="block mt-4">
            <span className="block mb-2 text-xs text-text-muted">执行消息内容</span>
            <textarea
              value={instruction}
              onChange={(event) => onInstructionChange(event.target.value)}
              placeholder="请输入"
              rows={4}
              className="w-full rounded-xl border border-[#aeb8ff] bg-white px-3 py-3 text-sm text-text outline-none resize-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
            <span>📊 数据报告</span>
            <span>⏰ 定时提醒</span>
            <span>🔍 定时检查</span>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs text-text-muted">执行频率</div>
            <div className="grid grid-cols-3 gap-3">
              {frequencyOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateForm({ frequency: option.value })}
                  className={cn(
                    'h-11 rounded-xl border px-3 text-sm font-medium transition flex items-center justify-center gap-2',
                    scheduleForm.frequency === option.value
                      ? 'border-primary text-text shadow-[0_0_0_1px_#3550FF_inset]'
                      : 'border-[#e5e7ef] text-text hover:border-border-strong',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {scheduleForm.frequency === option.value && (
                    <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 12 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs text-text-muted">执行时间</div>
            <div className="min-h-12 rounded-xl border border-[#e5e7ef] bg-white px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text">时间</span>
              <ScheduleTimeControl
                scheduleForm={scheduleForm}
                showWeekdays={showWeekdays}
                onChange={updateForm}
                onWeekdayPickerChange={onWeekdayPickerChange}
                onWeekdayToggle={toggleWeekday}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        <footer className="px-5 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-full bg-[#333] text-white text-sm font-medium hover:bg-black transition"
          >
            取消
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="h-10 px-5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"
          >
            保存
          </button>
        </footer>
      </section>
    </div>
  );
}

interface ScheduleTimeControlProps {
  scheduleForm: ScheduleFormState;
  showWeekdays: boolean;
  onChange: (next: Partial<ScheduleFormState>) => void;
  onWeekdayPickerChange: (value: boolean) => void;
  onWeekdayToggle: (day: number) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function DropdownSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const idx = options.indexOf(value);
      if (idx >= 0) listRef.current.scrollTop = idx * 32;
    }
  }, [open, value, options]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-8 w-14 rounded-lg border border-[#dfe3ef] bg-white text-sm font-medium outline-none hover:border-primary focus:border-primary text-center flex items-center justify-center gap-0.5 transition"
      >
        {value}
        <svg className="w-3 h-3 text-text-hint shrink-0" fill="currentColor" viewBox="0 0 8 5"><path d="M0 0l4 5 4-5z" /></svg>
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute bottom-full mb-1 left-0 w-14 rounded-lg border border-[#e5e7ef] bg-white shadow-[0_6px_20px_rgba(20,22,40,0.12)] z-20 overflow-y-auto"
          style={{ maxHeight: 32 * 10 }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                'w-full h-8 text-sm text-center transition',
                opt === value ? 'bg-primary/10 text-primary font-medium' : 'text-text hover:bg-gray-50',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeSelect({ value, onTimeChange }: { value: string; onTimeChange: (t: string) => void }) {
  const [h, m] = value.split(':');
  return (
    <div className="flex items-center gap-1">
      <DropdownSelect value={h} options={hours} onChange={(v) => onTimeChange(`${v}:${m}`)} />
      <span className="text-sm font-medium text-text">:</span>
      <DropdownSelect value={m} options={minutes} onChange={(v) => onTimeChange(`${h}:${v}`)} />
    </div>
  );
}

function ScheduleTimeControl({
  scheduleForm,
  showWeekdays,
  onChange,
  onWeekdayPickerChange,
  onWeekdayToggle,
}: ScheduleTimeControlProps) {
  if (scheduleForm.frequency === 'interval') {
    const max = scheduleForm.intervalUnit === 'd' ? 10 : 60;
    const min = scheduleForm.intervalUnit === 'm' ? 10 : 1;
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={scheduleForm.intervalValue}
          onChange={(event) => onChange({ intervalValue: Number(event.target.value) })}
          className="w-20 h-8 rounded-lg border border-[#dfe3ef] px-3 text-right text-sm font-medium outline-none focus:border-primary"
        />
        <select
          value={scheduleForm.intervalUnit}
          onChange={(event) => onChange({ intervalUnit: event.target.value as IntervalUnit })}
          className="h-8 rounded-lg border border-[#dfe3ef] bg-white px-3 text-sm font-medium outline-none focus:border-primary"
        >
          {intervalUnits.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (scheduleForm.frequency === 'weekly') {
    return (
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => onWeekdayPickerChange(!showWeekdays)}
          className="max-w-[230px] h-8 rounded-lg border border-[#dfe3ef] px-3 text-sm font-medium truncate hover:border-primary transition"
        >
          {selectedWeekdayText(scheduleForm.weekdays)}
        </button>
        {showWeekdays && (
          <div className="absolute right-20 top-10 z-10 w-24 rounded-xl border border-[#e5e7ef] bg-white p-2 shadow-[0_10px_30px_rgba(20,22,40,0.16)]">
            {weekdayOptions.map((day) => (
              <label key={day.value} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-text hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={scheduleForm.weekdays.includes(day.value)}
                  onChange={() => onWeekdayToggle(day.value)}
                  className="accent-primary"
                />
                {day.label}
              </label>
            ))}
          </div>
        )}
        <TimeSelect value={scheduleForm.time} onTimeChange={(t) => onChange({ time: t })} />
      </div>
    );
  }

  return (
    <TimeSelect value={scheduleForm.time} onTimeChange={(t) => onChange({ time: t })} />
  );
}
