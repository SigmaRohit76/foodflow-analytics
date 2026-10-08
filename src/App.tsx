import { useState, useEffect } from 'react';
import './App.css';
import { ThemeProvider } from './context/ThemeContext';
import { FilterProvider } from './context/FilterContext';
import { Sidebar, type NavPage } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import OverviewPage from './pages/OverviewPage';
import ComingSoonPage from './pages/ComingSoonPage';
import OrdersPage from './pages/OrdersPage';
import RestaurantsPage from './pages/RestaurantsPage';
import DeliveryPage from './pages/DeliveryPage';
import RevenuePage from './pages/RevenuePage';
import CustomersPage from './pages/CustomersPage';
import LocationPage from './pages/LocationPage';

const COMING_SOON_PAGES: Partial<Record<NavPage, { title: string; description: string; icon: string }>> = {
  delivery: {
    title: 'Delivery Analytics',
    icon: '🚴',
    description: 'Delivery time analysis, route performance, peak-hour insights and SLA tracking.',
  },
  revenue: {
    title: 'Revenue Analytics',
    icon: '💰',
    description: 'Revenue trends, cohort analysis, discount impact and category profitability.',
  },
  customers: {
    title: 'Customer Analytics',
    icon: '👥',
    description: 'Customer segmentation, lifetime value, retention, and behavioural insights.',
  },
  location: {
    title: 'Location Analytics',
    icon: '🗺️',
    description: 'City and area-level heatmaps, penetration rates and geographic breakdowns.',
  },
};

function AppShell() {
  const [activePage, setActivePage] = useState<NavPage>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Make mobile menu button visible via inline style on small screens
  useEffect(() => {
    const btn = document.getElementById('mobile-menu-btn');
    if (!btn) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => { btn.style.display = mq.matches ? 'flex' : 'none'; };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const comingSoon = COMING_SOON_PAGES[activePage];

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="main-area">
        <TopHeader
          activePage={activePage}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />
        <main className="page-content">
          {activePage === 'overview'     && <OverviewPage />}
          {activePage === 'orders'       && <OrdersPage />}
          {activePage === 'restaurants'  && <RestaurantsPage />}
          {activePage === 'delivery'     && <DeliveryPage />}
          {activePage === 'revenue'      && <RevenuePage />}
          {activePage === 'customers'    && <CustomersPage />}
          {activePage === 'location'     && <LocationPage />}
          {comingSoon && (
            <ComingSoonPage
              title={comingSoon.title}
              description={comingSoon.description}
              icon={comingSoon.icon}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <FilterProvider>
        <AppShell />
      </FilterProvider>
    </ThemeProvider>
  );
}
