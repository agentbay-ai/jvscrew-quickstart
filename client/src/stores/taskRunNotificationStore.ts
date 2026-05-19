import { create } from 'zustand';

export interface TaskRunNotification {
  id: string;
  taskId: string;
  taskName: string;
  content: string;
  timestamp: number;
}

interface TaskRunNotificationState {
  notifications: TaskRunNotification[];
  addNotification: (n: TaskRunNotification) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useTaskRunNotificationStore = create<TaskRunNotificationState>((set) => ({
  notifications: [],

  addNotification: (n) =>
    set((s) => ({ notifications: [...s.notifications, n] })),

  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  clearAll: () => set({ notifications: [] }),
}));
