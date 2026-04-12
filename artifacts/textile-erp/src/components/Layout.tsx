import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { OperationalSearch } from "@/components/OperationalSearch";
import { hasTenantFeatureAccess, isPlatformAdminRole, isTenantAdminRole } from "@/lib/roles";
import {
  LayoutDashboard,
  ScrollText,
  Package,
  Warehouse,
  ShoppingCart,
  CheckCircle,
  Droplets,
  Users,
  ClipboardList,
  CreditCard,
  Building2,
  Activity,
  Receipt,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  PanelRightClose,
} from "lucide-react";

const navItems = (t: ReturnType<typeof useLang>["t"], role: string) => [
  ...(isPlatformAdminRole(role)
    ? [
        { href: "/admin/tenants", label: t.tenants, icon: Building2 },
        ...(role === "billing_admin" || role === "readonly_admin" || role === "super_admin"
          ? [
              { href: "/admin/plans", label: t.pricingSettings, icon: CreditCard },
              { href: "/admin/payment-methods", label: t.paymentMethodsManagement, icon: Settings },
              { href: "/admin/billing", label: t.adminBilling, icon: CreditCard },
              { href: "/admin/payments", label: t.manualPayments, icon: Receipt },
            ]
          : []),
        ...(role === "security_admin" || role === "readonly_admin" || role === "support_admin" || role === "super_admin"
          ? [{ href: "/admin/monitoring", label: t.monitoring, icon: Activity }]
          : []),
      ]
    : [
        ...(hasTenantFeatureAccess(role, "dashboard") ? [{ href: "/dashboard", label: t.dashboard, icon: LayoutDashboard }] : []),
        ...(hasTenantFeatureAccess(role, "fabric_rolls") ? [{ href: "/fabric-rolls", label: t.fabricRolls, icon: Package }] : []),
        ...(hasTenantFeatureAccess(role, "production") ? [{ href: "/production-orders", label: t.productionOrders, icon: ScrollText }] : []),
        ...(hasTenantFeatureAccess(role, "qc") ? [{ href: "/qc", label: t.qualityControl, icon: CheckCircle }] : []),
        ...(hasTenantFeatureAccess(role, "dyeing") ? [{ href: "/dyeing", label: t.dyeing, icon: Droplets }] : []),
        ...(hasTenantFeatureAccess(role, "warehouse") ? [{ href: "/warehouses", label: t.warehouse, icon: Warehouse }] : []),
        ...(hasTenantFeatureAccess(role, "sales") ? [{ href: "/sales", label: t.sales, icon: ShoppingCart }] : []),
        ...(isTenantAdminRole(role) ? [{ href: "/subscription", label: t.subscriptionInfo, icon: CreditCard }] : []),
        ...(isTenantAdminRole(role) ? [{ href: "/billing/pay", label: t.manualPayment, icon: Receipt }] : []),
        { href: "/profile/security", label: t.passwordSecurity, icon: Shield },
      ]),
  ...(isTenantAdminRole(role)
    ? [
        { href: "/users", label: t.users, icon: Users },
        { href: "/audit-logs", label: t.auditLogs, icon: ClipboardList },
        { href: "/billing", label: t.billing, icon: CreditCard },
      ]
    : []),
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t, isRTL } = useLang();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const items = navItems(t, user?.role || "");
  const showOperationalSearch = user?.role ? !isPlatformAdminRole(user.role) : false;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location, isRTL]);

  return (
    <div className="min-h-screen bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label={t.close}
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50"
            aria-label={t.menu}
          >
            <Menu size={18} />
          </button>

          <div className="text-center">
            <div className="text-base font-bold text-indigo-950">{t.appName}</div>
            <div className="text-xs text-slate-500">{t.fabricManagementShort}</div>
          </div>

          <LanguageSwitcher compact />
        </div>
      </header>

      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 z-40 w-72 max-w-[88vw] bg-indigo-950 text-white transition-transform duration-300 md:static md:z-auto md:max-w-none ${
            isRTL
              ? `right-0 border-s border-indigo-900 ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"} md:translate-x-0`
              : `left-0 border-e border-indigo-900 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`
          } ${sidebarCollapsed ? "md:w-20" : "md:w-64"} flex shrink-0 flex-col`}
        >
          <div className="flex items-center justify-between border-b border-indigo-800 p-4">
            {!sidebarCollapsed && (
              <div>
                <div className="text-lg font-bold leading-tight text-amber-400">{t.appName}</div>
                <div className="text-xs text-indigo-300">{t.fabricManagementShort}</div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded p-1.5 transition-colors hover:bg-indigo-800 md:hidden"
                aria-label={t.close}
              >
                <X size={18} />
              </button>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                className="hidden rounded p-1.5 transition-colors hover:bg-indigo-800 md:inline-flex"
                aria-label={t.menu}
              >
                <PanelRightClose size={18} className={sidebarCollapsed ? "rotate-180" : ""} />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mx-2 mb-1 flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-150 group ${
                    isActive
                      ? "bg-amber-500 font-semibold text-indigo-950 shadow-md"
                      : "text-indigo-200 hover:bg-indigo-800 hover:text-white"
                  }`}
                >
                  <Icon size={20} className="shrink-0" />
                  {!sidebarCollapsed && <span className="whitespace-nowrap text-sm">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-indigo-800 p-3">
            <LanguageSwitcher
              variant="dark"
              compact={sidebarCollapsed}
              className="w-full justify-center md:justify-start"
            />

            {!sidebarCollapsed && user && (
              <div className="rounded-lg bg-indigo-900 px-3 py-2">
                <div className="truncate text-sm font-medium text-white">{user.fullName}</div>
                <div className="text-xs text-indigo-300">{(t.roles as Record<string, string>)[user.role] || user.role}</div>
              </div>
            )}

            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-900/30 hover:text-red-200"
            >
              <LogOut size={16} className="shrink-0" />
              {!sidebarCollapsed && <span>{t.logout}</span>}
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="max-w-full p-4 sm:p-6">
            {showOperationalSearch && (
              <div className="mb-5">
                <OperationalSearch />
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
