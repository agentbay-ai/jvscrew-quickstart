import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface SandboxInfo {
  sessionActive: boolean;
  resourceUrl: string | null;
  sandboxSessionId: string | null;
}

interface SandboxState {
  sandboxInfo: SandboxInfo | null;
  currentResourceUrl: string | null;
  sandboxPreviewOpen: boolean;
  sandboxMinimized: boolean;
  isPolling: boolean;
  pollError: string | null;
  lastPollParams: { sessionId: string; templateId?: string } | null;

  openSandboxPreview: () => void;
  closeSandboxPreview: () => void;
  minimizeSandbox: () => void;
  restoreSandbox: () => void;
  setSandboxUrl: (url: string | null) => void;
  startPolling: (token: string, sessionId: string, templateId?: string) => void;
  refreshSandbox: () => Promise<void>;
  stopPolling: () => void;
  reset: () => void;
}

const JVS_ENDPOINT = '/jvs';
const API_VERSION = '2026-03-11';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_COUNT = 60;

function nowUTC(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function fetchSandboxInfo(
  token: string,
  sessionId: string,
  templateId?: string,
): Promise<SandboxInfo> {
  const authParam = encodeURIComponent(`Bearer ${token}`);
  let url = `${JVS_ENDPOINT}/?Authorization=${authParam}`;
  if (templateId) url += `&TemplateId=${encodeURIComponent(templateId)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-acs-version': API_VERSION,
      'x-acs-action': 'GetSandboxInfo',
      'x-acs-date': nowUTC(),
    },
    body: JSON.stringify({ SessionId: sessionId }),
  });

  const data = await res.json();
  const active = String(data.SessionActive ?? 'false').toLowerCase();

  return {
    sessionActive: active === 'true' || active === '1',
    resourceUrl: data.ResourceUrl ?? null,
    sandboxSessionId: data.SandboxSessionId ?? null,
  };
}

let pollAbortController: AbortController | null = null;

export const useSandboxStore = create<SandboxState>((set, get) => ({
  sandboxInfo: null,
  currentResourceUrl: null,
  sandboxPreviewOpen: false,
  sandboxMinimized: false,
  isPolling: false,
  pollError: null,
  lastPollParams: null,

  openSandboxPreview: () => set({ sandboxPreviewOpen: true, sandboxMinimized: false }),

  closeSandboxPreview: () => set({ sandboxPreviewOpen: false, sandboxMinimized: false }),

  minimizeSandbox: () => set({ sandboxPreviewOpen: false, sandboxMinimized: true }),

  restoreSandbox: () => set({ sandboxPreviewOpen: true, sandboxMinimized: false }),

  setSandboxUrl: (url) => set({
    currentResourceUrl: url,
    sandboxPreviewOpen: !!url,
  }),

  startPolling: (_token, sessionId, templateId) => {
    const state = get();
    if (state.isPolling) return;

    pollAbortController?.abort();
    pollAbortController = new AbortController();
    const { signal } = pollAbortController;

    set({ isPolling: true, pollError: null, lastPollParams: { sessionId, templateId } });

    (async () => {
      for (let i = 0; i < MAX_POLL_COUNT; i++) {
        if (signal.aborted) break;

        try {
          const freshToken = await useAuthStore.getState().refreshAccessToken();
          if (!freshToken || signal.aborted) break;

          const info = await fetchSandboxInfo(freshToken, sessionId, templateId);
          set({ sandboxInfo: info });

          if (info.resourceUrl) {
            set({
              currentResourceUrl: info.resourceUrl,
              sandboxPreviewOpen: true,
              isPolling: false,
            });
            return;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[Sandbox] poll #${i + 1} failed:`, msg);
        }

        if (signal.aborted) break;
        if (i < MAX_POLL_COUNT - 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }

      if (!signal.aborted) {
        set({ isPolling: false, pollError: 'Sandbox not ready after timeout' });
      }
    })();
  },

  refreshSandbox: async () => {
    const { lastPollParams } = get();
    if (!lastPollParams) return;
    const { sessionId, templateId } = lastPollParams;
    try {
      const freshToken = await useAuthStore.getState().refreshAccessToken();
      if (!freshToken) {
        console.error('[Sandbox] refresh failed: unable to get token');
        return;
      }
      console.log('[Sandbox] refreshing after disconnect...');
      const info = await fetchSandboxInfo(freshToken, sessionId, templateId);
      console.log('[Sandbox] refresh result:', { resourceUrl: info.resourceUrl?.slice(0, 60), sessionActive: info.sessionActive });
      set({ sandboxInfo: info });
      if (info.resourceUrl) {
        set({ currentResourceUrl: info.resourceUrl, sandboxPreviewOpen: true });
      }
    } catch (e) {
      console.error('[Sandbox] refresh failed:', e instanceof Error ? e.message : e);
    }
  },

  stopPolling: () => {
    pollAbortController?.abort();
    pollAbortController = null;
    set({ isPolling: false });
  },

  reset: () => {
    pollAbortController?.abort();
    pollAbortController = null;
    set({
      sandboxInfo: null,
      currentResourceUrl: null,
      sandboxPreviewOpen: false,
      sandboxMinimized: false,
      isPolling: false,
      pollError: null,
      lastPollParams: null,
    });
  },
}));
