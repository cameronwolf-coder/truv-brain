import type { ActivityFeedItem } from '../../types/marketingHub';

const typeConfig = {
  campaign: { color: 'bg-blue-100 text-blue-700', icon: '📧' },
  event: { color: 'bg-purple-100 text-purple-700', icon: '📅' },
  content: { color: 'bg-green-100 text-green-700', icon: '📝' },
  ops: { color: 'bg-gray-100 text-gray-700', icon: '⚙️' },
};

const sourceConfig = {
  hubspot: { label: 'HubSpot', color: 'bg-orange-50 text-orange-600' },
  linear: { label: 'Linear', color: 'bg-indigo-50 text-indigo-600' },
};

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface ActivityFeedCardProps {
  item: ActivityFeedItem;
}

export function ActivityFeedCard({ item }: ActivityFeedCardProps) {
  const type = typeConfig[item.type];
  const source = sourceConfig[item.source];

  return (
    <div
      className="flex items-start gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      style={{ contentVisibility: 'auto' }}
    >
      <span className="text-lg mt-0.5">{type.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:text-truv-blue truncate"
            >
              {item.title}
            </a>
          ) : (
            <span className="text-sm font-medium text-gray-900 truncate">{item.title}</span>
          )}
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${type.color}`}>
            {item.type}
          </span>
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${source.color}`}>
            {source.label}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500">{item.description}</p>
        )}
      </div>
      <span className="text-xs text-gray-400 shrink-0 mt-0.5">{timeAgo(item.timestamp)}</span>
    </div>
  );
}
