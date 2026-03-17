import { useSearchParams } from 'react-router-dom';
import { Wizard } from '../components/campaign-os/Wizard';

function DashboardTab() {
  return (
    <div className="text-center py-20 text-gray-400">
      Dashboard — coming soon
    </div>
  );
}

function LibraryTab() {
  return (
    <div className="text-center py-20 text-gray-400">
      Building blocks library — coming soon
    </div>
  );
}

type Tab = 'dashboard' | 'new' | 'library';

export function CampaignOS() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'dashboard';

  const setTab = (t: Tab) => {
    setSearchParams(t === 'dashboard' ? {} : { tab: t });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'new', label: 'New Campaign' },
    { id: 'library', label: 'Library' },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Campaign OS</h1>
        <p className="text-gray-500 mt-1">
          Build, schedule, and monitor email campaigns
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'new' && <Wizard onComplete={() => setTab('dashboard')} />}
      {tab === 'library' && <LibraryTab />}
    </div>
  );
}
