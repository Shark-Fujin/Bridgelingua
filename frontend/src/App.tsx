import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';

const WorkspacePage = lazy(() => import('./components/workspace/WorkspacePage'));
const LibraryPage = lazy(() => import('./components/library/LibraryPage'));
const LexiconPage = lazy(() => import('./components/lexicon/LexiconPage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Suspense fallback={<PageLoader />}><WorkspacePage /></Suspense>} />
          <Route path="library" element={<Suspense fallback={<PageLoader />}><LibraryPage /></Suspense>} />
          <Route path="lexicon" element={<Suspense fallback={<PageLoader />}><LexiconPage /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
