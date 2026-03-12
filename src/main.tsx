import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { ProofPoints } from './pages/ProofPoints';
import { Products } from './pages/Products';
import { Personas } from './pages/Personas';
import { Brand } from './pages/Brand';
import { Campaigns } from './pages/Campaigns';
import { EmailBuilder } from './pages/EmailBuilder';
import { ListBuilder } from './pages/ListBuilder';
import { SmartListBuilder } from './pages/SmartListBuilder';
import { ROIGenerator } from './pages/ROIGenerator';
import { ABMBuilder } from './pages/ABMBuilder';
import { DataEnrichment } from './pages/DataEnrichment';
import { ExpertReview } from './pages/ExpertReview';
import { UrlToEmail } from './pages/UrlToEmail';
import { EmailPerformance } from './pages/EmailPerformance';
const MarketingHub = lazy(() => import('./pages/MarketingHub').then((m) => ({ default: m.MarketingHub })));
const Hub = lazy(() => import('./pages/Hub').then((m) => ({ default: m.Hub })));
const VideoEditor = lazy(() => import('./pages/VideoEditor').then((m) => ({ default: m.VideoEditor })));
import './index.css';

const router = createBrowserRouter([
  {
    path: '/hub',
    element: <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}><ProtectedRoute><Hub /></ProtectedRoute></Suspense>,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'proof-points',
        element: <ProofPoints />,
      },
      {
        path: 'products',
        element: <Products />,
      },
      {
        path: 'personas',
        element: <Personas />,
      },
      {
        path: 'brand',
        element: <Brand />,
      },
      {
        path: 'campaigns',
        element: <Campaigns />,
      },
      {
        path: 'email-builder',
        element: <EmailBuilder />,
      },
      {
        path: 'list-builder',
        element: <ListBuilder />,
      },
      {
        path: 'smart-list-builder',
        element: <SmartListBuilder />,
      },
      {
        path: 'roi-generator',
        element: <ROIGenerator />,
      },
      {
        path: 'abm-builder',
        element: <ABMBuilder />,
      },
      {
        path: 'data-enrichment',
        element: <DataEnrichment />,
      },
      {
        path: 'expert-review',
        element: <ExpertReview />,
      },
      {
        path: 'url-to-email',
        element: <UrlToEmail />,
      },
      {
        path: 'email-performance',
        element: <EmailPerformance />,
      },
      {
        path: 'video-editor',
        element: <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}><VideoEditor /></Suspense>,
      },
      {
        path: 'marketing-hub',
        element: <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}><ProtectedRoute><MarketingHub /></ProtectedRoute></Suspense>,
      },
    ],
  },
]);

const GOOGLE_CLIENT_ID = '600053020430-etbmsaj7r5pv60ma4s6butlosa571hrd.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
