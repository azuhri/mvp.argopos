import { type ReactNode, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, RefreshCw, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommerceBrand } from "@/components/shared/CommerceBrand";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { PendingPaymentSection } from "@/components/commerce/PendingPaymentSection";
import { type Location } from "@/lib/api";
import { isLocationActive, locationService } from "@/lib/services/locationService";
import { COMMERCE_LOCATION_CHANGE_EVENT, commerceCartNeedsReset, commerceDestination, confirmCommerceLocation, getConfirmedCommerceLocation, getPreferredCommerceLocation } from "@/lib/commerceLocation";

function activeStores(stores: Location[] | undefined): Location[] {
  return (stores ?? []).filter(store => store.type !== "warehouse" && Boolean(store.location_code) && isLocationActive(store));
}

export function CommerceLocationGate({ children, forceSelection = false }: { children?: ReactNode; forceSelection?: boolean }) {
  const { locationCode = "" } = useParams<{ locationCode: string }>();
  const route = useLocation();
  const [, setStorageVersion] = useState(0);
  const [analyticsRedirect] = useState(() => {
    try { return route.pathname === "/commerce" && Boolean(localStorage.getItem("umami.auth")); }
    catch { return false; }
  });
  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: () => locationService.getListStore(),
    enabled: !analyticsRedirect,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  useEffect(() => {
    if (analyticsRedirect) window.location.replace("/analytics");
  }, [analyticsRedirect]);
  useEffect(() => {
    const update = () => setStorageVersion(value => value + 1);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    window.addEventListener("pageshow", update);
    window.addEventListener(COMMERCE_LOCATION_CHANGE_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener(COMMERCE_LOCATION_CHANGE_EVENT, update);
    };
  }, []);
  if (analyticsRedirect) return null;

  const stores = activeStores(storesQuery.data);
  const confirmed = getConfirmedCommerceLocation();
  const previous = getPreferredCommerceLocation();
  const requested = locationCode || new URLSearchParams(route.search).get("location") || "";
  const ready = storesQuery.isFetchedAfterMount && !storesQuery.isPending && !storesQuery.error;
  const canEnter = ready && !forceSelection && confirmed && confirmed === previous &&
    (!locationCode || locationCode === confirmed) && stores.some(store => store.location_code === confirmed);

  if (canEnter) {
    if (!locationCode) return <Navigate replace to={commerceDestination(route.pathname, "", previous, confirmed) + route.search + route.hash} />;
    return <div key={locationCode}>{children}</div>;
  }

  return <LocationSelection key={route.pathname + route.search} stores={stores} requested={requested}
    loading={!storesQuery.isFetchedAfterMount || storesQuery.isPending} loadError={Boolean(storesQuery.error)}
    refetch={async () => {
      const result = await storesQuery.refetch();
      if (result.error || !result.data) throw new Error("Daftar lokasi belum dapat dimuat. Coba kembali.");
      return activeStores(result.data);
    }} />;
}

function LocationSelection({ stores, requested, loading, loadError, refetch }: {
  stores: Location[]; requested: string; loading: boolean; loadError: boolean; refetch: () => Promise<Location[]>;
}) {
  const route = useLocation();
  const { locationCode = "" } = useParams<{ locationCode: string }>();
  const navigate = useNavigate();
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const previous = getPreferredCommerceLocation();
  const selected = stores.find(store => store.location_code === chosen) ||
    stores.find(store => store.location_code === requested) ||
    stores.find(store => store.location_code === previous) || stores[0];
  const resetCart = selected ? commerceCartNeedsReset(selected.location_code) : false;
  const confirmed = getConfirmedCommerceLocation();
  const backCode = confirmed === previous && stores.some(store => store.location_code === confirmed) ? confirmed : "";
  const unavailableRequested = requested && !loading && !loadError && !stores.some(store => store.location_code === requested);

  const confirm = async () => {
    if (!selected || busy || loading || loadError) return;
    const code = selected.location_code;
    const previousCode = previous;
    const warnedAboutReset = resetCart;
    setBusy(true);
    setError("");
    try {
      const current = await refetch();
      if (!mounted.current) return;
      if (!current.some(store => store.location_code === code)) {
        setError("Lokasi yang dipilih sudah tidak tersedia. Pilih lokasi aktif lainnya.");
        return;
      }
      if (!warnedAboutReset && commerceCartNeedsReset(code)) {
        setError("Keranjang berubah di tab lain. Periksa lokasi dan konfirmasi kembali sebelum melanjutkan.");
        return;
      }
      confirmCommerceLocation(code);
      const destination = commerceDestination(route.pathname, locationCode, previousCode, code);
      const preserveLink = destination === route.pathname || (!locationCode && code === previousCode && route.pathname !== "/commerce/locations");
      navigate(destination + (preserveLink ? route.search + route.hash : ""), { replace: true });
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Pilihan lokasi belum dapat disimpan. Coba kembali.");
    } finally { if (mounted.current) setBusy(false); }
  };

  return <div className="commerce-theme commerce-surface min-h-screen">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <CommerceBrand /><ThemeToggle className="h-11 w-11 rounded-md border border-slate-200 text-[#071a4f]" />
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-7 max-w-2xl">
        <span className="mb-4 inline-flex rounded-xl bg-[#071a4f] p-3 text-white"><MapPin className="h-7 w-7" /></span>
        <p className="mb-2 text-sm font-bold text-[#e30613]">Selamat datang di AMP Mart</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#071a4f] md:text-4xl">Pilih lokasi belanja</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">Pastikan lokasi pengambilan pesanan Anda sesuai sebelum mulai berbelanja.</p>
      </div>
      <section className="commerce-panel p-5 md:p-7" aria-label="Pilihan lokasi belanja">
        {loading ? <p role="status" className="flex items-center gap-2 py-6 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Memuat lokasi aktif...</p> : null}
        {loadError ? <div role="alert" className="space-y-3 py-4 text-sm text-red-700"><p>Daftar lokasi belum dapat dimuat. Periksa koneksi Anda lalu coba kembali.</p><Button variant="outline" disabled={busy} onClick={() => { setBusy(true); void refetch().catch(() => {}).finally(() => { if (mounted.current) setBusy(false); }); }}><RefreshCw className="h-4 w-4" />Muat ulang lokasi</Button></div> : null}
        {!loading && !loadError && stores.length === 0 ? <div role="status" className="py-6 text-center"><StoreIcon className="mx-auto mb-3 h-9 w-9 text-slate-400" /><h2 className="font-bold text-[#071a4f]">Belum ada lokasi aktif</h2><p className="mt-2 text-sm text-slate-600">Silakan kembali nanti atau hubungi admin toko.</p><Button className="mt-4" variant="outline" disabled={busy} onClick={() => { setBusy(true); void refetch().catch(() => {}).finally(() => { if (mounted.current) setBusy(false); }); }}>Muat ulang lokasi</Button></div> : null}
        {!loading && !loadError && stores.length > 0 ? <>
          {unavailableRequested ? <p role="alert" className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Lokasi pada tautan ini tidak tersedia. Pilih lokasi aktif di bawah.</p> : null}
          <fieldset disabled={busy}>
            <legend className="mb-4 text-sm font-bold text-[#071a4f]">Lokasi pengambilan</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {stores.map(store => <label key={store.id || store.location_code} className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-4 transition focus-within:ring-2 focus-within:ring-[#071a4f] focus-within:ring-offset-2 ${selected?.location_code === store.location_code ? "border-[#071a4f] bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"}`}>
                <input type="radio" name="commerce-location" aria-label={store.location_name} value={store.location_code} checked={selected?.location_code === store.location_code} onChange={() => { setChosen(store.location_code); setError(""); }} className="mt-1 h-4 w-4 shrink-0 accent-[#071a4f]" />
                <span className="min-w-0 flex-1"><span className="block break-words font-bold text-[#071a4f]">{store.location_name}</span><span className="mt-1 block break-all text-xs font-medium text-slate-500">{store.location_code}</span><span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><Check className="h-3 w-3" />Aktif</span></span>
                <StoreIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
              </label>)}
            </div>
          </fieldset>
          {resetCart ? <p role="alert" className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">Mengganti lokasi akan mengosongkan keranjang dari lokasi sebelumnya. Pesanan yang sudah dibuat tetap tersimpan.</p> : null}
          {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Belanja di <strong className="break-words text-[#071a4f]">{selected?.location_name}</strong></p>
            <Button className="commerce-orange-button min-h-12 w-full px-6 font-bold sm:w-auto" disabled={busy || !selected} onClick={() => void confirm()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Lanjutkan belanja</Button>
          </div>
        </> : null}
      </section>
      {backCode ? <Link className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#071a4f]" to={`/${encodeURIComponent(backCode)}/commerce`}><ArrowLeft className="h-4 w-4" />Kembali ke katalog</Link> : null}
      <div className="mt-6"><PendingPaymentSection /></div>
    </main>
  </div>;
}
