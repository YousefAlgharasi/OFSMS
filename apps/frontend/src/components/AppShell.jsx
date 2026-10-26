'use client';

/**
 * AppShell.jsx — Main layout wrapper for authenticated pages
 *
 * Mobile  (<768px): sidebar is hidden by default. A ☰ button in the top bar
 *                   opens it as a full-width drawer with a dark backdrop.
 * Desktop (≥768px): sidebar is fixed on the right. Content shifts left.
 *                   A toggle button collapses it to icons only.
 *
 * Usage: wrap any authenticated page with <AppShell>{children}</AppShell>
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import api from '../lib/api';
import NotificationBell from './NotificationBell';
import {
  LayoutDashboard, Users, Home, Tag, Handshake, Star,
  Map, UserCog, BookOpen, FileText, ClipboardList, ClipboardCheck,
  Plus, DollarSign, Archive, LogOut, ChevronRight, ChevronLeft, Menu, X, Megaphone,
  Globe, ExternalLink, Package, GraduationCap, Settings, Sun, Moon, CheckCircle2,
} from 'lucide-react';

// ── Nav items per role ────────────────────────────────────────────────────────
const NAV_ITEMS = {
  gm: [
    {
      group: 'الرئيسية',
      items: [
        { label: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'الأيتام والأسر',
      items: [
        { label: 'الأيتام',            href: '/orphans',         icon: Users },
        { label: 'الأسر',              href: '/families',        icon: Home },
        { label: 'أيتامي',             href: '/my-orphans',      icon: Users },
        { label: 'تقييم الباحث الدوري', href: '/evaluations',     icon: ClipboardCheck },
        { label: 'برامج الدعم العيني', href: '/in-kind',         icon: Package },
        { label: 'البرامج التربوية والتوعوية', href: '/educational', icon: GraduationCap },
        { label: 'الأيتام الموهوبون',  href: '/orphans/gifted',  icon: Star },
        { label: 'مجمع التسويق',      href: '/marketing-pool',  icon: Tag },
        { label: 'تسجيل يتيم',        href: '/orphans/new',     icon: Plus },
        { label: 'تسجيل أسرة',        href: '/families/new',    icon: Plus },
      ],
    },
    {
      group: 'الكفلاء والتسجيل',
      items: [
        { label: 'الكفلاء',         href: '/sponsors',       icon: Handshake },
        { label: 'طلبات التسجيل',   href: '/registrations',  icon: ClipboardList },
      ],
    },
    {
      group: 'القرآن الكريم',
      items: [
        { label: 'إعدادات الحفظ',       href: '/quran-thresholds',  icon: BookOpen },
        { label: 'مراجعة تقارير الحفظ', href: '/quran-reports',     icon: ClipboardList },
        { label: 'رفع تقرير الحفظ',     href: '/quran-reports/new', icon: BookOpen },
      ],
    },
    {
      group: 'المالية',
      items: [
        { label: 'كشف الصرف',     href: '/disbursements',         icon: DollarSign },
        { label: 'سجل الإصدارات', href: '/disbursements/history', icon: Archive },
      ],
    },
    {
      group: 'التقارير والتواصل',
      items: [
        { label: 'تحليلات المحافظات', href: '/governorates',  icon: Map },
        { label: 'التقارير',           href: '/reports',       icon: FileText },
        { label: 'الإعلانات',          href: '/announcements', icon: Megaphone },
      ],
    },
    {
      group: 'الموقع التعريفي',
      items: [
        { label: 'إدارة الموقع التعريفي', href: '/landing-settings', icon: Globe },
        { label: 'معاينة الموقع', href: '/landing', icon: ExternalLink },
      ],
    },
    {
      group: 'النظام',
      items: [
        { label: 'إعدادات النظام', href: '/settings', icon: Settings },
        { label: 'إدارة المستخدمين', href: '/users', icon: UserCog },
      ],
    },
    {
      group: 'المساعدة',
      items: [
        { label: 'كيف تستخدم النظام', href: '/how-to-use', icon: BookOpen },
      ],
    },
  ],
  supervisor: [
    {
      group: 'الرئيسية',
      items: [
        { label: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'الإدارة',
      items: [
        { label: 'إعدادات النظام', href: '/settings',         icon: Settings },
        { label: 'تقييم الباحث الدوري', href: '/evaluations',   icon: ClipboardCheck },
        { label: 'طلبات التسجيل',      href: '/registrations', icon: ClipboardList },
        { label: 'برامج الدعم العيني', href: '/in-kind',       icon: Package },
        { label: 'البرامج التربوية والتوعوية', href: '/educational', icon: GraduationCap },
      ],
    },
    {
      group: 'القرآن والحفظ',
      items: [
        { label: 'تقارير الحفظ', href: '/quran-reports', icon: BookOpen },
      ],
    },
    {
      group: 'المالية',
      items: [
        { label: 'كشف الصرف', href: '/disbursements', icon: DollarSign },
      ],
    },
    {
      group: 'التقارير والتواصل',
      items: [
        { label: 'التقارير',  href: '/reports',       icon: FileText },
        { label: 'الإعلانات', href: '/announcements', icon: Megaphone },
      ],
    },
    {
      group: 'المساعدة',
      items: [
        { label: 'كيف تستخدم النظام', href: '/how-to-use', icon: BookOpen },
      ],
    },
  ],
  agent: [
    {
      group: 'الرئيسية',
      items: [
        { label: 'لوحة التحكم', href: '/dashboard',  icon: LayoutDashboard },
        { label: 'أيتامي وأسري', href: '/my-orphans', icon: Users },
        { label: 'تقييم الباحث الدوري', href: '/evaluations', icon: ClipboardCheck },
        { label: 'البرامج التربوية والتوعوية', href: '/educational', icon: GraduationCap },
      ],
    },
    {
      group: 'التسجيل',
      items: [
        { label: 'تسجيل يتيم', href: '/orphans/new',  icon: Plus },
        { label: 'تسجيل أسرة', href: '/families/new', icon: Plus },
      ],
    },
    {
      group: 'القرآن الكريم',
      items: [
        { label: 'رفع تقرير الحفظ', href: '/quran-reports/new', icon: BookOpen },
      ],
    },
    {
      group: 'الصرف',
      items: [
        { label: 'تأكيد الاستلام', href: '/receipts/batch', icon: CheckCircle2 },
      ],
    },
    {
      group: 'التواصل',
      items: [
        { label: 'الإعلانات', href: '/announcements', icon: Megaphone },
      ],
    },
    {
      group: 'المساعدة',
      items: [
        { label: 'كيف تستخدم النظام', href: '/how-to-use', icon: BookOpen },
      ],
    },
  ],
  finance: [
    {
      group: 'الرئيسية',
      items: [
        { label: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'المالية',
      items: [
        { label: 'كشف الصرف',     href: '/disbursements',         icon: DollarSign },
        { label: 'سجل الإصدارات', href: '/disbursements/history', icon: Archive },
      ],
    },
    {
      group: 'التقارير والتواصل',
      items: [
        { label: 'التقارير',  href: '/reports',       icon: FileText },
        { label: 'الإعلانات', href: '/announcements', icon: Megaphone },
      ],
    },
    {
      group: 'المساعدة',
      items: [
        { label: 'كيف تستخدم النظام', href: '/how-to-use', icon: BookOpen },
      ],
    },
  ],
};

const ROLE_LABELS = {
  gm:         'المدير العام',
  supervisor: 'مشرف الأيتام',
  agent:      'مندوب',
  finance:    'القسم المالي',
  sponsor:    'كافل',
};

const flatItems = (groups) => groups.flatMap((g) => g.items);

const PUBLIC_PREFIXES = ['/login', '/sponsor/login', '/sponsor/portal', '/landing', '/install', '/how-to-use'];
const ROLE_EXTRA_PATHS = {
  gm: ['/ads', '/receipts/supervisor', '/landing-settings', '/landing', '/in-kind', '/educational', '/evaluations', '/settings'],
  supervisor: ['/receipts/supervisor', '/landing-settings', '/landing', '/in-kind', '/educational', '/evaluations', '/settings'],
  agent: ['/receipts/batch', '/in-kind', '/educational', '/evaluations'],
  finance: ['/in-kind', '/educational', '/evaluations'],
};

const roleCanAccessPath = (role, pathname) => {
  if (!role || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  const allowedItems = flatItems(NAV_ITEMS[role] || []);
  const allowedPaths = [
    ...allowedItems.map((item) => item.href),
    ...(ROLE_EXTRA_PATHS[role] || []),
  ];

  return allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
};

// ── AppShell ──────────────────────────────────────────────────────────────────
export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed]   = useState(false); // desktop sidebar collapsed
  const [mounted, setMounted]       = useState(false);

  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => { setMounted(true); }, []);

  const navGroups = NAV_ITEMS[user?.role] || [];
  const navItems  = flatItems(navGroups);
  const canAccessCurrentPath = roleCanAccessPath(user?.role, pathname);

  // Close mobile drawer whenever the route changes
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    if (!roleCanAccessPath(user.role, pathname)) {
      router.replace('/dashboard');
    }
  }, [pathname, router, user]);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_e) { /* best-effort — clear auth regardless */ }
    clearAuth();
    router.push('/login');
  };

  // Desktop sidebar width
  const desktopSidebarW = collapsed ? 'md:w-16' : 'md:w-64';
  const desktopMainMr   = collapsed ? 'md:mr-16' : 'md:mr-64';

  if (!user || !canAccessCurrentPath) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B131B] text-gray-800 dark:text-slate-100 transition-colors duration-200" dir="rtl">

      {/* ══ MOBILE DRAWER ═══════════════════════════════════════════════════ */}

      {/* Backdrop — only visible when drawer is open, only on mobile */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside
        className={`
          fixed top-0 right-0 h-full w-72 z-50 bg-white dark:bg-[#111E2E] border-l border-gray-200 dark:border-[#1E344B]
          flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
          md:hidden
          ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-[#1E344B]">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="شعار مؤسسة نماء" className="w-9 h-9 object-contain drop-shadow-sm" />
            <div className="flex flex-col">
              <span className="text-emerald-700 dark:text-emerald-400 font-black text-base leading-tight">
                مؤسسة نماء
              </span>
              <span className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold tracking-wide">
                التنموية الخيرية
              </span>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#17283C] text-gray-500 dark:text-slate-400 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.group}>
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 select-none">
                {group.group}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-primary text-white shadow-sm shadow-primary/30'
                          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#17283C] hover:text-primary dark:hover:text-sky-400'
                      }`}
                    >
                      <item.icon size={18} className="flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Mobile Drawer Theme Toggle */}
        <div className="px-3 py-2.5 border-t border-gray-100 dark:border-[#1E344B] bg-gray-50/60 dark:bg-[#0E1A29]">
          <button
            onClick={toggleTheme}
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-[#17283C] hover:bg-gray-100 dark:hover:bg-[#1E344B] border border-gray-200 dark:border-[#1E344B] shadow-2xs transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {mounted && theme === 'dark' ? (
                <Sun size={17} className="text-amber-400" />
              ) : (
                <Moon size={17} className="text-[#1B5E8C] dark:text-sky-400" />
              )}
              <span>{mounted && theme === 'dark' ? 'الوضع النهاري (فاتح)' : 'الوضع الليلي (داكن)'}</span>
            </div>
            <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${mounted && theme === 'dark' ? 'bg-[#1B5E8C] justify-end' : 'bg-gray-300 dark:bg-slate-700 justify-start'}`}>
              <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
            </div>
          </button>
        </div>

        {/* User + Logout */}
        <div className="border-t border-gray-100 dark:border-[#1E344B] p-4 bg-gray-50/50 dark:bg-[#0D1825]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{ROLE_LABELS[user?.role]}</p>
            </div>
            <button onClick={handleLogout} className="text-xs text-danger hover:underline flex-shrink-0">
              خروج
            </button>
          </div>
        </div>
      </aside>

      {/* ══ DESKTOP SIDEBAR ═════════════════════════════════════════════════ */}
      <aside
        className={`
          hidden md:flex fixed top-0 right-0 h-full z-30 bg-white dark:bg-[#111E2E] border-l border-gray-200 dark:border-[#1E344B]
          flex-col shadow-sm transition-all duration-300
          ${desktopSidebarW}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-[#1E344B]">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="شعار مؤسسة نماء" className="w-9 h-9 object-contain drop-shadow-sm" />
              <div className="flex flex-col">
                <span className="text-emerald-700 dark:text-emerald-400 font-black text-base leading-tight">
                  مؤسسة نماء
                </span>
                <span className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold tracking-wide">
                  التنموية الخيرية
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto py-1">
              <img src="/logo.png" alt="نماء" className="w-8 h-8 object-contain drop-shadow-sm" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#17283C] text-gray-500 dark:text-slate-400 transition"
          >
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.group}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 select-none">
                  {group.group}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-primary text-white shadow-sm shadow-primary/30'
                          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#17283C] hover:text-primary dark:hover:text-sky-400'
                      }`}
                    >
                      <item.icon size={18} className="flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Desktop Sidebar Theme Toggle */}
        <div className="px-3 py-2.5 border-t border-gray-100 dark:border-[#1E344B] bg-gray-50/60 dark:bg-[#0E1A29]">
          {!collapsed ? (
            <button
              onClick={toggleTheme}
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-[#17283C] hover:bg-gray-100 dark:hover:bg-[#1E344B] border border-gray-200 dark:border-[#1E344B] shadow-2xs transition-all cursor-pointer"
              title={mounted && theme === 'dark' ? 'التحويل للوضع النهاري (فاتح)' : 'التحويل للوضع الليلي (داكن)'}
            >
              <div className="flex items-center gap-2.5">
                {mounted && theme === 'dark' ? (
                  <Sun size={17} className="text-amber-400" />
                ) : (
                  <Moon size={17} className="text-[#1B5E8C] dark:text-sky-400" />
                )}
                <span>{mounted && theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
              </div>
              <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${mounted && theme === 'dark' ? 'bg-[#1B5E8C] justify-end' : 'bg-gray-300 dark:bg-slate-700 justify-start'}`}>
                <div className="bg-white w-4 h-4 rounded-full shadow-xs" />
              </div>
            </button>
          ) : (
            <button
              onClick={toggleTheme}
              type="button"
              className="w-full flex justify-center items-center p-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-200/70 dark:hover:bg-[#17283C] transition cursor-pointer"
              title={mounted && theme === 'dark' ? 'التحويل للوضع النهاري' : 'التحويل للوضع الليلي'}
            >
              {mounted && theme === 'dark' ? (
                <Sun size={18} className="text-amber-400" />
              ) : (
                <Moon size={18} className="text-[#1B5E8C] dark:text-sky-400" />
              )}
            </button>
          )}
        </div>

        {/* User + Logout */}
        <div className="border-t border-gray-100 dark:border-[#1E344B] p-4 bg-gray-50/50 dark:bg-[#0D1825]">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{ROLE_LABELS[user?.role]}</p>
              </div>
              <button onClick={handleLogout} className="text-xs text-danger hover:underline flex-shrink-0">
                خروج
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center text-danger hover:bg-red-50 dark:hover:bg-red-950/30 p-2 rounded-lg transition"
              title="تسجيل الخروج"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* ══ MAIN CONTENT ════════════════════════════════════════════════════ */}
      <main className={`flex flex-col min-h-screen transition-all duration-300 mr-0 ${desktopMainMr}`}>

        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white dark:bg-[#111E2E] border-b border-gray-200 dark:border-[#1E344B] px-4 py-3 flex items-center justify-between shadow-sm transition-colors duration-200">
          <div className="flex items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#17283C] transition"
              onClick={() => setDrawerOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-base font-bold text-gray-800 dark:text-slate-100">
              {navItems.find((i) => i.href === pathname)?.label || 'مؤسسة نماء التنموية الخيرية'}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              type="button"
              className="p-2 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#17283C] border border-gray-200 dark:border-[#1E344B] transition-all duration-150 flex items-center justify-center cursor-pointer"
              title={mounted && theme === 'dark' ? 'التحويل للوضع النهاري (فاتح)' : 'التحويل للوضع الليلي (داكن)'}
              aria-label="تبديل مظهر النظام"
            >
              {mounted && theme === 'dark' ? (
                <Sun size={19} className="text-amber-400 animate-[fadeIn_0.2s_ease]" />
              ) : (
                <Moon size={19} className="text-[#1B5E8C] dark:text-sky-400 animate-[fadeIn_0.2s_ease]" />
              )}
            </button>

            <NotificationBell />
            <div className="text-sm text-gray-500 dark:text-slate-400 hidden sm:block">
              {new Date().toLocaleDateString('ar-YE', { dateStyle: 'medium' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6 bg-gray-50 dark:bg-[#0B131B] transition-colors duration-200">
          {children}
        </div>
      </main>

    </div>
  );
}
