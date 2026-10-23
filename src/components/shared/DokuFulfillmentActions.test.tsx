import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DokuFulfillmentActions } from "./DokuFulfillmentActions";

const mocks = vi.hoisted(() => ({ approveDelivery: vi.fn(), canWrite: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/services/transactionService", () => ({ transactionService: { approveDelivery: mocks.approveDelivery } }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ canWrite: mocks.canWrite }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

const order = { id: "paid-order", payment_provider: "DOKU", status: "PAID" as const };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.canWrite.mockReturnValue(true); mocks.approveDelivery.mockResolvedValue(undefined); });

describe("DOKU fulfillment actions", () => {
  it("requires an explicit preparation action before offering upload", async () => {
    const onUpload = vi.fn(), onUpdated = vi.fn();
    const view = render(<DokuFulfillmentActions transaction={order} onUpload={onUpload} onUpdated={onUpdated} />);
    expect(screen.queryByRole("button", { name: "Upload Bukti" })).not.toBeInTheDocument();
    expect(mocks.approveDelivery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mulai persiapan" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(mocks.approveDelivery).toHaveBeenCalledWith(order.id);
    expect(onUpload).not.toHaveBeenCalled();
    // Only refreshed canonical state unlocks upload; clicking prepare alone does not.
    expect(screen.queryByRole("button", { name: "Upload Bukti" })).not.toBeInTheDocument();
    view.rerender(<DokuFulfillmentActions transaction={{ ...order, status: "PREPARING_PRODUCT" }} onUpload={onUpload} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: "Upload Bukti" }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it("deduplicates preparation clicks and keeps upload unavailable after failure", async () => {
    let reject!: (reason: Error) => void;
    mocks.approveDelivery.mockReturnValue(new Promise((_, failure) => { reject = failure; }));
    const onUpdated = vi.fn();
    render(<DokuFulfillmentActions transaction={order} onUpload={vi.fn()} onUpdated={onUpdated} />);
    const button = screen.getByRole("button", { name: "Mulai persiapan" });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.approveDelivery).toHaveBeenCalledTimes(1);
    await act(async () => { reject(new Error("Status pesanan berubah.")); });
    expect(mocks.error).toHaveBeenCalledWith("Status pesanan berubah.");
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Upload Bukti" })).not.toBeInTheDocument();
  });

  it.each(["PAID", "PREPARING_PRODUCT"] as const)("does not allow %s actions without write access", (status) => {
    mocks.canWrite.mockReturnValue(false);
    const onUpload = vi.fn();
    render(<DokuFulfillmentActions transaction={{ ...order, status }} onUpload={onUpload} onUpdated={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.approveDelivery).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it.each(["READY_TO_PICKUP", "COMPLETED"] as const)("allows missing proof for %s without another preparation", (status) => {
    render(<DokuFulfillmentActions transaction={{ ...order, status }} onUpload={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Upload Bukti" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Mulai persiapan" })).not.toBeInTheDocument();
  });

  it.each([
    { ...order, status: "WAITING_TO_PAYMENT" as const },
    { ...order, status: "REJECTED" as const },
    { ...order, status: "COMPLETED" as const, path_proof_pickup: "existing-proof.png" },
    { ...order, payment_provider: "MANUAL" },
  ])("does not offer an ineligible or duplicate DOKU action", (transaction) => {
    render(<DokuFulfillmentActions transaction={transaction} onUpload={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
