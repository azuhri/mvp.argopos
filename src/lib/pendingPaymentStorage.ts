export const PENDING_PAYMENT_STORAGE_KEY = "argopos.store.pending-payments.v1";
export const PENDING_PAYMENT_CHANGE_EVENT = "argopos:pending-payments-change";
export const PENDING_PAYMENT_STORAGE_VERSION = 1 as const;

export interface PendingPaymentReference {
  transaction_id: string;
  transaction_code: string;
  location_code: string;
  location_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  expires_at: string;
}

interface PendingPaymentEnvelope {
  version: typeof PENDING_PAYMENT_STORAGE_VERSION;
  items: PendingPaymentReference[];
}

type StorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function toPendingPaymentReference(value: unknown): PendingPaymentReference | null {
  if (!isRecord(value)) return null;

  const totalAmount = value.total_amount;
  if (
    !isNonEmptyString(value.transaction_id) ||
    !isNonEmptyString(value.transaction_code) ||
    !isNonEmptyString(value.location_code) ||
    !isNonEmptyString(value.location_name) ||
    typeof totalAmount !== "number" ||
    !Number.isFinite(totalAmount) ||
    totalAmount < 0 ||
    value.status !== "WAITING_TO_PAYMENT" ||
    !isValidDate(value.created_at) ||
    !isValidDate(value.expires_at)
  ) {
    return null;
  }

  return {
    transaction_id: value.transaction_id,
    transaction_code: value.transaction_code,
    location_code: value.location_code,
    location_name: value.location_name,
    total_amount: totalAmount,
    status: value.status,
    created_at: value.created_at,
    expires_at: value.expires_at,
  };
}

function serializePendingPayments(items: PendingPaymentReference[]): string {
  const envelope: PendingPaymentEnvelope = {
    version: PENDING_PAYMENT_STORAGE_VERSION,
    items,
  };
  return JSON.stringify(envelope);
}

function getBrowserStorage(): StorageAdapter | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function notifyPendingPaymentChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PENDING_PAYMENT_CHANGE_EVENT));
  }
}

export function parsePendingPaymentStorage(
  rawValue: string | null,
  now = Date.now(),
): PendingPaymentReference[] {
  if (!rawValue) return [];

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (
      !isRecord(parsed) ||
      parsed.version !== PENDING_PAYMENT_STORAGE_VERSION ||
      !Array.isArray(parsed.items)
    ) {
      return [];
    }

    const references = new Map<string, PendingPaymentReference>();
    for (const item of parsed.items) {
      const reference = toPendingPaymentReference(item);
      if (!reference || Date.parse(reference.expires_at) <= now) continue;
      references.set(reference.transaction_id, reference);
    }

    return [...references.values()].sort(
      (left, right) => Date.parse(left.expires_at) - Date.parse(right.expires_at),
    );
  } catch {
    return [];
  }
}

export function readPendingPayments(
  now = Date.now(),
  storage: StorageAdapter | null = getBrowserStorage(),
): PendingPaymentReference[] {
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(PENDING_PAYMENT_STORAGE_KEY);
    const items = parsePendingPaymentStorage(rawValue, now);
    const normalizedValue = items.length > 0 ? serializePendingPayments(items) : null;

    if (rawValue !== normalizedValue) {
      if (normalizedValue) storage.setItem(PENDING_PAYMENT_STORAGE_KEY, normalizedValue);
      else storage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    }

    return items;
  } catch {
    return [];
  }
}

export function writePendingPayments(
  items: PendingPaymentReference[],
  now = Date.now(),
  storage: StorageAdapter | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;

  const normalizedItems = parsePendingPaymentStorage(
    serializePendingPayments(items),
    now,
  );
  const nextValue = normalizedItems.length > 0
    ? serializePendingPayments(normalizedItems)
    : null;

  try {
    const currentValue = storage.getItem(PENDING_PAYMENT_STORAGE_KEY);
    if (currentValue === nextValue) return true;

    if (nextValue) storage.setItem(PENDING_PAYMENT_STORAGE_KEY, nextValue);
    else storage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    notifyPendingPaymentChange();
    return true;
  } catch {
    return false;
  }
}

export function upsertPendingPayment(
  item: PendingPaymentReference,
  now = Date.now(),
  storage: StorageAdapter | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;

  const normalizedItem = parsePendingPaymentStorage(
    serializePendingPayments([item]),
    now,
  )[0];
  if (!normalizedItem) return false;

  const currentItems = readPendingPayments(now, storage);
  const nextItems = currentItems.filter(
    (reference) => reference.transaction_id !== normalizedItem.transaction_id,
  );
  nextItems.push(normalizedItem);

  return writePendingPayments(nextItems, now, storage);
}

export function removePendingPayment(
  transactionId: string,
  storage: StorageAdapter | null = getBrowserStorage(),
): boolean {
  if (!storage || !transactionId) return false;

  const currentItems = readPendingPayments(Date.now(), storage);
  const nextItems = currentItems.filter(
    (reference) => reference.transaction_id !== transactionId,
  );
  if (nextItems.length === currentItems.length) return true;

  return writePendingPayments(nextItems, Date.now(), storage);
}
