import type { Send } from '../../types/campaign';

interface SendTimelineProps {
  sends: Send[];
  onCancel: (sendId: string) => void;
  onAddSend: () => void;
}

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  draft: { icon: '○', color: 'text-gray-400' },
  scheduled: { icon: '⏳', color: 'text-blue-600' },
  sending: { icon: '●', color: 'text-purple-600' },
  sent: { icon: '✓', color: 'text-green-600' },
  error: { icon: '✗', color: 'text-red-600' },
  cancelled: { icon: '—', color: 'text-gray-400' },
};

export function SendTimeline({ sends, onCancel, onAddSend }: SendTimelineProps) {
  const sorted = [...sends].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Send Timeline &middot; {sends.length} send{sends.length !== 1 ? 's' : ''}</h3>
        <button onClick={onAddSend} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">+ Add Send</button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No sends scheduled yet.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
          <div className="space-y-4">
            {sorted.map((send) => {
              const { icon, color } = STATUS_ICONS[send.status] || STATUS_ICONS.draft;
              const date = send.scheduledAt ? new Date(send.scheduledAt) : null;
              return (
                <div key={send.id} className="relative flex items-start gap-4 pl-8">
                  <span className={`absolute left-2.5 top-1 text-lg ${color}`}>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{send.name}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        send.status === 'sent' ? 'bg-green-100 text-green-700' :
                        send.status === 'error' ? 'bg-red-100 text-red-700' :
                        send.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{send.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {date ? date.toLocaleString() : 'Not scheduled'}
                      {send.recipientCount ? ` · ${send.recipientCount.toLocaleString()} recipients` : ''}
                      {send.audienceFilter.type !== 'all' ? ` · ${send.audienceFilter.type.replace('_', '-')}` : ''}
                    </p>
                    {send.error && <p className="text-xs text-red-600 mt-1">{send.error}</p>}
                  </div>
                  {send.status === 'scheduled' && (
                    <button onClick={() => onCancel(send.id)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors">Cancel</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
