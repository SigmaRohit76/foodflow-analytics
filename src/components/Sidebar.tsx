import {
  LayoutDashboard,
  ShoppingCart,
  Store,
  Bike,
  DollarSign,
  Users,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type NavPage =
  | 'overview'
  | 'orders'
  | 'restaurants'
  | 'delivery'
  | 'revenue'
  | 'customers'
  | 'location';

interface NavItem {
  id: NavPage;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',     label: 'Overview',            icon: <LayoutDashboard size={18} /> },
  { id: 'orders',       label: 'Orders',               icon: <ShoppingCart size={18} /> },
  { id: 'restaurants',  label: 'Restaurants',          icon: <Store size={18} /> },
  { id: 'delivery',     label: 'Delivery Analytics',   icon: <Bike size={18} /> },
  { id: 'revenue',      label: 'Revenue Analytics',    icon: <DollarSign size={18} /> },
  { id: 'customers',    label: 'Customers',             icon: <Users size={18} /> },
  { id: 'location',     label: 'Location Analytics',   icon: <MapPin size={18} /> },
];

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const handleNav = (id: NavPage) => {
    onNavigate(id);
    onMobileClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🍛</div>
          {!collapsed && (
            <div className="sidebar-logo-text">
              FoodFlow
              <span>Analytics Platform</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {!collapsed && (
            <div className="sidebar-section-label">Main Menu</div>
          )}
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item${activePage === item.id ? ' active' : ''}`}
              onClick={() => handleNav(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {!collapsed && (
                <span className="nav-item-label">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ display: 'flex' }}
        >
          {collapsed
            ? <ChevronRight size={18} />
            : <><ChevronLeft size={18} />{' '}<span style={{ fontSize: 12, marginLeft: 4 }}>Collapse</span></>
          }
        </button>
      </aside>
    </>
  );
}
