import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import StatusBar from './StatusBar';
import DataSovereigntyModal from '../common/DataSovereigntyModal';
import { useSettingsStore } from '../../stores/settings';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const connected = useSettingsStore((s) => s.connected);

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <DataSovereigntyModal />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <Topbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <StatusBar connected={connected} />
        <main id="main-content" className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
