import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Check, RefreshCw } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useLang } from "@/contexts/LangContext";
import { formatDateTime } from "@/lib/format";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkNotificationsRead,
} from "@workspace/api-client-react";

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-800",
  critical: "bg-rose-50 text-rose-700",
};

export function NotificationsPage() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);

  const params = useMemo(
    () => ({
      unreadOnly: unreadOnly ? true : undefined,
      limit: 100,
      refresh: refreshPending ? true : undefined,
    }),
    [unreadOnly, refreshPending],
  );

  const { data: notifications, isLoading } = useListNotifications(params, {
    query: {
      onSuccess: () => {
        if (refreshPending) {
          setRefreshPending(false);
        }
      },
    },
  });

  const markOne = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      },
    },
  });

  const markAll = useMarkNotificationsRead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      },
    },
  });

  const unreadIds = (notifications || []).filter((item) => !item.isRead).map((item) => item.id);

  return (
    <Layout>
      <PageHeader
        title={t.notifications}
        action={
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              {t.unreadOnly}
            </label>
            <button
              type="button"
              onClick={() => setRefreshPending(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              {t.refresh}
            </button>
            <button
              type="button"
              onClick={() => unreadIds.length > 0 && markAll.mutate({ data: { ids: unreadIds } })}
              disabled={unreadIds.length === 0 || markAll.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <Check size={16} />
              {t.markAllRead}
            </button>
          </>
        }
      />

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
              <div className="mt-3 h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
            </div>
          ))
        ) : (notifications || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Bell size={20} />
            </div>
            <div className="text-sm font-medium text-slate-700">{t.noNotifications}</div>
          </div>
        ) : (
          (notifications || []).map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition ${
                item.isRead ? "opacity-70" : "shadow-md"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${SEVERITY_STYLES[item.severity] || "bg-slate-100 text-slate-600"}`}>
                    {(t.notificationSeverities as Record<string, string>)[item.severity] || item.severity}
                  </span>
                  {!item.isRead && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                      {t.notificationUnread}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">{formatDateTime(item.createdAt, lang)}</div>
              </div>

              <div className="mt-3 text-base font-semibold text-slate-800">{item.title}</div>
              <div className="mt-1 text-sm text-slate-600">{item.message}</div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <div>
                  {item.entityType ? `${item.entityType}${item.entityId ? ` #${item.entityId}` : ""}` : "—"}
                </div>
                <button
                  type="button"
                  onClick={() => markOne.mutate({ params: { id: item.id } })}
                  disabled={item.isRead || markOne.isPending}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {t.markRead}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
