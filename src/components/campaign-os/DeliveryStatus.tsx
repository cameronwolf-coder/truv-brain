import { useState, useEffect } from 'react';

interface KnockMessage {
  id: string;
  status: string;
  email: string;
  name: string;
  sentAt: string;
}

interface KnockStats {
  total: number;
  delivered: number;
  sent: number;
  queued: number;
  failed: number;
}

interface SendGridStats {
  requests: number;
  delivered: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  bounces: number;
  blocks: number;
  spamReports: number;
  unsubscribes: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

interface DeliveryStatusProps {
  workflowKey: string | undefined;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
  queued: 'bg-yellow-100 text-yellow-700',
  undelivered: 'bg-red-100 text-red-700',
  not_sent: 'bg-red-100 text-red-700',
  bounced: 'bg-red-100 text-red-700',
};

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function DeliveryStatus({ workflowKey }: DeliveryStatusProps) {
  const [messages, setMessages] = useState<KnockMessage[]>([]);
  const [stats, setStats] = useState<KnockStats | null>(null);
  const [sgStats, setSgStats] = useState<SendGridStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    if (!workflowKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/knock-status?workflow=${workflowKey}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      const data = await res.json();
      setMessages(data.messages || []);
      setStats(data.stats || null);
      setSgStats(data.sendgridStats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [workflowKey]);

  if (!workflowKey) return null;

  const displayMessages = showAll ? messages : messages.slice(0, 50);

  return (
    <div className="space-y-4">
      {/* Knock Delivery Status */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Knock Delivery Status</h3>
          <button onClick={load} disabled={loading} className="text-xs text-blue-600 hover:underline">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-xs text-red-600 border-b border-red-100">{error}</div>
        )}

        {stats && (
          <div className="grid grid-cols-5 gap-4 p-4 border-b border-gray-100">
            {[
              { label: 'Total', value: stats.total, color: 'text-gray-900' },
              { label: 'Delivered', value: stats.delivered, color: 'text-green-600' },
              { label: 'Sent', value: stats.sent, color: 'text-blue-600' },
              { label: 'Queued', value: stats.queued, color: 'text-yellow-600' },
              { label: 'Failed', value: stats.failed, color: 'text-red-600' },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className={`text-lg font-semibold ${m.color}`}>{m.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{m.label}</p>
              </div>
            ))}
          </div>
        )}

        {messages.length > 0 ? (
          <>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-100 sticky top-0">
                    <th className="px-3 py-1.5 text-left font-medium">Email</th>
                    <th className="px-3 py-1.5 text-left font-medium">Name</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-left font-medium">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayMessages.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-900">{m.email}</td>
                      <td className="px-3 py-1.5 text-gray-700">{m.name || '—'}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[m.status] || 'bg-gray-100 text-gray-600'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">{new Date(m.sentAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {messages.length > 50 && (
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-center">
                <button onClick={() => setShowAll(!showAll)} className="text-xs text-blue-600 hover:underline">
                  {showAll ? 'Show less' : `Show all ${messages.length.toLocaleString()} messages`}
                </button>
              </div>
            )}
          </>
        ) : !loading ? (
          <div className="p-4 text-xs text-gray-400 text-center">No messages yet. Send the campaign first.</div>
        ) : null}
      </div>

      {/* SendGrid Stats */}
      {sgStats && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">SendGrid Delivery Stats</h3>
          </div>
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100">
            {[
              { label: 'Requests', value: sgStats.requests.toLocaleString() },
              { label: 'Delivered', value: sgStats.delivered.toLocaleString() },
              { label: 'Open Rate', value: pct(sgStats.openRate) },
              { label: 'Click Rate', value: pct(sgStats.clickRate) },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-lg font-semibold text-gray-900">{m.value}</p>
                <p className="text-xs text-gray-500">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-3 p-4">
            {[
              { label: 'Opens', value: sgStats.uniqueOpens, total: sgStats.opens },
              { label: 'Clicks', value: sgStats.uniqueClicks, total: sgStats.clicks },
              { label: 'Bounces', value: sgStats.bounces },
              { label: 'Blocks', value: sgStats.blocks },
              { label: 'Spam', value: sgStats.spamReports },
              { label: 'Unsubs', value: sgStats.unsubscribes },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className={`text-sm font-semibold ${m.value > 0 && (m.label === 'Bounces' || m.label === 'Blocks' || m.label === 'Spam') ? 'text-red-600' : 'text-gray-900'}`}>
                  {m.value}
                </p>
                <p className="text-xs text-gray-500">{m.label}</p>
                {'total' in m && m.total !== undefined && m.total !== m.value && (
                  <p className="text-xs text-gray-400">{m.total} total</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
