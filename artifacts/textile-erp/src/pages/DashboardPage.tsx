import { useLang } from "@/contexts/LangContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useGetDashboardStats,
  useGetRollStatusBreakdown,
  useGetProductionByMonth,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatDate, formatNumber } from "@/lib/format";

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

export function DashboardPage() {
  const { t, lang } = useLang();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
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

  return (
    <Layout>
      <PageHeader title={t.dashboard} />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        <KpiCard label={t.totalRolls} value={stats?.totalRolls || 0} color="text-slate-600" lang={lang} />
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
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">{t.noData}</div>
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
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">{t.noData}</div>
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
            <div className="px-6 py-8 text-center text-slate-400 text-sm">{t.noData}</div>
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
