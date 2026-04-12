import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { isTenantAdminRole } from "@/lib/roles";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useGetDashboardStats,
  useGetQcReportSummary,
  useGetRollStatusBreakdown,
  useGetProductionByMonth,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatDate, formatNumber } from "@/lib/format";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  CREATED: "#94a3b8",
  IN_PRODUCTION: "#3b82f6",
  QC_PENDING: "#eab308",
  QC_PASSED: "#22c55e",
  QC_FAILED: "#ef4444",
  SENT_TO_DYEING: "#a855f7",
  IN_DYEING: "#6366f1",
  FINISHED: "#14b8a6",
  IN_STOCK: "#10b981",
  RESERVED: "#f97316",
  SOLD: "#64748b",
};

function KpiCard({ label, value, color, lang }: { label: string; value: number; color: string; lang: "ar" | "en" }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm`}>
      <div className="text-3xl font-bold text-slate-800">{formatNumber(value, lang)}</div>
      <div className={`text-sm font-medium mt-1 ${color}`}>{label}</div>
    </div>
  );
}

function MetricPanel({
  title,
  items,
  lang,
}: {
  title: string;
  items: Array<{ label: string; value: number; tone?: string }>;
  lang: "ar" | "en";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-800">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">{item.label}</span>
            <span className={`text-lg font-bold ${item.tone || "text-slate-800"}`}>
              {formatNumber(item.value, lang)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: qcSummary } = useGetQcReportSummary();
  const { data: breakdown } = useGetRollStatusBreakdown();
  const { data: monthlyData } = useGetProductionByMonth();
  const { data: activity } = useGetRecentActivity({ limit: 10 });

  if (statsLoading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const pieData = (breakdown || []).map((item) => ({
    name: (t as unknown as Record<string, string>)[item.status] || item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] || "#94a3b8",
  }));

  const barData = (monthlyData || []).map((item) => ({
    month: item.month,
    count: item.count,
  }));

  const labels = {
    activeRolls: t.dashboardActiveRolls,
    activeProductionOrders: t.dashboardActiveProductionOrders,
    qcOutcomes: t.dashboardQcOutcomes,
    qcTotal: t.dashboardQcTotal,
    qcPending: t.dashboardQcPending,
    qcRework: t.dashboardQcRework,
    inventory: t.dashboardInventory,
    availableForSale: t.dashboardAvailableForSale,
    warehouseStock: t.dashboardWarehouseStock,
    salesSummary: t.dashboardSalesSummary,
    totalOrders: t.dashboardTotalOrders,
    deliveredOrders: t.dashboardDeliveredOrders,
    deliveredRevenue: t.dashboardDeliveredRevenue,
    totalRevenue: t.dashboardTotalRevenue,
  };
  const qcOutcomes = qcSummary ?? stats?.qcOutcomes;
  const isFirstRun = Boolean(
    stats
      && (stats.totalRolls ?? 0) === 0
      && (stats.activeProductionOrders ?? 0) === 0
      && (stats.totalCustomers ?? 0) === 0
      && (activity || []).length === 0,
  );
  const showOnboarding = isFirstRun && Boolean(user?.role && isTenantAdminRole(user.role));

  return (
    <Layout>
      <PageHeader title={t.dashboard} />

      {showOnboarding && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium text-amber-700">{t.onboardingTitle}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{t.onboardingSubtitle}</div>
              <p className="mt-2 text-sm text-slate-600">{t.onboardingIntro}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/users" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                {t.addUser}
              </Link>
              <Link href="/subscription" className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800">
                {t.onboardingGoSubscription}
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-amber-100 bg-white p-4">
              <div className="text-xs text-slate-500">{t.onboardingStepUsersTitle}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{t.onboardingStepUsersBody}</div>
              <Link href="/users" className="mt-3 inline-flex text-sm font-medium text-indigo-700">
                {t.onboardingStepUsersCta}
              </Link>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white p-4">
              <div className="text-xs text-slate-500">{t.onboardingStepSubscriptionTitle}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{t.onboardingStepSubscriptionBody}</div>
              <Link href="/billing" className="mt-3 inline-flex text-sm font-medium text-indigo-700">
                {t.onboardingStepSubscriptionCta}
              </Link>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white p-4">
              <div className="text-xs text-slate-500">{t.onboardingStepRollsTitle}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{t.onboardingStepRollsBody}</div>
              <Link href="/fabric-rolls" className="mt-3 inline-flex text-sm font-medium text-indigo-700">
                {t.onboardingStepRollsCta}
              </Link>
            </div>
            <div className="rounded-xl border border-amber-100 bg-white p-4">
              <div className="text-xs text-slate-500">{t.onboardingStepSetupTitle}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{t.onboardingStepSetupBody}</div>
              <Link href="/production-orders" className="mt-3 inline-flex text-sm font-medium text-indigo-700">
                {t.onboardingStepSetupCta}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        <KpiCard label={t.totalRolls} value={stats?.totalRolls || 0} color="text-slate-600" lang={lang} />
        <KpiCard label={labels.activeRolls} value={stats?.activeRolls || 0} color="text-indigo-600" lang={lang} />
        <KpiCard label={t.inProduction} value={stats?.inProduction || 0} color="text-blue-600" lang={lang} />
        <KpiCard label={t.qcPassed} value={stats?.qcPassed || 0} color="text-green-600" lang={lang} />
        <KpiCard label={t.qcFailed} value={stats?.qcFailed || 0} color="text-red-600" lang={lang} />
        <KpiCard label={t.inDyeing} value={stats?.inDyeing || 0} color="text-indigo-600" lang={lang} />
        <KpiCard label={t.inStock} value={stats?.inStock || 0} color="text-emerald-600" lang={lang} />
        <KpiCard label={t.sold} value={stats?.sold || 0} color="text-slate-500" lang={lang} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label={t.activeProductionOrders} value={stats?.activeProductionOrders || 0} color="text-blue-600" lang={lang} />
        <KpiCard label={t.activeDyeingOrders} value={stats?.activeDyeingOrders || 0} color="text-purple-600" lang={lang} />
        <KpiCard label={t.pendingSalesOrders} value={stats?.pendingSalesOrders || 0} color="text-orange-600" lang={lang} />
        <KpiCard label={t.totalCustomers} value={stats?.totalCustomers || 0} color="text-teal-600" lang={lang} />
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8 lg:grid-cols-3">
        <MetricPanel
          title={labels.qcOutcomes}
          lang={lang}
          items={[
            { label: labels.qcTotal, value: qcOutcomes?.total || 0, tone: "text-slate-800" },
            { label: t.qcPassed, value: qcOutcomes?.passed || 0, tone: "text-green-600" },
            { label: t.qcFailed, value: qcOutcomes?.failed || 0, tone: "text-red-600" },
            { label: labels.qcPending, value: qcOutcomes?.pending || 0, tone: "text-amber-600" },
            { label: labels.qcRework, value: qcOutcomes?.rework || 0, tone: "text-purple-600" },
            { label: t.dashboardFailureRate, value: Math.round((qcSummary?.failureRate ?? 0) * 100), tone: "text-rose-600" },
          ]}
        />
        <MetricPanel
          title={labels.inventory}
          lang={lang}
          items={[
            { label: labels.availableForSale, value: stats?.availableInventory.availableForSale || 0, tone: "text-emerald-600" },
            { label: t.reserved, value: stats?.availableInventory.reserved || 0, tone: "text-orange-600" },
            { label: labels.warehouseStock, value: stats?.availableInventory.warehouseStock || 0, tone: "text-slate-800" },
          ]}
        />
        <MetricPanel
          title={labels.salesSummary}
          lang={lang}
          items={[
            { label: labels.totalOrders, value: stats?.salesSummary.totalOrders || 0, tone: "text-slate-800" },
            { label: t.pendingSalesOrders, value: stats?.salesSummary.pendingOrders || 0, tone: "text-orange-600" },
            { label: labels.deliveredOrders, value: stats?.salesSummary.deliveredOrders || 0, tone: "text-green-600" },
            { label: labels.deliveredRevenue, value: stats?.salesSummary.deliveredRevenue || 0, tone: "text-indigo-600" },
          ]}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Roll status donut */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">{t.rollStatusBreakdown}</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [formatNumber(Number(value), lang), name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm">
              <div>{t.noData}</div>
              <Link href="/fabric-rolls" className="mt-2 text-indigo-600 hover:text-indigo-700">
                {t.emptyDashboardRollsHint}
              </Link>
            </div>
          )}
        </div>

        {/* Production by month bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">{t.productionByMonth}</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm">
              <div>{t.noData}</div>
              <Link href="/production-orders" className="mt-2 text-indigo-600 hover:text-indigo-700">
                {t.emptyDashboardProductionHint}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{t.recentActivity}</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {(activity || []).length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              <div>{t.noData}</div>
              <Link href="/fabric-rolls" className="mt-2 inline-flex text-indigo-600 hover:text-indigo-700">
                {t.emptyDashboardActivityHint}
              </Link>
            </div>
          ) : (
            (activity || []).map((item) => (
              <div key={item.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-700">{item.description}</span>
                  {item.userName && (
                    <span className="text-xs text-slate-400 ms-2">— {item.userName}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {formatDate(item.createdAt, lang)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
