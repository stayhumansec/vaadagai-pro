import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardSummary } from '../api';

interface NavItem {
  path: string;
  labelKey: string;
  mobileLabel?: string;
  icon: string;
  mobile?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'nav.dashboard', icon: '📊', mobile: true },
  { path: '/monthly', labelKey: 'nav.rentEntry', icon: '📝', mobile: true },
  { path: '/ledger', labelKey: 'nav.ledger', icon: '📒', mobile: true },
  { path: '/receipt', labelKey: 'nav.receipt', icon: '🧾' },
  { path: '/eb', labelKey: 'nav.eb', mobileLabel: 'EB', icon: '⚡', mobile: true },
  { path: '/tenants', labelKey: 'nav.tenants', icon: '🏘️' },
  { path: '/rent-history', labelKey: 'nav.rentHistory', icon: '📈' },
  { path: '/report', labelKey: 'nav.report', icon: '📑' },
  { path: '/whatsapp', labelKey: 'nav.whatsapp', mobileLabel: 'WhatsApp', icon: '💬', mobile: true },
  { path: '/settings', labelKey: 'nav.settings', icon: '⚙️' },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();

  const currentTitle = (pathname: string): string => {
    const match = NAV_ITEMS.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)));
    return match ? t(match.labelKey) : 'வாடகை Pro';
  };

  useEffect(() => {
    getDashboardSummary().then((s) => setDueCount(s.dueCount)).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-4">
      <header
        className={`fixed inset-x-0 top-0 z-30 flex h-[52px] items-center gap-3 bg-gradient-to-r from-navy via-navy to-[#22224a] px-4 text-white transition-shadow duration-300 ${
          scrolled ? 'shadow-elevated' : ''
        }`}
      >
        <button
          type="button"
          className="text-xl md:hidden"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={t('nav.menu')}
        >
          ☰
        </button>
        <span className="text-lg font-semibold">🏠 வாடகை Pro</span>
        <span className="hidden text-sm text-white/70 md:inline">— {currentTitle(location.pathname)}</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setLanguage(language === 'ta' ? 'en' : 'ta')}
            className="rounded bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20"
            title={t('settings.language')}
          >
            {language === 'ta' ? 'த / EN' : 'EN / த'}
          </button>
          {user && <span className="hidden sm:inline">{user.name}</span>}
          <button type="button" onClick={logout} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
            {t('nav.logout')}
          </button>
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 z-20 w-[220px] transform bg-gradient-to-b from-navy to-[#15152a] pt-[52px] text-white transition-transform duration-300 ease-premium md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-premium ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-blue to-brand-blue/80 text-white shadow-glow'
                    : 'text-white/80 hover:translate-x-0.5 hover:bg-white/10'
                }`
              }
            >
              <span>{item.icon}</span>
              <span className="flex-1">{t(item.labelKey)}</span>
              {item.path === '/whatsapp' && dueCount > 0 && (
                <span className="rounded-full bg-brand-red px-1.5 py-0.5 text-[10px] font-semibold text-white">{dueCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-10 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="min-h-screen pb-16 pt-[52px] md:ml-[220px] md:pb-4">
        <div key={location.pathname} className="animate-fade-in p-4">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-gray-3 bg-white md:hidden">
        {NAV_ITEMS.filter((item) => item.mobile).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center text-xs ${isActive ? 'text-brand-blue' : 'text-gray'}`
            }
          >
            <span className="relative text-base">
              {item.icon}
              {item.path === '/whatsapp' && dueCount > 0 && (
                <span className="absolute -right-2 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-red text-[8px] font-semibold text-white">
                  {dueCount > 9 ? '9+' : dueCount}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap">{item.mobileLabel ?? t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
