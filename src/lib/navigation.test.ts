import { describe, expect, it } from "vitest";

import { NAV_GROUPS_MENUS } from "./navigation";

describe("admin navigation", () => {
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
