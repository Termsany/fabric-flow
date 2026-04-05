import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useListAuditLogs } from "@workspace/api-client-react";
import { formatDateTime } from "@/lib/format";
import { Link } from "wouter";

export function AuditLogsPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { data: logs, isLoading, error } = useListAuditLogs({ limit: 100 });

  const ACTION_COLORS: Record<string, string> = {
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
  };
  const ACTION_LABELS: Record<string, string> = {
    CREATE: t.actionCreate,
    UPDATE: t.actionUpdate,
    DELETE: t.actionDelete,
  };

  const accessError = error as { status?: number } | undefined;
  const accessErrorMessage = (() => {
    if (!accessError) return null;
    if (accessError.status === 403) return t.featureRequiresPro;
    if (accessError.status === 402) return t.subscriptionInactiveMessage;
    return t.failedToLoadData;
  })();

  return (
    <Layout>
      <PageHeader title={t.auditLogs} />

      {accessErrorMessage && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <div className="font-medium">{accessErrorMessage}</div>
          {accessError?.status === 403 && user?.role === "admin" && (
            <div className="mt-3">
              <Link href="/billing" className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700">
                {t.goToBilling}
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.action}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.entityType}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.entityId}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.user}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.changes}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.date}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                  ))}</tr>
                ))
              ) : accessErrorMessage ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">{accessErrorMessage}</td></tr>
              ) : (logs || []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">{t.noAuditLogsYet}</td></tr>
              ) : (
                (logs || []).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || "bg-slate-100 text-slate-600"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">#{log.entityId}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{log.userId ? `#${log.userId}` : "—"}</td>
                    <td className="px-4 py-3">
                      {log.changes ? (
                        <code className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 block max-w-48 truncate">
                          {log.changes}
                        </code>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDateTime(log.createdAt, lang)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
