import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useListUsers, useCreateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { resetUserPassword } from "@/lib/password";

const ROLES = ["admin", "production", "qc", "warehouse", "sales"];

export function UsersPage() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "production" });
  const [resetUser, setResetUser] = useState<{ id: number; fullName: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data: users, isLoading } = useListUsers();

  const createUser = useCreateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setShowCreate(false);
        setForm({ fullName: "", email: "", password: "", role: "production" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    createUser.mutate({ data: form });
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setError("");
    setSuccess("");
    try {
      await resetUserPassword(resetUser.id, { newPassword });
      setSuccess(t.passwordChanged);
      setResetUser(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t.users}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t.addUser}
          </button>
        }
      />

      {success ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.addUser}</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.fullName}</label>
                <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.email}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required dir="ltr"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.password}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required dir="ltr"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.role}</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {(t.roles as Record<string, string>)[r] || r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600">{t.cancel}</button>
                <button type="submit" disabled={createUser.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {createUser.isPending ? t.loading : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.fullName}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.email}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.role}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.status}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.date}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                  ))}</tr>
                ))
              ) : (users || []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">{t.noData}</td></tr>
              ) : (
                (users || []).map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{user.fullName}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs dir-ltr">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium capitalize">
                        {(t.roles as Record<string, string>)[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {user.isActive ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(user.createdAt, lang)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setResetUser({ id: user.id, fullName: user.fullName })}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        <KeyRound size={14} />
                        {t.resetPassword}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetUser ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.resetPasswordForUser}</h2>
              <button onClick={() => setResetUser(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-500">{resetUser.fullName}</div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.newPassword}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  dir="ltr"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-sm text-slate-500">{t.strongPasswordHint}</p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setResetUser(null)} className="px-4 py-2 text-sm text-slate-600">{t.cancel}</button>
                <button type="button" onClick={() => void handleResetPassword()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
