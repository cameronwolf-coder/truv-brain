export type CampaignStatus = 'draft' | 'building' | 'ready' | 'sending' | 'sent' | 'error';
export type CampaignChannel = 'marketing' | 'outreach';
export type StageStatus = 'idle' | 'executing' | 'success' | 'error';
export type SendStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'error' | 'cancelled';
export type StageName = 'audience' | 'list' | 'knock_audience' | 'template' | 'workflow';
export type AudienceFilterType = 'all' | 'non_openers' | 'non_clickers' | 'custom';
export type BlockType = 'audience' | 'template' | 'workflow';

export interface PipelineStage {
  stage: StageName;
  status: StageStatus;
  result?: Record<string, unknown>;
  error?: string;
  completedAt?: string;
}

export interface SendAudienceFilter {
  type: AudienceFilterType;
  relativeTo?: string;
}

export interface Send {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  scheduledAt: string;
  status: SendStatus;
  audienceFilter: SendAudienceFilter;
  recipientCount?: number;
  workflowKey?: string;
  presetKey?: string;
  error?: string;
  sentAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  audience: {
    hubspotListId: string;
    knockAudienceKey?: string;
    count: number;
    filterConfig?: AudienceConfig;
  };
  template: {
    sendgridTemplateId: string;
    name: string;
    templateVars?: Record<string, string>;
  };
  workflow: {
    knockWorkflowKey?: string;
    smartleadCampaignId?: string;
  };
  preset: {
    key: string;
    batchSize: number;
    delayMinutes: number;
  } | null;
  pipeline: PipelineStage[];
  sends: Send[];
  createdAt: string;
  sentAt?: string;
}

export interface AudienceConfig {
  filters: HubSpotFilter[];
  excludeLifecycleStages?: string[];
  excludeIndustries?: string[];
  engagementMinimum?: { opens?: number; clicks?: number };
}

export interface HubSpotFilter {
  property: string;
  operator: string;
  value: string | number | string[];
}

export interface TemplateConfig {
  sendgridTemplateId: string;
  subject: string;
  templateVars?: Record<string, string>;
  heroStyle?: 'light' | 'dark';
}

export interface WorkflowConfig {
  knockWorkflowKey: string;
  senderEmail: string;
  senderName: string;
  asmGroupId: number;
  channel: CampaignChannel;
}

export interface BuildingBlock {
  id: string;
  type: BlockType;
  name: string;
  config: AudienceConfig | TemplateConfig | WorkflowConfig;
  lastUsed: string | null;
  usedCount: number;
  createdAt: string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  audienceCount: number;
  sendCount: number;
  createdAt: string;
  sentAt?: string;
  nextSendAt?: string;
}
