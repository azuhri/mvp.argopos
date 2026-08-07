import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_PAYMENT_STORAGE_KEY,
  parsePendingPaymentStorage,
  readPendingPayments,
  removePendingPayment,
  upsertPendingPayment,
} from "./pendingPaymentStorage";

const NOW = Date.parse("2026-08-06T08:00:00.000Z");

const payment = {
  transaction_id: "transaction-1",
  transaction_code: "TRX-001",
  location_code: "AMP-JKT",
  location_name: "AMP Mart Jakarta",
  total_amount: 57_042,
  status: "WAITING_TO_PAYMENT",
  created_at: "2026-08-06T07:00:00.000Z",
  expires_at: "2026-08-06T13:00:00.000Z",
};

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("pendingPaymentStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses only the supported version and minimal valid fields", () => {
    const parsed = parsePendingPaymentStorage(
      JSON.stringify({
        version: 1,
        items: [{ ...payment, customer_name: "Must not persist" }],
      }),
      NOW,
    );

    expect(parsed).toEqual([payment]);
    expect(parsed[0]).not.toHaveProperty("customer_name");
    expect(
      parsePendingPaymentStorage(
        JSON.stringify({ version: 2, items: [payment] }),
        NOW,
      ),
    ).toEqual([]);
    expect(
      parsePendingPaymentStorage(
        JSON.stringify({ version: 1, items: [{ ...payment, status: "PAID" }] }),
        NOW,
      ),
    ).toEqual([]);
  });

  it("discards malformed values without throwing", () => {
    storage.setItem(PENDING_PAYMENT_STORAGE_KEY, "{not-json");

    expect(readPendingPayments(NOW, storage)).toEqual([]);
    expect(storage.getItem(PENDING_PAYMENT_STORAGE_KEY)).toBeNull();
  });

  it("upserts idempotently by transaction id", () => {
    expect(upsertPendingPayment(payment, NOW, storage)).toBe(true);
    expect(
      upsertPendingPayment(
        { ...payment, total_amount: 60_000 },
        NOW,
        storage,
      ),
    ).toBe(true);

    expect(readPendingPayments(NOW, storage)).toEqual([
      { ...payment, total_amount: 60_000 },
    ]);
  });

  it("sorts by nearest expiry and removes expired entries", () => {
    upsertPendingPayment(
      { ...payment, transaction_id: "later", expires_at: "2026-08-06T14:00:00.000Z" },
      NOW,
      storage,
    );
    upsertPendingPayment(
      { ...payment, transaction_id: "earlier", expires_at: "2026-08-06T10:00:00.000Z" },
      NOW,
      storage,
    );

    expect(readPendingPayments(NOW, storage).map((item) => item.transaction_id)).toEqual([
      "earlier",
      "later",
    ]);
    expect(readPendingPayments(Date.parse("2026-08-06T15:00:00.000Z"), storage)).toEqual([]);
  });

  it("removes a recovery reference without affecting other transactions", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    upsertPendingPayment(payment, NOW, storage);
    upsertPendingPayment(
      { ...payment, transaction_id: "transaction-2", transaction_code: "TRX-002" },
      NOW,
      storage,
    );

    expect(removePendingPayment("transaction-1", storage)).toBe(true);
    expect(readPendingPayments(NOW, storage).map((item) => item.transaction_id)).toEqual([
      "transaction-2",
    ]);
  });

  it("keeps the application usable when storage operations fail", () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readPendingPayments(NOW, unavailableStorage)).toEqual([]);
    expect(upsertPendingPayment(payment, NOW, unavailableStorage)).toBe(false);
  });
});
