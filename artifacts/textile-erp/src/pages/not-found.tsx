import { useLang } from "@/contexts/LangContext";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  const { t, isRTL } = useLang();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50" dir={isRTL ? "rtl" : "ltr"}>
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              {t.pageNotFound}
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">{t.pageNotFoundDescription}</p>

          <Link href="/dashboard">
            <button className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
              {t.goToDashboard}
            </button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
