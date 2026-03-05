import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 w-full max-w-sm text-center">
        <svg className="w-10 h-10 text-truv-blue mx-auto mb-4" viewBox="0 0 11 24" fill="currentColor">
          <path d="M5.355 23.557C3.681 23.557 2.364 23.077 1.404 22.117.469 21.157.001 19.852.001 18.203V0h4.21v18.019c0 .566.172 1.033.517 1.403.345.344.8.517 1.366.517h3.95v3.618H5.356ZM0 8.345V4.726h10.081v3.619H0Z"/>
        </svg>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Marketing Hub</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in with your Truv Google account</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={(response) => {
              try {
                if (response.credential) {
                  login(response.credential);
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Login failed');
              }
            }}
            onError={() => setError('Google sign-in failed. Please try again.')}
            theme="outline"
            size="large"
            width="300"
          />
        </div>

        <p className="text-xs text-gray-400 mt-6">Only @truv.com accounts are allowed.</p>
      </div>
    </div>
  );
}
