import { useState } from 'react';
import { FIELD_CATEGORIES, FIELD_BUNDLES } from '../../types/enrichment';
import type { FieldBundle } from '../../types/enrichment';

interface FieldSelectorProps {
  selectedFields: string[];
  onFieldsChange: (fields: string[]) => void;
}

export function FieldSelector({ selectedFields, onFieldsChange }: FieldSelectorProps) {
  const [activeBundle, setActiveBundle] = useState<FieldBundle | null>(null);

  const handleBundleClick = (bundle: FieldBundle) => {
    const bundleFields = FIELD_BUNDLES[bundle];
    onFieldsChange([...bundleFields]);
    setActiveBundle(bundle);
  };

  const handleFieldToggle = (field: string) => {
    if (selectedFields.includes(field)) {
      onFieldsChange(selectedFields.filter(f => f !== field));
    } else {
      onFieldsChange([...selectedFields, field]);
    }
    setActiveBundle(null);
  };

  const handleSelectAll = () => {
    onFieldsChange([...FIELD_BUNDLES.full]);
    setActiveBundle('full');
  };

  const handleClearAll = () => {
    onFieldsChange([]);
    setActiveBundle(null);
  };

  const estimatedCost = selectedFields.length * 0.02;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleBundleClick('quick')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'quick'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Quick Qualification
          </button>
          <button
            onClick={() => handleBundleClick('sales')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'sales'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sales Intelligence
          </button>
          <button
            onClick={() => handleBundleClick('executive')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'executive'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Executive Outreach
          </button>
          <button
            onClick={() => handleBundleClick('technical')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'technical'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Technical Fit
          </button>
          <button
            onClick={() => handleBundleClick('full')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeBundle === 'full'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Full Enrichment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(FIELD_CATEGORIES).map(([category, fields]) => (
          <div key={category} className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 capitalize">
              {category.replace('_', ' ')}
            </h4>
            <div className="space-y-1">
              {fields.map(field => (
                <label key={field} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field)}
                    onChange={() => handleFieldToggle(field)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">
                    {field.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-gray-600">
          <span className="font-medium">{selectedFields.length}</span> fields selected
          {selectedFields.length > 0 && (
            <span className="ml-2 text-gray-500">
              (~${estimatedCost.toFixed(2)} per contact)
            </span>
          )}
        </div>
        <div className="space-x-2">
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear All
          </button>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            Select All
          </button>
        </div>
      </div>
    </div>
  );
}
