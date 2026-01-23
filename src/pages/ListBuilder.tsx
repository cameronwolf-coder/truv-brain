import { useState, useMemo, useCallback } from 'react';
import segments from '../data/segments.json';

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  jobtitle: string;
  company: string;
  companyId: string;
  lifecyclestage: string;
  vertical: string;
  employees: number | null;
  matchedPersona?: string | null;
  lastActivity?: string | null;
}

interface CompanyGroup {
  id: string;
  name: string;
  vertical: string;
  contactCount: number;
  employees: number | null;
  contacts: Contact[];
}

// Persona job title patterns for matching
const PERSONA_PATTERNS: Record<string, string[]> = {
  coo: ['COO', 'Chief Operating Officer', 'Chief Operating'],
  cfo: ['CFO', 'Chief Financial', 'VP Finance', 'Controller', 'Finance Director'],
  other_exec: ['EVP', 'SVP', 'Senior Vice President', 'Executive Vice President'],
  cto: ['CTO', 'Chief Technology', 'VP Engineering', 'CIO', 'IT Director', 'VP Technology'],
  manager: ['Manager', 'Director', 'Team Lead', 'Supervisor'],
  ceo: ['CEO', 'Chief Executive', 'Founder', 'President', 'Owner', 'Principal'],
  vp_product: ['VP Product', 'Head of Product', 'Product Director', 'Chief Product'],
  vp_underwriting: ['VP Underwriting', 'Chief Credit', 'Underwriting Director', 'Head of Underwriting'],
  vp_lending: ['VP Lending', 'VP Mortgage', 'Lending Director', 'Mortgage Director', 'Head of Lending'],
};

// Persona labels for display
const PERSONA_LABELS: Record<string, string> = {
  coo: 'COO/Chief Operating',
  cfo: 'CFO/Finance',
  ceo: 'CEO/Founder',
  cto: 'CTO/VP Engineering',
  vp_lending: 'VP Lending',
  vp_underwriting: 'VP Underwriting',
  vp_product: 'VP Product',
  manager: 'Manager/Director',
  other_exec: 'Other Executive',
  other: 'Other Title',
  no_title: 'No Title',
};

// Industries from Truv's verticals
const VERTICALS = segments.verticals.map((v) => ({
  id: v.id,
  label: v.label,
  count: v.contacts,
}));

type Step = 'vertical' | 'company' | 'persona' | 'review';

// Match persona from job title
function matchPersona(jobtitle: string | undefined): string {
  if (!jobtitle || jobtitle.trim() === '') return 'no_title';

  const lowerTitle = jobtitle.toLowerCase();

  for (const [persona, patterns] of Object.entries(PERSONA_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerTitle.includes(pattern.toLowerCase())) {
        return persona;
      }
    }
  }

  return 'other';
}

export function ListBuilder() {
  // Current step in the filter pipeline
  const [currentStep, setCurrentStep] = useState<Step>('vertical');

  // Step 1: Vertical filter
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);

  // Step 2: Companies (grouped from contacts)
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [selectedCompanyNames, setSelectedCompanyNames] = useState<Set<string>>(new Set());
  const [employeesMin, setEmployeesMin] = useState<number | undefined>();
  const [employeesMax, setEmployeesMax] = useState<number | undefined>();
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [totalContacts, setTotalContacts] = useState(0);

  // Step 3: Persona filters
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [requireTitle, setRequireTitle] = useState(true);

  // Step 4: Review
  const [excludedContactIds, setExcludedContactIds] = useState<Set<string>>(new Set());
  const [listName, setListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{
    success: boolean;
    listId?: string;
    count?: number;
    error?: string;
  } | null>(null);

  // Computed: Filtered companies based on employee size
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (employeesMin && (c.employees === null || c.employees < employeesMin)) return false;
      if (employeesMax && (c.employees === null || c.employees > employeesMax)) return false;
      return true;
    });
  }, [companies, employeesMin, employeesMax]);

  // Computed: Selected companies (or all if none selected)
  const activeCompanies = useMemo(() => {
    if (selectedCompanyNames.size === 0) return filteredCompanies;
    return filteredCompanies.filter((c) => selectedCompanyNames.has(c.name));
  }, [filteredCompanies, selectedCompanyNames]);

  // Computed: All contacts from active companies with persona matching
  const allContactsWithPersona = useMemo(() => {
    const contacts: (Contact & { matchedPersona: string })[] = [];
    for (const company of activeCompanies) {
      for (const contact of company.contacts) {
        contacts.push({
          ...contact,
          matchedPersona: matchPersona(contact.jobtitle),
        });
      }
    }
    return contacts;
  }, [activeCompanies]);

  // Computed: Contacts filtered by persona and title requirement
  const filteredContacts = useMemo(() => {
    return allContactsWithPersona.filter((c) => {
      // Filter by title requirement
      if (requireTitle && c.matchedPersona === 'no_title') return false;

      // Filter by selected personas
      if (selectedPersonas.length > 0 && !selectedPersonas.includes(c.matchedPersona)) {
        return false;
      }

      return true;
    });
  }, [allContactsWithPersona, selectedPersonas, requireTitle]);

  // Computed: Final contacts (after exclusions)
  const finalContacts = useMemo(() => {
    return filteredContacts.filter((c) => !excludedContactIds.has(c.id));
  }, [filteredContacts, excludedContactIds]);

  // Computed: Persona breakdown from all contacts
  const personaBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    for (const contact of allContactsWithPersona) {
      breakdown[contact.matchedPersona] = (breakdown[contact.matchedPersona] || 0) + 1;
    }
    return breakdown;
  }, [allContactsWithPersona]);

  // Step 1: Load companies by vertical
  const loadCompanies = useCallback(async () => {
    if (selectedVerticals.length === 0) return;

    setIsLoadingCompanies(true);
    setCompanies([]);
    setSelectedCompanyNames(new Set());

    try {
      const response = await fetch('/api/search-by-vertical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verticals: selectedVerticals,
          limit: 1000,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCompanies(data.companies);
        setTotalContacts(data.totalContacts);
        setCurrentStep('company');
      }
    } catch (err) {
      console.error('Error loading companies:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  }, [selectedVerticals]);

  // Move to persona step
  const goToPersona = () => {
    setSelectedPersonas([]);
    setCurrentStep('persona');
  };

  // Move to review step
  const goToReview = useCallback(() => {
    setExcludedContactIds(new Set());
    // Generate default list name
    const date = new Date().toISOString().split('T')[0];
    const verticalLabel =
      selectedVerticals.length === 1 ? selectedVerticals[0] : 'Multi-Vertical';
    const personaLabel =
      selectedPersonas.length === 1
        ? PERSONA_LABELS[selectedPersonas[0]] || selectedPersonas[0]
        : selectedPersonas.length > 1
          ? 'Multi-Persona'
          : 'All Personas';
    setListName(`${verticalLabel} - ${personaLabel} - ${date}`);
    setCurrentStep('review');
  }, [selectedVerticals, selectedPersonas]);

  // Toggle vertical selection
  const toggleVertical = (verticalId: string) => {
    setSelectedVerticals((prev) =>
      prev.includes(verticalId) ? prev.filter((v) => v !== verticalId) : [...prev, verticalId]
    );
  };

  // Toggle company selection
  const toggleCompany = (companyName: string) => {
    setSelectedCompanyNames((prev) => {
      const next = new Set(prev);
      if (next.has(companyName)) {
        next.delete(companyName);
      } else {
        next.add(companyName);
      }
      return next;
    });
  };

  // Select all / none companies
  const selectAllCompanies = () => {
    setSelectedCompanyNames(new Set(filteredCompanies.map((c) => c.name)));
  };
  const selectNoCompanies = () => {
    setSelectedCompanyNames(new Set());
  };

  // Toggle persona selection
  const togglePersona = (personaId: string) => {
    setSelectedPersonas((prev) =>
      prev.includes(personaId) ? prev.filter((p) => p !== personaId) : [...prev, personaId]
    );
  };

  // Toggle contact exclusion
  const toggleContactExclusion = (contactId: string) => {
    setExcludedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  // Create HubSpot list
  const handleCreateList = useCallback(async () => {
    if (!listName.trim() || finalContacts.length === 0) return;

    setIsCreating(true);
    setCreateResult(null);

    try {
      const response = await fetch('/api/create-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName,
          contactIds: finalContacts.map((c) => c.id),
        }),
      });

      const data = await response.json();
      setCreateResult(data);
    } catch (err) {
      setCreateResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsCreating(false);
    }
  }, [listName, finalContacts]);

  // Reset all
  const handleReset = () => {
    setCurrentStep('vertical');
    setSelectedVerticals([]);
    setCompanies([]);
    setSelectedCompanyNames(new Set());
    setEmployeesMin(undefined);
    setEmployeesMax(undefined);
    setTotalContacts(0);
    setSelectedPersonas([]);
    setRequireTitle(true);
    setExcludedContactIds(new Set());
    setListName('');
    setCreateResult(null);
  };

  // Step indicator component
  const StepIndicator = () => {
    const steps = [
      { key: 'vertical', label: 'Vertical', num: 1 },
      { key: 'company', label: 'Companies', num: 2 },
      { key: 'persona', label: 'Personas', num: 3 },
      { key: 'review', label: 'Review', num: 4 },
    ];

    const currentIdx = steps.findIndex((s) => s.key === currentStep);

    return (
      <div className="flex items-center gap-2 mb-6">
        {steps.map((step, idx) => {
          const isActive = currentStep === step.key;
          const isPast = idx < currentIdx;
          const canClick = isPast;

          return (
            <div key={step.key} className="flex items-center">
              {idx > 0 && (
                <div
                  className={`w-8 h-0.5 ${isPast || isActive ? 'bg-blue-500' : 'bg-gray-200'}`}
                />
              )}
              <button
                onClick={() => canClick && setCurrentStep(step.key as Step)}
                disabled={!canClick}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isPast
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    isActive
                      ? 'bg-white text-blue-600'
                      : isPast
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-gray-500'
                  }`}
                >
                  {isPast ? '✓' : step.num}
                </span>
                {step.label}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // Live count badge
  const CountBadge = ({ count, label }: { count: number; label: string }) => (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
      <span className="text-lg font-bold text-blue-700">{count.toLocaleString()}</span>
      <span className="text-sm text-blue-600">{label}</span>
    </div>
  );

  // Filter summary sidebar
  const FilterSummary = () => (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        Current Filters
      </p>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Verticals:</span>
          <span className="font-medium text-gray-900">
            {selectedVerticals.length === 0
              ? 'None'
              : selectedVerticals.length === 1
                ? selectedVerticals[0]
                : `${selectedVerticals.length} selected`}
          </span>
        </div>
        {currentStep !== 'vertical' && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Companies:</span>
            <span className="font-medium text-gray-900">
              {selectedCompanyNames.size === 0
                ? `All ${filteredCompanies.length}`
                : `${selectedCompanyNames.size} of ${filteredCompanies.length}`}
            </span>
          </div>
        )}
        {(currentStep === 'persona' || currentStep === 'review') && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Personas:</span>
              <span className="font-medium text-gray-900">
                {selectedPersonas.length === 0
                  ? 'All'
                  : `${selectedPersonas.length} selected`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Require title:</span>
              <span className="font-medium text-gray-900">{requireTitle ? 'Yes' : 'No'}</span>
            </div>
          </>
        )}
        <div className="pt-2 border-t border-gray-200 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-medium">Contacts:</span>
            <span className="font-bold text-blue-600">
              {currentStep === 'vertical'
                ? '—'
                : currentStep === 'company'
                  ? allContactsWithPersona.length.toLocaleString()
                  : filteredContacts.length.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">List Builder</h1>
            <p className="text-gray-500 mt-1">
              Build targeted HubSpot lists with visible filter logic
            </p>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator />

      {/* Filter Summary - shown on all steps after first */}
      {currentStep !== 'vertical' && <FilterSummary />}

      {/* Step 1: Vertical Selection */}
      {currentStep === 'vertical' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Step 1: Select Verticals</h2>
              <p className="text-sm text-gray-500">
                Choose one or more verticals (industries) to target
              </p>
            </div>
            <CountBadge count={selectedVerticals.length} label="selected" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {VERTICALS.map((vertical) => {
              const isSelected = selectedVerticals.includes(vertical.id);
              return (
                <button
                  key={vertical.id}
                  onClick={() => toggleVertical(vertical.id)}
                  className={`p-4 text-left rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                    {vertical.label}
                  </p>
                  <p className="text-sm text-gray-500">
                    ~{vertical.count.toLocaleString()} contacts
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={loadCompanies}
              disabled={selectedVerticals.length === 0 || isLoadingCompanies}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {isLoadingCompanies ? 'Loading...' : 'Next: Filter Companies'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Company Selection */}
      {currentStep === 'company' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Step 2: Filter Companies</h2>
              <p className="text-sm text-gray-500">
                {totalContacts.toLocaleString()} contacts from {companies.length} companies
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CountBadge count={activeCompanies.length} label="companies" />
              <CountBadge count={allContactsWithPersona.length} label="contacts" />
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Min Employees</label>
              <input
                type="number"
                value={employeesMin || ''}
                onChange={(e) =>
                  setEmployeesMin(e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="e.g., 50"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Max Employees</label>
              <input
                type="number"
                value={employeesMax || ''}
                onChange={(e) =>
                  setEmployeesMax(e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="e.g., 5000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="pt-5">
              <span className="text-sm text-gray-500">{filteredCompanies.length} matching</span>
            </div>
          </div>

          {/* Company List */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                {selectedCompanyNames.size === 0
                  ? `All ${filteredCompanies.length} companies selected`
                  : `${selectedCompanyNames.size} of ${filteredCompanies.length} companies selected`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllCompanies}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  onClick={selectNoCompanies}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="w-10 px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedCompanyNames.size === 0 ||
                          selectedCompanyNames.size === filteredCompanies.length
                        }
                        onChange={(e) =>
                          e.target.checked ? selectNoCompanies() : selectAllCompanies()
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Company
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Vertical
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Contacts
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Employees
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCompanies.slice(0, 100).map((company) => {
                    const isSelected =
                      selectedCompanyNames.size === 0 || selectedCompanyNames.has(company.name);
                    return (
                      <tr
                        key={company.name}
                        onClick={() => toggleCompany(company.name)}
                        className={`cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCompany(company.name)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">
                          {company.name}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">{company.vertical}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">
                          {company.contactCount}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 text-right">
                          {company.employees?.toLocaleString() || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCompanies.length > 100 && (
                <div className="p-2 text-center text-xs text-gray-500 bg-gray-50">
                  Showing 100 of {filteredCompanies.length} companies
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setCurrentStep('vertical')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={goToPersona}
              disabled={activeCompanies.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              Next: Filter by Persona
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Persona Selection */}
      {currentStep === 'persona' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Step 3: Filter by Persona</h2>
              <p className="text-sm text-gray-500">
                {allContactsWithPersona.length.toLocaleString()} contacts from{' '}
                {activeCompanies.length} companies
              </p>
            </div>
            <CountBadge count={filteredContacts.length} label="contacts" />
          </div>

          {/* Title requirement toggle */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requireTitle}
                onChange={(e) => setRequireTitle(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium">Only include contacts with job titles</span>
              <span className="text-gray-500">
                ({personaBreakdown['no_title'] || 0} without titles)
              </span>
            </label>
          </div>

          {/* Persona breakdown */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">
              {selectedPersonas.length === 0
                ? 'All personas included. Click to filter:'
                : `Filtering by ${selectedPersonas.length} persona(s):`}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(personaBreakdown)
                .filter(([persona]) => persona !== 'no_title' || !requireTitle)
                .sort(([, a], [, b]) => b - a)
                .map(([persona, count]) => {
                  const isSelected =
                    selectedPersonas.length === 0 || selectedPersonas.includes(persona);
                  const isFiltered = selectedPersonas.length > 0 && !isSelected;

                  return (
                    <button
                      key={persona}
                      onClick={() => togglePersona(persona)}
                      disabled={persona === 'no_title' && requireTitle}
                      className={`p-3 rounded-lg text-left transition-colors ${
                        isFiltered
                          ? 'bg-gray-100 opacity-50'
                          : isSelected && selectedPersonas.length > 0
                            ? 'bg-blue-100 border-2 border-blue-300'
                            : 'bg-gray-100 hover:bg-gray-200'
                      } ${persona === 'no_title' && requireTitle ? 'cursor-not-allowed' : ''}`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          isFiltered ? 'text-gray-400 line-through' : 'text-gray-900'
                        }`}
                      >
                        {PERSONA_LABELS[persona] || persona}
                      </p>
                      <p className="text-xs text-gray-500">{count.toLocaleString()} contacts</p>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Sample contacts preview */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Sample contacts ({filteredContacts.length}):</p>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Title
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Company
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Persona
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredContacts.slice(0, 20).map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <p className="text-sm font-medium text-gray-900">
                          {contact.firstname} {contact.lastname}
                        </p>
                        <p className="text-xs text-gray-500">{contact.email}</p>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {contact.jobtitle || '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">{contact.company || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          {PERSONA_LABELS[contact.matchedPersona] || contact.matchedPersona}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setCurrentStep('company')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={goToReview}
              disabled={filteredContacts.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              Next: Review & Create List
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Create */}
      {currentStep === 'review' && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Step 4: Review & Create List</h2>
              <CountBadge count={finalContacts.length} label="final contacts" />
            </div>

            {/* Filter Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Filter Logic Applied:</p>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">1. Verticals:</span>{' '}
                  {selectedVerticals.join(', ')}
                </p>
                <p>
                  <span className="font-medium">2. Companies:</span>{' '}
                  {selectedCompanyNames.size === 0
                    ? `All ${filteredCompanies.length}`
                    : `${selectedCompanyNames.size} of ${filteredCompanies.length}`}
                  {employeesMin || employeesMax
                    ? ` (${employeesMin || 0}–${employeesMax || '∞'} employees)`
                    : ''}
                </p>
                <p>
                  <span className="font-medium">3. Personas:</span>{' '}
                  {selectedPersonas.length === 0
                    ? 'All'
                    : selectedPersonas.map((p) => PERSONA_LABELS[p] || p).join(', ')}
                </p>
                <p>
                  <span className="font-medium">4. Job title required:</span>{' '}
                  {requireTitle ? 'Yes' : 'No'}
                </p>
                <p>
                  <span className="font-medium">5. Excluded stages:</span> Opportunity, Customer,
                  Disqualified
                </p>
              </div>
            </div>

            {/* Excluded contacts */}
            {excludedContactIds.size > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  {excludedContactIds.size} contacts manually excluded
                  <button
                    onClick={() => setExcludedContactIds(new Set())}
                    className="ml-2 text-red-600 hover:text-red-800 underline"
                  >
                    Clear exclusions
                  </button>
                </p>
              </div>
            )}

            {/* Final contact list */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Final contacts (click to exclude):</p>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={excludedContactIds.size === 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExcludedContactIds(new Set());
                            } else {
                              setExcludedContactIds(new Set(filteredContacts.map((c) => c.id)));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Title
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Company
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Vertical
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredContacts.map((contact) => {
                      const isExcluded = excludedContactIds.has(contact.id);
                      return (
                        <tr
                          key={contact.id}
                          onClick={() => toggleContactExclusion(contact.id)}
                          className={`cursor-pointer ${
                            isExcluded ? 'bg-gray-50 opacity-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => toggleContactExclusion(contact.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <p
                              className={`text-sm font-medium ${
                                isExcluded ? 'text-gray-400 line-through' : 'text-gray-900'
                              }`}
                            >
                              {contact.firstname} {contact.lastname}
                            </p>
                            <p className="text-xs text-gray-500">{contact.email}</p>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {contact.jobtitle || '—'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {contact.company || '—'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {contact.vertical || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Create List Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 mb-4">Create HubSpot List</h3>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">List Name</label>
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Enter list name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Success */}
            {createResult?.success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-900">List Created!</p>
                <p className="text-sm text-green-700 mt-1">
                  {createResult.count} contacts added to "{listName}"
                </p>
                <a
                  href={`https://app.hubspot.com/contacts/lists/${createResult.listId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-green-700 hover:text-green-800"
                >
                  Open in HubSpot →
                </a>
              </div>
            )}

            {/* Error */}
            {createResult && !createResult.success && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-900">Failed to create list</p>
                <p className="text-sm text-red-600 mt-1">{createResult.error}</p>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('persona')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateList}
                disabled={isCreating || !listName.trim() || finalContacts.length === 0}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
              >
                {isCreating
                  ? 'Creating...'
                  : `Create List with ${finalContacts.length} Contacts`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
