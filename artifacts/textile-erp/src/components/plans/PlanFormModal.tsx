import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/contexts/LangContext";
import { formatCurrency } from "@/lib/format";
import type { PlanRecord, PlanUpsertPayload } from "@/lib/plans";

interface PlanFormModalProps {
  open: boolean;
  plan: PlanRecord | null;
  title: string;
  description: string;
  saveLabel: string;
  cancelLabel: string;
  loading?: boolean;
  onClose: () => void;
  onSave: (payload: PlanUpsertPayload) => void;
}

const emptyPayload: PlanUpsertPayload = {
  code: "",
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  isActive: true,
  sortOrder: 0,
  prices: [
    { interval: "monthly", currency: "USD", amount: 49 * 50, trialDays: 0, localPaymentEnabled: true, isActive: true },
    { interval: "yearly", currency: "USD", amount: 490 * 50, trialDays: 0, localPaymentEnabled: true, isActive: true },
  ],
  features: [{ featureKey: "feature_1", labelAr: "", labelEn: "", included: true, sortOrder: 0 }],
};

interface FeatureDraft {
  labelAr: string;
  labelEn: string;
}

function formatFeatureLines(features: PlanUpsertPayload["features"] | PlanRecord["features"]) {
  return {
    ar: features.map((feature) => feature.labelAr).filter(Boolean).join("\n"),
    en: features.map((feature) => feature.labelEn).filter(Boolean).join("\n"),
  };
}

function slugifyFeatureKey(value: string, fallbackIndex: number) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `feature_${fallbackIndex + 1}`;
}

function parseFeatureLines(arText: string, enText: string): FeatureDraft[] {
  const arLines = arText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const enLines = enText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const maxLines = Math.max(arLines.length, enLines.length);

  return Array.from({ length: maxLines }, (_, index) => {
    const labelAr = arLines[index] ?? enLines[index] ?? "";
    const labelEn = enLines[index] ?? arLines[index] ?? "";
    return { labelAr, labelEn };
  }).filter((feature) => feature.labelAr || feature.labelEn);
}

function getPriceByInterval(form: PlanUpsertPayload, interval: "monthly" | "yearly") {
  return form.prices.find((price) => price.interval === interval) ?? {
    interval,
    currency: "USD",
    amount: 0,
    trialDays: 0,
    stripePriceId: null,
    localPaymentEnabled: true,
    isActive: true,
  };
}

function getUsdRate() {
  const parsed = Number((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PRICING_USD_RATE || 50);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function convertEgpToUsd(amount: number, rate: number) {
  return Math.round(((amount || 0) / rate) * 100) / 100;
}

function convertUsdToEgp(amount: number, rate: number) {
  return Math.round((amount || 0) * rate);
}

function convertByCurrency(amount: number, currency: string, rate: number) {
  return String(currency).toUpperCase() === "USD"
    ? { primary: convertEgpToUsd(amount, rate), secondary: amount, primaryCurrency: "USD", secondaryCurrency: "EGP" }
    : { primary: amount, secondary: convertEgpToUsd(amount, rate), primaryCurrency: "EGP", secondaryCurrency: "USD" };
}

export function PlanFormModal({
  open,
  plan,
  title,
  description,
  saveLabel,
  cancelLabel,
  loading,
  onClose,
  onSave,
}: PlanFormModalProps) {
  const { t, isRTL, lang } = useLang();
  const [form, setForm] = useState<PlanUpsertPayload>(emptyPayload);
  const [featuresArText, setFeaturesArText] = useState("");
  const [featuresEnText, setFeaturesEnText] = useState("");

  useEffect(() => {
    if (!plan) {
      setForm(emptyPayload);
      const emptyLines = formatFeatureLines(emptyPayload.features);
      setFeaturesArText(emptyLines.ar);
      setFeaturesEnText(emptyLines.en);
      return;
    }
    const featureLines = formatFeatureLines(plan.features);
    setForm({
      code: plan.code,
      nameAr: plan.nameAr,
      nameEn: plan.nameEn,
      descriptionAr: plan.descriptionAr ?? "",
      descriptionEn: plan.descriptionEn ?? "",
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      prices: plan.prices.map((price) => ({
        interval: price.interval,
        currency: price.currency,
        amount: price.amount,
        trialDays: price.trialDays,
        stripePriceId: price.stripePriceId ?? null,
        localPaymentEnabled: price.localPaymentEnabled,
        isActive: price.isActive,
      })),
      features: plan.features.map((feature) => ({
        featureKey: feature.featureKey,
        labelAr: feature.labelAr,
        labelEn: feature.labelEn,
        included: feature.included,
        sortOrder: feature.sortOrder,
      })),
    });
    setFeaturesArText(featureLines.ar);
    setFeaturesEnText(featureLines.en);
  }, [plan]);

  const monthlyPrice = useMemo(() => getPriceByInterval(form, "monthly"), [form]);
  const yearlyPrice = useMemo(() => getPriceByInterval(form, "yearly"), [form]);
  const usdRate = getUsdRate();

  const updatePrice = (
    interval: "monthly" | "yearly",
    field: "amount" | "currency" | "trialDays" | "localPaymentEnabled" | "isActive",
    value: number | string | boolean,
  ) => {
    setForm((current) => ({
      ...current,
      prices: ["monthly", "yearly"].map((itemInterval) => {
        const currentPrice = getPriceByInterval(current, itemInterval as "monthly" | "yearly");
        if (itemInterval !== interval) {
          return currentPrice;
        }
        return {
          ...currentPrice,
          [field]: value,
        };
      }),
    }));
  };

  const handleSave = () => {
    const parsedFeatures = parseFeatureLines(featuresArText, featuresEnText);

    onSave({
      ...form,
      code: form.code.trim().toLowerCase(),
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim(),
      descriptionAr: form.descriptionAr?.trim() || null,
      descriptionEn: form.descriptionEn?.trim() || null,
      prices: [
        getPriceByInterval(form, "monthly"),
        getPriceByInterval(form, "yearly"),
      ],
      features: parsedFeatures.map((feature, index) => ({
        featureKey: slugifyFeatureKey(feature.labelEn || feature.labelAr, index),
        labelAr: feature.labelAr,
        labelEn: feature.labelEn,
        included: true,
        sortOrder: index,
      })),
    });
  };

  const sectionClassName = "rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5";
  const inputClassName = "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";
  const textareaClassName = `${inputClassName} min-h-28 resize-y`;

  const renderField = (label: string, input: ReactNode) => (
    <label className="grid gap-2 text-sm text-slate-700">
      <span className="font-medium text-slate-800">{label}</span>
      {input}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <section className={sectionClassName}>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">{t.basicInfoSection}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.basicInfoSectionHint}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {renderField(
                t.code,
                <input
                  value={form.code}
                  onChange={(e) => setForm((cur) => ({ ...cur, code: e.target.value }))}
                  className={inputClassName}
                  placeholder="basic"
                  dir="ltr"
                />,
              )}
              {renderField(
                t.sortOrder,
                <input
                  value={String(form.sortOrder)}
                  onChange={(e) => setForm((cur) => ({ ...cur, sortOrder: Number(e.target.value || 0) }))}
                  className={inputClassName}
                  inputMode="numeric"
                  placeholder="0"
                />,
              )}
              {renderField(
                t.nameArabic,
                <input
                  value={form.nameAr}
                  onChange={(e) => setForm((cur) => ({ ...cur, nameAr: e.target.value }))}
                  className={inputClassName}
                  placeholder={t.nameArabic}
                />,
              )}
              {renderField(
                t.nameEnglish,
                <input
                  value={form.nameEn}
                  onChange={(e) => setForm((cur) => ({ ...cur, nameEn: e.target.value }))}
                  className={inputClassName}
                  placeholder={t.nameEnglish}
                  dir="ltr"
                />,
              )}
              {renderField(
                t.descriptionArabic,
                <textarea
                  value={form.descriptionAr ?? ""}
                  onChange={(e) => setForm((cur) => ({ ...cur, descriptionAr: e.target.value }))}
                  className={textareaClassName}
                  placeholder={t.planDescriptionHintAr}
                />,
              )}
              {renderField(
                t.descriptionEnglish,
                <textarea
                  value={form.descriptionEn ?? ""}
                  onChange={(e) => setForm((cur) => ({ ...cur, descriptionEn: e.target.value }))}
                  className={textareaClassName}
                  placeholder={t.planDescriptionHintEn}
                  dir="ltr"
                />,
              )}
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((cur) => ({ ...cur, isActive: e.target.checked }))}
                className="size-4"
              />
              <span className="font-medium text-slate-800">{t.planActive}</span>
            </label>
          </section>

          <section className={sectionClassName}>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">{t.pricingSection}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.pricingSectionHint}</p>
            </div>

            <div className="mb-4">
              {renderField(
                t.currency,
                <div className="space-y-2">
                  <select
                    value={monthlyPrice.currency}
                    onChange={(e) => {
                      updatePrice("monthly", "currency", e.target.value.toUpperCase());
                      updatePrice("yearly", "currency", e.target.value.toUpperCase());
                    }}
                    className={inputClassName}
                    dir="ltr"
                  >
                    <option value="USD">USD</option>
                    <option value="EGP">EGP</option>
                  </select>
                  <div className="text-xs text-slate-500">
                    {t.currencyHint}
                  </div>
                </div>,
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {([
                { interval: "monthly", label: t.monthly, price: monthlyPrice },
                { interval: "yearly", label: t.yearly, price: yearlyPrice },
              ] as const).map(({ interval, label, price }) => (
                <div key={interval} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{label}</h4>
                      <p className="text-xs text-slate-500">{t.planPriceCardHint}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={price.localPaymentEnabled}
                        onChange={(e) => updatePrice(interval, "localPaymentEnabled", e.target.checked)}
                        className="size-4"
                      />
                      {t.localPayments}
                    </label>
                  </div>

                  <div className="grid gap-4">
                    {(() => {
                      const currency = String(price.currency || "USD").toUpperCase();
                      const primary = convertByCurrency(price.amount, currency, usdRate);
                      return renderField(
                        t.amount,
                        <input
                          value={String(primary.primary)}
                          onChange={(e) => updatePrice(
                            interval,
                            "amount",
                            currency === "USD"
                              ? convertUsdToEgp(Number(e.target.value || 0), usdRate)
                              : Number(e.target.value || 0),
                          )}
                          className={inputClassName}
                          inputMode="numeric"
                          placeholder="0"
                          dir="ltr"
                        />,
                      );
                    })()}
                    {(() => {
                      const currency = String(price.currency || "USD").toUpperCase();
                      const primary = convertByCurrency(price.amount, currency, usdRate);
                      return (
                        <div className="text-xs text-slate-500">
                          {formatCurrency(primary.secondary || 0, primary.secondaryCurrency, lang)}
                        </div>
                      );
                    })()}
                    {renderField(
                      t.trialDays,
                      <input
                        value={String(price.trialDays)}
                        onChange={(e) => updatePrice(interval, "trialDays", Number(e.target.value || 0))}
                        className={inputClassName}
                        inputMode="numeric"
                        placeholder="0"
                      />,
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">{t.featuresSection}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.featuresSectionHint}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {renderField(
                t.featuresArabic,
                <textarea
                  value={featuresArText}
                  onChange={(e) => setFeaturesArText(e.target.value)}
                  className={textareaClassName}
                  placeholder={t.featureTextareaPlaceholderAr}
                />,
              )}
              {renderField(
                t.featuresEnglish,
                <textarea
                  value={featuresEnText}
                  onChange={(e) => setFeaturesEnText(e.target.value)}
                  className={textareaClassName}
                  placeholder={t.featureTextareaPlaceholderEn}
                  dir="ltr"
                />,
              )}
            </div>

            <div className={`mt-3 text-xs text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
              {t.featureTextareaHelp}
            </div>
          </section>
        </div>

        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">{cancelLabel}</button>
          <button type="button" disabled={loading} onClick={handleSave} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saveLabel}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
