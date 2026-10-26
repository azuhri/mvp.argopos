import { describe, expect, it } from "vitest";
import { pickupQrFilename } from "./pickupQrImage";

describe("pickup QR filename", () => {
  it("keeps filenames bounded and removes paths, control characters, and markup", () => {
    const name = pickupQrFilename("../order\\id\n<script>" + "a".repeat(100));
    expect(name).toMatch(/^qr-penyerahan-[a-zA-Z0-9_-]{1,80}\.png$/);
    expect(pickupQrFilename("")).toBe("qr-penyerahan-pesanan.png");
  });
});
