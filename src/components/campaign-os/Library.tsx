import { useState, useEffect } from 'react';
import { listBlocks, deleteBlock } from '../../services/campaignClient';
import type { BuildingBlock, BlockType } from '../../types/campaign';
import { BlockCard } from './BlockCard';

interface LibraryProps {
  onUseBlock: (block: BuildingBlock) => void;
}

export function Library({ onUseBlock }: LibraryProps) {
  const [blocks, setBlocks] = useState<BuildingBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BlockType>('audience');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    listBlocks().then(setBlocks).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (block: BuildingBlock) => {
    if (!confirm(`Delete "${block.name}"?`)) return;
    await deleteBlock(block.id);
    load();
  };

  const tabs: { id: BlockType; label: string }[] = [
    { id: 'audience', label: 'Audiences' },
    { id: 'template', label: 'Templates' },
    { id: 'workflow', label: 'Workflows' },
  ];

  const filtered = blocks
    .filter((b) => b.type === tab)
    .filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {t.label} ({blocks.filter((b) => b.type === t.id).length})
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center">No {tab} blocks saved yet. Complete a campaign to save reusable blocks.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((block) => (
            <BlockCard key={block.id} block={block} onUse={onUseBlock} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
