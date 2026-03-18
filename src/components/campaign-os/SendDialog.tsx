import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Campaign } from '../../types/campaign';

interface SendDialogProps {
  campaign: Campaign;
  onSendNow: (batchSize: number, delaySeconds: number) => Promise<void>;
  onSchedule: (scheduledAt: string) => Promise<void>;
  onCancel: () => void;
}

type SendMode = 'now' | 'drip' | 'schedule';

export function SendDialog({ campaign, onSendNow, onSchedule, onCancel }: SendDialogProps) {
  const [mode, setMode] = useState<SendMode>('now');
  const [batchSize, setBatchSize] = useState(500);
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipientCount = campaign.audience?.count || 0;
  const batches = Math.ceil(recipientCount / batchSize);
  const estMinutes = Math.ceil((batches * delaySeconds) / 60);

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    try {
      if (mode === 'schedule') {
        if (!scheduledDate) throw new Error('Pick a date');
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
        await onSchedule(scheduledAt);
      } else if (mode === 'now') {
        await onSendNow(recipientCount, 0); // all at once
      } else {
        await onSendNow(batchSize, delaySeconds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setExecuting(false);
    }
  };

  const modes: { id: SendMode; label: string; desc: string }[] = [
    { id: 'now', label: 'Send Now', desc: 'Deliver to all recipients immediately' },
    { id: 'drip', label: 'Drip Send', desc: 'Send in batches with delays between' },
    { id: 'schedule', label: 'Schedule', desc: 'Pick a date and time for the cron to fire' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Send Campaign</h3>
          <p className="text-sm text-gray-500 mt-1">
            <strong>{campaign.name}</strong> — {recipientCount.toLocaleString()} recipients
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode selector */}
          <div className="space-y-2">
            {modes.map((m) => (
              <label
                key={m.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mode === m.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="sendMode"
                  checked={mode === m.id}
                  onChange={() => setMode(m.id)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.label}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Drip options */}
          {mode === 'drip' && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Batch Size</label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={1000}>1,000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Delay Between</label>
                  <select
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-white rounded p-2">
                {batches} batches of {batchSize} — est. {estMinutes} min total — ~{Math.round((batchSize * 3600) / delaySeconds).toLocaleString()}/hr
              </div>
            </div>
          )}

          {/* Schedule options */}
          {mode === 'schedule' && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Vercel cron checks every 15 minutes. Send will fire at the next cron tick after this time.</p>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex items-center justify-between">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={handleExecute}
            disabled={executing || (mode === 'schedule' && !scheduledDate)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {executing
              ? 'Sending...'
              : mode === 'now'
                ? `Send to ${recipientCount.toLocaleString()} Now`
                : mode === 'drip'
                  ? `Start Drip (${batches} batches)`
                  : 'Schedule Send'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
