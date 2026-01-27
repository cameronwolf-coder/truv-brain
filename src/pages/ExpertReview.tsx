import { useState, useCallback } from 'react';
import { ExpertReviewClient } from '../services/expertReviewClient';
import type {
  ReviewStatus,
  ReviewResult,
  ReviewStreamEvent,
  ExpertEvaluation,
  ModelId,
} from '../types/expertReview';
import { AVAILABLE_MODELS } from '../types/expertReview';

export function ExpertReview() {
  // Input state
  const [textContent, setTextContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>('claude-sonnet-4-20250514');

  // Review state
  const [status, setStatus] = useState<ReviewStatus>('idle');
  const [currentIteration, setCurrentIteration] = useState(0);
  const [currentEvaluations, setCurrentEvaluations] = useState<ExpertEvaluation[]>([]);
  const [currentAverage, setCurrentAverage] = useState<number | null>(null);
  const [improvingMessage, setImprovingMessage] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedExperts, setExpandedExperts] = useState(false);

  const handleFileUpload = useCallback((file: File) => {
    setUploadedFile(file);
    setTextContent('');

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        const isValid =
          file.type.startsWith('image/') || file.type === 'application/pdf';
        if (isValid) {
          handleFileUpload(file);
        }
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleStartReview = async () => {
    setError(null);
    setStatus('reviewing');
    setCurrentIteration(1);
    setCurrentEvaluations([]);
    setCurrentAverage(null);
    setImprovingMessage(null);
    setResult(null);

    const client = new ExpertReviewClient();

    let content: string;
    let contentType: 'text' | 'image' | 'pdf';
    let fileName: string | undefined;

    if (uploadedFile) {
      content = await fileToBase64(uploadedFile);
      contentType = uploadedFile.type.startsWith('image/') ? 'image' : 'pdf';
      fileName = uploadedFile.name;
    } else {
      content = textContent;
      contentType = 'text';
    }

    await client.startReview(
      { content, contentType, fileName, model: selectedModel },
      handleStreamEvent,
      (err) => {
        setError(err.message);
        setStatus('error');
      }
    );
  };

  const handleStreamEvent = (event: ReviewStreamEvent) => {
    switch (event.type) {
      case 'expert':
        setCurrentEvaluations((prev) => [...prev, event.data]);
        break;

      case 'round_complete':
        setCurrentAverage(event.averageScore);
        setCurrentIteration(event.iteration);
        break;

      case 'improving':
        setStatus('improving');
        setImprovingMessage(event.message);
        setCurrentEvaluations([]);
        break;

      case 'revision':
        setStatus('reviewing');
        setImprovingMessage(null);
        setCurrentIteration((prev) => prev + 1);
        setCurrentEvaluations([]);
        break;

      case 'complete':
        setResult(event.result);
        setStatus('complete');
        break;

      case 'error':
        setError(event.message);
        setStatus('error');
        break;
    }
  };

  const handleReset = () => {
    setTextContent('');
    setUploadedFile(null);
    setFilePreview(null);
    setStatus('idle');
    setCurrentIteration(0);
    setCurrentEvaluations([]);
    setCurrentAverage(null);
    setImprovingMessage(null);
    setResult(null);
    setError(null);
    setExpandedExperts(false);
  };

  const handleCopyContent = async () => {
    if (result?.finalContent) {
      await navigator.clipboard.writeText(result.finalContent);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const hasContent = textContent.trim().length > 0 || uploadedFile !== null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Expert Review Panel</h1>
        <p className="mt-2 text-gray-600">
          Submit any creative work and get feedback from 10 world-class advertising
          experts. Text content is automatically improved until it scores 90+.
        </p>
      </div>

      {/* Error State */}
      {status === 'error' && error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={handleReset}
              className="ml-4 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Input State */}
      {status === 'idle' && !result && (
        <div className="space-y-6">
          {/* Text Input */}
          <div className="bg-white border rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste your content
            </label>
            <textarea
              value={textContent}
              onChange={(e) => {
                setTextContent(e.target.value);
                setUploadedFile(null);
                setFilePreview(null);
              }}
              placeholder="Paste your ad copy, email, landing page text, or any creative content..."
              className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              disabled={uploadedFile !== null}
            />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-gray-50 text-gray-500">or</span>
            </div>
          </div>

          {/* File Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`bg-white border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              uploadedFile
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {uploadedFile ? (
              <div className="space-y-4">
                {filePreview && (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg shadow-sm"
                  />
                )}
                <div className="flex items-center justify-center space-x-2">
                  <svg
                    className="h-5 w-5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">{uploadedFile.name}</span>
                  <button
                    onClick={() => {
                      setUploadedFile(null);
                      setFilePreview(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-500 font-medium">
                      Upload a file
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                  <span className="text-gray-500"> or drag and drop</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Images (PNG, JPG, GIF) or PDF files
                </p>
              </>
            )}
          </div>

          {/* Helper Text */}
          <p className="text-sm text-gray-500 text-center">
            Text content will be automatically improved until it scores 90+. Images and
            PDFs receive detailed feedback only (no auto-improvement).
          </p>

          {/* Model Selector */}
          <div className="bg-white border rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              AI Model
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    selectedModel === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 text-sm">{model.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{model.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <button
              onClick={handleStartReview}
              disabled={!hasContent}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Review with Expert Panel
            </button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {(status === 'reviewing' || status === 'improving') && (
        <div className="space-y-6">
          {/* Progress Header */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {status === 'improving'
                    ? 'Improving Content...'
                    : `Review Round ${currentIteration}`}
                </h3>
                <p className="text-sm text-gray-600">
                  {status === 'improving'
                    ? improvingMessage || 'AI is revising based on expert feedback'
                    : `${currentEvaluations.length} of 10 experts reviewed`}
                </p>
              </div>
              {currentAverage !== null && (
                <div
                  className={`text-3xl font-bold px-4 py-2 rounded-lg ${getScoreColor(
                    currentAverage
                  )}`}
                >
                  {currentAverage.toFixed(1)}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width:
                    status === 'improving'
                      ? '100%'
                      : `${(currentEvaluations.length / 10) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Expert Cards Grid */}
          {status === 'reviewing' && currentEvaluations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentEvaluations.map((evaluation) => (
                <div
                  key={evaluation.expertId}
                  className="bg-white border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {evaluation.expertName}
                      </h4>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {evaluation.verdict}
                      </p>
                    </div>
                    <span
                      className={`ml-4 flex-shrink-0 px-3 py-1 text-lg font-semibold rounded ${getScoreColor(
                        evaluation.score
                      )}`}
                    >
                      {evaluation.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Improving Animation */}
          {status === 'improving' && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <svg
                  className="animate-spin h-8 w-8 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-lg text-gray-600">
                  {improvingMessage || 'Applying expert suggestions...'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results State */}
      {status === 'complete' && result && (
        <div className="space-y-6">
          {/* Score Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Final Score</p>
                <p className="text-5xl font-bold mt-1">{result.finalScore.toFixed(1)}</p>
                <p className="text-blue-200 mt-2">
                  Achieved in {result.iterations} iteration
                  {result.iterations !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
              >
                Start New Review
              </button>
            </div>
          </div>

          {/* Final Content */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {result.contentType === 'text' ? 'Final Content' : 'Reviewed Content'}
              </h3>
              {result.contentType === 'text' && (
                <button
                  onClick={handleCopyContent}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center space-x-2"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Copy</span>
                </button>
              )}
            </div>
            {result.contentType === 'text' ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                  {result.finalContent}
                </pre>
              </div>
            ) : (
              <div className="flex justify-center">
                {filePreview && (
                  <img
                    src={filePreview}
                    alt="Reviewed content"
                    className="max-h-96 rounded-lg shadow-sm"
                  />
                )}
                {!filePreview && (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <svg
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>{uploadedFile?.name || 'PDF Document'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Change Summary (text only) */}
          {result.contentType === 'text' &&
            result.changeSummary &&
            result.changeSummary.length > 0 && (
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Changes Made
                </h3>
                <ul className="space-y-2">
                  {result.changeSummary.map((change, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <svg
                        className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-gray-700">{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Expert Breakdown */}
          <div className="bg-white border rounded-lg">
            <button
              onClick={() => setExpandedExperts(!expandedExperts)}
              className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <h3 className="text-lg font-medium text-gray-900">Expert Breakdown</h3>
              <svg
                className={`h-5 w-5 text-gray-500 transition-transform ${
                  expandedExperts ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {expandedExperts && (
              <div className="border-t divide-y">
                {result.expertBreakdown.map((expert) => (
                  <div key={expert.expertId} className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{expert.expertName}</h4>
                      <span
                        className={`px-3 py-1 text-sm font-semibold rounded ${getScoreColor(
                          expert.score
                        )}`}
                      >
                        {expert.score}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{expert.verdict}</p>

                    {expert.strengths.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Strengths
                        </p>
                        <ul className="space-y-1">
                          {expert.strengths.map((strength, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-700 flex items-start"
                            >
                              <span className="text-green-500 mr-2">+</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {expert.improvements.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Areas for Improvement
                        </p>
                        <ul className="space-y-1">
                          {expert.improvements.map((improvement, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-700 flex items-start"
                            >
                              <span className="text-yellow-500 mr-2">-</span>
                              {improvement}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
