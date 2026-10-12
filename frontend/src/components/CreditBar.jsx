// Shows how much of the free AI allowance is left.
// usage = { requests:{limit,remaining}, tokens:{limit,remaining}, resetRequests, resetTokens }
function Bar({ label, remaining, limit, reset }) {
  const pct = limit ? Math.max(0, Math.min(100, Math.round((remaining / limit) * 100))) : 0;
  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';
  const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString());
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="flex justify-between text-[11px] text-gray-500 mb-1">
        <span>{label}</span>
        <span>
          {fmt(remaining)} / {fmt(limit)} left{reset ? ` · resets in ${reset}` : ''}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CreditBar({ usage }) {
  const r = usage?.requests;
  const t = usage?.tokens;

  if (!r?.limit && !t?.limit) {
    return (
      <div className="px-4 py-2 text-[11px] text-gray-400 text-center">
        AI credits will show here after your first question.
      </div>
    );
  }

  const low = (r?.limit && r.remaining / r.limit < 0.1) || (t?.limit && t.remaining / t.limit < 0.1);

  return (
    <div className="px-4 py-2 border-t border-gray-100 bg-white">
      <div className="flex flex-wrap gap-4">
        {r?.limit ? <Bar label="Daily questions" remaining={r.remaining} limit={r.limit} reset={usage.resetRequests} /> : null}
        {t?.limit ? <Bar label="Per-minute capacity" remaining={t.remaining} limit={t.limit} reset={usage.resetTokens} /> : null}
      </div>
      {low && (
        <p className="mt-1 text-[11px] text-red-600">
          Credits are almost used up. Replies may pause until the limit resets.
        </p>
      )}
    </div>
  );
}
