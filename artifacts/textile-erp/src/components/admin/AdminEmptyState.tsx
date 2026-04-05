import { Inbox } from "lucide-react";

interface AdminEmptyStateProps {
  title: string;
  description?: string;
}

export function AdminEmptyState({ title, description }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      <div className="rounded-full bg-white p-3 text-slate-400 shadow-sm">
        <Inbox size={20} />
      </div>
      <div className="mt-4 text-base font-medium text-slate-700">{title}</div>
      {description ? <div className="mt-2 max-w-md text-sm text-slate-500">{description}</div> : null}
    </div>
  );
}
