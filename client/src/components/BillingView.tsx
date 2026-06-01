import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getMyConsumption, getMyCreditRecords } from '../services/billing';
import { listTemplates } from '../services/api';
import type { CreditRecord, UserConsumption } from '../types/billing';
import type { TemplateItem } from '../types/api';

const PAGE_SIZE = 20;

function formatDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDurationMs(ms: number): string {
  if (!ms || ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '加载用量数据失败';
}

const TEMPLATE_DOT_COLORS = [
  ['bg-blue-100', 'text-blue-600'],
  ['bg-emerald-100', 'text-emerald-600'],
  ['bg-violet-100', 'text-violet-600'],
  ['bg-amber-100', 'text-amber-600'],
  ['bg-rose-100', 'text-rose-600'],
  ['bg-cyan-100', 'text-cyan-600'],
  ['bg-fuchsia-100', 'text-fuchsia-600'],
  ['bg-indigo-100', 'text-indigo-600'],
];

function templateDot(templateId?: string | null): { bg: string; text: string; letter: string } {
  if (!templateId) return { bg: 'bg-gray-100', text: 'text-gray-500', letter: '?' };
  let hash = 0;
  for (let i = 0; i < templateId.length; i++) hash = (hash * 31 + templateId.charCodeAt(i)) >>> 0;
  const [bg, text] = TEMPLATE_DOT_COLORS[hash % TEMPLATE_DOT_COLORS.length];
  const letter = (templateId.replace(/^template-?/i, '')[0] || templateId[0] || '?').toUpperCase();
  return { bg, text, letter };
}

function splitDateTime(iso: string): { date: string; time: string } {
  if (!iso) return { date: '-', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

export default function BillingView() {
  const externalUserId = useAuthStore((s) => s.config?.externalUserId);

  // Default: today minus 29 days → today (30-day window)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return formatDateInput(d);
  });
  const [toDate, setToDate] = useState(() => formatDateInput(new Date()));
  // 空字符串 = 全部 Agent
  const [filterTemplateId, setFilterTemplateId] = useState('');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listTemplates().then((data) => {
      if (cancelled) return;
      setTemplates(data.Items);
    }).catch(() => { /* 模板拉不到不阻塞 */ });
    return () => { cancelled = true; };
  }, []);

  const templateNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of templates) {
      m[t.TemplateId] = t.TemplateKey || t.TemplateId;
    }
    return m;
  }, [templates]);

  const [consumption, setConsumption] = useState<UserConsumption | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [totalSessionCount, setTotalSessionCount] = useState(0);
  const [totalDurationMs, setTotalDurationMs] = useState(0);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState('');

  const loadSummary = useCallback(async () => {
    if (!externalUserId) return;
    setIsLoadingSummary(true);
    setSummaryError('');
    try {
      const c = await getMyConsumption(externalUserId);
      setConsumption(c);
    } catch (err) {
      setSummaryError(errorText(err));
      setConsumption(null);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [externalUserId]);

  const loadRecords = useCallback(async (page: number) => {
    if (!externalUserId) return;
    if (!fromDate || !toDate) return;
    setIsLoadingRecords(true);
    setRecordsError('');
    try {
      const data = await getMyCreditRecords({
        externalUserId,
        fromDate,
        toDate,
        templateId: filterTemplateId || undefined,
        pageSize: PAGE_SIZE,
        pageNumber: page,
      });
      setRecords(data.Records);
      setTotalCount(data.TotalCount);
      setTotalCredit(data.TotalCredit);
      setTotalSessionCount(data.TotalSessionCount);
      setTotalDurationMs(data.TotalDurationMs);
      setPageNumber(data.PageNumber || page);
    } catch (err) {
      setRecordsError(errorText(err));
      setRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  }, [externalUserId, fromDate, toDate, filterTemplateId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadRecords(1);
  }, [loadRecords]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount],
  );

  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const handleCopySession = useCallback(async (sid: string) => {
    try {
      await navigator.clipboard.writeText(sid);
      setCopiedSessionId(sid);
      setTimeout(() => setCopiedSessionId((cur) => (cur === sid ? null : cur)), 1400);
    } catch {
      /* ignore */
    }
  }, []);

  // 客户端排序：null = 默认顺序（服务端返回顺序），desc = Credit 高到低，asc = 低到高
  const [creditSort, setCreditSort] = useState<null | 'asc' | 'desc'>(null);
  const sortedRecords = useMemo(() => {
    if (!creditSort) return records;
    const copy = [...records];
    copy.sort((a, b) => creditSort === 'desc' ? b.CreditAmount - a.CreditAmount : a.CreditAmount - b.CreditAmount);
    return copy;
  }, [records, creditSort]);
  const cycleCreditSort = () => {
    setCreditSort((cur) => (cur === null ? 'desc' : cur === 'desc' ? 'asc' : null));
  };

  const monthlyCards: Array<{ label: string; value: string; unit: string; tone: 'primary' | 'emerald' | 'amber' | 'violet'; icon: React.ReactNode }> = consumption
    ? [
      {
        label: '当月 Credit', value: consumption.MonthlyCredit.toFixed(2), unit: 'credits', tone: 'primary',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      },
      {
        label: '当月会话', value: String(consumption.MonthlySessions), unit: 'sessions', tone: 'emerald',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        ),
      },
      {
        label: '当月时长', value: consumption.MonthlyDurationMinutes.toFixed(1), unit: 'minutes', tone: 'amber',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        ),
      },
      {
        label: '单会话均耗',
        value: consumption.MonthlySessions > 0
          ? (consumption.MonthlyCredit / consumption.MonthlySessions).toFixed(2)
          : '0.00',
        unit: 'credits / session',
        tone: 'violet',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        ),
      },
    ]
    : [];

  return (
    <div className="h-full w-full overflow-auto bg-[#FAFBFF]">
      <div className="flex flex-col gap-5 p-6 max-w-[1280px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium text-black">我的用量</h2>
          <span className="text-xs text-black/40 font-mono">{externalUserId || '-'}</span>
        </div>

        {/* Monthly summary */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-black/60">当月汇总</span>
            <button
              onClick={() => void loadSummary()}
              disabled={isLoadingSummary}
              className="text-[11px] text-[#2F3A80] hover:underline disabled:opacity-50"
            >
              {isLoadingSummary ? '加载中...' : '刷新'}
            </button>
          </div>
          {summaryError && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{summaryError}</div>
          )}
          {monthlyCards.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {monthlyCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  unit={card.unit}
                  tone={card.tone}
                  icon={card.icon}
                />
              ))}
            </div>
          ) : (
            !isLoadingSummary && !summaryError && (
              <div className="rounded-2xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-4 py-10 flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
                <span className="text-xs text-black/40">当月暂无消耗</span>
              </div>
            )
          )}
        </section>

        {/* Detail records */}
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-black/60">消耗明细</span>
            <div className="flex items-center gap-1 text-xs">
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1 focus:outline-none focus:border-primary"
              />
              <span className="text-black/40">~</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1 focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={filterTemplateId}
              onChange={(e) => setFilterTemplateId(e.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-black/70 bg-white focus:outline-none focus:border-primary"
              title="按 Agent 模板筛选"
            >
              <option value="">全部 Agent</option>
              {templates.map((t) => (
                <option key={t.TemplateId} value={t.TemplateId}>
                  {t.TemplateKey || t.TemplateId}
                </option>
              ))}
            </select>
            <button
              onClick={() => void loadRecords(1)}
              disabled={isLoadingRecords}
              className="ml-auto text-[11px] text-[#2F3A80] hover:underline disabled:opacity-50"
            >
              {isLoadingRecords ? '加载中...' : '应用 / 刷新'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard
              compact
              label="范围内 Credit"
              value={totalCredit.toFixed(2)}
              unit="credits"
              tone="primary"
              icon={(
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              )}
            />
            <StatCard
              compact
              label="会话数"
              value={String(totalSessionCount)}
              unit="sessions"
              tone="emerald"
              icon={(
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              )}
            />
            <StatCard
              compact
              label="总耗时"
              value={formatDurationMs(totalDurationMs)}
              tone="amber"
              icon={(
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              )}
            />
          </div>

          {recordsError && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 flex items-center justify-between">
              <span>{recordsError}</span>
              <button
                onClick={() => void loadRecords(pageNumber)}
                className="text-red-500 hover:text-red-700 underline text-[11px]"
              >
                重试
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] overflow-hidden">
            {/* Table header */}
            <div className="flex items-center h-11 px-4 text-[14px] font-medium text-[#000000CC] leading-[22px] border-b border-gray-100 bg-[#FAFBFF]/50 select-none">
              <div className="w-[160px] shrink-0">时间</div>
              <div className="w-[200px] shrink-0">会话 ID</div>
              <div className="flex-1 min-w-[180px]">模板</div>
              <div className="w-[120px] shrink-0 text-right">时长</div>
              <button
                type="button"
                onClick={cycleCreditSort}
                className={`w-[140px] shrink-0 text-right inline-flex items-center justify-end gap-1 cursor-pointer transition ${
                  creditSort ? 'text-primary' : 'hover:text-black'
                }`}
                title={creditSort === 'desc' ? '当前：高到低 · 点击切换' : creditSort === 'asc' ? '当前：低到高 · 点击取消' : '点击按 Credit 排序'}
              >
                <span>Credit</span>
                <SortIndicator state={creditSort} />
              </button>
            </div>

            {isLoadingRecords ? (
              <div className="py-12 text-center text-sm text-black/40">加载明细中...</div>
            ) : sortedRecords.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M9 7h6m-6 4h6m-6 4h4M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z" />
                </svg>
                <span className="text-sm text-black/40">该时间范围内暂无消耗记录</span>
              </div>
            ) : (
              <ul>
                {sortedRecords.map((r) => {
                  const isCopied = copiedSessionId === r.SessionId;
                  const dt = splitDateTime(r.CreatedAt);
                  const tplName = r.TemplateId ? (templateNameMap[r.TemplateId] || r.TemplateId) : '-';
                  const dot = templateDot(r.TemplateId);
                  return (
                    <li
                      key={r.TraceId}
                      className="flex items-center h-[60px] px-4 text-[14px] text-[#000000CC] leading-[22px] border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition group"
                    >
                      {/* 时间 */}
                      <div className="w-[160px] shrink-0 flex flex-col leading-tight">
                        <span className="text-[13px] text-black/80">{dt.date}</span>
                        <span className="text-[11px] text-black/45 font-mono">{dt.time}</span>
                      </div>

                      {/* 会话 ID */}
                      <div className="w-[200px] shrink-0 flex items-center gap-1.5 min-w-0 pr-2">
                        <span className="font-mono text-[12px] text-black/70 truncate" title={r.SessionId}>
                          {r.SessionId}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopySession(r.SessionId)}
                          title={isCopied ? '已复制' : '复制完整 SessionId'}
                          className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition ${
                            isCopied
                              ? 'opacity-100 text-emerald-600 bg-emerald-50'
                              : 'opacity-0 group-hover:opacity-100 text-black/40 hover:text-black/70 hover:bg-gray-100'
                          }`}
                        >
                          {isCopied ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* 模板 */}
                      <div className="flex-1 min-w-[180px] flex items-center gap-2 pr-2">
                        <div className={`w-7 h-7 rounded-lg ${dot.bg} flex items-center justify-center shrink-0`}>
                          <span className={`text-[11px] font-bold ${dot.text}`}>{dot.letter}</span>
                        </div>
                        <div className="flex flex-col min-w-0 leading-tight">
                          <span className="text-[13px] text-black/85 truncate" title={r.TemplateId || ''}>
                            {tplName}
                          </span>
                          {r.TemplateId && tplName !== r.TemplateId && (
                            <span className="text-[11px] text-black/35 font-mono truncate">{r.TemplateId}</span>
                          )}
                        </div>
                      </div>

                      {/* 时长 */}
                      <div className="w-[120px] shrink-0 text-right">
                        <span className="text-[13px] text-black/70 font-mono tabular-nums">
                          {formatDurationMs(r.DurationMs)}
                        </span>
                      </div>

                      {/* Credit */}
                      <div className="w-[140px] shrink-0 text-right flex flex-col leading-tight">
                        <span className="text-[15px] font-semibold text-black tabular-nums">
                          {r.CreditAmount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-black/35">credits</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {totalCount > 0 && (
            <div className="flex items-center justify-end gap-3 text-xs text-black/60">
              <span>
                共 {totalCount} 条 · 第 {pageNumber} / {totalPages} 页
              </span>
              <button
                disabled={pageNumber <= 1 || isLoadingRecords}
                onClick={() => void loadRecords(pageNumber - 1)}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400 transition"
              >
                上一页
              </button>
              <button
                disabled={pageNumber >= totalPages || isLoadingRecords}
                onClick={() => void loadRecords(pageNumber + 1)}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400 transition"
              >
                下一页
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const TONE_STYLES: Record<'primary' | 'emerald' | 'amber' | 'violet', { iconBg: string; iconText: string; accent: string }> = {
  primary: { iconBg: 'bg-primary/10', iconText: 'text-primary', accent: 'from-primary/5' },
  emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', accent: 'from-emerald-50/40' },
  amber: { iconBg: 'bg-amber-50', iconText: 'text-amber-600', accent: 'from-amber-50/40' },
  violet: { iconBg: 'bg-violet-50', iconText: 'text-violet-600', accent: 'from-violet-50/40' },
};

function StatCard({
  label, value, unit, tone, icon, compact,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: 'primary' | 'emerald' | 'amber' | 'violet';
  icon: React.ReactNode;
  compact?: boolean;
}) {
  const style = TONE_STYLES[tone];
  return (
    <div className={`relative rounded-2xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] overflow-hidden hover:shadow-[inset_0_0_0_1px_#2F3A8033] transition ${
      compact ? 'p-3' : 'p-4'
    }`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${style.accent} via-transparent to-transparent pointer-events-none`} />
      <div className="relative flex items-start gap-3">
        <div className={`shrink-0 ${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl ${style.iconBg} ${style.iconText} flex items-center justify-center`}>
          {icon}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`text-[11px] text-black/50 ${compact ? '' : 'mb-0.5'}`}>{label}</span>
          <span className={`font-semibold text-black tabular-nums leading-tight truncate ${compact ? 'text-lg' : 'text-2xl'}`}>
            {value}
          </span>
          {unit && (
            <span className="text-[10px] text-black/35 mt-0.5">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SortIndicator({ state }: { state: null | 'asc' | 'desc' }) {
  if (state === 'desc') {
    return (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    );
  }
  if (state === 'asc') {
    return (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 text-black/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  );
}
