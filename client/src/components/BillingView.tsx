import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getMyConsumption, getMyCreditRecords } from '../services/billing';
import type { CreditRecord, UserConsumption } from '../types/billing';

const PAGE_SIZE = 20;

function formatDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

export default function BillingView() {
  const externalUserId = useAuthStore((s) => s.config?.externalUserId);
  const templateId = useAuthStore((s) => s.config?.templateId);

  // Default: today minus 29 days → today (30-day window)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return formatDateInput(d);
  });
  const [toDate, setToDate] = useState(() => formatDateInput(new Date()));
  const [scopeAllTemplates, setScopeAllTemplates] = useState(true);

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
        templateId: scopeAllTemplates ? undefined : templateId,
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
  }, [externalUserId, fromDate, toDate, scopeAllTemplates, templateId]);

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

  const monthlyCards = consumption
    ? [
      { label: '当月 Credit', value: consumption.MonthlyCredit.toFixed(2), unit: 'credits' },
      { label: '当月会话', value: String(consumption.MonthlySessions), unit: 'sessions' },
      { label: '当月时长', value: consumption.MonthlyDurationMinutes.toFixed(1), unit: 'minutes' },
      {
        label: '单会话均耗',
        value: consumption.MonthlySessions > 0
          ? (consumption.MonthlyCredit / consumption.MonthlySessions).toFixed(2)
          : '0.00',
        unit: 'credits',
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
                <div
                  key={card.label}
                  className="rounded-2xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] p-4"
                >
                  <div className="text-xs text-black/50 mb-2">{card.label}</div>
                  <div className="text-2xl font-semibold text-black">{card.value}</div>
                  <div className="text-[11px] text-black/40 mt-1">{card.unit}</div>
                </div>
              ))}
            </div>
          ) : (
            !isLoadingSummary && !summaryError && (
              <div className="rounded-2xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] px-4 py-6 text-center text-xs text-black/40">
                当月暂无消耗
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
            {templateId && (
              <label className="flex items-center gap-1.5 text-[11px] text-black/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeAllTemplates}
                  onChange={(e) => setScopeAllTemplates(e.target.checked)}
                  className="accent-[#2F3A80]"
                />
                全部 Agent（取消勾选则只看当前模板）
              </label>
            )}
            <button
              onClick={() => void loadRecords(1)}
              disabled={isLoadingRecords}
              className="ml-auto text-[11px] text-[#2F3A80] hover:underline disabled:opacity-50"
            >
              {isLoadingRecords ? '加载中...' : '应用 / 刷新'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] p-3">
              <div className="text-[11px] text-black/50">范围内 Credit</div>
              <div className="text-base font-semibold text-black mt-0.5">{totalCredit.toFixed(2)}</div>
            </div>
            <div className="rounded-xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] p-3">
              <div className="text-[11px] text-black/50">会话数</div>
              <div className="text-base font-semibold text-black mt-0.5">{totalSessionCount}</div>
            </div>
            <div className="rounded-xl bg-white shadow-[inset_0_0_0_1px_#2F3A801A] p-3">
              <div className="text-[11px] text-black/50">总耗时</div>
              <div className="text-base font-semibold text-black mt-0.5">{formatDurationMs(totalDurationMs)}</div>
            </div>
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
            <div className="grid grid-cols-[180px_minmax(160px,1fr)_minmax(160px,1fr)_90px_90px_minmax(120px,180px)] items-center px-4 h-10 text-xs font-medium text-black/60 border-b border-gray-100">
              <div>时间</div>
              <div>会话 ID</div>
              <div>模板</div>
              <div className="text-right">Credit</div>
              <div className="text-right">时长</div>
              <div className="truncate">TraceId</div>
            </div>
            {isLoadingRecords ? (
              <div className="py-12 text-center text-xs text-black/40">加载明细中...</div>
            ) : records.length === 0 ? (
              <div className="py-12 text-center text-xs text-black/40">该时间范围内暂无消耗记录</div>
            ) : (
              <ul>
                {records.map((r) => (
                  <li
                    key={r.TraceId}
                    className="grid grid-cols-[180px_minmax(160px,1fr)_minmax(160px,1fr)_90px_90px_minmax(120px,180px)] items-center px-4 h-12 text-xs text-black/80 border-b border-gray-50 last:border-b-0"
                  >
                    <div className="text-black/60">{formatDateTime(r.CreatedAt)}</div>
                    <div className="truncate font-mono text-black/70" title={r.SessionId}>{r.SessionId}</div>
                    <div className="truncate font-mono text-black/60" title={r.TemplateId || ''}>{r.TemplateId || '-'}</div>
                    <div className="text-right font-medium text-black">{r.CreditAmount.toFixed(2)}</div>
                    <div className="text-right text-black/60">{formatDurationMs(r.DurationMs)}</div>
                    <div className="truncate font-mono text-black/40" title={r.TraceId}>{r.TraceId}</div>
                  </li>
                ))}
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
