import QRCode from "qrcode";

type PaymentQrMethod = "instapay" | "vodafone_cash";

interface PaymentQrInput {
  method: PaymentQrMethod;
  accountNumber: string;
  accountName: string;
  amount?: number | null;
}

const qrCache = new Map<string, { expiresAt: number; dataUrl: string; payload: string }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function sanitize(value: string) {
  return value.trim();
}

export function buildPaymentQrPayload({ method, accountNumber, accountName, amount }: PaymentQrInput): string {
  const params = new URLSearchParams();
  params.set("method", method);
  params.set("account", sanitize(accountNumber));

  if (accountName.trim()) {
    params.set("name", sanitize(accountName));
  }

  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    params.set("amount", String(amount));
  }

  if (method === "instapay") {
    return `textile-erp://pay/instapay?${params.toString()}`;
  }

  return `textile-erp://pay/vodafone-cash?${params.toString()}`;
}

export async function generatePaymentQr(input: PaymentQrInput) {
  const payload = buildPaymentQrPayload(input);
  const cacheKey = payload;
  const cached = qrCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { dataUrl: cached.dataUrl, payload: cached.payload, cached: true };
  }

  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  qrCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    dataUrl,
    payload,
  });

  return { dataUrl, payload, cached: false };
}
