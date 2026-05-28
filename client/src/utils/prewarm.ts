import { warmWorkspace } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const WARM_TTL_MS = 30_000;
const WARM_INFLIGHT_KEY = '__inflight__';

const lastWarmAt = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();

function keyFor(templateId?: string): string {
  return templateId || '__default__';
}

export async function prewarmWorkspace(templateId?: string): Promise<void> {
  const key = keyFor(templateId);
  const now = Date.now();
  const last = lastWarmAt.get(key) ?? 0;
  if (now - last < WARM_TTL_MS) return;

  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      lastWarmAt.set(key, now);
      const state = useAuthStore.getState();
      const token = state.accessToken ?? (await state.refreshAccessToken());
      if (!token) return;

      const data = await warmWorkspace(token, templateId);
      if (!data.Success || data.Status === 'failed') {
        console.warn('[prewarm] backend reported failure', data);
        lastWarmAt.delete(key);
      }
    } catch (err) {
      console.warn('[prewarm] error', err);
      lastWarmAt.delete(key);
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(WARM_INFLIGHT_KEY, task);
  inflight.set(key, task);
  return task;
}

export function resetPrewarmCache(): void {
  lastWarmAt.clear();
  inflight.clear();
}
