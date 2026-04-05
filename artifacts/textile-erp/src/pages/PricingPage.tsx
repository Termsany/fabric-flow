import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { usePublicPlans } from "@/hooks/use-plans";
import { formatCurrency } from "@/lib/format";

export function PricingPage() {
  const { t, lang, isRTL } = useLang();
  const { data: plans = [], isLoading, error } = usePublicPlans();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <div className="text-sm font-medium text-indigo-600">{t.pricing}</div>
          <h1 className="mt-2 text-4xl font-bold text-slate-900">{t.pricing}</h1>
          <p className="mt-3 text-sm text-slate-500">{t.premiumFeatureNotice}</p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-96 animate-pulse rounded-3xl bg-slate-200" />)}</div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error instanceof Error ? error.message : t.failedToLoadData}</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-medium text-indigo-600">{lang === "ar" ? plan.nameAr : plan.nameEn}</div>
                <p className="mt-3 min-h-12 text-sm text-slate-500">{lang === "ar" ? plan.descriptionAr : plan.descriptionEn}</p>
                <div className="mt-5 grid gap-3">
                  {plan.prices.map((price) => (
                    <div key={price.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-500">{price.interval === "monthly" ? t.monthly : t.yearly}</div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(price.amount, price.baseCurrency, lang)}</div>
                      <div className="mt-1 text-sm text-slate-500">{formatCurrency(price.baseCurrency === "USD" ? price.egpAmount : price.usdAmount, price.baseCurrency === "USD" ? price.egpCurrency : price.usdCurrency, lang)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {plan.features.filter((feature) => feature.included).map((feature) => (
                    <div key={feature.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>{lang === "ar" ? feature.labelAr : feature.labelEn}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register" className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white">{t.register}</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
