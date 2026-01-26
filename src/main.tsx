import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { ProofPoints } from './pages/ProofPoints';
import { Products } from './pages/Products';
import { Personas } from './pages/Personas';
import { Brand } from './pages/Brand';
import { Campaigns } from './pages/Campaigns';
import { EmailBuilder } from './pages/EmailBuilder';
import { ListBuilder } from './pages/ListBuilder';
import { ROIGenerator } from './pages/ROIGenerator';
import { ABMBuilder } from './pages/ABMBuilder';
import { DataEnrichment } from './pages/DataEnrichment';
import { ExpertReview } from './pages/ExpertReview';
import './index.css';

const router = createBrowserRouter([
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
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
