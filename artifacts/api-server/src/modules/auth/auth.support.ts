const changePasswordAttempts = new Map<string, { count: number; resetAt: number }>();
const CHANGE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const CHANGE_PASSWORD_MAX_ATTEMPTS = 6;

export function isStrongPassword(password: string): boolean {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password);
}

export function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = changePasswordAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    changePasswordAttempts.set(key, { count: 1, resetAt: now + CHANGE_PASSWORD_WINDOW_MS });
    return { limited: false };
  }

  if (entry.count >= CHANGE_PASSWORD_MAX_ATTEMPTS) {
    return { limited: true, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { limited: false };
}

export function clearRateLimit(key: string) {
  changePasswordAttempts.delete(key);
}
