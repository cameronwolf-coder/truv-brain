import { useState, useMemo } from 'react';
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

type CampaignType = 'closed_loss' | 'vertical' | 'persona' | 'product';

const campaignTypes = [
  { id: 'closed_loss' as const, label: 'Closed Loss Re-engagement', description: 'Target contacts by objection reason' },
  { id: 'vertical' as const, label: 'Vertical Campaign', description: 'Target an entire industry segment' },
  { id: 'persona' as const, label: 'Persona Campaign', description: 'Target by job role across verticals' },
  { id: 'product' as const, label: 'Product-Led Campaign', description: 'Target by product interest' },
];

export function EmailBuilder() {
  const [campaignType, setCampaignType] = useState<CampaignType>('closed_loss');
  const [vertical, setVertical] = useState(segments.verticals[0].id);
  const [objection, setObjection] = useState(segments.objections[0].id);
  const [persona, setPersona] = useState(segments.personas[0].id);
  const [product, setProduct] = useState((segments as { products: { id: string }[] }).products[0].id);
  const [touch, setTouch] = useState(1);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  // Get selected template
  const selectedTemplate = (templates.touches as Template[]).find(
    (t) => t.touch === touch
  );

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
    } else {
      // product campaign - by product interest across all contacts
      if (!productData || !personaData) return 0;
      return Math.round(totalContacts * productData.pct * personaData.pct);
    }
  }, [vertical, objection, persona, product, campaignType]);

  // Build the email preview
  const buildEmailPreview = () => {
    if (!selectedTemplate) return { subject: '', body: '' };

    let subject = selectedTemplate.subject
      .replace('{{vertical}}', segments.verticals.find((v) => v.id === vertical)?.label.toLowerCase() || vertical);

    let body = selectedTemplate.body
      .replace('{{objection_summary}}', objectionSummary)
      .replace('{{proof_company}}', bestProofPoint?.customer || '[Customer]')
      .replace('{{proof_metric}}', bestProofPoint?.metrics[0]
        ? `${bestProofPoint.metrics[0].value} ${bestProofPoint.metrics[0].label}`
        : '[metric]');

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
              </p>
            </div>
          </div>

          {/* Step 3: Touch */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="font-medium text-gray-900 mb-4">
              Step 3: Select Touch
            </h2>
            <div className="flex gap-2">
              {(templates.touches as Template[]).map((t) => (
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

          {/* Matched Proof Points */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-medium text-gray-900 mb-3">
              Matched Proof Points
            </h2>
            {relevantProofPoints.length > 0 ? (
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
