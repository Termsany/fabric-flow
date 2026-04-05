import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useLang } from "@/contexts/LangContext";
import { changePassword } from "@/lib/password";

export function ProfileSecurityPage() {
  const { t } = useLang();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setMessage(t.passwordChanged);
      setError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      setMessage("");
      setError(err instanceof Error ? err.message : t.failedToLoadData);
    },
  });

  const handleSubmit = () => {
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }

    mutation.mutate({ currentPassword, newPassword });
  };

  return (
    <Layout>
      <PageHeader title={t.changePassword} subtitle={t.passwordSecurity} />

      {message ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t.currentPassword}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t.newPassword}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">{t.confirmPassword}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
              dir="ltr"
            />
          </div>
          <p className="text-sm text-slate-500">{t.strongPasswordHint}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {mutation.isPending ? t.loading : t.save}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
