import { useState, useEffect } from 'react';
import type { Campaign } from '../../types/campaign';
import { updateCampaign } from '../../services/campaignClient';

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
}

interface HubSpotList {
  id: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string | null;
}

interface CampaignResourcesProps {
  campaign: Campaign;
  onRefresh: () => void;
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
    </svg>
  );
}

// ---- List Picker (inline) ----

function ListPicker({ current, onSelect, onCancel }: { current: string; onSelect: (list: HubSpotList) => void; onCancel: () => void }) {
  const [query, setQuery] = useState('');
  const [lists, setLists] = useState<HubSpotList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractListId = (input: string): string | null => {
    const urlMatch = input.match(/lists\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    if (/^\d+$/.test(input.trim())) return input.trim();
    return null;
  };

  const loadLists = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const id = extractListId(q);
      if (id) {
        const res = await fetch(`/api/campaigns/hubspot-lists?listId=${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.list) { setLists([data.list]); setLoading(false); return; }
        }
        setError(`List ${id} not found`);
        setLists([]);
      } else {
        const params = q ? `?q=${encodeURIComponent(q)}` : '';
        const res = await fetch(`/api/campaigns/hubspot-lists${params}`);
        if (res.ok) {
          const data = await res.json();
          setLists(data.lists || []);
        }
      }
    } catch { setError('Failed to load lists'); }
    setLoading(false);
  };

  useEffect(() => { loadLists(''); }, []);
  useEffect(() => {
    const t = setTimeout(() => loadLists(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="mt-2 border border-blue-200 rounded-lg bg-blue-50 p-3 space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search lists, paste URL, or enter ID..."
        autoFocus
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {loading ? (
        <p className="text-xs text-gray-400">Loading...</p>
      ) : (
        <div className="max-h-40 overflow-y-auto divide-y divide-blue-100 rounded border border-blue-100 bg-white">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => onSelect(list)}
              className={`w-full text-left px-2.5 py-2 text-xs hover:bg-blue-50 transition-colors ${list.id === current ? 'bg-blue-100' : ''}`}
            >
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">{list.name}</span>
                <span className="text-gray-500">{list.size} contacts</span>
              </div>
              <span className="text-gray-400">ID: {list.id} · {list.type.toLowerCase()}</span>
            </button>
          ))}
          {lists.length === 0 && !loading && <p className="px-2.5 py-2 text-xs text-gray-400">No lists found</p>}
        </div>
      )}
      <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
    </div>
  );
}

// ---- Template Picker (inline) ----

interface SgTemplate {
  id: string;
  name: string;
  subject: string | null;
  updatedAt: string;
}

function TemplatePicker({ onSelect, onCancel, campaignName }: { onSelect: (id: string, name: string) => void; onCancel: () => void; campaignName: string }) {
  const [tplMode, setTplMode] = useState<'pick' | 'create' | 'existing'>('pick');
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState(campaignName);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick mode state
  const [sgTemplates, setSgTemplates] = useState<SgTemplate[]>([]);
  const [sgQuery, setSgQuery] = useState('');
  const [sgLoading, setSgLoading] = useState(false);

  const loadTemplates = async (q: string) => {
    setSgLoading(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await fetch(`/api/campaigns/sendgrid-templates${params}`);
      if (res.ok) {
        const data = await res.json();
        setSgTemplates(data.templates || []);
      }
    } catch { /* ignore */ }
    setSgLoading(false);
  };

  useEffect(() => {
    if (tplMode === 'pick') loadTemplates('');
  }, [tplMode]);

  useEffect(() => {
    if (tplMode !== 'pick') return;
    const t = setTimeout(() => loadTemplates(sgQuery), 300);
    return () => clearTimeout(t);
  }, [sgQuery]);

  const [cloneSource, setCloneSource] = useState<SgTemplate | null>(null);
  const [cloneContent, setCloneContent] = useState('');
  const [cloneCtaUrl, setCloneCtaUrl] = useState('');
  const [cloneCtaText, setCloneCtaText] = useState('');
  // Notion import removed — workspace doesn't allow integration creation

  const handleCloneSubmit = async () => {
    if (!cloneSource) return;
    const cloneName = `${campaignName}`;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns/create-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cloneName,
          subject: subject.trim() || cloneName,
          cloneFromId: cloneSource.id,
          content: cloneContent.trim() || undefined,
          ctaUrl: cloneCtaUrl.trim() || undefined,
          ctaText: cloneCtaText.trim() || undefined,
          campaignSlug: campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      const data = await res.json();
      onSelect(data.templateId, cloneName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clone failed');
    }
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!templateName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns/create-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          subject: subject.trim() || undefined,
          content: content.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          ctaText: ctaText.trim() || undefined,
          campaignSlug: campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      const data = await res.json();
      onSelect(data.templateId, templateName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    }
    setCreating(false);
  };

  return (
    <div className="mt-2 border border-blue-200 rounded-lg bg-blue-50 p-3 space-y-2">
      <div className="flex gap-1 bg-white rounded-md p-0.5 border border-gray-200">
        <button
          onClick={() => setTplMode('pick')}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${tplMode === 'pick' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
        >
          Pick Template
        </button>
        <button
          onClick={() => setTplMode('create')}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${tplMode === 'create' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
        >
          Create New
        </button>
        <button
          onClick={() => setTplMode('existing')}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${tplMode === 'existing' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
        >
          Paste ID
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {tplMode === 'pick' ? (
        <>
          <input
            type="text"
            value={sgQuery}
            onChange={(e) => setSgQuery(e.target.value)}
            placeholder="Search templates by name, subject, or ID..."
            autoFocus
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {sgLoading ? (
            <p className="text-xs text-gray-400 py-3 text-center">Loading templates...</p>
          ) : sgTemplates.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">No templates found.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-blue-100 rounded border border-blue-100 bg-white">
              {sgTemplates.map((t) => (
                <div key={t.id}>
                  <div className="px-2.5 py-2 text-xs hover:bg-blue-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{t.name}</p>
                        {t.subject && <p className="text-gray-500 truncate mt-0.5">{t.subject}</p>}
                        <p className="text-gray-400 mt-0.5 font-mono">{t.id}</p>
                      </div>
                      <div className="flex gap-1.5 ml-2 flex-shrink-0">
                        <button
                          onClick={() => onSelect(t.id, t.name)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => setCloneSource(cloneSource?.id === t.id ? null : t)}
                          className={`px-2 py-1 border text-xs rounded transition-colors ${
                            cloneSource?.id === t.id
                              ? 'border-blue-600 bg-blue-100 text-blue-700'
                              : 'border-blue-300 text-blue-600 hover:bg-blue-100'
                          }`}
                        >
                          Clone
                        </button>
                      </div>
                    </div>
                  </div>
                  {cloneSource?.id === t.id && (
                    <div className="px-2.5 pb-2.5 space-y-2 bg-blue-50 border-t border-blue-100">
                      <p className="text-xs text-gray-600 pt-2">Cloning design from <strong>{t.name}</strong>. Add your new content:</p>
                      <textarea
                        value={cloneContent}
                        onChange={(e) => setCloneContent(e.target.value)}
                        placeholder="Paste or type your new content — hero title, body paragraphs, bullet points, sections. AI will replace the copy while keeping the design."
                        rows={4}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={cloneCtaUrl}
                          onChange={(e) => setCloneCtaUrl(e.target.value)}
                          placeholder="CTA URL"
                          className="px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <input
                          type="text"
                          value={cloneCtaText}
                          onChange={(e) => setCloneCtaText(e.target.value)}
                          placeholder="CTA button text"
                          className="px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCloneSubmit}
                          disabled={creating}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs rounded-md"
                        >
                          {creating ? 'Generating...' : (cloneContent.trim() ? 'Clone & Rewrite' : 'Clone As-Is')}
                        </button>
                        <button onClick={() => setCloneSource(null)} className="text-xs text-gray-500">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        </>
      ) : tplMode === 'create' ? (
        <>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name"
            autoFocus
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or type content — describe what the email should say. Include bullet points, sections, key messages. AI will generate branded Truv HTML from this."
            rows={5}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="CTA URL (e.g., https://truv.com/...)"
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="CTA button text"
              className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <p className="text-xs text-gray-400">
            {content.trim()
              ? 'AI will generate a branded Truv HTML email from your content and upload it to SendGrid.'
              : 'Add content above to auto-generate HTML, or leave blank to create an empty template.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!templateName.trim() || creating}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs rounded-md"
            >
              {creating ? (content.trim() ? 'Generating...' : 'Creating...') : (content.trim() ? 'Generate & Create' : 'Create Empty')}
            </button>
            <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </>
      ) : (
        <>
          <input
            type="text"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder="SendGrid Template ID (d-abc123...)"
            autoFocus
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name (optional)"
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { if (templateId.trim()) onSelect(templateId.trim(), templateName.trim() || templateId.trim()); }}
              disabled={!templateId.trim()}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs rounded-md"
            >
              Save
            </button>
            <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Workflow Editor (inline) ----

function WorkflowEditor({ current, onSave, onCancel }: { current: string; onSave: (key: string) => void; onCancel: () => void }) {
  const [workflowKey, setWorkflowKey] = useState(current);

  return (
    <div className="mt-2 border border-blue-200 rounded-lg bg-blue-50 p-3 space-y-2">
      <input
        type="text"
        value={workflowKey}
        onChange={(e) => setWorkflowKey(e.target.value)}
        placeholder="Knock workflow key"
        autoFocus
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
      <div className="flex gap-2">
        <button
          onClick={() => { if (workflowKey.trim()) onSave(workflowKey.trim()); }}
          disabled={!workflowKey.trim()}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs rounded-md"
        >
          Save
        </button>
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    </div>
  );
}

// ---- Main Component ----

export function CampaignResources({ campaign, onRefresh }: CampaignResourcesProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [editingField, setEditingField] = useState<'list' | 'template' | 'workflow' | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingRecipients(true);
    fetch(`/api/campaigns/${campaign.id}/recipients`)
      .then((r) => r.json())
      .then((data) => setRecipients(data.recipients || []))
      .catch(() => {})
      .finally(() => setLoadingRecipients(false));
  }, [campaign.id, campaign.audience?.knockAudienceKey]);

  const hubspotListId = campaign.audience?.hubspotListId;
  const knockAudienceKey = campaign.audience?.knockAudienceKey;
  const templateId = campaign.template?.sendgridTemplateId;
  const templateName = campaign.template?.name;
  const workflowKey = campaign.workflow?.knockWorkflowKey;
  const presetKey = campaign.preset?.key;

  const nextSend = (campaign.sends || [])
    .filter((s) => s.status === 'scheduled')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

  const saveField = async (updates: Partial<Campaign>) => {
    setSaving(true);
    try {
      await updateCampaign(campaign.id, updates);
      setEditingField(null);
      onRefresh();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleListSelect = (list: HubSpotList) => {
    saveField({
      audience: { ...campaign.audience, hubspotListId: list.id, count: list.size },
    });
  };

  const handleTemplateSelect = (id: string, name: string) => {
    saveField({
      template: { sendgridTemplateId: id, name },
    });
  };

  const handleWorkflowSave = (key: string) => {
    saveField({
      workflow: { ...campaign.workflow, knockWorkflowKey: key },
    });
  };

  const handleSyncAudience = async () => {
    setActionLoading('sync-audience');
    setActionError(null);
    try {
      const res = await fetch('/api/campaigns/sync-audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Sync failed');
    }
    setActionLoading(null);
  };

  const handleCreateWorkflow = async () => {
    setActionLoading('create-workflow');
    setActionError(null);
    try {
      const res = await fetch('/api/campaigns/create-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Creation failed');
    }
    setActionLoading(null);
  };

  const changeButton = (field: 'list' | 'template' | 'workflow') => (
    <button
      onClick={() => setEditingField(editingField === field ? null : field)}
      className="text-gray-300 hover:text-blue-600 transition-colors ml-1"
      title="Change"
    >
      <EditIcon />
    </button>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Campaign Resources</h3>
      </div>

      <div className="p-4 space-y-5">
        {saving && (
          <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">Saving...</div>
        )}
        {actionError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
          </div>
        )}

        {/* Resource Links Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* HubSpot List */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center">
              HubSpot List {changeButton('list')}
            </p>
            {hubspotListId ? (
              <div>
                <a
                  href={`https://app.hubspot.com/contacts/19933594/lists/${hubspotListId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  List #{hubspotListId} ↗
                </a>
                <p className="text-xs text-gray-500 mt-0.5">{campaign.audience?.count || 0} contacts</p>
              </div>
            ) : (
              <button onClick={() => setEditingField('list')} className="text-sm text-blue-600 hover:underline">+ Select a list</button>
            )}
            {editingField === 'list' && (
              <ListPicker current={hubspotListId || ''} onSelect={handleListSelect} onCancel={() => setEditingField(null)} />
            )}
          </div>

          {/* Knock Audience */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Knock Audience</p>
            {knockAudienceKey ? (
              <div>
                <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{knockAudienceKey}</code>
                <p className="text-xs text-gray-500 mt-0.5">{recipients.length || campaign.audience?.count || 0} members</p>
                {hubspotListId && (
                  <button
                    onClick={handleSyncAudience}
                    disabled={actionLoading === 'sync-audience'}
                    className="text-xs text-blue-600 hover:underline mt-1"
                  >
                    {actionLoading === 'sync-audience' ? 'Syncing...' : 'Re-sync from HubSpot'}
                  </button>
                )}
              </div>
            ) : hubspotListId ? (
              <button
                onClick={handleSyncAudience}
                disabled={actionLoading === 'sync-audience'}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-medium rounded-md transition-colors"
              >
                {actionLoading === 'sync-audience' ? 'Syncing...' : 'Sync from HubSpot'}
              </button>
            ) : (
              <p className="text-sm text-gray-400">Set a HubSpot list first</p>
            )}
          </div>

          {/* SendGrid Template */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center">
              SendGrid Template {changeButton('template')}
            </p>
            {templateId ? (
              <div>
                <a
                  href={`https://mc.sendgrid.com/dynamic-templates/${templateId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {templateName || templateId} ↗
                </a>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{templateId}</p>
              </div>
            ) : (
              <button onClick={() => setEditingField('template')} className="text-sm text-blue-600 hover:underline">+ Add template</button>
            )}
            {editingField === 'template' && (
              <TemplatePicker onSelect={handleTemplateSelect} onCancel={() => setEditingField(null)} campaignName={campaign.name} />
            )}
          </div>

          {/* Knock Workflow */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center">
              Knock Workflow {changeButton('workflow')}
            </p>
            {workflowKey ? (
              <div>
                <a
                  href={`https://dashboard.knock.app/truvhq/development/workflows/${workflowKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {workflowKey} ↗
                </a>
                {presetKey && (
                  <p className="text-xs text-gray-500 mt-0.5">Preset: <code className="bg-gray-100 px-1 rounded">{presetKey}</code></p>
                )}
              </div>
            ) : templateId ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateWorkflow}
                  disabled={actionLoading === 'create-workflow'}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-medium rounded-md transition-colors"
                >
                  {actionLoading === 'create-workflow' ? 'Creating...' : 'Create Workflow'}
                </button>
                <span className="text-gray-300">or</span>
                <button onClick={() => setEditingField('workflow')} className="text-xs text-blue-600 hover:underline">link existing</button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Add a SendGrid template first</p>
            )}
            {editingField === 'workflow' && (
              <WorkflowEditor current={workflowKey || ''} onSave={handleWorkflowSave} onCancel={() => setEditingField(null)} />
            )}
          </div>
        </div>

        {/* Next Scheduled Send */}
        {nextSend && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">⏳</span>
              <div>
                <p className="text-sm font-medium text-blue-800">Next send: {nextSend.name}</p>
                <p className="text-xs text-blue-600">
                  {new Date(nextSend.scheduledAt).toLocaleString()} · {nextSend.recipientCount || campaign.audience?.count || 0} recipients
                  {nextSend.audienceFilter?.type !== 'all' && ` · ${nextSend.audienceFilter.type.replace('_', '-')}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Status */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pipeline Status</p>
          <div className="flex gap-1">
            {(campaign.pipeline || []).map((stage) => (
              <div key={stage.stage} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  stage.status === 'success' ? 'bg-green-500' :
                  stage.status === 'error' ? 'bg-red-500' :
                  stage.status === 'executing' ? 'bg-yellow-500' :
                  'bg-gray-300'
                }`} />
                <span className={`text-xs ${
                  stage.status === 'success' ? 'text-green-700' :
                  stage.status === 'error' ? 'text-red-700' :
                  'text-gray-400'
                }`}>{stage.stage.replace('_', ' ')}</span>
                {stage !== campaign.pipeline[campaign.pipeline.length - 1] && (
                  <span className="text-gray-300 text-xs mx-0.5">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recipient Preview */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Recipients {recipients.length > 0 && `(${recipients.length})`}
          </p>
          {loadingRecipients ? (
            <p className="text-xs text-gray-400">Loading recipients...</p>
          ) : recipients.length === 0 ? (
            <p className="text-xs text-gray-400">No recipients found in Knock audience.</p>
          ) : (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-1.5 text-left font-medium">Email</th>
                    <th className="px-3 py-1.5 text-left font-medium">Name</th>
                    <th className="px-3 py-1.5 text-left font-medium">Company</th>
                    <th className="px-3 py-1.5 text-left font-medium">Title</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recipients.slice(0, 20).map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-900">{r.email}</td>
                      <td className="px-3 py-1.5 text-gray-700">{r.name || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.company || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.title || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recipients.length > 20 && (
                <div className="px-3 py-1.5 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">
                  Showing 20 of {recipients.length}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
