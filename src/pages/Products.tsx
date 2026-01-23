import { useState } from 'react';
import products from '../data/products.json';

type Product = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  painPoints: string[];
  verticals: string[];
  benefits: { icon: string; title: string; detail: string }[];
  dataFields: string[];
  integrations: string[];
};

type PainPointSolution = {
  headline: string;
  description: string;
  products: string[];
  keyStats: string[];
};

const PAIN_POINTS = [
  { id: 'all', label: 'All Products' },
  { id: 'price', label: 'Price/Budget Concerns' },
  { id: 'timing', label: 'Timing/Speed Needs' },
  { id: 'competitor', label: 'Competitor Comparison' },
  { id: 'bandwidth', label: 'Internal Bandwidth' },
  { id: 'no_decision', label: 'Building the Case' },
];

const VERTICALS = [
  { id: 'all', label: 'All Verticals' },
  { id: 'Bank', label: 'Bank' },
  { id: 'Credit Union', label: 'Credit Union' },
  { id: 'IMB', label: 'IMB (Independent Mortgage Bank)' },
  { id: 'Lending', label: 'Lending' },
  { id: 'Fintech', label: 'Fintech' },
  { id: 'Auto Lending', label: 'Auto Lending' },
  { id: 'Tenant Screening', label: 'Tenant Screening' },
  { id: 'Background Screening', label: 'Background Screening' },
];

export function Products() {
  const [painPointFilter, setPainPointFilter] = useState('all');
  const [verticalFilter, setVerticalFilter] = useState('all');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredProducts = (products.products as Product[]).filter((p) => {
    if (painPointFilter !== 'all' && !p.painPoints.includes(painPointFilter)) {
      return false;
    }
    if (verticalFilter !== 'all' && !p.verticals.includes(verticalFilter)) {
      return false;
    }
    return true;
  });

  const activeSolution = painPointFilter !== 'all'
    ? (products.painPointSolutions as Record<string, PainPointSolution>)[painPointFilter]
    : null;

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        <p className="text-gray-500 mt-1">
          Truv products and how they solve customer pain points
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={painPointFilter}
          onChange={(e) => setPainPointFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PAIN_POINTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {VERTICALS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Pain Point Solution Banner */}
      {activeSolution && (
        <div className="mb-6 p-5 bg-blue-50 border border-blue-200 rounded-xl">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            {activeSolution.headline}
          </h2>
          <p className="text-blue-800 mb-3">{activeSolution.description}</p>
          <div className="flex flex-wrap gap-2">
            {activeSolution.keyStats.map((stat, i) => (
              <button
                key={i}
                onClick={() => copyToClipboard(stat, `stat-${i}`)}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-sm font-medium transition-colors"
              >
                {copiedId === `stat-${i}` ? 'Copied!' : stat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">
        {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
      </p>

      {/* Product Cards */}
      <div className="space-y-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
          >
            {/* Product Header */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {product.name}
                  </h3>
                  <p className="text-blue-600 font-medium">{product.tagline}</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">{product.description}</p>

              {/* Benefits Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {product.benefits.map((benefit, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      copyToClipboard(
                        `${benefit.title}: ${benefit.detail}`,
                        `${product.id}-benefit-${i}`
                      )
                    }
                    className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                  >
                    <span className="text-xl">{benefit.icon}</span>
                    <p className="font-medium text-gray-900 text-sm mt-1">
                      {copiedId === `${product.id}-benefit-${i}`
                        ? 'Copied!'
                        : benefit.title}
                    </p>
                    <p className="text-xs text-gray-500">{benefit.detail}</p>
                  </button>
                ))}
              </div>

              {/* Expand/Collapse */}
              <button
                onClick={() =>
                  setExpandedProduct(
                    expandedProduct === product.id ? null : product.id
                  )
                }
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {expandedProduct === product.id
                  ? 'Hide details'
                  : 'Show data fields & integrations'}
              </button>
            </div>

            {/* Expanded Details */}
            {expandedProduct === product.id && (
              <div className="px-5 pb-5 pt-0 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Data Fields */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Data Fields
                    </h4>
                    <ul className="space-y-1">
                      {product.dataFields.map((field, i) => (
                        <li
                          key={i}
                          className="text-sm text-gray-600 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Integrations */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Integrations
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {product.integrations.map((integration, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                        >
                          {integration}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Verticals */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Best for
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {product.verticals.map((v) => {
                      const vertical = VERTICALS.find((vert) => vert.id === v);
                      return (
                        <span
                          key={v}
                          className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                        >
                          {vertical?.label || v}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No products match your filters
        </div>
      )}
    </div>
  );
}
