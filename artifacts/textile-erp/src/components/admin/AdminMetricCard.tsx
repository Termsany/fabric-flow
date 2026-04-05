interface AdminMetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}

const toneClasses: Record<NonNullable<AdminMetricCardProps["tone"]>, string> = {
  default: "from-white to-slate-50 text-slate-900",
  primary: "from-indigo-600 to-indigo-700 text-white",
  success: "from-emerald-500 to-emerald-600 text-white",
  warning: "from-amber-400 to-amber-500 text-slate-950",
  danger: "from-rose-500 to-rose-600 text-white",
};

export function AdminMetricCard({ label, value, hint, tone = "default" }: AdminMetricCardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-gradient-to-br p-5 shadow-sm ${toneClasses[tone]}`}>
      <div className={`text-xs font-medium ${tone === "default" ? "text-slate-500" : "text-current/80"}`}>{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className={`mt-2 text-sm ${tone === "default" ? "text-slate-500" : "text-current/80"}`}>{hint}</div> : null}
    </div>
  );
}
