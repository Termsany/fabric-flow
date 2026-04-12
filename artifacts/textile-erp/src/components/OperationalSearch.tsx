import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { apiClientRequest } from "@/lib/api-client";
import { useLang } from "@/contexts/LangContext";

type OperationalSearchResult = {
  type: "fabric_roll" | "production_order" | "sales_order" | "warehouse";
  id: number;
  label: string;
  subtitle: string | null;
  href: string;
  metadata: Record<string, unknown>;
};

type OperationalSearchResponse = {
  query: string;
  results: OperationalSearchResult[];
};

export function OperationalSearch() {
  const { t } = useLang();
  const resultTypeLabels: Record<OperationalSearchResult["type"], string> = {
    fabric_roll: t.operationalTypeRoll,
    production_order: t.operationalTypeProduction,
    sales_order: t.operationalTypeSale,
    warehouse: t.operationalTypeWarehouse,
  };
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OperationalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await apiClientRequest<OperationalSearchResponse>(
          `/api/search/operational?q=${encodeURIComponent(trimmed)}&limit=4`,
        );
        if (!cancelled) {
          setResults(response.results);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t.operationalSearchPlaceholder}
        className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pe-3 ps-9 text-sm text-slate-700 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
      />

      {query.trim().length >= 2 && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-400">{t.loading}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">{t.operationalSearchNoResults}</div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((result) => (
                <Link
                  key={`${result.type}-${result.id}`}
                  href={result.href}
                  onClick={() => setQuery("")}
                  className="block px-4 py-3 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-semibold text-slate-800">{result.label}</div>
                      {result.subtitle && (
                        <div className="mt-0.5 truncate text-xs text-slate-500">{result.subtitle}</div>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                      {resultTypeLabels[result.type]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
