export interface CampaignMetrics {
  processed: number;
  delivered: number;
  opens: number;
  unique_opens: number;
  clicks: number;
  unique_clicks: number;
  bounces: number;
  dropped: number;
  deferred: number;
  unsubscribes: number;
  spam_reports: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  click_to_open: number;
}

export interface CampaignSummary {
  workflow_key: string;
  name: string;
  template_id: string;
  first_event: number;
  last_event: number;
  metrics: CampaignMetrics;
}

export interface RecipientEvent {
  type: string;
  timestamp: number;
  url?: string;
  reason?: string;
  sg_message_id?: string;
}

export interface RecipientActivity {
  email: string;
  events: RecipientEvent[];
  summary: {
    delivered: boolean;
    opened: boolean;
    clicked: boolean;
    bounced: boolean;
    last_activity: number;
  };
}

export interface CampaignDetailResponse {
  workflow_key: string;
  recipients: RecipientActivity[];
  total: number;
}
