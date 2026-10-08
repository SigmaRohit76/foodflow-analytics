import { Sun, Moon, Search, Menu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ExportMenu } from './ExportMenu';
import { useFilters } from '../context/FilterContext';
import type { NavPage } from './Sidebar';

const PAGE_TITLES: Record<NavPage, { title: string; subtitle: string }> = {
  overview:     { title: 'Overview',            subtitle: 'Business summary & key metrics' },
  orders:       { title: 'Orders',              subtitle: 'Order management & tracking' },
  restaurants:  { title: 'Restaurants',         subtitle: 'Partner restaurant analytics' },
  delivery:     { title: 'Delivery Analytics',  subtitle: 'Delivery time & performance' },
  revenue:      { title: 'Revenue Analytics',   subtitle: 'Revenue trends & breakdown' },
  customers:    { title: 'Customers',           subtitle: 'Customer insights & segments' },
  location:     { title: 'Location Analytics',  subtitle: 'City & area performance' },
};

interface TopHeaderProps {
  activePage: NavPage;
  onMobileMenuOpen: () => void;
}

export function TopHeader({ activePage, onMobileMenuOpen }: TopHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const filters = useFilters();
  const { title, subtitle } = PAGE_TITLES[activePage];

  return (
    <header className="header">
      {/* Mobile menu button */}
      <button
        className="header-icon-btn"
        onClick={onMobileMenuOpen}
        style={{ display: 'none' }}
        id="mobile-menu-btn"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="header-title">
        {title}
        <span>{subtitle}</span>
      </div>

      <div className="header-spacer" />

      {/* Date range pill */}
      <div className="header-date-pill" aria-label={`Active period: ${filters.dateLabel}`}>
        {filters.dateLabel ?? 'All dates'}
      </div>

      {/* Search */}
      <div className="header-search" role="search">
        <Search size={14} aria-hidden="true" />
        <input
          placeholder="Search orders, restaurants…"
          aria-label="Search dashboard"
        />
      </div>

      {/* Export */}
      <ExportMenu />

      {/* Theme toggle */}
      <button
        className="header-icon-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* User avatar */}
      <div className="user-avatar" title="Admin User" role="img" aria-label="User: Admin">AD</div>
    </header>
  );
}
