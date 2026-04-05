import { useLang } from "@/contexts/LangContext";

const statusColors: Record<string, string> = {
  CREATED: "bg-gray-100 text-gray-700 border-gray-200",
  IN_PRODUCTION: "bg-blue-100 text-blue-700 border-blue-200",
  QC_PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  QC_PASSED: "bg-green-100 text-green-700 border-green-200",
  QC_FAILED: "bg-red-100 text-red-700 border-red-200",
  SENT_TO_DYEING: "bg-purple-100 text-purple-700 border-purple-200",
  IN_DYEING: "bg-indigo-100 text-indigo-700 border-indigo-200",
  FINISHED: "bg-teal-100 text-teal-700 border-teal-200",
  IN_STOCK: "bg-emerald-100 text-emerald-700 border-emerald-200",
  RESERVED: "bg-orange-100 text-orange-700 border-orange-200",
  SOLD: "bg-slate-100 text-slate-700 border-slate-200",
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  SENT: "bg-purple-100 text-purple-700 border-purple-200",
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  CONFIRMED: "bg-blue-100 text-blue-700 border-blue-200",
  INVOICED: "bg-cyan-100 text-cyan-700 border-cyan-200",
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
  PASS: "bg-green-100 text-green-700 border-green-200",
  FAIL: "bg-red-100 text-red-700 border-red-200",
  SECOND: "bg-orange-100 text-orange-700 border-orange-200",
  active: "bg-green-100 text-green-700 border-green-200",
  trialing: "bg-amber-100 text-amber-700 border-amber-200",
  past_due: "bg-orange-100 text-orange-700 border-orange-200",
  canceled: "bg-rose-100 text-rose-700 border-rose-200",
  unpaid: "bg-rose-100 text-rose-700 border-rose-200",
  incomplete: "bg-slate-100 text-slate-600 border-slate-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useLang();
  const colorClass = statusColors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  const label = (t as unknown as Record<string, string>)[status] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}
