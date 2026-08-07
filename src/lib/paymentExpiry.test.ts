import { describe, expect, it } from "vitest";
import {
  getRemainingPaymentSeconds,
  parsePaymentExpiry,
} from "./paymentExpiry";

const NOW = Date.parse("2026-08-06T08:00:00.000Z");

describe("paymentExpiry", () => {
  it("returns the wall-clock duration until the backend expiry", () => {
    expect(
      getRemainingPaymentSeconds("2026-08-06T10:00:00.000Z", NOW),
    ).toBe(7_200);
  });

  it("does not display zero before the exact expiry boundary", () => {
    expect(
      getRemainingPaymentSeconds("2026-08-06T08:00:00.500Z", NOW),
    ).toBe(1);
    expect(
      getRemainingPaymentSeconds("2026-08-06T08:00:00.000Z", NOW),
    ).toBe(0);
  });

  it("distinguishes an unavailable expiry from an expired transaction", () => {
    expect(parsePaymentExpiry(undefined)).toBeNull();
    expect(parsePaymentExpiry("not-a-date")).toBeNull();
    expect(getRemainingPaymentSeconds(undefined, NOW)).toBeNull();
    expect(
      getRemainingPaymentSeconds("2026-08-06T07:59:59.000Z", NOW),
    ).toBe(0);
  });
});
