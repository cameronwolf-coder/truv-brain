import type { BuildingBlock, TemplateConfig, WorkflowConfig, AudienceConfig } from '../../types/campaign';

interface BlockCardProps {
  block: BuildingBlock;
  onUse: (block: BuildingBlock) => void;
  onDelete: (block: BuildingBlock) => void;
}

export function BlockCard({ block, onUse, onDelete }: BlockCardProps) {
  const subtitle = () => {
    if (block.type === 'template') {
      const c = block.config as TemplateConfig;
      return c.sendgridTemplateId;
    }
    if (block.type === 'workflow') {
      const c = block.config as WorkflowConfig;
      return `${c.senderName} <${c.senderEmail}>`;
    }
    if (block.type === 'audience') {
      const c = block.config as AudienceConfig;
      return `${c.filters?.length || 0} filters`;
    }
    return '';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-900 text-sm">{block.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{subtitle()}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          block.type === 'audience' ? 'bg-purple-100 text-purple-700' :
          block.type === 'template' ? 'bg-blue-100 text-blue-700' :
          'bg-green-100 text-green-700'
        }`}>{block.type}</span>
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
        {block.usedCount > 0 && <span>Used {block.usedCount}x</span>}
        {block.lastUsed && <span>Last: {new Date(block.lastUsed).toLocaleDateString()}</span>}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onUse(block)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">Use in Campaign</button>
        <button onClick={() => onDelete(block)} className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors">Delete</button>
      </div>
    </div>
  );
}
