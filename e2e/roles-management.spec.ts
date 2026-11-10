import { expect, test, type Page, type Route } from "@playwright/test";

type Access = "hidden" | "read" | "write";
type MenuAccess = { menu_id: string; access_type: Access };
type FixtureRole = { id: string; role_name: string; description: string; user_count: number; name_locked: boolean; deletable: boolean; permissions: Record<string, Access> };
const diagnostics = new WeakMap<Page, { consoleErrors: string[]; unexpectedRequests: string[]; expectedErrorStatuses: Set<number> }>();

test.afterEach(async ({ page }) => {
  const captured = diagnostics.get(page);
  if (!captured) return;
  expect(captured.unexpectedRequests, "Every API request must match an explicit fixture contract").toEqual([]);
  expect(captured.consoleErrors.filter(message => ![...captured.expectedErrorStatuses].some(status => message.startsWith(`Failed to load resource: the server responded with a status of ${status} `))), "No unexpected browser console errors").toEqual([]);
});

const menus = [
  ["dashboard", "Dashboard"], ["transactions", "Transactions"], ["payments", "Pembayaran DOKU"],
  ["customers", "Customers"], ["koperasi", "Koperasi"], ["master_users", "User Management"],
  ["master_products", "Product Management"], ["master_locations", "Location Management"],
  ["master_stock", "Stock Management"], ["master_stock_mutations", "Stock Mutations"],
  ["master_stores", "Store Management"], ["master_roles", "Role Management"],
].map(([key, label]) => ({ id: `menu-${key}`, menu_name: key, label }));

async function mockRoles(page: Page, roleAccess: Access = "write") {
  const all = (access: Access): Record<string, Access> => Object.fromEntries(menus.map(menu => [menu.menu_name, access]));
  const roles: FixtureRole[] = [
    { id: "role-admin", role_name: "super_admin", description: "Administrator sistem", user_count: 1, name_locked: true, deletable: false, permissions: { ...all("write"), master_roles: roleAccess } },
    { id: "role-staff", role_name: "staff_internal", description: "Akses operasional untuk tim internal", user_count: 3, name_locked: true, deletable: false, permissions: { ...all("write"), dashboard: "read", master_locations: "read", master_users: "hidden", master_roles: "hidden" } },
    { id: "role-reader", role_name: "auditor", description: "Pemeriksaan laporan bulanan", user_count: 2, name_locked: false, deletable: false, permissions: { ...all("hidden"), dashboard: "read", master_roles: "read" } },
    { id: "role-empty", role_name: "tester", description: "Role untuk pengujian", user_count: 0, name_locked: false, deletable: true, permissions: all("hidden") },
  ];
  const state = { roles, failNextSave: false, failDetailsFor: "", failedDetailRequests: 0, writes: [] as Array<{ method: string; path: string; body: Record<string, unknown> }>, deniedRequests: [] as string[], pageErrors: [] as string[] };
  const captured = { consoleErrors: [] as string[], unexpectedRequests: [] as string[], expectedErrorStatuses: new Set<number>() };
  diagnostics.set(page, captured);
  page.on("pageerror", error => state.pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") captured.consoleErrors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem("argopos.auth.user", JSON.stringify({ id: "qa-admin", username: "admin", email: "admin@example.test", role: "super_admin", role_id: "role-admin", created_at: "2026-11-06T00:00:00Z", updated_at: "2026-11-06T00:00:00Z" }));
    localStorage.setItem("argopos.auth.token", "roles-browser-fixture-token");
  });
  const json = (route: Route, data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  const fail = (route: Route, message: string, status: number) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: false, code: status, error: { message } }) });
  const roleResponse = (role: FixtureRole) => ({ ...role, access_roles: menus.map(menu => ({ id: `${role.id}-${menu.id}`, role_id: role.id, menu_id: menu.id, access_type: role.permissions[menu.menu_name] || "hidden", menu: { id: menu.id, menu_name: menu.menu_name } })) });
  await page.route("**/api/v1/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname.split("/api/v1")[1].replace(/\/$/, "");
    const method = req.method();
    if (path === "/users" && method === "GET") return json(route, { id: "qa-admin", username: "admin", email: "admin@example.test", role_id: "role-admin", role: { id: "role-admin", role_name: "super_admin" }, assigned_stores: [] });
    if (path === "/menus/list") return json(route, menus.map(({ id, menu_name }) => ({ id, menu_name })));
    if (path === "/access-roles/roles" && method === "GET") return json(route, { roles: roles.map(roleResponse), meta: { page: 1, page_size: 100, total: roles.length } });
    const roleDetail = path.match(/^\/access-roles\/role\/([^/]+)\/with-access$/);
    if (roleDetail && method === "GET") {
      if (roleDetail[1] === state.failDetailsFor) {
        state.failedDetailRequests++;
        captured.expectedErrorStatuses.add(503);
        return fail(route, "Pembaruan role belum tersedia.", 503);
      }
      const role = roles.find(item => item.id === roleDetail[1]);
      return role ? json(route, roleResponse(role)) : fail(route, "Role tidak ditemukan", 404);
    }
    const roleMutation = path.match(/^\/access-roles\/role(?:\/([^/]+))?$/);
    if (roleMutation && ["POST", "PUT", "DELETE"].includes(method)) {
      expect(req.headers().authorization).toBe("Bearer roles-browser-fixture-token");
      const body = method === "DELETE" ? {} : req.postDataJSON() as Record<string, unknown>;
      state.writes.push({ method, path, body });
      if (roles[0].permissions.master_roles !== "write") { state.deniedRequests.push(path); return fail(route, "Akses ditolak", 403); }
      if (state.failNextSave) { state.failNextSave = false; captured.expectedErrorStatuses.add(503); return fail(route, "Perubahan belum dapat disimpan. Coba kembali.", 503); }
      const id = roleMutation[1];
      let role = roles.find(item => item.id === id);
      if (method === "DELETE") {
        if (!role) return fail(route, "Role tidak ditemukan", 404);
        if (!role.deletable || role.user_count) return fail(route, "Role masih digunakan atau dilindungi", 409);
        roles.splice(roles.indexOf(role), 1); return json(route, null);
      }
      if (method === "POST") {
        role = { id: `role-created-${roles.length}`, role_name: String(body.role_name), description: String(body.description || ""), user_count: 0, name_locked: false, deletable: true, permissions: all("hidden") };
        roles.push(role);
      }
      if (!role) return fail(route, "Role tidak ditemukan", 404);
      if (body.role_name) role.role_name = String(body.role_name);
      if (body.description !== undefined) role.description = String(body.description);
      if (Array.isArray(body.menu_accesses)) role.permissions = Object.fromEntries(menus.map(menu => [menu.menu_name, (body.menu_accesses as MenuAccess[]).find(access => access.menu_id === menu.id)?.access_type || "hidden"]));
      return json(route, roleResponse(role));
    }
    captured.unexpectedRequests.push(`${method} ${path}`);
    return fail(route, `Unexpected fixture endpoint: ${method} ${path}`, 404);
  });
  return state;
}

test("edit preserves protected names and keeps failed changes unsaved until an atomic retry succeeds", async ({ page }, testInfo) => {
  const state = await mockRoles(page);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/master/roles/role-staff/edit");
  await expect(page.getByRole("heading", { name: "Edit Role", exact: true })).toBeVisible();
  await expect(page.getByLabel("Nama role", { exact: false })).not.toBeEditable();
  await expect(page.getByLabel("Nama role", { exact: false })).toHaveValue("staff_internal");
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "User Management: Hidden", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Simpan Perubahan", exact: true })).toBeDisabled();
  await page.getByLabel("Deskripsi", { exact: true }).fill("Tim operasional dengan akses laporan");
  await page.getByRole("radio", { name: "Transactions: Read", exact: true }).check();
  await page.screenshot({ path: testInfo.outputPath("roles-edit-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("roles-edit-mobile.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1050 });
  state.failNextSave = true;
  await page.getByRole("button", { name: "Simpan Perubahan", exact: true }).click();
  await expect(page.getByText("Perubahan belum dapat disimpan. Coba kembali.", { exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/role-staff\/edit$/);
  expect(state.roles.find(role => role.id === "role-staff")?.permissions.transactions).toBe("write");
  await expect(page.getByRole("radio", { name: "Transactions: Read", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Simpan Perubahan", exact: true }).click();
  await expect(page).toHaveURL(/\/master\/roles$/);
  expect(state.writes).toHaveLength(2);
  expect(state.roles.find(role => role.id === "role-staff")).toMatchObject({ role_name: "staff_internal", description: "Tim operasional dengan akses laporan", user_count: 3 });
  expect(state.roles.find(role => role.id === "role-staff")?.permissions.transactions).toBe("read");
  await page.goto("/master/roles/role-staff/edit");
  await expect(page.getByRole("radio", { name: "Transactions: Read", exact: true })).toBeChecked();
  expect(state.pageErrors).toEqual([]);
});

test("copy replaces only target permissions and survives reload", async ({ page }) => {
  const state = await mockRoles(page);
  await page.goto("/master/roles");
  await page.getByRole("button", { name: "Copy Permissions", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Role sumber", { exact: true }).selectOption("role-staff");
  await dialog.getByLabel("Role tujuan", { exact: true }).selectOption("role-empty");
  await dialog.getByRole("button", { name: "Salin permission", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ method: "PUT", path: "/access-roles/role/role-empty" });
  expect(state.roles.find(role => role.id === "role-empty")?.permissions).toEqual(state.roles.find(role => role.id === "role-staff")?.permissions);
  expect(state.roles.find(role => role.id === "role-empty")?.role_name).toBe("tester");
  expect(state.roles.find(role => role.id === "role-empty")?.description).toBe("Role untuk pengujian");
  await page.reload();
  await page.getByRole("row").filter({ hasText: "tester" }).getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeDisabled();
  expect(state.pageErrors).toEqual([]);
});

test("background detail refresh failure preserves the unsaved role draft", async ({ page }) => {
  const state = await mockRoles(page);
  await page.goto("/master/roles/role-staff/edit");
  await page.getByLabel("Deskripsi", { exact: true }).fill("Draft tetap tersimpan saat jaringan bermasalah");
  await page.getByRole("radio", { name: "Transactions: Read", exact: true }).check();
  state.failDetailsFor = "role-staff";
  // React Query refetches stale active queries when the browser becomes visible again.
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => state.failedDetailRequests, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  await expect(page.getByLabel("Deskripsi", { exact: true })).toHaveValue("Draft tetap tersimpan saat jaringan bermasalah");
  await expect(page.getByRole("radio", { name: "Transactions: Read", exact: true })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Role belum dapat dimuat", exact: true })).toHaveCount(0);
  state.failDetailsFor = "";
  await page.getByRole("button", { name: "Simpan Perubahan", exact: true }).click();
  await expect(page).toHaveURL(/\/master\/roles$/);
  expect(state.roles.find(role => role.id === "role-staff")?.description).toBe("Draft tetap tersimpan saat jaringan bermasalah");
  expect(state.roles.find(role => role.id === "role-staff")?.permissions.transactions).toBe("read");
  expect(state.writes).toHaveLength(1);
  expect(state.pageErrors).toEqual([]);
});

test("breadcrumb navigation asks before discarding the unsaved role draft", async ({ page }) => {
  const state = await mockRoles(page);
  await page.goto("/master/roles/role-staff/edit");
  await page.getByLabel("Deskripsi", { exact: true }).fill("Perubahan belum disimpan");
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
  await breadcrumb.getByRole("link", { name: "Role Management", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Buang perubahan?", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Lanjutkan edit", exact: true }).click();
  await expect(page).toHaveURL(/\/role-staff\/edit$/);
  await expect(page.getByLabel("Deskripsi", { exact: true })).toHaveValue("Perubahan belum disimpan");
  await breadcrumb.getByRole("link", { name: "Role Management", exact: true }).click();
  await dialog.getByRole("button", { name: "Buang perubahan", exact: true }).click();
  await expect(page).toHaveURL(/\/master\/roles$/);
  expect(state.roles.find(role => role.id === "role-staff")?.description).toBe("Akses operasional untuk tim internal");
  expect(state.writes).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test("reset and delete require explicit confirmation and persist their distinct changes", async ({ page }) => {
  const state = await mockRoles(page);
  const target = state.roles.find(role => role.id === "role-empty")!;
  target.permissions.transactions = "write";
  target.permissions.payments = "read";
  await page.goto("/master/roles");
  await page.getByRole("button", { name: "Aksi tester", exact: true }).click();
  await page.getByRole("menuitem", { name: "Reset permission", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(state.writes).toEqual([]);
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  expect(target.permissions.transactions).toBe("write");
  await page.getByRole("button", { name: "Aksi tester", exact: true }).click();
  await page.getByRole("menuitem", { name: "Reset permission", exact: true }).click();
  await dialog.getByRole("button", { name: "Reset permission", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(Object.values(target.permissions)).toEqual(menus.map(() => "hidden"));
  expect(target.description).toBe("Role untuk pengujian");
  expect(state.roles).toHaveLength(4);
  await page.reload();
  await page.getByRole("button", { name: "Aksi tester", exact: true }).click();
  await page.getByRole("menuitem", { name: "Hapus role", exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(state.roles).toHaveLength(4);
  await dialog.getByRole("button", { name: "Hapus role", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "tester" })).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toMatchObject({ method: "DELETE", path: "/access-roles/role/role-empty" });
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "tester" })).toHaveCount(0);
  await page.getByRole("button", { name: "Aksi auditor", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Hapus role", exact: true })).toBeDisabled();
  expect(state.pageErrors).toEqual([]);
});

test("readonly role can inspect but cannot open create or edit routes", async ({ page }) => {
  const state = await mockRoles(page, "read");
  await page.goto("/master/roles");
  await expect(page.getByRole("main").getByRole("heading", { name: "Role Management", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Permissions", exact: true }).and(page.locator(":enabled"))).toHaveCount(0);
  await page.goto("/master/roles/role-staff");
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeDisabled();
  await page.goto("/master/roles/new");
  await expect(page.getByRole("alert")).toContainText(/permission|akses/i);
  await page.goto("/master/roles/role-staff/edit");
  await expect(page.getByRole("alert")).toContainText(/permission|akses/i);
  expect(state.writes).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test("hidden permission denies direct role list and detail access even for super_admin", async ({ page }) => {
  const state = await mockRoles(page, "hidden");
  await page.goto("/master/roles");
  await expect(page.getByRole("alert")).toContainText(/permission|akses/i);
  await expect(page.getByRole("heading", { name: "Role Management", exact: true })).toHaveCount(0);
  await page.goto("/master/roles/role-staff");
  await expect(page.getByRole("alert")).toContainText(/permission|akses/i);
  await expect(page.getByRole("radio")).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test("saving a current-role revocation removes DOKU navigation and denies its route immediately", async ({ page }) => {
  const state = await mockRoles(page);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/master/roles/role-admin/edit");
  await expect(page.getByRole("link", { name: "Pembayaran DOKU", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Pembayaran DOKU: Hidden", exact: true }).check();
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Simpan Perubahan", exact: true }).click();
  await expect(page).toHaveURL(/\/master\/roles$/);
  await expect(page.getByRole("link", { name: "Pembayaran DOKU", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Transactions", exact: true })).toBeVisible();
  await page.goto("/payments");
  await expect(page.getByRole("alert")).toContainText(/permission|akses/i);
  expect(state.roles[0].permissions.payments).toBe("hidden");
  expect(state.roles[0].permissions.transactions).toBe("write");
  expect(state.writes).toHaveLength(1);
  expect(state.pageErrors).toEqual([]);
});

test("copying a template edits only the draft and cancel protects unsaved changes", async ({ page }) => {
  const state = await mockRoles(page);
  await page.goto("/master/roles/new");
  await page.getByLabel("Nama role", { exact: false }).fill("operations_copy");
  await page.getByLabel("Deskripsi", { exact: true }).fill("Salinan untuk tim baru");
  await page.getByLabel("Salin permission dari", { exact: true }).selectOption("role-staff");
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "User Management: Hidden", exact: true })).toBeChecked();
  await expect(page.getByLabel("Nama role", { exact: false })).toHaveValue("operations_copy");
  await expect(page.getByLabel("Deskripsi", { exact: true })).toHaveValue("Salinan untuk tim baru");
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  const confirmation = page.getByRole("dialog");
  await expect(confirmation).toContainText("Buang perubahan?");
  await confirmation.getByRole("button", { name: "Lanjutkan edit", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Transactions: Write", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await confirmation.getByRole("button", { name: "Buang perubahan", exact: true }).click();
  await expect(page).toHaveURL(/\/master\/roles$/);
  expect(state.writes).toEqual([]);
  expect(state.roles).toHaveLength(4);
  expect(state.pageErrors).toEqual([]);
});

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("role list reflects server counts, search and exclusive access filtering", async ({ page }, testInfo) => {
  const state = await mockRoles(page);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/master/roles");
  await expect(page.getByRole("main").getByRole("heading", { name: "Role Management", exact: true })).toBeVisible();
  const staffCells = page.getByRole("row", { name: "Role staff_internal", exact: true }).getByRole("cell");
  await expect(staffCells.nth(1)).toHaveText("3");
  await expect(staffCells.nth(2)).toHaveText("2");
  await expect(staffCells.nth(3)).toHaveText("8");
  await expect(staffCells.nth(4)).toHaveText("2");
  await expect(page.getByText("Total Role", { exact: true })).toBeVisible();
  await expect(page.getByText("Total Menu", { exact: true })).toBeVisible();
  await expect(page.getByText("Pengguna dengan Role", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Total Role", exact: true })).toContainText("4");
  await expect(page.getByRole("region", { name: "Total Menu", exact: true })).toContainText("12");
  await expect(page.getByRole("region", { name: "Pengguna dengan Role", exact: true })).toContainText("6");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("roles-list-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await expect(page.getByRole("article", { name: "Role staff_internal", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("roles-list-mobile.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.getByPlaceholder("Cari nama atau deskripsi role...").fill("laporan bulanan");
  await expect(page.getByRole("row").filter({ hasText: "auditor" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "staff_internal" })).toHaveCount(0);
  await page.getByPlaceholder("Cari nama atau deskripsi role...").clear();
  await page.getByLabel("Akses menu", { exact: true }).selectOption("write");
  await expect(page.getByRole("row").filter({ hasText: "staff_internal" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "auditor" })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`create role submits one complete permission matrix and persists at ${width}px`, async ({ page }, testInfo) => {
    const state = await mockRoles(page);
    await page.setViewportSize({ width, height: 1050 });
    await page.goto("/master/roles/new");
    await expect(page.getByRole("heading", { name: "Tambah Role", exact: true })).toBeVisible();
    expect(await page.getByRole("radio", { checked: true }).count()).toBe(menus.length);
    await expect(page.getByRole("radio", { name: /: Hidden$/, checked: true })).toHaveCount(menus.length);
    await expect(page.getByRole("button", { name: "Buat Role", exact: true })).toBeDisabled();
    await page.getByLabel("Nama role", { exact: false }).fill("finance_readonly");
    await page.getByLabel("Deskripsi", { exact: true }).fill("Laporan keuangan tanpa perubahan transaksi");
    if (width < 768) {
      // Exercise rows below the bottom navigation without forcing clicks or bypassing actionability.
      await page.getByRole("radio", { name: "Stock Mutations: Read", exact: true }).check();
      await page.getByRole("radio", { name: "Stock Mutations: Hidden", exact: true }).check();
      await page.getByRole("radio", { name: "Role Management: Read", exact: true }).check();
      await page.getByRole("radio", { name: "Role Management: Hidden", exact: true }).check();
    }
    await page.getByRole("radio", { name: "Transactions: Read", exact: true }).check();
    await expect(page.getByRole("radio", { name: "Transactions: Read", exact: true })).toBeChecked();
    await page.getByRole("radio", { name: "Pembayaran DOKU: Write", exact: true }).check();
    await expect(page.getByRole("radio", { name: "Transactions: Read", exact: true })).toBeChecked();
    await page.getByLabel("Cari menu permission", { exact: true }).fill("product");
    await page.getByRole("radio", { name: "Product Management: Read", exact: true }).check();
    await page.getByLabel("Cari menu permission", { exact: true }).clear();
    await expect(page.getByRole("radio", { name: "Transactions: Read", exact: true })).toBeChecked();
    await expect(page.getByTestId("permission-count-hidden")).toHaveText("9");
    await expect(page.getByTestId("permission-count-read")).toHaveText("2");
    await expect(page.getByTestId("permission-count-write")).toHaveText("1");
    await noOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`roles-create-${width}.png`), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Buat Role", exact: true }).dblclick();
    await expect(page).toHaveURL(/\/master\/roles$/);
    expect(state.writes).toHaveLength(1);
    const body = state.writes[0].body;
    expect(body).toMatchObject({ role_name: "finance_readonly", description: "Laporan keuangan tanpa perubahan transaksi" });
    expect(body.menu_accesses).toHaveLength(menus.length);
    expect(body.menu_accesses).toEqual(expect.arrayContaining([{ menu_id: "menu-transactions", access_type: "read" }, { menu_id: "menu-payments", access_type: "write" }, { menu_id: "menu-master_products", access_type: "read" }, { menu_id: "menu-master_users", access_type: "hidden" }]));
    await page.reload();
    const savedRole = width < 1280
      ? page.getByRole("article", { name: "Role finance_readonly", exact: true })
      : page.getByRole("row", { name: "Role finance_readonly", exact: true });
    await expect(savedRole).toBeVisible();
    expect(state.pageErrors).toEqual([]);
  });
}
