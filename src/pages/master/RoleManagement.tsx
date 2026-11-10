import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Edit, Eye, Home, LayoutGrid, Loader2, LockKeyhole, MoreHorizontal, Plus, RotateCcw, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PermissionBadge, PermissionLegend, RolePermissions } from "@/components/master/RolePermissions";
import { useAuth } from "@/lib/auth";
import type { Menu, Role } from "@/lib/api";
import { matrixPayload, permissionCounts, roleManagementService, roleMatrix, type Permission, type PermissionMatrix } from "@/lib/services/roleManagementService";
import { notifyRolePermissionsChanged } from "@/lib/permissionEvents";
import { toast } from "sonner";

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
const builtinNames = ["super_admin", "admin", "staff_internal", "sales_external"];
const errorText = (error: unknown) => error instanceof Error ? error.message : "Permintaan belum berhasil. Silakan coba lagi.";
type Mode = "list" | "create" | "edit" | "view";

function Breadcrumb({ page, onRolesNavigate }: { page?: string; onRolesNavigate?: () => void }) {
  return <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm sm:gap-3"><Home className="mr-1 h-4 w-4" aria-hidden="true" /><span>Master Data</span><span aria-hidden="true">/</span><Link to="/master/roles" className="hover:underline" onClick={onRolesNavigate ? event => { event.preventDefault(); onRolesNavigate(); } : undefined}>Role Management</Link>{page && <><span aria-hidden="true">/</span><span aria-current="page">{page}</span></>}</nav>;
}

function RoleEditor({ role, roles, menus, mode, saved }: { role?: Role; roles: Role[]; menus: Menu[]; mode: Exclude<Mode, "list">; saved: (id: string) => Promise<void> }) {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const readonly = mode === "view" || !canWrite("master_roles");
  const [name, setName] = useState(role?.role_name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [matrix, setMatrix] = useState<PermissionMatrix>(() => roleMatrix(role, menus));
  const [copySource, setCopySource] = useState("");
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const inFlight = useRef(false);
  const copyVersion = useRef(0);
  const initial = useRef({ name: role?.role_name || "", description: role?.description || "", matrix: roleMatrix(role, menus) });
  const changes = Number(name !== initial.current.name) + Number(description !== initial.current.description) + menus.filter(menu => matrix[menu.id] !== initial.current.matrix[menu.id]).length;
  const dirty = !readonly && changes > 0;
  const nameLocked = Boolean(role && (role.name_locked ?? builtinNames.includes(role.role_name)));
  const title = mode === "create" ? "Tambah Role" : mode === "edit" ? "Edit Role" : "Detail Role";
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  useEffect(() => () => { copyVersion.current++; }, []);
  const leave = () => { if (dirty) setDiscard(true); else navigate("/master/roles"); };
  const copyFrom = async (id: string) => {
    setCopySource(id); setError("");
    const version = ++copyVersion.current;
    if (!id) { setMatrix(roleMatrix(undefined, menus)); return; }
    setCopying(true);
    try {
      const source = await roleManagementService.get(id);
      if (version === copyVersion.current) setMatrix(roleMatrix(source, menus));
    } catch (reason) { if (version === copyVersion.current) setError(errorText(reason)); }
    finally { if (version === copyVersion.current) setCopying(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readonly || inFlight.current || copying || !name.trim()) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await roleManagementService.save(role?.id, { role_name: name.trim(), description: description.trim(), menu_accesses: matrixPayload(menus, matrix) });
      await saved(result.id);
      toast.success(mode === "create" ? "Role berhasil dibuat." : "Perubahan role berhasil disimpan.");
      navigate("/master/roles");
    } catch (reason) { setError(errorText(reason)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <>
    <Breadcrumb page={title} onRolesNavigate={() => { if (!busy && !copying) leave(); }} />
    <div className="mb-6 flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>{role && <span className="max-w-full break-all rounded-full bg-secondary px-4 py-1 text-sm font-bold">{role.role_name}</span>}</div><p className="mt-1 text-muted-foreground">{mode === "create" ? "Tentukan akses menu untuk role baru." : readonly ? "Lihat informasi dan hak akses role." : "Perbarui informasi dan hak akses role."}</p></div><Button variant="outline" onClick={leave} disabled={busy || copying}><ArrowLeft className="h-4 w-4" />Kembali</Button></div>
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Informasi Role"><h2 className="mb-4 text-xl font-extrabold">Informasi Role</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label htmlFor="role-name" className="mb-2 block text-sm font-semibold">Nama role <span className="text-red-600">*</span></label><div className="relative">{nameLocked && <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />}<Input id="role-name" placeholder="Contoh: finance_readonly" maxLength={100} required value={name} onChange={event => setName(event.target.value)} disabled={readonly || nameLocked || busy || copying} className={nameLocked ? "pl-9" : ""} /></div></div>
          <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="role-description" className="text-sm font-semibold">Deskripsi</label>{dirty && <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">● Perubahan belum disimpan</span>}</div><Input id="role-description" placeholder="Jelaskan fungsi role ini" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} disabled={readonly || busy || copying} /></div>
        </div>
        {!readonly && <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center"><label htmlFor="copy-source-editor" className="flex shrink-0 items-center gap-3 text-sm font-semibold"><Copy className="h-4 w-4" />Salin permission dari</label><select id="copy-source-editor" value={copySource} onChange={event => void copyFrom(event.target.value)} disabled={busy || copying} className={`${selectClass} sm:max-w-xs`}><option value="" disabled={mode !== "create"}>{mode === "create" ? "Mulai dari kosong" : "Pilih role sumber"}</option>{roles.filter(source => source.id !== role?.id).map(source => <option key={source.id} value={source.id}>{source.role_name}</option>)}</select>{copying && <span role="status" className="text-sm">Memuat permission…</span>}</div>}
      </section>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
      <RolePermissions menus={menus} matrix={matrix} onChange={(id, access) => setMatrix(current => ({ ...current, [id]: access }))} disabled={readonly || busy || copying} isNew={mode === "create"} userCount={role?.user_count} />
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <p className="text-sm">{readonly ? "Mode lihat · Hak akses sesuai data tersimpan." : mode === "create" ? <>Field bertanda <span className="font-bold text-red-600">*</span> wajib diisi.</> : dirty ? <span className="text-amber-700 dark:text-amber-300">● {changes} perubahan belum disimpan.</span> : "Tidak ada perubahan."}</p>
        <div className="ml-auto flex gap-3"><Button type="button" variant="outline" onClick={leave} disabled={busy || copying}>{readonly ? "Kembali" : "Batal"}</Button>{!readonly && <Button className="admin-accent-button min-w-36" type="submit" disabled={busy || copying || !name.trim() || (mode === "edit" && !dirty)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Menyimpan…" : mode === "create" ? "Buat Role" : "Simpan Perubahan"}</Button>}</div>
      </footer>
    </form>
    <Dialog open={discard} onOpenChange={setDiscard}><DialogContent><DialogHeader><DialogTitle>Buang perubahan?</DialogTitle><DialogDescription>Perubahan role belum disimpan. Kembali ke daftar akan membuang perubahan ini.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscard(false)}>Lanjutkan edit</Button><Button variant="destructive" onClick={() => navigate("/master/roles")}>Buang perubahan</Button></DialogFooter></DialogContent></Dialog>
  </>;
}

function RoleActions({ role, writable, onAction }: { role: Role; writable: boolean; onAction: (kind: "reset" | "delete", role: Role) => void }) {
  return <div className="flex flex-wrap items-center gap-2">
    <Button asChild variant="outline" size="sm"><Link to={`/master/roles/${role.id}`}><Eye className="h-4 w-4" />View</Link></Button>
    {writable && <><Button asChild variant="outline" size="sm"><Link to={`/master/roles/${role.id}/edit`}><Edit className="h-4 w-4" />Edit</Link></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9" aria-label={`Aksi ${role.role_name}`}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-52"><DropdownMenuItem onSelect={() => onAction("reset", role)}><RotateCcw className="mr-2 h-4 w-4" />Reset permission</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem disabled={role.deletable !== true} onSelect={() => onAction("delete", role)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Hapus role</DropdownMenuItem></DropdownMenuContent></DropdownMenu></>}
  </div>;
}

function RoleList({ roles, menus, writable, onAction }: { roles: Role[]; menus: Menu[]; writable: boolean; onAction: (kind: "reset" | "delete", role: Role) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Permission | "all">("all");
  const filtered = roles.filter(role => {
    const counts = permissionCounts(roleMatrix(role, menus));
    return `${role.role_name} ${role.description || ""}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "all" || counts[filter] > 0);
  });
  return <>
    <div className="mb-6 grid gap-4 sm:grid-cols-3">{[
      { label: "Total Role", value: roles.length, icon: ShieldCheck },
      { label: "Total Menu", value: menus.length, icon: LayoutGrid },
      { label: "Pengguna dengan Role", value: roles.every(role => typeof role.user_count === "number") ? roles.reduce((sum, role) => sum + role.user_count!, 0) : "—", icon: Users },
    ].map(stat => <section key={stat.label} aria-label={stat.label} className="flex items-center gap-5 rounded-xl border border-border bg-card p-5 sm:p-6"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><stat.icon className="h-7 w-7" aria-hidden="true" /></span><div><h2 className="text-sm text-muted-foreground sm:text-base">{stat.label}</h2><p className="mt-1 text-3xl font-extrabold">{stat.value}</p></div></section>)}</div>
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Daftar Role">
      <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-center"><div className="flex items-center gap-3"><h2 className="text-xl font-extrabold">Daftar Role</h2><span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">{roles.length} role</span></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative sm:w-80"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input aria-label="Cari role" placeholder="Cari nama atau deskripsi role..." value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div><div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-5"><label htmlFor="role-access-filter" className="shrink-0 text-sm">Akses menu:</label><select id="role-access-filter" aria-label="Akses menu" value={filter} onChange={event => setFilter(event.target.value as Permission | "all")} className={`${selectClass} min-w-28`}><option value="all">Semua</option><option value="hidden">Hidden</option><option value="read">Read</option><option value="write">Write</option></select></div></div></div>
      {!filtered.length ? <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center"><ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-bold">{roles.length ? "Role tidak ditemukan" : "Belum ada role"}</h3><p className="mt-1 text-sm text-muted-foreground">{roles.length ? "Coba kata kunci atau filter akses lainnya." : "Tambahkan role untuk mulai mengatur akses menu."}</p></div> : <>
        <div className="hidden overflow-hidden rounded-lg border border-border xl:block"><table className="w-full text-sm"><thead><tr><th className="p-4 text-left">Role</th><th className="p-4 text-center">Pengguna</th>{(["read", "write", "hidden"] as Permission[]).map(access => <th key={access} className="p-4 text-center">{access[0].toUpperCase()+access.slice(1)}</th>)}<th className="p-4 text-left">Aksi</th></tr></thead><tbody>{filtered.map(role => { const counts = permissionCounts(roleMatrix(role, menus)); return <tr key={role.id} aria-label={`Role ${role.role_name}`} className="border-t border-border hover:bg-muted/20"><td className="p-4"><div className="flex items-center gap-3"><span className="rounded-full bg-secondary p-3"><ShieldCheck className="h-5 w-5" /></span><div className="max-w-xs"><p className="break-words text-base font-bold">{role.role_name}</p><p className="mt-1 break-words text-muted-foreground">{role.description || "Belum ada deskripsi"}</p></div></div></td><td className="p-4 text-center"><span className="inline-flex items-center gap-2 font-semibold"><Users className="h-4 w-4" />{role.user_count ?? "—"}</span></td>{(["read", "write", "hidden"] as Permission[]).map(access => <td key={access} className="px-3 py-4 text-center"><PermissionBadge access={access}>{counts[access]}</PermissionBadge></td>)}<td className="p-4"><RoleActions role={role} writable={writable} onAction={onAction} /></td></tr>; })}</tbody></table></div>
        <div className="space-y-3 xl:hidden">{filtered.map(role => { const counts = permissionCounts(roleMatrix(role, menus)); return <article key={role.id} aria-label={`Role ${role.role_name}`} className="rounded-lg border border-border p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-6 w-6 shrink-0" /><div className="min-w-0"><h3 className="break-words text-lg font-bold">{role.role_name}</h3><p className="mt-1 break-words text-sm text-muted-foreground">{role.description || "Belum ada deskripsi"}</p><p className="mt-2 flex items-center gap-2 text-sm"><Users className="h-4 w-4" />{role.user_count ?? "—"} pengguna</p></div></div><dl className="my-4 flex flex-wrap gap-3 text-sm">{(["read", "write", "hidden"] as Permission[]).map(access => <div key={access} className="flex items-center gap-2"><dt className="capitalize">{access}</dt><dd><PermissionBadge access={access}>{counts[access]}</PermissionBadge></dd></div>)}</dl><RoleActions role={role} writable={writable} onAction={onAction} /></article>; })}</div>
      </>}
      <p className="mt-4 px-2 text-sm text-muted-foreground">Menampilkan {filtered.length} dari {roles.length} role.</p>
    </section><div className="mt-6"><PermissionLegend /></div>
  </>;
}

export default function MasterRoles({ mode = "list" }: { mode?: Mode }) {
  const { roleId } = useParams();
  const { canWrite } = useAuth();
  const writable = canWrite("master_roles");
  const queryClient = useQueryClient();
  const [copyDialog, setCopyDialog] = useState(false);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [action, setAction] = useState<{ kind: "reset" | "delete"; role: Role } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const actionLock = useRef(false);
  const rolesQuery = useQuery({ queryKey: ["roles-with-access"], queryFn: roleManagementService.list, staleTime: 0 });
  const menusQuery = useQuery({ queryKey: ["role-management-menus"], queryFn: roleManagementService.menus, staleTime: 0 });
  const detailQuery = useQuery({ queryKey: ["role-management", roleId], queryFn: () => roleManagementService.get(roleId!), enabled: Boolean(roleId) && mode !== "list", staleTime: 0 });
  const roles = rolesQuery.data || [], menus = menusQuery.data || [];
  const saved = async (id: string) => {
    notifyRolePermissionsChanged(id);
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["roles-with-access"] }), queryClient.invalidateQueries({ queryKey: ["role-management", id], exact: true })]);
  };
  const confirmAction = async () => {
    if (!writable || actionLock.current || (!action && (!source || !target || source === target))) return;
    actionLock.current = true; setBusy(true); setActionError("");
    try {
      const id = action?.role.id || target;
      if (action?.kind === "delete") await roleManagementService.remove(id);
      else {
        const copied = action?.kind === "reset" ? undefined : await roleManagementService.get(source);
        await roleManagementService.replacePermissions(id, menus, roleMatrix(copied, menus));
      }
      await saved(id);
      toast.success(action?.kind === "delete" ? "Role berhasil dihapus." : action?.kind === "reset" ? "Permission berhasil direset." : "Permission berhasil disalin.");
      setAction(null); setCopyDialog(false); setSource(""); setTarget("");
    } catch (reason) { setActionError(errorText(reason)); }
    finally { actionLock.current = false; setBusy(false); }
  };
  // A failed background refresh must not unmount an editor with unsaved changes.
  const pageError = (!rolesQuery.data && rolesQuery.error) || (!menusQuery.data && menusQuery.error) || (!detailQuery.data && detailQuery.error);
  const loading = rolesQuery.isPending || menusQuery.isPending || (Boolean(roleId) && detailQuery.isPending);
  return <AppLayout title="Role Management">
    {loading ? <div role="status" className="flex min-h-60 items-center justify-center gap-3"><Loader2 className="h-5 w-5 animate-spin" />Memuat role dan hak akses…</div> : pageError ? <section role="alert" className="rounded-xl border border-border bg-card p-6"><h1 className="mb-2 text-xl font-bold">Role belum dapat dimuat</h1><p>{errorText(pageError)}</p><Button className="mt-4" variant="outline" onClick={() => { void rolesQuery.refetch(); void menusQuery.refetch(); if (roleId) void detailQuery.refetch(); }}>Muat ulang</Button></section> : mode !== "list" ? <RoleEditor key={`${mode}-${roleId || "new"}`} mode={mode} role={detailQuery.data} roles={roles} menus={menus} saved={saved} /> : <>
      <Breadcrumb />
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-extrabold tracking-tight">Role Management</h1><p className="mt-1 text-muted-foreground">Kelola role dan hak akses menu dalam satu tempat.</p></div>{writable && <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => { setActionError(""); setCopyDialog(true); }} disabled={roles.length < 2}><Copy className="h-4 w-4" />Copy Permissions</Button><Button asChild className="admin-accent-button"><Link to="/master/roles/new"><Plus className="h-5 w-5" />Tambah Role</Link></Button></div>}</div>
      <RoleList roles={roles} menus={menus} writable={writable} onAction={(kind, role) => { setActionError(""); setAction({ kind, role }); }} />
      <Dialog open={copyDialog} onOpenChange={open => { if (!busy) { setCopyDialog(open); setActionError(""); } }}><DialogContent><DialogHeader><DialogTitle>Copy Permissions</DialogTitle><DialogDescription>Permission role tujuan akan diganti dengan seluruh permission role sumber. Nama dan deskripsi tetap.</DialogDescription></DialogHeader><div className="space-y-4"><div><label htmlFor="role-copy-source" className="mb-2 block text-sm font-semibold">Role sumber</label><select id="role-copy-source" className={selectClass} value={source} onChange={event => setSource(event.target.value)} disabled={busy}><option value="">Pilih role sumber</option>{roles.map(role => <option key={role.id} value={role.id}>{role.role_name}</option>)}</select></div><div><label htmlFor="role-copy-target" className="mb-2 block text-sm font-semibold">Role tujuan</label><select id="role-copy-target" className={selectClass} value={target} onChange={event => setTarget(event.target.value)} disabled={busy}><option value="">Pilih role tujuan</option>{roles.filter(role => role.id !== source).map(role => <option key={role.id} value={role.id}>{role.role_name}</option>)}</select></div>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}</div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setCopyDialog(false)}>Batal</Button><Button className="admin-accent-button" disabled={busy || !source || !target || source === target} onClick={() => void confirmAction()}>{busy ? "Menyimpan…" : "Salin permission"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(action)} onOpenChange={open => { if (!open && !busy) { setAction(null); setActionError(""); } }}><DialogContent><DialogHeader><DialogTitle>{action?.kind === "delete" ? "Hapus role" : "Reset permission"}</DialogTitle><DialogDescription>{action?.kind === "delete" ? <>Hapus role <strong>{action.role.role_name}</strong> beserta permission-nya? Tindakan ini tidak dapat dibatalkan.</> : <>Semua akses menu role <strong>{action?.role.role_name}</strong> akan menjadi Hidden. Pengguna role ini akan kehilangan akses menu.</>}</DialogDescription></DialogHeader>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Batal</Button><Button variant="destructive" disabled={busy} onClick={() => void confirmAction()}>{busy ? "Menyimpan…" : action?.kind === "delete" ? "Hapus role" : "Reset permission"}</Button></DialogFooter></DialogContent></Dialog>
    </>}
  </AppLayout>;
}
