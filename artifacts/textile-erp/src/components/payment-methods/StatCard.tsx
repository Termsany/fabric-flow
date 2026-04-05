import { AdminMetricCard } from "@/components/admin/AdminMetricCard";

interface StatCardProps {
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "danger";
}

export function StatCard({ label, value, tone }: StatCardProps) {
  return <AdminMetricCard label={label} value={value} tone={tone} />;
}
