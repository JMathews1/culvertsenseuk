'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  alertCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ alertCount = 0, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  // Close drawer whenever the route changes — no onClick interference with navigation
  useEffect(() => {
    onClose?.();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className={`sidebar${isOpen ? ' open' : ''}`}>
      {/* Logo */}
      <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
        <div className="logo-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="6" stroke="#080d0f" strokeWidth="1.5" />
            <path d="M9 5v4l2.5 2.5" stroke="#080d0f" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="9" cy="9" r="1" fill="#080d0f" />
          </svg>
        </div>
        <div>
          <div className="logo-text">CulvertSense</div>
          <div className="logo-sub">Operations</div>
        </div>
      </Link>

      {/* Nav */}
      <div className="nav">
        {/* Monitor */}
        <div className="nav-section">
          <div className="nav-label">Monitor</div>
          <Link href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Overview
          </Link>
          <Link href="/sensors" className={`nav-item ${isActive('/sensors') ? 'active' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="7.5" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
            </svg>
            Live Feed
          </Link>
          <Link href="/alerts" className={`nav-item ${isActive('/alerts') ? 'active' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1.5L1 13h13L7.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M7.5 6v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="7.5" cy="11" r="0.6" fill="currentColor" />
            </svg>
            Alerts
            {alertCount > 0 && (
              <span className="nav-badge">{alertCount}</span>
            )}
          </Link>
        </div>

        {/* Analyse */}
        <div className="nav-section">
          <div className="nav-label">Analyse</div>
          <Link href="/historical" className={`nav-item ${isActive('/historical') ? 'active' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1 11.5L5 7l3 3 5-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 14h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Historical
          </Link>
          <Link href="/map" className={`nav-item ${isActive('/map') ? 'active' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M5 1L1 3v11l4-2 5 2 4-2V1l-4 2-5-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M5 1v11M10 3v11" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Site Map
          </Link>
        </div>

        {/* System */}
        <div className="nav-section">
          <div className="nav-label">System</div>
          <Link href="/gateway" className={`nav-item ${isActive('/gateway') ? 'active' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="5" width="13" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4.5 3.5C4.5 2.1 7.5 1 7.5 1s3 1.1 3 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="10.5" cy="8.5" r="1" fill="currentColor" />
            </svg>
            Gateway
          </Link>
          <Link href="/settings" className={`nav-item ${isActive('/settings') ? 'active' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.7 2.7l1 1M11.3 11.3l1 1M2.7 12.3l1-1M11.3 3.7l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Settings
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="client-chip">
          <div className="client-avatar">HW</div>
          <div>
            <div className="client-name">Halifax Water</div>
            <div className="client-role">Pilot Yr 1</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
