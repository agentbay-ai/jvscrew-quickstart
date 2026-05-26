import { useCallback, useEffect, useRef, useState } from 'react';
import { createWechatQrCode, describeWechatQrCode } from '../services/channels';
import { useAuthStore } from '../stores/authStore';
import type { QrCodeStatus } from '../types/channels';

interface WechatBindPopoverProps {
  onClose: () => void;
}

interface QrSession {
  sessionKey: string;
  qrcodeImg: string;
  qrcodeUrl?: string;
  expiresAt: number;
}

const POLL_INTERVAL_MS = 2000;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '操作失败';
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function statusLabel(status: QrCodeStatus): { text: string; tone: 'info' | 'pending' | 'success' | 'error' } {
  switch (status) {
    case 'waiting':
      return { text: '请使用微信扫码', tone: 'info' };
    case 'scanned':
      return { text: '已扫码，请在手机上点击确认', tone: 'pending' };
    case 'confirmed':
      return { text: '绑定成功', tone: 'success' };
    case 'expired':
      return { text: '二维码已过期', tone: 'error' };
  }
}

export default function WechatBindPopover({ onClose }: WechatBindPopoverProps) {
  const externalUserId = useAuthStore((s) => s.config?.externalUserId);
  const templateId = useAuthStore((s) => s.config?.templateId);

  const [session, setSession] = useState<QrSession | null>(null);
  const [status, setStatus] = useState<QrCodeStatus>('waiting');
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const createSession = useCallback(async () => {
    if (!externalUserId || !templateId) {
      setError('请先选择一个 Agent 模板再绑定');
      return;
    }
    setIsCreating(true);
    setError('');
    setStatus('waiting');
    setInstanceId(null);
    try {
      const resp = await createWechatQrCode({
        externalUserId,
        templateId,
        channelType: 'wechat',
      });
      setSession({
        sessionKey: resp.SessionKey,
        qrcodeImg: resp.QrcodeImgBase64,
        qrcodeUrl: resp.QrcodeImgUrl,
        expiresAt: resp.ExpiresAt,
      });
    } catch (err) {
      setError(errorText(err));
      setSession(null);
    } finally {
      setIsCreating(false);
    }
  }, [externalUserId, templateId]);

  useEffect(() => {
    void createSession();
    return () => stopPolling();
  }, [createSession, stopPolling]);

  // Poll status every 2s while waiting/scanned.
  useEffect(() => {
    if (!session) return;
    if (status === 'confirmed' || status === 'expired') {
      stopPolling();
      return;
    }
    if (pollTimer.current) return;
    pollTimer.current = setInterval(async () => {
      try {
        const resp = await describeWechatQrCode(session.sessionKey);
        setStatus(resp.Status);
        if (resp.Status === 'confirmed' && resp.ChannelInstanceId) {
          setInstanceId(resp.ChannelInstanceId);
        }
        if (resp.Status === 'expired' && resp.ErrMsg) {
          setError(resp.ErrMsg);
        }
      } catch (err) {
        setError(errorText(err));
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopPolling();
    };
  }, [session, status, stopPolling]);

  // 1s tick for the countdown.
  useEffect(() => {
    if (!session) return;
    if (status === 'confirmed' || status === 'expired') return;
    tickTimer.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickTimer.current) {
        clearInterval(tickTimer.current);
        tickTimer.current = null;
      }
    };
  }, [session, status]);

  // Auto-detect expiry if backend hasn't told us yet.
  useEffect(() => {
    if (!session || status === 'confirmed' || status === 'expired') return;
    if (now >= session.expiresAt) {
      setStatus('expired');
    }
  }, [now, session, status]);

  const remaining = session ? session.expiresAt - now : 0;
  const label = statusLabel(status);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-[320px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-black/80">绑定微信</span>
          <span className="text-[11px] text-black/40">扫码后即可在微信里与该 Agent 对话</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 transition text-black/40"
          title="关闭"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col items-center gap-3">
        {error && (
          <div className="w-full rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600 text-center">
            {error}
          </div>
        )}

        <div className="relative w-[180px] h-[180px] rounded-lg bg-[#F5F6FA] flex items-center justify-center overflow-hidden">
          {isCreating && (
            <div className="text-xs text-black/40">二维码加载中...</div>
          )}
          {!isCreating && session && (
            <>
              <img
                src={session.qrcodeImg}
                alt="WeChat QR"
                className={`w-full h-full object-contain ${
                  status === 'expired' || status === 'confirmed' ? 'opacity-30' : ''
                }`}
              />
              {status === 'expired' && (
                <button
                  onClick={() => void createSession()}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 text-xs text-[#2F3A80] font-medium hover:bg-white/90 transition"
                >
                  <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  点击刷新
                </button>
              )}
              {status === 'confirmed' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                  <svg className="w-14 h-14 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </>
          )}
          {!isCreating && !session && !error && (
            <div className="text-xs text-black/40">未生成二维码</div>
          )}
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-xs font-medium ${
            label.tone === 'success' ? 'text-emerald-600'
              : label.tone === 'pending' ? 'text-amber-600'
                : label.tone === 'error' ? 'text-red-600'
                  : 'text-black/70'
          }`}>
            {label.text}
          </span>
          {status === 'waiting' && session && (
            <span className="text-[11px] text-black/40">
              {remaining > 0 ? `剩余 ${formatRemaining(remaining)}` : ''}
            </span>
          )}
          {status === 'confirmed' && instanceId && (
            <span className="text-[11px] text-black/40 font-mono break-all px-2 text-center">
              {instanceId}
            </span>
          )}
        </div>

        {status === 'expired' && (
          <button
            type="button"
            disabled={isCreating}
            onClick={() => void createSession()}
            className="text-xs text-[#2F3A80] hover:underline disabled:opacity-50"
          >
            重新生成二维码
          </button>
        )}
      </div>
    </div>
  );
}
