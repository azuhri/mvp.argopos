import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api";
import { accessRoleService } from "./accessRoleService";

describe("accessRoleService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves Store Management write permission using the server menu ID", async () => {
    vi.spyOn(apiClient, "getAllMenus").mockResolvedValue({ success: true, data: [
      { id: "store-menu", menu_name: "master_stores" },
    ] });
    const update = vi.spyOn(apiClient, "updateRoleAccess").mockResolvedValue({ success: true });
    await accessRoleService.setRolePermissions("staff-role", { master_stores: "write" });
    expect(update).toHaveBeenCalledWith("staff-role", [{ menu_id: "store-menu", access_type: "write" }]);
  });

  it("does not silently discard a store permission when the server menu is missing", async () => {
    vi.spyOn(apiClient, "getAllMenus").mockResolvedValue({ success: true, data: [] });
    const update = vi.spyOn(apiClient, "updateRoleAccess").mockResolvedValue({ success: true });
    await expect(accessRoleService.setRolePermissions("staff-role", { master_stores: "write" }))
      .rejects.toThrow("Menu Store Management belum tersedia");
    expect(update).not.toHaveBeenCalled();
  });

  it("sends stock mutation menu access when saving role permissions", async () => {
    vi.spyOn(apiClient, "getAllMenus").mockResolvedValue({
      success: true,
      data: [
        { id: "menu-dashboard", menu_name: "dashboard" },
        { id: "menu-stock-mutations", menu_name: "master_stock_mutations" },
      ],
    });
    const updateRoleAccess = vi.spyOn(apiClient, "updateRoleAccess").mockResolvedValue({
      success: true,
    });

    await accessRoleService.setRolePermissions("role-admin", {
      master_stock_mutations: "write",
    });

    expect(updateRoleAccess).toHaveBeenCalledWith("role-admin", [
      { menu_id: "menu-dashboard", access_type: "hidden" },
      { menu_id: "menu-stock-mutations", access_type: "write" },
    ]);
  });
});
