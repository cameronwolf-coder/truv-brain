import { useState, useMemo, useCallback } from 'react';
import segments from '../data/segments.json';
import templates from '../data/templates.json';
import painPointMapping from '../data/painPointMapping.json';
import proofPoints from '../data/proofPoints.json';

type ProofPoint = {
  id: string;
  customer: string;
  vertical: string;
  metrics: { value: string; label: string; type: string }[];
  quotes: { text: string; author: string; title: string }[];
};

type ZoneConfig = { placeholder: string; prompt: string };

type Template = {
  touch: number;
  day: number;
  subject: string;
  body: string;
  zones: Record<string, ZoneConfig>;
};

type CampaignType = 'closed_loss' | 'vertical' | 'persona' | 'product' | 'case_study';

type TemplatesByType = Record<CampaignType, { touches: Template[] }>;

const campaignTypes = [
  { id: 'closed_loss' as const, label: 'Closed Loss Re-engagement', description: 'Target contacts by objection reason' },
  { id: 'vertical' as const, label: 'Vertical Campaign', description: 'Target an entire industry segment' },
  { id: 'persona' as const, label: 'Persona Campaign', description: 'Target by job role across verticals' },
  { id: 'product' as const, label: 'Product-Led Campaign', description: 'Target by product interest' },
  { id: 'case_study' as const, label: 'Case Study Campaign', description: 'Share a specific customer story' },
];

export function EmailBuilder() {
  const [campaignType, setCampaignType] = useState<CampaignType>('closed_loss');
  const [vertical, setVertical] = useState(segments.verticals[0].id);
  const [objection, setObjection] = useState(segments.objections[0].id);
  const [persona, setPersona] = useState(segments.personas[0].id);
  const [product, setProduct] = useState((segments as { products: { id: string }[] }).products[0].id);
  const [caseStudy, setCaseStudy] = useState((proofPoints as ProofPoint[])[0].id);
  const [touch, setTouch] = useState(1);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [listCreating, setListCreating] = useState(false);
  const [listResult, setListResult] = useState<{ success: boolean; listId?: string; listName?: string; count?: number; error?: string } | null>(null);

  // Get relevant proof points for selected segment
  const relevantProofPointIds = useMemo(() => {
    const mapping = painPointMapping as Record<string, Record<string, string[]>>;
    return mapping[objection]?.[vertical] || [];
  }, [vertical, objection]);

  const relevantProofPoints = useMemo(() => {
    return (proofPoints as ProofPoint[]).filter((pp) =>
      relevantProofPointIds.includes(pp.id)
    );
  }, [relevantProofPointIds]);

  // Get the best proof point for this segment
  const bestProofPoint = relevantProofPoints[0];

  // Get selected case study
  const selectedCaseStudy = useMemo(() => {
    return (proofPoints as ProofPoint[]).find((pp) => pp.id === caseStudy);
  }, [caseStudy]);

  // Get selected template based on campaign type
  const selectedTemplate = useMemo(() => {
    const typedTemplates = templates as TemplatesByType;
    return typedTemplates[campaignType]?.touches.find((t) => t.touch === touch);
  }, [campaignType, touch]);

  // Get objection summary
  const objectionSummary =
    segments.objections.find((o) => o.id === objection)?.summary || objection;

  // Calculate estimated audience size based on campaign type
  const estimatedAudience = useMemo(() => {
    const verticalData = segments.verticals.find((v) => v.id === vertical) as { contacts: number } | undefined;
    const objectionData = segments.objections.find((o) => o.id === objection) as { pct: number } | undefined;
    const personaData = segments.personas.find((p) => p.id === persona) as { pct: number } | undefined;
    const productData = (segments as { products: { id: string; pct: number }[] }).products.find((p) => p.id === product);
    const totalContacts = segments.verticals.reduce((sum, v) => sum + (v as { contacts: number }).contacts, 0);

    if (campaignType === 'closed_loss') {
      if (!verticalData || !objectionData || !personaData) return 0;
      return Math.round(verticalData.contacts * objectionData.pct * personaData.pct);
    } else if (campaignType === 'vertical') {
      if (!verticalData || !personaData) return 0;
      return Math.round(verticalData.contacts * personaData.pct);
    } else if (campaignType === 'persona') {
      if (!personaData) return 0;
      return Math.round(totalContacts * personaData.pct);
    } else if (campaignType === 'product') {
      // product campaign - by product interest across all contacts
      if (!productData || !personaData) return 0;
      return Math.round(totalContacts * productData.pct * personaData.pct);
    } else {
      // case_study campaign - target by vertical matching the case study
      if (!personaData) return 0;
      // For case studies, we target all contacts in matching vertical or all if no match
      const caseStudyVertical = selectedCaseStudy?.vertical;
      const matchingVertical = segments.verticals.find(
        (v) => v.id.toLowerCase() === caseStudyVertical?.toLowerCase() ||
               v.label.toLowerCase().includes(caseStudyVertical?.toLowerCase() || '')
      ) as { contacts: number } | undefined;
      const baseContacts = matchingVertical?.contacts || totalContacts;
      return Math.round(baseContacts * personaData.pct);
    }
  }, [vertical, objection, persona, product, caseStudy, campaignType, selectedCaseStudy]);

  // Calculate segment quality score based on persona performance data
  const segmentQuality = useMemo(() => {
    const personaData = segments.personas.find((p) => p.id === persona) as {
      replyRate?: number;
      conversionScore?: number;
      priority?: number;
    } | undefined;

    if (!personaData) return { score: 0, label: 'Unknown', color: 'gray' };

    const replyRate = personaData.replyRate || 0;
    const conversionScore = personaData.conversionScore || 0;
    const priority = personaData.priority || 5;

    // Calculate weighted score (0-100)
    // Reply rate contributes 40%, conversion score 40%, priority 20%
    const normalizedReply = Math.min(replyRate * 100, 100); // 0-100
    const normalizedConversion = Math.min(conversionScore * 8, 100); // Scale to 0-100
    const normalizedPriority = ((6 - priority) / 5) * 100; // Priority 1 = 100, Priority 5 = 20

    const score = Math.round(
      normalizedReply * 0.4 +
      normalizedConversion * 0.4 +
      normalizedPriority * 0.2
    );

    let label = 'Low';
    let color = 'red';
    if (score >= 70) {
      label = 'Excellent';
      color = 'green';
    } else if (score >= 50) {
      label = 'Good';
      color = 'blue';
    } else if (score >= 30) {
      label = 'Fair';
      color = 'yellow';
    }

    return { score, label, color, replyRate, conversionScore, priority };
  }, [persona]);

  // Generate recommended personas based on scores
  const recommendedPersonas = useMemo(() => {
    const personasWithScores = segments.personas.map((p) => {
      const data = p as { id: string; label: string; replyRate?: number; conversionScore?: number; priority?: number };
      const replyRate = data.replyRate || 0;
      const conversionScore = data.conversionScore || 0;
      const priority = data.priority || 5;

      const score = Math.round(
        (replyRate * 100) * 0.4 +
        Math.min(conversionScore * 8, 100) * 0.4 +
        ((6 - priority) / 5) * 100 * 0.2
      );

      return { ...data, score };
    });

    return personasWithScores.sort((a, b) => b.score - a.score);
  }, []);

  // Generate list name
  const listName = useMemo(() => {
    return `${campaignType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${
      segments.personas.find(p => p.id === persona)?.label || persona
    }${vertical && campaignType !== 'persona' ? ` - ${segments.verticals.find(v => v.id === vertical)?.label || vertical}` : ''
    } - ${new Date().toISOString().split('T')[0]}`;
  }, [campaignType, persona, vertical]);

  // Create HubSpot list via API
  const createHubSpotList = useCallback(async () => {
    setListCreating(true);
    setListResult(null);

    try {
      const payload = {
        name: listName,
        campaignType,
        persona,
        vertical: campaignType === 'closed_loss' || campaignType === 'vertical' ? vertical : undefined,
        objection: campaignType === 'closed_loss' ? objection : undefined,
        product: campaignType === 'product' ? product : undefined,
        limit: Math.min(estimatedAudience > 0 ? estimatedAudience : 100, 500),
      };

      const response = await fetch('/api/create-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success && data.listId) {
        setListResult({
          success: true,
          listId: data.listId,
          listName: data.listName || listName,
          count: data.count || 0,
        });
      } else {
        setListResult({
          success: false,
          error: data.error || 'Failed to create list',
        });
      }
    } catch (err) {
      setListResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setListCreating(false);
    }
  }, [listName, campaignType, persona, vertical, objection, product, estimatedAudience]);

  // Build the email preview with variable substitution
  const buildEmailPreview = () => {
    if (!selectedTemplate) return { subject: '', body: '' };

    // Get data based on campaign type
    const verticalLabel = segments.verticals.find((v) => v.id === vertical)?.label || vertical;
    const personaLabel = segments.personas.find((p) => p.id === persona)?.label || persona;
    const productLabel = (segments as { products: { id: string; label: string }[] }).products.find((p) => p.id === product)?.label || product;

    // Determine proof point source based on campaign type
    const proofSource = (campaignType === 'case_study' || campaignType === 'product')
      ? selectedCaseStudy
      : bestProofPoint;
    const proofCompany = proofSource?.customer || '[Customer]';
    const proofMetric = proofSource?.metrics[0]
      ? `${proofSource.metrics[0].value} ${proofSource.metrics[0].label}`
      : '[metric]';
    const proofQuote = proofSource?.quotes[0]
      ? `"${proofSource.quotes[0].text}" — ${proofSource.quotes[0].author}, ${proofSource.quotes[0].title}`
      : '';

    // Variable substitution map
    const replacements: Record<string, string> = {
      '{{vertical}}': verticalLabel.toLowerCase(),
      '{{persona}}': personaLabel,
      '{{product}}': productLabel,
      '{{proof_company}}': proofCompany,
      '{{proof_metric}}': proofMetric,
      '{{quote}}': proofQuote,
      '{{objection_summary}}': objectionSummary,
      '{{company}}': '{{company}}', // Keep as Clay variable
    };

    // For case study campaigns, use the case study's vertical
    if (campaignType === 'case_study' && selectedCaseStudy) {
      replacements['{{vertical}}'] = selectedCaseStudy.vertical?.toLowerCase() || verticalLabel.toLowerCase();
    }

    let subject = selectedTemplate.subject;
    let body = selectedTemplate.body;

    // Apply all replacements
    Object.entries(replacements).forEach(([key, value]) => {
      subject = subject.split(key).join(value);
      body = body.split(key).join(value);
    });

    return { subject, body };
  };

  const { subject, body } = buildEmailPreview();

  const copyAll = async () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPrompt = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt);
  };

  // Render body with clickable zones
  const renderBody = () => {
    if (!selectedTemplate) return null;

    const parts = body.split(/({{clay\.[^}]+}})/g);

    return parts.map((part, index) => {
      const zoneMatch = part.match(/{{clay\.([^}]+)}}/);
      if (zoneMatch) {
        const zoneName = zoneMatch[1];
        const zoneKey = zoneName.replace('clay.', '');
        const zoneConfig = selectedTemplate.zones[zoneKey];
        const isExpanded = expandedZone === zoneKey;

        return (
          <span key={index} className="inline">
            <button
              onClick={() => setExpandedZone(isExpanded ? null : zoneKey)}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-sm font-mono hover:bg-amber-200 transition-colors"
            >
              {part}
              <span className="text-amber-600 text-xs">?</span>
            </button>
            {isExpanded && zoneConfig && (
              <div className="block my-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-amber-900 mb-1">Clay Prompt:</p>
                    <p className="text-amber-800">{zoneConfig.prompt}</p>
                  </div>
                  <button
                    onClick={() => copyPrompt(zoneConfig.prompt)}
                    className="px-2 py-1 text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 rounded transition-colors whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Email Builder</h1>
        <p className="text-gray-500 mt-1">
          Generate segment-specific email templates for Clay
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Selectors */}
        <div>
          {/* Step 1: Campaign Type */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="font-medium text-gray-900 mb-4">
              Step 1: Campaign Type
            </h2>
            <div className="space-y-2">
              {campaignTypes.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setCampaignType(ct.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    campaignType === ct.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <p className={`font-medium ${campaignType === ct.id ? 'text-blue-900' : 'text-gray-900'}`}>
                    {ct.label}
                  </p>
                  <p className={`text-sm ${campaignType === ct.id ? 'text-blue-700' : 'text-gray-500'}`}>
                    {ct.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Segment */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="font-medium text-gray-900 mb-4">
              Step 2: Select Segment
            </h2>
            <div className="space-y-3">
              {/* Vertical - shown for closed_loss and vertical campaigns */}
              {(campaignType === 'closed_loss' || campaignType === 'vertical') && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Vertical
                  </label>
                  <select
                    value={vertical}
                    onChange={(e) => setVertical(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {segments.verticals.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Objection - only shown for closed_loss campaigns */}
              {campaignType === 'closed_loss' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Objection
                  </label>
                  <select
                    value={objection}
                    onChange={(e) => setObjection(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {segments.objections.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product - only shown for product campaigns */}
              {campaignType === 'product' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Product
                  </label>
                  <select
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(segments as { products: { id: string; label: string }[] }).products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Case Study - only shown for case_study campaigns */}
              {campaignType === 'case_study' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Case Study
                  </label>
                  <select
                    value={caseStudy}
                    onChange={(e) => setCaseStudy(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(proofPoints as ProofPoint[]).map((pp) => (
                      <option key={pp.id} value={pp.id}>
                        {pp.customer}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Persona - shown for all campaign types */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Persona
                </label>
                <select
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {segments.personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Audience Estimate */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-900">Estimated Audience</p>
                <p className="text-xs text-blue-600">
                  of {(segments as { totalTargetable?: number }).totalTargetable?.toLocaleString() || '134,796'} targetable
                </p>
              </div>
              <p className="text-3xl font-bold text-blue-900 mb-1">
                {estimatedAudience.toLocaleString()} <span className="text-lg font-normal">contacts</span>
              </p>
              <p className="text-xs text-blue-700">
                {campaignType === 'closed_loss' && (
                  <>{segments.verticals.find((v) => v.id === vertical)?.label} × {segments.objections.find((o) => o.id === objection)?.label} × {segments.personas.find((p) => p.id === persona)?.label}</>
                )}
                {campaignType === 'vertical' && (
                  <>{segments.verticals.find((v) => v.id === vertical)?.label} × {segments.personas.find((p) => p.id === persona)?.label}</>
                )}
                {campaignType === 'persona' && (
                  <>All verticals × {segments.personas.find((p) => p.id === persona)?.label}</>
                )}
                {campaignType === 'product' && (
                  <>{(segments as { products: { id: string; label: string }[] }).products.find((p) => p.id === product)?.label} × {segments.personas.find((p) => p.id === persona)?.label}</>
                )}
                {campaignType === 'case_study' && (
                  <>{selectedCaseStudy?.customer} ({selectedCaseStudy?.vertical}) × {segments.personas.find((p) => p.id === persona)?.label}</>
                )}
              </p>
            </div>

            {/* Segment Quality Score */}
            <div className={`mt-3 p-4 rounded-lg border ${
              segmentQuality.color === 'green' ? 'bg-green-50 border-green-200' :
              segmentQuality.color === 'blue' ? 'bg-blue-50 border-blue-200' :
              segmentQuality.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm font-medium ${
                  segmentQuality.color === 'green' ? 'text-green-900' :
                  segmentQuality.color === 'blue' ? 'text-blue-900' :
                  segmentQuality.color === 'yellow' ? 'text-yellow-900' :
                  'text-red-900'
                }`}>Segment Quality</p>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  segmentQuality.color === 'green' ? 'bg-green-200 text-green-800' :
                  segmentQuality.color === 'blue' ? 'bg-blue-200 text-blue-800' :
                  segmentQuality.color === 'yellow' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-red-200 text-red-800'
                }`}>
                  {segmentQuality.label}
                </span>
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <p className={`text-3xl font-bold ${
                    segmentQuality.color === 'green' ? 'text-green-900' :
                    segmentQuality.color === 'blue' ? 'text-blue-900' :
                    segmentQuality.color === 'yellow' ? 'text-yellow-900' :
                    'text-red-900'
                  }`}>
                    {segmentQuality.score}<span className="text-lg font-normal">/100</span>
                  </p>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                  <div className={`${
                    segmentQuality.color === 'green' ? 'text-green-700' :
                    segmentQuality.color === 'blue' ? 'text-blue-700' :
                    segmentQuality.color === 'yellow' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    <p className="font-semibold">{((segmentQuality.replyRate || 0) * 100).toFixed(0)}%</p>
                    <p className="opacity-75">Reply Rate</p>
                  </div>
                  <div className={`${
                    segmentQuality.color === 'green' ? 'text-green-700' :
                    segmentQuality.color === 'blue' ? 'text-blue-700' :
                    segmentQuality.color === 'yellow' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    <p className="font-semibold">{(segmentQuality.conversionScore || 0).toFixed(1)}x</p>
                    <p className="opacity-75">Conversion</p>
                  </div>
                  <div className={`${
                    segmentQuality.color === 'green' ? 'text-green-700' :
                    segmentQuality.color === 'blue' ? 'text-blue-700' :
                    segmentQuality.color === 'yellow' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    <p className="font-semibold">#{segmentQuality.priority || '-'}</p>
                    <p className="opacity-75">Priority</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Touch */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="font-medium text-gray-900 mb-4">
              Step 3: Select Touch
            </h2>
            <div className="flex gap-2">
              {(templates as TemplatesByType)[campaignType]?.touches.map((t) => (
                <button
                  key={t.touch}
                  onClick={() => setTouch(t.touch)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    touch === t.touch
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Touch {t.touch}
                  <span className="block text-xs opacity-75">Day {t.day}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Matched Proof Points / Selected Case Study */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-medium text-gray-900 mb-3">
              {campaignType === 'case_study' ? 'Selected Case Study' : 'Matched Proof Points'}
            </h2>
            {campaignType === 'case_study' && selectedCaseStudy ? (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-semibold text-green-900 text-lg">{selectedCaseStudy.customer}</p>
                  <p className="text-sm text-green-700 capitalize mb-3">{selectedCaseStudy.vertical}</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {selectedCaseStudy.metrics.map((m, idx) => (
                      <div key={idx} className="bg-white p-2 rounded border border-green-100">
                        <p className="text-lg font-bold text-green-800">{m.value}</p>
                        <p className="text-xs text-green-600">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  {selectedCaseStudy.quotes[0] && (
                    <div className="border-t border-green-200 pt-3 mt-3">
                      <p className="text-sm text-green-800 italic">"{selectedCaseStudy.quotes[0].text}"</p>
                      <p className="text-xs text-green-600 mt-1">
                        — {selectedCaseStudy.quotes[0].author}, {selectedCaseStudy.quotes[0].title}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : relevantProofPoints.length > 0 ? (
              <div className="space-y-2">
                {relevantProofPoints.map((pp) => (
                  <div
                    key={pp.id}
                    className="p-3 bg-gray-50 rounded-lg text-sm"
                  >
                    <p className="font-medium text-gray-900">{pp.customer}</p>
                    <p className="text-gray-600">
                      {pp.metrics.map((m) => `${m.value} ${m.label}`).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No specific proof points for this segment. Use general Truv stats.
              </p>
            )}
          </div>

          {/* Recommended Personas */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
            <h2 className="font-medium text-gray-900 mb-3">
              Recommended Personas
            </h2>
            <p className="text-xs text-gray-500 mb-3">Based on your HubSpot engagement data</p>
            <div className="space-y-2">
              {recommendedPersonas.slice(0, 3).map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    persona === p.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-green-100 text-green-700' :
                        idx === 1 ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-medium text-gray-900">{p.label}</span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      p.score >= 70 ? 'bg-green-100 text-green-700' :
                      p.score >= 50 ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {p.score}/100
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>{((p.replyRate || 0) * 100).toFixed(0)}% reply</span>
                    <span>{(p.conversionScore || 0).toFixed(1)}x conversion</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Create HubSpot List */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
            <h2 className="font-medium text-gray-900 mb-3">
              Create HubSpot List
            </h2>

            {/* List Preview */}
            <div className="p-3 bg-gray-50 rounded-lg mb-4">
              <p className="text-xs text-gray-500 mb-1">List Name</p>
              <p className="text-sm font-medium text-gray-900">{listName}</p>
              <p className="text-xs text-gray-500 mt-2">
                ~{Math.min(estimatedAudience > 0 ? estimatedAudience : 100, 500).toLocaleString()} contacts
              </p>
            </div>

            {/* Success State */}
            {listResult?.success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-900">List Created</p>
                    <p className="text-sm text-green-700 mt-1">
                      {listResult.count?.toLocaleString()} contacts added to "{listResult.listName}"
                    </p>
                    <a
                      href={`https://app.hubspot.com/contacts/lists/${listResult.listId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-green-700 hover:text-green-800"
                    >
                      Open in HubSpot
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {listResult && !listResult.success && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-red-900">Failed to create list</p>
                    <p className="text-sm text-red-700 mt-1">{listResult.error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={createHubSpotList}
              disabled={listCreating || estimatedAudience === 0}
              className={`w-full px-4 py-3 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                listCreating || estimatedAudience === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {listCreating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating List...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create HubSpot List
                </>
              )}
            </button>

          </div>
        </div>

        {/* Right: Preview */}
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 sticky top-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-gray-900">Preview</h2>
              <button
                onClick={copyAll}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {copied ? 'Copied!' : 'Copy All'}
              </button>
            </div>

            {/* Subject */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Subject</label>
              <p className="text-gray-900 font-medium">{subject}</p>
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Body</label>
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {renderBody()}
              </div>
            </div>

            {/* Tip */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Click any{' '}
                <span className="px-1 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-xs">
                  {'{{clay.zone}}'}
                </span>{' '}
                to see the Clay prompt suggestion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
