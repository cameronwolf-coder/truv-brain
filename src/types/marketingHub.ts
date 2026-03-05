export type CalendarViewType = 'month' | 'week' | 'timeline';

export type ActivityItemType = 'campaign' | 'event' | 'content' | 'ops';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  type: 'project' | 'issue';
  status: string;
  statusColor: string;
  assignee?: string;
  project?: string;
  labels: { name: string; color: string }[];
  url: string;
}

export interface ActivityFeedItem {
  id: string;
  title: string;
  type: ActivityItemType;
  source: 'hubspot' | 'linear';
  timestamp: string;
  description?: string;
  url?: string;
}

export interface MarketingHubFilters {
  project: string | null;
  label: string | null;
  assignee: string | null;
  status: string | null;
}
