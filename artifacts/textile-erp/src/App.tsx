import "@/lib/auth";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LangProvider } from "@/contexts/LangContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { FabricRollsPage } from "@/pages/FabricRollsPage";
import { FabricRollDetailPage } from "@/pages/FabricRollDetailPage";
import { ProductionOrdersPage } from "@/pages/ProductionOrdersPage";
import { ProductionOrderDetailPage } from "@/pages/ProductionOrderDetailPage";
import { QualityControlPage } from "@/pages/QualityControlPage";
import { DyeingPage } from "@/pages/DyeingPage";
import { WarehousePage } from "@/pages/WarehousePage";
import { SalesPage } from "@/pages/SalesPage";
import { UsersPage } from "@/pages/UsersPage";
import { AuditLogsPage } from "@/pages/AuditLogsPage";
import { BillingPage } from "@/pages/BillingPage";
import { AdminTenantsPage } from "@/pages/AdminTenantsPage";
import { AdminTenantDetailPage } from "@/pages/AdminTenantDetailPage";
import { AdminBillingPage } from "@/pages/AdminBillingPage";
import { AdminMonitoringPage } from "@/pages/AdminMonitoringPage";
import { AdminPaymentsPage } from "@/pages/AdminPaymentsPage";
import { AdminPaymentMethodsPage } from "@/pages/AdminPaymentMethodsPage";
import { AdminTenantPaymentMethodsPage } from "@/pages/AdminTenantPaymentMethodsPage";
import { AdminPlansPage } from "@/pages/AdminPlansPage";
import { BillingPayPage } from "@/pages/BillingPayPage";
import { ProfileSecurityPage } from "@/pages/ProfileSecurityPage";
import { PricingPage } from "@/pages/PricingPage";
import { SubscriptionPage } from "@/pages/SubscriptionPage";
import NotFound from "@/pages/not-found";
import { useLang } from "@/contexts/LangContext";
import { Toaster } from "@/components/ui/toaster";
import { getHomeRouteForRole, isPlatformAdminRole, isRoleAllowed, isTenantAdminRole } from "@/lib/roles";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({
  component: Component,
  adminOnly = false,
  allowedRoles,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
  allowedRoles?: string[];
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useLang();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">{t.loading}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !isRoleAllowed(allowedRoles, user?.role)) {
    return <Redirect to={getHomeRouteForRole(user?.role)} />;
  }

  if (isPlatformAdminRole(user?.role) && !allowedRoles) {
    return <Redirect to={getHomeRouteForRole(user?.role)} />;
  }

  if (adminOnly && !isTenantAdminRole(user?.role)) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function HomeRoute() {
  const { isLoading, isAuthenticated, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Redirect to={getHomeRouteForRole(user?.role)} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/" component={HomeRoute} />
      <Route path="/admin" component={HomeRoute} />
      <Route path="/admin/plans" component={() => <ProtectedRoute component={AdminPlansPage} allowedRoles={["super_admin", "billing_admin", "readonly_admin"]} />} />
      <Route path="/admin/tenants" component={() => <ProtectedRoute component={AdminTenantsPage} allowedRoles={["super_admin", "support_admin", "billing_admin", "security_admin", "readonly_admin"]} />} />
      <Route path="/admin/tenants/:id" component={() => <ProtectedRoute component={AdminTenantDetailPage} allowedRoles={["super_admin", "support_admin", "billing_admin", "security_admin", "readonly_admin"]} />} />
      <Route path="/admin/tenants/:id/payment-methods" component={() => <ProtectedRoute component={AdminTenantPaymentMethodsPage} allowedRoles={["super_admin", "support_admin", "billing_admin", "security_admin", "readonly_admin"]} />} />
      <Route path="/admin/payment-methods" component={() => <ProtectedRoute component={AdminPaymentMethodsPage} allowedRoles={["super_admin", "billing_admin", "readonly_admin"]} />} />
      <Route path="/admin/billing" component={() => <ProtectedRoute component={AdminBillingPage} allowedRoles={["super_admin", "billing_admin", "readonly_admin"]} />} />
      <Route path="/admin/payments" component={() => <ProtectedRoute component={AdminPaymentsPage} allowedRoles={["super_admin", "billing_admin", "readonly_admin"]} />} />
      <Route path="/admin/monitoring" component={() => <ProtectedRoute component={AdminMonitoringPage} allowedRoles={["super_admin", "support_admin", "security_admin", "readonly_admin"]} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} allowedRoles={["tenant_admin", "production_user", "dyeing_user", "qc_user", "warehouse_user", "sales_user"]} />} />
      <Route path="/fabric-rolls" component={() => <ProtectedRoute component={FabricRollsPage} allowedRoles={["tenant_admin", "production_user", "dyeing_user", "qc_user", "warehouse_user", "sales_user"]} />} />
      <Route path="/fabric-rolls/:id" component={() => <ProtectedRoute component={FabricRollDetailPage} allowedRoles={["tenant_admin", "production_user", "dyeing_user", "qc_user", "warehouse_user", "sales_user"]} />} />
      <Route path="/production-orders" component={() => <ProtectedRoute component={ProductionOrdersPage} allowedRoles={["tenant_admin", "production_user"]} />} />
      <Route path="/production-orders/:id" component={() => <ProtectedRoute component={ProductionOrderDetailPage} allowedRoles={["tenant_admin", "production_user"]} />} />
      <Route path="/qc" component={() => <ProtectedRoute component={QualityControlPage} allowedRoles={["tenant_admin", "qc_user"]} />} />
      <Route path="/dyeing" component={() => <ProtectedRoute component={DyeingPage} allowedRoles={["tenant_admin", "dyeing_user"]} />} />
      <Route path="/warehouses" component={() => <ProtectedRoute component={WarehousePage} allowedRoles={["tenant_admin", "warehouse_user"]} />} />
      <Route path="/sales" component={() => <ProtectedRoute component={SalesPage} allowedRoles={["tenant_admin", "sales_user"]} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} adminOnly />} />
      <Route path="/audit-logs" component={() => <ProtectedRoute component={AuditLogsPage} adminOnly />} />
      <Route path="/billing" component={() => <ProtectedRoute component={BillingPage} adminOnly />} />
      <Route path="/subscription" component={() => <ProtectedRoute component={SubscriptionPage} adminOnly />} />
      <Route path="/billing/pay" component={() => <ProtectedRoute component={BillingPayPage} adminOnly />} />
      <Route path="/profile/security" component={() => <ProtectedRoute component={ProfileSecurityPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <Toaster />
          </WouterRouter>
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}

export default App;
