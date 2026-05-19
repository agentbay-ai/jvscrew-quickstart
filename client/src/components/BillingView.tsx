import { useState, useEffect } from 'react';

interface BillingOverview {
  MonthlyCredit: number;
  MonthlySessions: number;
  AvgCreditPerSession: number;
  CycleStart: string;
  CycleEnd: string;
}

export default function BillingView() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadBilling();
  }, []);

  async function loadBilling() {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.Success) {
        setOverview({
          MonthlyCredit: data.MonthlyCredit ?? 0,
          MonthlySessions: data.MonthlySessions ?? 0,
          AvgCreditPerSession: data.AvgCreditPerSession ?? 0,
          CycleStart: data.CycleStart ?? '',
          CycleEnd: data.CycleEnd ?? '',
        });
      } else {
        setError(data.Message || 'Failed to load billing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }

  const cards = overview
    ? [
        { label: 'Monthly Credit', value: overview.MonthlyCredit.toFixed(2), unit: 'credits' },
        { label: 'Sessions', value: overview.MonthlySessions.toString(), unit: 'sessions' },
        { label: 'Avg / Session', value: overview.AvgCreditPerSession.toFixed(2), unit: 'credits' },
      ]
    : [];

  return (
    <div className="h-full p-6 overflow-y-auto">
      <h2 className="text-lg font-medium text-text mb-6">Billing Overview</h2>

      {isLoading && <div className="text-sm text-text-hint text-center py-8">Loading...</div>}

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 mb-4">
          {error}
        </div>
      )}

      {overview && (
        <>
          <div className="text-xs text-text-hint mb-4">
            Billing cycle: {overview.CycleStart?.slice(0, 10)} ~ {overview.CycleEnd?.slice(0, 10)}
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {cards.map((card) => (
              <div
                key={card.label}
                className="p-5 rounded-2xl border border-border bg-white"
              >
                <div className="text-xs text-text-muted mb-2">{card.label}</div>
                <div className="text-2xl font-semibold text-text">{card.value}</div>
                <div className="text-[11px] text-text-hint mt-1">{card.unit}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isLoading && !overview && !error && (
        <div className="text-sm text-text-hint text-center py-8">
          Click to load billing data
          <button
            onClick={loadBilling}
            className="ml-2 text-primary hover:underline"
          >
            Load
          </button>
        </div>
      )}
    </div>
  );
}
