import { describe, expect, it } from "vitest";

import { getFilteredNavigation, NAV_GROUPS_MENUS } from "./navigation";

describe("admin navigation", () => {
  it("uses the independent payments grant for the DOKU report", () => {
    const menus = getFilteredNavigation((key) => key === "payments").flatMap((group) => group.listMenus);
    expect(menus).toHaveLength(1);
    expect(menus[0]).toMatchObject({ key: "payments", path: "/payments" });
  });

  it("omits groups without readable menus", () => {
    expect(getFilteredNavigation(() => false)).toEqual([]);
  });
  it("registers the canonical stock mutations menu", () => {
    const stockMutations = NAV_GROUPS_MENUS
      .flatMap((group) => group.listMenus)
      .find((menu) => menu.key === "master_stock_mutations");

    expect(stockMutations).toMatchObject({
      path: "/master/stock-mutations",
      label: "Stock Mutations",
    });
  });
});
