export function parsePaymentExpiry(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;

  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getRemainingPaymentSeconds(
  expiresAt?: string | null,
  now = Date.now(),
): number | null {
  const expiryTimestamp = parsePaymentExpiry(expiresAt);
  if (expiryTimestamp === null) return null;

  return Math.max(Math.ceil((expiryTimestamp - now) / 1000), 0);
}
