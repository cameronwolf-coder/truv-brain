import type { ActivityFeedItem } from '../../types/marketingHub';
import { ActivityFeedCard } from './ActivityFeedCard';

interface ActivityFeedProps {
  items: ActivityFeedItem[];
  isLoading: boolean;
}

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4 border-b border-gray-100 animate-pulse">
            <div className="w-6 h-6 bg-gray-200 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm">
        No recent activity in the last 30 days
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {items.map((item) => (
        <ActivityFeedCard key={item.id} item={item} />
      ))}
    </div>
  );
}
