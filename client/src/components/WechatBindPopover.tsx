import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { createWechatQrCode, describeWechatQrCode, listChannelInstances } from '../services/channels';
import { useAuthStore } from '../stores/authStore';
import type { ChannelInstanceItem, QrCodeStatus } from '../types/channels';
import { usePopoverPosition } from '../utils/usePopoverPosition';

interface WechatBindPopoverProps {
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

interface QrSession {
  sessionKey: string;
  qrcodeImg: string;
  qrcodeUrl?: string;
  expiresAt: number;
}

type Mode = 'loading' | 'bound' | 'qr';

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

function formatBindTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export default function WechatBindPopover({ onClose, anchorRef }: WechatBindPopoverProps) {
  const externalUserId = useAuthStore((s) => s.config?.externalUserId);
  const templateId = useAuthStore((s) => s.config?.templateId);
  const pos = usePopoverPosition(anchorRef);

  const [mode, setMode] = useState<Mode>('loading');
  const [boundInstance, setBoundInstance] = useState<ChannelInstanceItem | null>(null);
  const [session, setSession] = useState<QrSession | null>(null);
  const [status, setStatus] = useState<QrCodeStatus>('waiting');
  const [confirmedInstanceId, setConfirmedInstanceId] = useState<string | null>(null);
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

  const checkExistingBinding = useCallback(async () => {
    if (!externalUserId || !templateId) {
      setError('请先选择一个 Agent 模板再绑定');
      setMode('qr');
      return;
    }
    setError('');
    try {
      const resp = await listChannelInstances({
        channelType: 'wechat',
        templateId,
        externalUserId,
        status: 'enabled',
        pageSize: 1,
      });
      const enabled = resp.Channels.find((c) => c.Status === 'enabled');
      if (enabled) {
        setBoundInstance(enabled);
        setMode('bound');
      } else {
        setMode('qr');
      }
    } catch (err) {
      // 查询失败不要直接卡住，回退到二维码模式让用户能继续操作
      console.warn('[WechatBindPopover] list channels failed', err);
      setMode('qr');
    }
  }, [externalUserId, templateId]);

  const createSession = useCallback(async () => {
    if (!externalUserId || !templateId) {
      setError('请先选择一个 Agent 模板再绑定');
      return;
    }
    setIsCreating(true);
    setError('');
    setStatus('waiting');
    setConfirmedInstanceId(null);
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
    void checkExistingBinding();
    return () => stopPolling();
  }, [checkExistingBinding, stopPolling]);

  // 进入 qr 模式时按需创建二维码（可能是初次绑定或重新绑定）
  useEffect(() => {
    if (mode !== 'qr') return;
    if (session) return;          // 已有 session 不重复创建
    void createSession();
  }, [mode, session, createSession]);

  // Poll status every 2s while waiting/scanned.
  useEffect(() => {
    if (mode !== 'qr' || !session) return;
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
          setConfirmedInstanceId(resp.ChannelInstanceId);
          // 绑定完成 → 拉一次最新实例，回到 bound 视图
          setTimeout(() => { void checkExistingBinding(); }, 600);
        }
        if (resp.Status === 'expired' && resp.ErrMsg) {
          setError(resp.ErrMsg);
        }
      } catch (err) {
        setError(errorText(err));
      }
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [mode, session, status, stopPolling, checkExistingBinding]);

  // 1s tick for the countdown.
  useEffect(() => {
    if (mode !== 'qr' || !session) return;
    if (status === 'confirmed' || status === 'expired') return;
    tickTimer.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickTimer.current) {
        clearInterval(tickTimer.current);
        tickTimer.current = null;
      }
    };
  }, [mode, session, status]);

  // Auto-detect expiry if backend hasn't told us yet.
  useEffect(() => {
    if (mode !== 'qr' || !session || status === 'confirmed' || status === 'expired') return;
    if (now >= session.expiresAt) {
      setStatus('expired');
    }
  }, [mode, now, session, status]);

  const handleRebind = () => {
    setBoundInstance(null);
    setSession(null);
    setStatus('waiting');
    setError('');
    setMode('qr');
  };

  const remaining = session ? session.expiresAt - now : 0;
  const label = statusLabel(status);

  if (!pos) return null;

  return createPortal(
    <div
      data-popover-portal="wechat"
      style={{ position: 'fixed', left: pos.left, bottom: pos.bottom }}
      className="w-[320px] bg-white rounded-xl border border-gray-200 shadow-xl z-[60] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-black/80">
            {mode === 'bound' ? '微信已绑定' : '绑定微信'}
          </span>
          <span className="text-[11px] text-black/40 truncate">
            {mode === 'bound' ? '可在微信里直接与该 Agent 对话' : '扫码后即可在微信里与该 Agent 对话'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 transition text-black/40 shrink-0"
          title="关闭"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col items-center gap-3">
        {error && (
          <div className="w-full rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600 text-center break-all">
            {error}
          </div>
        )}

        {mode === 'loading' && (
          <div className="py-10 text-xs text-black/40">加载中...</div>
        )}

        {mode === 'bound' && boundInstance && (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-xs font-medium text-emerald-600">已绑定</div>
            <div className="w-full flex flex-col gap-1 px-1">
              {boundInstance.Name && (
                <Row label="名称" value={boundInstance.Name} />
              )}
              <Row label="实例 ID" value={boundInstance.ChannelInstanceId} mono truncate />
              <Row label="模板" value={boundInstance.TemplateId} mono truncate />
              {boundInstance.GmtCreate && (
                <Row label="绑定时间" value={formatBindTime(boundInstance.GmtCreate)} />
              )}
            </div>
            <button
              type="button"
              onClick={handleRebind}
              className="w-full mt-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新绑定
            </button>
          </>
        )}

        {mode === 'qr' && (
          <>
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
              {status === 'confirmed' && confirmedInstanceId && (
                <span className="text-[11px] text-black/40 font-mono break-all px-2 text-center">
                  {confirmedInstanceId}
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
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value, mono, truncate }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-black/40 shrink-0">{label}</span>
      <span className={`text-black/75 text-right min-w-0 ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : 'break-all'}`}>
        {value}
      </span>
    </div>
  );
}
