import { useState } from 'react';
import { motion } from 'framer-motion';
import type { AudienceFilterType, Send } from '../../types/campaign';

interface AddSendDrawerProps {
  existingSends: Send[];
  onAdd: (send: Partial<Send>) => Promise<void>;
  onClose: () => void;
}

export function AddSendDrawer({ existingSends, onAdd, onClose }: AddSendDrawerProps) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [filterType, setFilterType] = useState<AudienceFilterType>('all');
  const [relativeTo, setRelativeTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sentSends = existingSends.filter((s) => s.status === 'sent');

  const handleSubmit = async () => {
    if (!name || !scheduledDate) return;
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      await onAdd({ name, templateId, templateName, scheduledAt, audienceFilter: { type: filterType, relativeTo: relativeTo || undefined } });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }} className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Add Send</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Send Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., 24hr Reminder" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SendGrid Template ID</label>
          <input type="text" value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="d-abc123..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
          <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Optional display name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Audience Filter</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as AudienceFilterType)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All recipients</option>
            <option value="non_openers">Non-openers of a previous send</option>
            <option value="non_clickers">Non-clickers of a previous send</option>
          </select>
        </div>
        {(filterType === 'non_openers' || filterType === 'non_clickers') && sentSends.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relative to</label>
            <select value={relativeTo} onChange={(e) => setRelativeTo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select a send...</option>
              {sentSends.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-200">
        <button onClick={handleSubmit} disabled={!name || !scheduledDate || submitting} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors">
          {submitting ? 'Adding...' : 'Add Send'}
        </button>
      </div>
    </motion.div>
  );
}
