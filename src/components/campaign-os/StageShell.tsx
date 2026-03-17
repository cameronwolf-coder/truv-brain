import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StageStatus } from '../../types/campaign';

interface StageShellProps {
  title: string;
  description: string;
  status: StageStatus;
  confirmLabel?: string;
  onExecute: () => Promise<void>;
  result?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}

export function StageShell({
  title,
  description,
  status: initialStatus,
  confirmLabel = 'Confirm & Execute',
  onExecute,
  result,
  error: externalError,
  children,
}: StageShellProps) {
  const [status, setStatus] = useState<StageStatus>(initialStatus);
  const [error, setError] = useState<string | null>(externalError || null);

  const handleExecute = async () => {
    setStatus('executing');
    setError(null);
    try {
      await onExecute();
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>

      {status !== 'success' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {children}
        </div>
      )}

      <AnimatePresence>
        {status === 'error' && error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <p className="text-sm text-red-800 font-medium">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === 'success' && result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-xl p-4"
          >
            {result}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3">
        {(status === 'idle' || status === 'error') && (
          <button
            onClick={handleExecute}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {status === 'error' ? 'Retry' : confirmLabel}
          </button>
        )}
        {status === 'executing' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Executing...
          </div>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span>✓</span> Complete
          </div>
        )}
      </div>
    </div>
  );
}
