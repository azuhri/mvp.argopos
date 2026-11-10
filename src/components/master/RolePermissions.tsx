import { useState } from "react";
import { Info, Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NAV_GROUPS_MENUS } from "@/lib/navigation";
import type { Menu } from "@/lib/api";
import { permissionCounts, type Permission, type PermissionMatrix } from "@/lib/services/roleManagementService";

const permissionLabels: Record<Permission, string> = { hidden: "Hidden", read: "Read", write: "Write" };
const permissionStyles: Record<Permission, string> = {
  hidden: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
  read: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  write: "bg-[#091b50] text-white dark:bg-blue-700",
};

function menuPresentation(menu: Menu) {
  const configured = NAV_GROUPS_MENUS.flatMap(group => group.listMenus).find(item => item.key === menu.menu_name);
  return { label: configured?.label || menu.menu_name.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()), icon: configured?.icon || ShieldCheck };
}

function orderMenus(menus: Menu[]) {
  const keys = NAV_GROUPS_MENUS.flatMap(group => group.listMenus).map(item => item.key as string);
  return [...menus].sort((a, b) => {
    const first = keys.indexOf(a.menu_name), second = keys.indexOf(b.menu_name);
    return (first < 0 ? keys.length : first) - (second < 0 ? keys.length : second) || a.menu_name.localeCompare(b.menu_name);
  });
}

export function PermissionBadge({ access, children }: { access: Permission; children?: React.ReactNode }) {
  return <span className={`inline-flex min-w-10 items-center justify-center rounded-lg px-3 py-1 text-sm font-bold ${permissionStyles[access]}`}>{children ?? permissionLabels[access]}</span>;
}

export function PermissionLegend({ vertical = false }: { vertical?: boolean }) {
  return <div className={`flex ${vertical ? "flex-col gap-5" : "flex-wrap gap-x-7 gap-y-3"} text-sm`}>
    {(["hidden", "read", "write"] as Permission[]).map(access => <div key={access} className="flex items-center gap-3"><PermissionBadge access={access} /><span className="text-muted-foreground">— {access === "hidden" ? "Menu disembunyikan" : access === "read" ? "Akses baca" : "Akses tulis"}</span></div>)}
  </div>;
}

export function RolePermissions({ menus, matrix, onChange, disabled = false, isNew = false, userCount }: {
  menus: Menu[]; matrix: PermissionMatrix; onChange: (id: string, access: Permission) => void;
  disabled?: boolean; isNew?: boolean; userCount?: number;
}) {
  const [search, setSearch] = useState("");
  const counts = permissionCounts(matrix);
  const filtered = orderMenus(menus).filter(menu => menuPresentation(menu).label.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Hak Akses Menu">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-xl font-extrabold">Hak Akses Menu</h2><p className="mt-1 text-sm text-muted-foreground">{disabled ? "Hak akses yang tersimpan untuk role ini." : "Pilih satu akses untuk setiap menu."}</p></div>
        <div className="relative sm:max-w-[280px]"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input aria-label="Cari menu permission" placeholder="Cari menu..." value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <thead><tr className="border-b border-border"><th className="py-3 pl-3 text-left sm:pl-5">Menu</th>{(["hidden", "read", "write"] as Permission[]).map(access => <th key={access} className="w-[52px] px-0.5 py-3 text-center sm:w-[92px]">{permissionLabels[access]}</th>)}</tr></thead>
          <tbody>{filtered.map(menu => {
            const { label, icon: Icon } = menuPresentation(menu);
            return <tr key={menu.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <th scope="row" className="px-3 py-1.5 text-left font-semibold sm:pl-5"><span className="flex items-center gap-3"><Icon className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden="true" /><span className="break-words">{label}</span></span></th>
              {(["hidden", "read", "write"] as Permission[]).map(access => <td key={access} className="p-0.5 text-center">
                <label className={`flex min-h-8 cursor-pointer items-center justify-center rounded-lg ${matrix[menu.id] === access ? permissionStyles[access] : "hover:bg-muted"} ${disabled ? "cursor-default" : ""}`}>
                  <input type="radio" name={`menu-${menu.id}`} aria-label={`${label}: ${permissionLabels[access]}`} value={access} checked={(matrix[menu.id] || "hidden") === access} disabled={disabled} onChange={() => onChange(menu.id, access)} className="h-[18px] w-[18px] cursor-inherit accent-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 disabled:opacity-80" />
                </label>
              </td>)}
            </tr>;
          })}</tbody>
        </table>
        {!filtered.length && <p className="p-6 text-center text-sm text-muted-foreground">Menu tidak ditemukan. Permission lainnya tetap tersimpan dalam formulir.</p>}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-[#091b50] dark:bg-blue-950 dark:text-blue-100"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{disabled ? "Mode lihat. Hak akses tidak dapat diubah di halaman ini." : isNew ? <>Semua menu dimulai dari <strong>Hidden</strong>.</> : "Perubahan berlaku setelah disimpan."}</p></div>
    </section>
    <aside className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5" aria-label="Ringkasan Akses"><h2 className="text-xl font-extrabold">Ringkasan Akses</h2><p className="mb-4 mt-1 text-sm">Total {menus.length} menu.</p><dl className="divide-y divide-border rounded-lg border border-border px-3">
        {(["hidden", "read", "write"] as Permission[]).map(access => <div key={access} className="flex items-center justify-between py-2"><dt><PermissionBadge access={access} /></dt><dd className="font-bold" data-testid={`permission-count-${access}`}>{counts[access]}</dd></div>)}
      </dl><p className="mt-4 border-t border-border pt-3 text-sm">{counts.read + counts.write} menu dapat diakses.</p>{userCount !== undefined && <p className="mt-1 text-sm">{userCount} pengguna menggunakan role ini.</p>}</section>
      <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-5 text-xl font-extrabold">Panduan Akses</h2><PermissionLegend vertical /></section>
    </aside>
  </div>;
}
