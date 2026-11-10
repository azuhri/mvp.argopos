import { expect, it, vi } from "vitest";
import { userService } from "./userService";

const api = vi.hoisted(() => ({ getRoleManagementPage: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

it("includes roles on later pages in the user assignment selector", async () => {
  api.getRoleManagementPage.mockResolvedValueOnce({
    success: true, data: { roles: [{ id: "role-1", role_name: "admin" }], meta: { total: 2 } },
  }).mockResolvedValueOnce({
    success: true, data: { roles: [{ id: "role-2", role_name: "finance_custom" }], meta: { total: 2 } },
  });
  expect(await userService.getRoles()).toEqual([
    { id: "role-1", role_name: "admin" }, { id: "role-2", role_name: "finance_custom" },
  ]);
});
