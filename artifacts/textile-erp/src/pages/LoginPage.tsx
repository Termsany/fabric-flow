import { useState } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLogin } from "@workspace/api-client-react";

function getPostLoginPath(role?: string) {
  if (role === "billing_admin") return "/admin/billing";
  if (role === "security_admin") return "/admin/monitoring";
  if (["super_admin", "support_admin", "readonly_admin"].includes(role || "")) return "/admin/tenants";
  return "/dashboard";
}

export function LoginPage() {
  const { t, lang, isRTL } = useLang();
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data as any);
        navigate(getPostLoginPath((data as any)?.user?.role));
      },
      onError: () => {
        setError(t.invalidCredentials);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError(t.requiredField);
      return;
    }
    loginMutation.mutate({ data: { email, password } });
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
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">{t.login}</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={lang === "ar" ? "بريدك الإلكتروني" : "your@email.com"}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? t.loading : t.loginButton}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            {t.noAccount}{" "}
            <a href="/register" className="text-indigo-600 hover:underline">
              {t.registerHere}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
