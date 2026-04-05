interface AdminTabItem {
  key: string;
  label: string;
}

interface AdminTabsProps {
  items: AdminTabItem[];
  value: string;
  onChange: (value: string) => void;
}

export function AdminTabs({ items, value, onChange }: AdminTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            value === item.key
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
