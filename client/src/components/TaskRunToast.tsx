import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTaskRunNotificationStore, type TaskRunNotification } from '../stores/taskRunNotificationStore';
import { useChatStore } from '../stores/chatStore';

const AUTO_DISMISS_MS = 8000;

export default function TaskRunToast() {
  const notifications = useTaskRunNotificationStore((s) => s.notifications);
  const removeNotification = useTaskRunNotificationStore((s) => s.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[360px]">
      {notifications.map((n) => (
        <ToastItem
          key={n.id}
          notification={n}
          onDismiss={() => removeNotification(n.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({ notification, onDismiss }: { notification: TaskRunNotification; onDismiss: () => void }) {
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setMessages = useChatStore((s) => s.setMessages);

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleClick = () => {
    const virtualSessionId = `schedule:${notification.taskId}`;
    setSessionId(virtualSessionId);
    setMessages([{
      id: `task-run-result-${notification.taskId}-${notification.timestamp}`,
      role: 'assistant',
      content: notification.content,
      timestamp: notification.timestamp,
    }]);
    onDismiss();
  };

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3 flex items-start gap-3 cursor-pointer hover:border-primary/40 transition animate-slide-in"
      onClick={handleClick}
    >
      <div className="w-8 h-8 rounded-full bg-[#48CD00]/10 flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-[#48CD00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-black truncate">
          定时任务执行完成
        </div>
        <div className="text-xs text-black/50 mt-0.5 line-clamp-3 markdown-body [&_*]:!text-xs [&_*]:!leading-tight [&_p]:!my-0 [&_ul]:!my-0 [&_ol]:!my-0 [&_li]:!my-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {notification.content.length > 200 ? notification.content.slice(0, 200) + '...' : notification.content}
          </ReactMarkdown>
        </div>
        <div className="text-[11px] text-primary mt-1">点击查看结果</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="w-5 h-5 rounded flex items-center justify-center text-black/30 hover:text-black/60 hover:bg-gray-100 transition shrink-0"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
