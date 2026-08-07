import { describe, expect, it, vi } from "vitest";
import type { PendingPaymentReference } from "@/lib/pendingPaymentStorage";
import {
  PendingPaymentRequestError,
  reconcilePendingPayments,
} from "./usePendingPayments";

const NOW = Date.parse("2026-08-06T08:00:00.000Z");
const reference: PendingPaymentReference = {
  transaction_id: "transaction-1",
  transaction_code: "TRX-001",
  location_code: "AMP-JKT",
  location_name: "AMP Mart Jakarta",
  total_amount: 57_042,
  status: "WAITING_TO_PAYMENT",
  created_at: "2026-08-06T07:00:00.000Z",
  expires_at: "2026-08-06T13:00:00.000Z",
};

describe("reconcilePendingPayments", () => {
  it("verifies an active transaction and refreshes authoritative fields", async () => {
    const fetchTransaction = vi.fn().mockResolvedValue({
      id: reference.transaction_id,
      transaction_code: "TRX-CANONICAL",
      status: "WAITING_TO_PAYMENT",
      total_amount: 60_000,
      created_at: reference.created_at,
      expires_at: "2026-08-06T12:00:00.000Z",
    });

    const result = await reconcilePendingPayments(
      [reference],
      fetchTransaction,
      NOW,
    );

    expect(fetchTransaction).toHaveBeenCalledWith(reference.transaction_id);
    expect(result.failedCount).toBe(0);
    expect(result.verified).toEqual([
      {
        ...reference,
        transaction_code: "TRX-CANONICAL",
        total_amount: 60_000,
        expires_at: "2026-08-06T12:00:00.000Z",
      },
    ]);
    expect(result.retained).toEqual(result.verified);
  });

  it.each(["PAID", "REJECTED", "COMPLETED", "READY_TO_PICKUP"])(
    "removes a transaction with status %s",
    async (status) => {
      const result = await reconcilePendingPayments(
        [reference],
        async () => ({ ...reference, id: reference.transaction_id, status }),
        NOW,
      );

      expect(result.verified).toEqual([]);
      expect(result.retained).toEqual([]);
    },
  );

  it("removes a transaction that reaches the backend expiry", async () => {
    const result = await reconcilePendingPayments(
      [reference],
      async () => ({
        ...reference,
        id: reference.transaction_id,
        expires_at: new Date(NOW).toISOString(),
      }),
      NOW,
    );

    expect(result.retained).toEqual([]);
  });

  it("removes a missing transaction after a 404", async () => {
    const result = await reconcilePendingPayments(
      [reference],
      async () => {
        throw new PendingPaymentRequestError("not found", 404);
      },
      NOW,
    );

    expect(result).toEqual({ verified: [], retained: [], failedCount: 0 });
  });

  it("retains but does not display an entry after a temporary API failure", async () => {
    const result = await reconcilePendingPayments(
      [reference],
      async () => {
        throw new PendingPaymentRequestError("unavailable", 503);
      },
      NOW,
    );

    expect(result.verified).toEqual([]);
    expect(result.retained).toEqual([reference]);
    expect(result.failedCount).toBe(1);
  });
});
