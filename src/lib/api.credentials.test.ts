import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("axios", () => ({ default: { create: () => ({
  interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  request: mocks.request,
}) } }));

import { apiClient } from "./api";

describe("transaction cookie compatibility", () => {
  beforeEach(() => { mocks.request.mockReset(); mocks.request.mockResolvedValue({ success: true }); });

  it("keeps public transaction detail compatible with legacy wildcard CORS", async () => {
    await apiClient.getTransaction("manual-one");
    expect(mocks.request.mock.calls[0][0].withCredentials).toBeUndefined();
  });

  it.each(["JSON", "FormData"])("only includes upload ownership cookies for a DOKU transaction (%s)", async (encoding) => {
    const file = encoding === "FormData" ? new File(["fixture"], "proof.png", { type: "image/png" }) : undefined;
    await apiClient.uploadPickupProof("manual-one", file, "proof");
    await apiClient.uploadPickupProof("gateway-one", file, "proof", "DOKU");
    expect(mocks.request.mock.calls[0][0].withCredentials).toBe(false);
    expect(mocks.request.mock.calls[1][0].withCredentials).toBe(true);
  });
});
