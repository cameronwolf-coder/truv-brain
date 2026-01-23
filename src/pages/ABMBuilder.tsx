import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ROIData, ScoredContact, GeneratedEmail, PersonaGroup, HubSpotContact } from '../types';
import { scoreContacts, getChampions, groupByPersona } from '../utils/championScoring';
import { generateAllEmails } from '../utils/abmEmailGenerator';
import segments from '../data/segments.json';

// Mock HubSpot data for now - will be replaced with actual API calls
const MOCK_CONTACTS: HubSpotContact[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    persona: 'cfo',
    lastOpenDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastClickDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastReplyDate: null,
    openCount: 8,
    clickCount: 3,
    replyCount: 0,
    associatedDeals: [{ id: 'd1', name: 'Enterprise Deal', stage: 'negotiation', amount: 50000, isClosed: false, isWon: false }],
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@example.com',
    persona: 'coo',
    lastOpenDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastClickDate: null,
    lastReplyDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    openCount: 5,
    clickCount: 1,
    replyCount: 1,
    associatedDeals: [],
  },
  {
    id: '3',
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike.johnson@example.com',
    persona: 'cto',
    lastOpenDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    lastClickDate: null,
    lastReplyDate: null,
    openCount: 2,
    clickCount: 0,
    replyCount: 0,
    associatedDeals: [],
  },
  {
    id: '4',
    firstName: 'Lisa',
    lastName: 'Wong',
    email: 'lisa.wong@example.com',
    persona: 'manager',
    lastOpenDate: null,
    lastClickDate: null,
    lastReplyDate: null,
    openCount: 0,
    clickCount: 0,
    replyCount: 0,
    associatedDeals: [],
  },
];

const PERSONA_LABELS: Record<string, string> = {};
segments.personas.forEach((p) => {
  PERSONA_LABELS[p.id] = p.label;
});

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'No activity';
  const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function ABMBuilder() {
  const location = useLocation();
  const navigate = useNavigate();
  const roiData = location.state?.roiData as ROIData | undefined;

  const [companySearch, setCompanySearch] = useState(roiData?.companyName || '');
  const [isSearching, setIsSearching] = useState(false);
  const [contacts, setContacts] = useState<ScoredContact[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [listCreated, setListCreated] = useState(false);

  // Redirect if no ROI data
  useEffect(() => {
    if (!roiData) {
      navigate('/roi-generator');
    }
  }, [roiData, navigate]);

  // Score and group contacts
  const scoredContacts = useMemo(() => scoreContacts(contacts), [contacts]);
  const champions = useMemo(() => getChampions(scoredContacts), [scoredContacts]);
  const personaGroups = useMemo(() => {
    const groups = groupByPersona(scoredContacts, PERSONA_LABELS);
    const result: PersonaGroup[] = [];
    groups.forEach((groupContacts, personaId) => {
      result.push({
        personaId,
        personaLabel: PERSONA_LABELS[personaId] || personaId,
        contacts: groupContacts,
        selected: selectedPersonas.has(personaId),
      });
    });
    return result.sort((a, b) => b.contacts.length - a.contacts.length);
  }, [scoredContacts, selectedPersonas]);

  const handleSearch = async () => {
    setIsSearching(true);
    // Simulate API call - will be replaced with actual HubSpot integration
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setContacts(scoreContacts(MOCK_CONTACTS));
    setIsSearching(false);
  };

  const togglePersona = (personaId: string) => {
    setSelectedPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) {
        next.delete(personaId);
      } else {
        next.add(personaId);
      }
      return next;
    });
  };

  const selectAllPersonas = () => {
    setSelectedPersonas(new Set(personaGroups.map((g) => g.personaId)));
  };

  const handleGenerateEmails = () => {
    if (!roiData) return;
    const selectedPersonaList = personaGroups
      .filter((g) => selectedPersonas.has(g.personaId))
      .map((g) => ({ id: g.personaId, label: g.personaLabel }));
    const emails = generateAllEmails(champions, selectedPersonaList, roiData);
    setGeneratedEmails(emails);
  };

  const handleCopyEmail = async (email: GeneratedEmail) => {
    const text = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(email.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = async () => {
    const text = generatedEmails
      .map((e) => `--- ${e.type === 'champion' ? `Champion: ${e.contactName}` : `${e.persona} - Email ${e.sequenceNumber}`} ---\n\nSubject: ${e.subject}\n\n${e.body}`)
      .join('\n\n\n');
    await navigator.clipboard.writeText(text);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateList = async () => {
    setIsCreatingList(true);
    // Simulate API call - will be replaced with actual HubSpot integration
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsCreatingList(false);
    setListCreated(true);
  };

  if (!roiData) return null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/roi-generator')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to ROI Generator
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">ABM Campaign Builder</h1>
        <p className="text-gray-500 mt-1">
          {roiData.companyName} • {formatCurrency(roiData.annualSavings)}/year potential savings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Company Search */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-medium text-gray-900 mb-4">Company Lookup</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                placeholder="Search HubSpot company..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !companySearch.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Search for the company in HubSpot to fetch contacts
            </p>
          </div>

          {/* Champions */}
          {contacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-medium text-gray-900 mb-4">
                {champions.some((c) => c.isChampion) ? 'Champions' : 'Best Bets'} ({champions.length})
              </h2>
              <div className="space-y-3">
                {champions.map((contact) => (
                  <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-500">★</span>
                          <span className="font-medium text-gray-900">
                            {contact.firstName} {contact.lastName}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {PERSONA_LABELS[contact.persona] || contact.persona} • Score: {contact.championScore}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <p>
                        {contact.lastActivityType
                          ? `${contact.lastActivityType.charAt(0).toUpperCase() + contact.lastActivityType.slice(1)} ${formatTimeAgo(contact.lastActivityDate)}`
                          : 'No recent activity'}
                      </p>
                      <p>
                        {contact.associatedDeals.length > 0
                          ? `Open deal: ${formatCurrency(contact.associatedDeals[0].amount)}`
                          : 'No active deals'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Persona Selection */}
          {contacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900">Contacts by Persona</h2>
                <button onClick={selectAllPersonas} className="text-sm text-blue-600 hover:text-blue-800">
                  Select All
                </button>
              </div>
              <div className="space-y-2">
                {personaGroups.map((group) => (
                  <label
                    key={group.personaId}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPersonas.has(group.personaId)}
                      onChange={() => togglePersona(group.personaId)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="flex-1 text-sm text-gray-700">{group.personaLabel}</span>
                    <span className="text-sm text-gray-400">({group.contacts.length})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Actions */}
          {contacts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-medium text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={handleGenerateEmails}
                  disabled={selectedPersonas.size === 0}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Generate Emails
                </button>
                <button
                  onClick={handleCreateList}
                  disabled={selectedPersonas.size === 0 || isCreatingList || listCreated}
                  className="w-full py-3 px-4 bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingList ? (
                    'Creating List...'
                  ) : listCreated ? (
                    <>
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      List Created!
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Create HubSpot List
                    </>
                  )}
                </button>
              </div>
              {selectedPersonas.size === 0 && (
                <p className="text-xs text-gray-500 mt-2 text-center">Select at least one persona to continue</p>
              )}
            </div>
          )}

          {/* Generated Emails */}
          {generatedEmails.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-gray-900">Generated Emails ({generatedEmails.length})</h2>
                <button
                  onClick={handleCopyAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {copiedId === 'all' ? 'Copied!' : 'Copy All'}
                </button>
              </div>
              <div className="space-y-2">
                {generatedEmails.map((email) => (
                  <div key={email.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {email.type === 'champion'
                            ? `Champion: ${email.contactName}`
                            : `${email.persona} - Email ${email.sequenceNumber}`}
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{email.subject}</p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedEmail === email.id ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedEmail === email.id && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        <p className="text-xs text-gray-500 mb-1">Subject:</p>
                        <p className="text-sm text-gray-900 mb-3">{email.subject}</p>
                        <p className="text-xs text-gray-500 mb-1">Body:</p>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded-lg">
                          {email.body}
                        </pre>
                        <button
                          onClick={() => handleCopyEmail(email)}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                        >
                          {copiedId === email.id ? 'Copied!' : 'Copy Email'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {contacts.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-600 mb-2">No contacts loaded</p>
              <p className="text-sm text-gray-500">
                Search for a company in HubSpot to see contacts and build your campaign
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
