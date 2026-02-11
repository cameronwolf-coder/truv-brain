interface FilePreviewProps {
  headers: string[];
  rows: Record<string, string>[];
  emailColumn: string | null;
  nameColumn: string | null;
  companyColumn: string | null;
  onEmailColumnChange: (col: string | null) => void;
  onNameColumnChange: (col: string | null) => void;
  onCompanyColumnChange: (col: string | null) => void;
  onReset: () => void;
}

export function FilePreview({
  headers,
  rows,
  emailColumn,
  nameColumn,
  companyColumn,
  onEmailColumnChange,
  onNameColumnChange,
  onCompanyColumnChange,
  onReset,
}: FilePreviewProps) {
  const previewRows = rows.slice(0, 5);
  const findEmailMode = !emailColumn && !!(nameColumn && companyColumn);
  const canProceed = !!emailColumn || (!!nameColumn && !!companyColumn);

  return (
    <div className="bg-white border rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">File Preview</h3>
          <p className="text-sm text-gray-500">{rows.length} rows &middot; {headers.length} columns</p>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Upload Different File
        </button>
      </div>

      {/* Data preview table */}
      <div className="border rounded-md overflow-x-auto max-h-64">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {headers.map(h => (
                <th
                  key={h}
                  className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap ${
                    h === emailColumn
                      ? 'text-blue-700 bg-blue-50'
                      : h === nameColumn
                      ? 'text-green-700 bg-green-50'
                      : h === companyColumn
                      ? 'text-purple-700 bg-purple-50'
                      : 'text-gray-500'
                  }`}
                >
                  {h}
                  {h === emailColumn && <span className="ml-1 text-[10px] font-normal normal-case">(email)</span>}
                  {h === nameColumn && <span className="ml-1 text-[10px] font-normal normal-case">(name)</span>}
                  {h === companyColumn && <span className="ml-1 text-[10px] font-normal normal-case">(company)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {previewRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {headers.map(h => (
                  <td
                    key={h}
                    className={`px-3 py-2 whitespace-nowrap text-gray-700 max-w-[200px] truncate ${
                      h === emailColumn
                        ? 'bg-blue-50/50'
                        : h === nameColumn
                        ? 'bg-green-50/50'
                        : h === companyColumn
                        ? 'bg-purple-50/50'
                        : ''
                    }`}
                    title={row[h]}
                  >
                    {row[h] || <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <p className="text-xs text-gray-400 -mt-4">Showing 5 of {rows.length} rows</p>
      )}

      {/* Column mapping */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Column Mapping</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-blue-700 mb-1">
              Email Column
            </label>
            <select
              value={emailColumn || ''}
              onChange={e => onEmailColumnChange(e.target.value || null)}
              className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">None (Find Email mode)</option>
              {headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-green-700 mb-1">
              Name Column
            </label>
            <select
              value={nameColumn || ''}
              onChange={e => onNameColumnChange(e.target.value || null)}
              className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">Not mapped</option>
              {headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-purple-700 mb-1">
              Company Column
            </label>
            <select
              value={companyColumn || ''}
              onChange={e => onCompanyColumnChange(e.target.value || null)}
              className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
            >
              <option value="">Not mapped</option>
              {headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {canProceed ? (
        findEmailMode ? (
          <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3">
            <p className="text-sm text-blue-800 font-medium">
              Find Email mode — will discover emails using name + company, then enrich
            </p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3">
            <p className="text-sm text-green-800">
              Ready to enrich {rows.length} contacts using <strong>{emailColumn}</strong> as the email column
            </p>
          </div>
        )
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <p className="text-sm text-amber-800">
            Map an <strong>email column</strong>, or both <strong>name + company</strong> columns to proceed
          </p>
        </div>
      )}
    </div>
  );
}
