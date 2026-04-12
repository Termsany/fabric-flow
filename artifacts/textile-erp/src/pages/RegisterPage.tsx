import { useState } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useRegister } from "@workspace/api-client-react";
import { isTenantAdminRole } from "@/lib/roles";

export function RegisterPage() {
  const { t, isRTL } = useLang();
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ companyName: "", email: "", password: "", fullName: "" });
  const [error, setError] = useState("");

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        login(data as any);
        const role = (data as any)?.user?.role as string | undefined;
        navigate(isTenantAdminRole(role) ? "/subscription" : "/dashboard");
      },
      onError: (err: any) => {
        setError(err?.data?.error || t.serverError);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.companyName || !form.email || !form.password || !form.fullName) {
      setError(t.requiredField);
      return;
    }
    registerMutation.mutate({ data: form });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 flex items-center justify-center p-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="absolute top-4 end-4">
        <LanguageSwitcher variant="dark" compact />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-amber-400 mb-2">{t.appName}</div>
          <div className="text-indigo-200 text-sm">{t.appSubtitle}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">{t.register}</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: "companyName", label: t.companyName, type: "text" },
              { key: "fullName", label: t.fullName, type: "text" },
              { key: "email", label: t.email, type: "email" },
              { key: "password", label: t.password, type: "password" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dir={key === "email" || key === "password" ? "ltr" : undefined}
                />
                {key === "password" && (
                  <p className="mt-1 text-xs text-slate-500">{t.strongPasswordHint}</p>
                )}
              </div>
            ))}
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50"
            >
              {registerMutation.isPending ? t.loading : t.registerButton}
            </button>
            <p className="text-xs text-slate-500 text-center">{t.registerNextStep}</p>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            {t.hasAccount}{" "}
            <a href="/login" className="text-indigo-600 hover:underline">
              {t.loginHere}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
