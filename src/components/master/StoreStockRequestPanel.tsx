import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Inbox,
  Loader2,
  PackagePlus,
  RefreshCw,
  ShieldAlert,
  Truck,
  Warehouse,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { GlassCard } from "@/components/shared/GlassCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import type { Location, StockTransferRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isLocationActive, locationService } from "@/lib/services/locationService";
import { stockService } from "@/lib/services/stockService";
import { userService } from "@/lib/services/userService";

interface StoreStockRequestPanelProps {
  locationId: string;
  locationName: string;
  onStockChanged?: () => void | Promise<void>;
}

interface CreateRequestForm {
  sourceLocationId: string;
  sourceProductStockId: string;
  quantity: string;
  notes: string;
}

const PAGE_SIZE = 10;

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusCopy: Record<StockTransferRequest["status"], string> = {
  requested: "Menunggu persetujuan sumber",
  source_approved: "Menunggu penerimaan",
  source_rejected: "Ditolak",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const initialCreateForm: CreateRequestForm = {
  sourceLocationId: "",
  sourceProductStockId: "",
  quantity: "1",
  notes: "",
};

const getLocationName = (location: StockTransferRequest["from_location"]) =>
  location?.location_name || location?.location_code || "Lokasi tidak tersedia";

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
};

const getAssignedLocationIds = (assignedStores?: Location[]) => new Set(
  (assignedStores ?? [])
    .map((store) => store.id || (store as Location & { location_id?: string }).location_id)
    .filter((id): id is string => Boolean(id)),
);

const approvalLetterFileName = (request: StockTransferRequest) => {
  const reference = request.approval_letter_number || request.id;
  const prefix = request.movement_type === "distribution"
    ? "surat-jalan-distribusi"
    : "permintaan-transfer-stok";
  return `${prefix}-${reference.replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`;
};

function RequestStatusBadge({ status }: { status: StockTransferRequest["status"] }) {
  if (status === "completed") {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{statusCopy[status]}</Badge>;
  }
  if (status === "source_approved") {
    return <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{statusCopy[status]}</Badge>;
  }
  if (status === "source_rejected") {
    return <Badge variant="destructive">{statusCopy[status]}</Badge>;
  }
  if (status === "cancelled") {
    return <Badge variant="outline">{statusCopy[status]}</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{statusCopy[status]}</Badge>;
}

export function StoreStockRequestPanel({
  locationId,
  locationName,
  onStockChanged,
}: StoreStockRequestPanelProps) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, canWrite, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [movementFilter, setMovementFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRequestForm>(initialCreateForm);
  const [approvalRequest, setApprovalRequest] = useState<StockTransferRequest | null>(null);
  const [receiveRequest, setReceiveRequest] = useState<StockTransferRequest | null>(null);
  const [rejectRequest, setRejectRequest] = useState<StockTransferRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [letterLoading, setLetterLoading] = useState<{ id: string; mode: "view" | "download" } | null>(null);

  const requestedRequestId = searchParams.get("request_id");
  const isSuperAdmin = user?.role === "super_admin";
  const isStoreAdmin = user?.role === "admin";
  const hasWritePermission = canWrite("master_stock_mutations");

  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: () => userService.getCurrentUser(),
    enabled: Boolean(user && hasWritePermission && !isSuperAdmin),
    staleTime: 5 * 60 * 1000,
  });

  const assignedLocationIds = useMemo(
    () => getAssignedLocationIds(currentUserQuery.data?.assigned_stores),
    [currentUserQuery.data?.assigned_stores],
  );
  const assignmentResolved = isSuperAdmin || currentUserQuery.isSuccess;
  const canViewCurrentStore = hasWritePermission && (
    isSuperAdmin || (assignmentResolved && assignedLocationIds.has(locationId))
  );
  const canManageCurrentStore = canViewCurrentStore && (isSuperAdmin || isStoreAdmin);

  useEffect(() => {
    setPage(1);
    if (requestedRequestId) {
      setMovementFilter("all");
      setStatusFilter("all");
    }
  }, [locationId, requestedRequestId]);

  const requestsQuery = useQuery({
    queryKey: ["store-stock-requests", locationId, requestedRequestId, page, movementFilter, statusFilter],
    queryFn: () => stockService.getStockTransferRequests({
      page,
      page_size: PAGE_SIZE,
      location_id: locationId,
      ...(requestedRequestId && { request_id: requestedRequestId }),
      movement_type: movementFilter,
      status: statusFilter,
      sort_order: "desc",
    }),
    enabled: canViewCurrentStore,
  });

  const locationsQuery = useQuery({
    queryKey: ["stock-request-locations"],
    queryFn: () => locationService.getAllLocations(),
    enabled: createOpen,
    staleTime: 5 * 60 * 1000,
  });

  const movementType: "distribution" | "transfer" = isSuperAdmin ? "distribution" : "transfer";
  const sourceLocations = useMemo(() => {
    const locations = (locationsQuery.data ?? []).filter(isLocationActive);
    if (movementType === "distribution") {
      return locations.filter((location) => location.type === "warehouse");
    }
    return locations.filter((location) => location.type === "store" && location.id !== locationId);
  }, [locationId, locationsQuery.data, movementType]);

  const sourceStocksQuery = useQuery({
    queryKey: ["stock-request-source-products", createForm.sourceLocationId],
    queryFn: () => stockService.getStocks(
      1,
      1000,
      "",
      createForm.sourceLocationId,
      "all",
      "stock",
      "desc",
    ),
    enabled: createOpen && Boolean(createForm.sourceLocationId),
  });

  const sourceStocks = useMemo(() => {
    const groups = sourceStocksQuery.data?.location_groups ?? [];
    return groups
      .filter((group) => group.location_id === createForm.sourceLocationId)
      .flatMap((group) => group.product_stocks)
      .filter((item) => item.stock > 0 && item.master_product?.id);
  }, [createForm.sourceLocationId, sourceStocksQuery.data?.location_groups]);

  const selectedSourceStock = sourceStocks.find((item) => item.id === createForm.sourceProductStockId);
  const requests = requestsQuery.data?.requests ?? [];
  const totalPages = Math.max(1, requestsQuery.data?.meta.total_pages ?? 1);
  const totalRequests = requestsQuery.data?.meta.total ?? 0;

  const invalidateStockQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["store-stock-requests", locationId] }),
      queryClient.invalidateQueries({ queryKey: ["stock-transfer-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["stocks"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedSourceStock?.master_product?.id) {
        throw new Error("Pilih produk yang tersedia di lokasi sumber");
      }
      return stockService.createStockTransferRequest({
        movement_type: movementType,
        from_location_id: createForm.sourceLocationId,
        to_location_id: locationId,
        master_product_id: selectedSourceStock.master_product.id,
        quantity: Number(createForm.quantity),
        notes: createForm.notes.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success(movementType === "distribution"
        ? "Distribution request berhasil dibuat"
        : "Transfer request berhasil diajukan");
      setCreateOpen(false);
      setCreateForm(initialCreateForm);
      setPage(1);
      await invalidateStockQueries();
    },
    onError: (error: Error) => toast.error(error.message || "Gagal membuat stock request"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => stockService.approveStockTransferSource(id),
    onSuccess: async () => {
      toast.success("Persetujuan sumber berhasil disimpan");
      setApprovalRequest(null);
      await invalidateStockQueries();
    },
    onError: (error: Error) => toast.error(error.message || "Gagal menyetujui stock request"),
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => stockService.receiveStockTransferRequest(id),
    onSuccess: async () => {
      toast.success("Penerimaan stock berhasil dikonfirmasi");
      setReceiveRequest(null);
      await invalidateStockQueries();
      await onStockChanged?.();
    },
    onError: (error: Error) => toast.error(error.message || "Gagal mengonfirmasi penerimaan stock"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => (
      stockService.rejectStockTransferRequest(id, reason)
    ),
    onSuccess: async () => {
      toast.success("Stock request berhasil ditolak");
      setRejectRequest(null);
      setRejectReason("");
      await invalidateStockQueries();
    },
    onError: (error: Error) => toast.error(error.message || "Gagal menolak stock request"),
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(createForm.quantity);

    if (!createForm.sourceLocationId) {
      toast.error("Pilih lokasi sumber stock");
      return;
    }
    if (!selectedSourceStock) {
      toast.error("Pilih produk yang akan diminta");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Jumlah stock harus berupa bilangan bulat lebih dari 0");
      return;
    }
    if (quantity > selectedSourceStock.stock) {
      toast.error(`Jumlah melebihi stock tersedia (${selectedSourceStock.stock})`);
      return;
    }

    createMutation.mutate();
  };

  const handleReject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    if (!rejectRequest) return;
    rejectMutation.mutate({ id: rejectRequest.id, reason });
  };

  const openApprovalLetter = async (request: StockTransferRequest, mode: "view" | "download") => {
    const previewWindow = mode === "view" ? window.open("about:blank", "_blank") : null;
    if (mode === "view" && !previewWindow) {
      toast.error("Browser memblokir tab PDF. Izinkan pop-up lalu coba lagi.");
      return;
    }

    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Menyiapkan surat persetujuan";
      previewWindow.document.body.textContent = "Menyiapkan surat persetujuan...";
    }

    try {
      setLetterLoading({ id: request.id, mode });
      const blob = await stockService.getStockApprovalLetter(request.id, mode === "download");
      const objectUrl = URL.createObjectURL(blob);

      if (mode === "view") {
        previewWindow?.location.replace(objectUrl);
      } else {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = approvalLetterFileName(request);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      previewWindow?.close();
      toast.error((error as Error).message || "Gagal membuka surat persetujuan");
    } finally {
      setLetterLoading(null);
    }
  };

  const canApproveSource = (request: StockTransferRequest) => (
    canManageCurrentStore &&
    request.status === "requested" &&
    request.from_location_id === locationId
  );
  const canReceiveDestination = (request: StockTransferRequest) => (
    canManageCurrentStore &&
    request.status === "source_approved" &&
    request.to_location_id === locationId
  );
  const canRejectAtCurrentStage = (request: StockTransferRequest) => (
    canManageCurrentStore && (
      (request.status === "requested" && request.from_location_id === locationId) ||
      (request.status === "source_approved" && request.to_location_id === locationId)
    )
  );

  const renderRequestActions = (request: StockTransferRequest, fullWidth = false) => {
    const canApprove = canApproveSource(request);
    const canReceive = canReceiveDestination(request);
    const canReject = canRejectAtCurrentStage(request);
    const canOpenLetter = canViewCurrentStore && request.approval_letter_available === true;
    const hasAction = canApprove || canReceive || canReject || canOpenLetter;
    const actionPending = (
      (approveMutation.isPending && approveMutation.variables === request.id) ||
      (receiveMutation.isPending && receiveMutation.variables === request.id) ||
      (rejectMutation.isPending && rejectMutation.variables?.id === request.id)
    );

    if (!hasAction) {
      return <span className="text-xs text-muted-foreground">Tidak ada aksi</span>;
    }

    return (
      <div className={cn("flex flex-wrap gap-2", fullWidth ? "w-full" : "justify-end")}>
        {canApprove ? (
          <Button
            size="sm"
            className={cn("gap-2", fullWidth && "flex-1")}
            disabled={actionPending}
            onClick={() => setApprovalRequest(request)}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Setujui sumber
          </Button>
        ) : null}
        {canReceive ? (
          <Button
            size="sm"
            className={cn("gap-2", fullWidth && "flex-1")}
            disabled={actionPending}
            onClick={() => setReceiveRequest(request)}
          >
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
            Konfirmasi diterima
          </Button>
        ) : null}
        {canReject ? (
          <Button
            size="sm"
            variant="outline"
            className={cn("gap-2 text-destructive hover:text-destructive", fullWidth && "flex-1")}
            disabled={actionPending}
            onClick={() => {
              setRejectReason("");
              setRejectRequest(request);
            }}
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Tolak
          </Button>
        ) : null}
        {canOpenLetter ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className={cn("gap-2", fullWidth && "flex-1")}
              disabled={letterLoading?.id === request.id}
              onClick={() => void openApprovalLetter(request, "view")}
            >
              {letterLoading?.id === request.id && letterLoading.mode === "view"
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Eye className="h-4 w-4" aria-hidden="true" />}
              Lihat PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={cn("gap-2", fullWidth && "flex-1")}
              disabled={letterLoading?.id === request.id}
              onClick={() => void openApprovalLetter(request, "download")}
            >
              {letterLoading?.id === request.id && letterLoading.mode === "download"
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Download className="h-4 w-4" aria-hidden="true" />}
              Unduh PDF
            </Button>
          </>
        ) : null}
      </div>
    );
  };

  if (authLoading) {
    return (
      <GlassCard className="flex min-h-48 items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Memeriksa akses stock management...</span>
      </GlassCard>
    );
  }

  if (!hasWritePermission) {
    return (
      <GlassCard>
        <Alert>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Akses terbatas</AlertTitle>
          <AlertDescription>
            Anda memerlukan akses write pada Stock Mutations untuk melihat dan memproses stock request.
          </AlertDescription>
        </Alert>
      </GlassCard>
    );
  }

  if (!isSuperAdmin && currentUserQuery.isLoading) {
    return (
      <GlassCard className="flex min-h-48 items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Memeriksa assignment store...</span>
      </GlassCard>
    );
  }

  if (!isSuperAdmin && currentUserQuery.isError) {
    return (
      <GlassCard>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Assignment store tidak dapat diverifikasi</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Data stock request tidak dimuat sampai assignment berhasil diverifikasi.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void currentUserQuery.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      </GlassCard>
    );
  }

  if (!canViewCurrentStore) {
    return (
      <GlassCard>
        <Alert>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Store tidak ditugaskan kepada Anda</AlertTitle>
          <AlertDescription>
            Stock request hanya dapat dilihat dan diproses pada store yang tercantum dalam assignment Anda.
          </AlertDescription>
        </Alert>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {!canManageCurrentStore ? (
        <Alert className="border-sky-200 bg-sky-50 text-sky-950">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Akses monitoring</AlertTitle>
          <AlertDescription>
            Anda dapat melihat request dan membuka surat persetujuan yang selesai. Pembuatan dan approval hanya tersedia untuk admin store.
          </AlertDescription>
        </Alert>
      ) : null}

      <GlassCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-lg font-semibold">Distribution & transfer stock</h3>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Pantau request masuk dan keluar untuk {locationName}, lalu proses persetujuan sesuai tahapnya.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={requestsQuery.isFetching}
              onClick={() => void requestsQuery.refetch()}
            >
              <RefreshCw className={cn("h-4 w-4", requestsQuery.isFetching && "animate-spin")} aria-hidden="true" />
              Muat ulang
            </Button>
            {canManageCurrentStore ? (
              <Button
                type="button"
                size="sm"
                className="admin-accent-button gap-2"
                onClick={() => {
                  setCreateForm(initialCreateForm);
                  setCreateOpen(true);
                }}
              >
                {isSuperAdmin
                  ? <Warehouse className="h-4 w-4" aria-hidden="true" />
                  : <PackagePlus className="h-4 w-4" aria-hidden="true" />}
                {isSuperAdmin ? "Buat distribution" : "Ajukan transfer"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">1. Request</p>
            <p className="mt-1 text-sm">Pilih sumber, produk, dan jumlah.</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">2. Approval</p>
            <p className="mt-1 text-sm">Admin sumber menyetujui ketersediaan.</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">3. Penerimaan</p>
            <p className="mt-1 text-sm">Admin tujuan konfirmasi dan surat dibuat.</p>
          </div>
        </div>
      </GlassCard>

      {requestedRequestId ? (
        <Alert className="border-primary/30 bg-primary/5">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Request dari tautan approval</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Request yang dituju akan ditandai pada daftar. Status tidak berubah sampai Anda menekan aksi konfirmasi.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete("request_id");
                setSearchParams(nextParams, { replace: true });
              }}
            >
              Tampilkan semua
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <GlassCard>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
            <div className="space-y-1.5">
              <Label htmlFor="stock-movement-filter">Jenis request</Label>
              <Select
                value={movementFilter}
                onValueChange={(value) => {
                  setMovementFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="stock-movement-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  <SelectItem value="distribution">Distribution</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-status-filter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="stock-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  <SelectItem value="requested">Menunggu persetujuan sumber</SelectItem>
                  <SelectItem value="source_approved">Menunggu penerimaan</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                  <SelectItem value="source_rejected">Ditolak</SelectItem>
                  <SelectItem value="cancelled">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{totalRequests} request</p>
        </div>

        {requestsQuery.isError ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Request stock gagal dimuat</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{(requestsQuery.error as Error).message || "Terjadi kesalahan saat mengambil data."}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void requestsQuery.refetch()}>
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="min-w-52">Produk</TableHead>
                    <TableHead className="min-w-56">Rute</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="min-w-44">Status</TableHead>
                    <TableHead className="min-w-40">Dibuat</TableHead>
                    <TableHead className="min-w-60 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden="true" />
                        Memuat stock request...
                      </TableCell>
                    </TableRow>
                  ) : requests.length > 0 ? requests.map((request) => {
                    const outgoing = request.from_location_id === locationId;
                    const highlighted = request.id === requestedRequestId;
                    return (
                      <TableRow key={request.id} className={cn(highlighted && "bg-primary/5 ring-1 ring-inset ring-primary/30")}>
                        <TableCell>
                          <div className="space-y-1.5">
                            <Badge variant="outline" className="capitalize">{request.movement_type}</Badge>
                            <div className={cn("flex items-center gap-1 text-xs", outgoing ? "text-amber-700" : "text-emerald-700")}>
                              {outgoing
                                ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                : <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />}
                              {outgoing ? "Keluar" : "Masuk"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{request.master_product?.product_name || request.master_product_id}</p>
                          <p className="mt-1 max-w-52 truncate text-xs text-muted-foreground">
                            {request.master_product?.product_code || request.notes || "Tanpa catatan"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{getLocationName(request.from_location)}</p>
                          <p className="my-0.5 text-xs text-muted-foreground">ke</p>
                          <p className="text-sm">{getLocationName(request.to_location)}</p>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{request.quantity}</TableCell>
                        <TableCell>
                          <RequestStatusBadge status={request.status} />
                          {request.approval_letter_number ? (
                            <p className="mt-1 text-xs text-muted-foreground">{request.approval_letter_number}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">{formatDateTime(request.created_at)}</TableCell>
                        <TableCell>{renderRequestActions(request)}</TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center">
                        <Inbox className="mx-auto mb-2 h-7 w-7 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">Belum ada stock request untuk filter ini.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {requestsQuery.isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden="true" />
                  Memuat stock request...
                </div>
              ) : requests.length > 0 ? requests.map((request) => {
                const outgoing = request.from_location_id === locationId;
                const highlighted = request.id === requestedRequestId;
                return (
                  <article
                    key={request.id}
                    className={cn("rounded-lg border p-4", highlighted && "border-primary/40 bg-primary/5 ring-1 ring-primary/20")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="capitalize">{request.movement_type}</Badge>
                          <span className={cn("flex items-center gap-1 text-xs", outgoing ? "text-amber-700" : "text-emerald-700")}>
                            {outgoing
                              ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                              : <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />}
                            {outgoing ? "Keluar" : "Masuk"}
                          </span>
                        </div>
                        <h4 className="mt-2 truncate font-semibold">
                          {request.master_product?.product_name || request.master_product_id}
                        </h4>
                      </div>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    {request.approval_letter_number ? (
                      <p className="mt-2 text-xs text-muted-foreground">Surat: {request.approval_letter_number}</p>
                    ) : null}
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-y py-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Dari</dt>
                        <dd className="mt-0.5 font-medium">{getLocationName(request.from_location)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Tujuan</dt>
                        <dd className="mt-0.5 font-medium">{getLocationName(request.to_location)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Jumlah</dt>
                        <dd className="mt-0.5 font-semibold">{request.quantity}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Dibuat</dt>
                        <dd className="mt-0.5">{formatDateTime(request.created_at)}</dd>
                      </div>
                    </dl>
                    {request.rejection_reason || request.notes ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {request.rejection_reason || request.notes}
                      </p>
                    ) : null}
                    <div className="mt-4">{renderRequestActions(request, true)}</div>
                  </article>
                );
              }) : (
                <div className="py-10 text-center">
                  <Inbox className="mx-auto mb-2 h-7 w-7 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">Belum ada stock request untuk filter ini.</p>
                </div>
              )}
            </div>

            {totalPages > 1 ? (
              <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || requestsQuery.isFetching}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                    Sebelumnya
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || requestsQuery.isFetching}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    Berikutnya
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </GlassCard>

      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!createMutation.isPending) {
          setCreateOpen(open);
          if (!open) setCreateForm(initialCreateForm);
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleCreate} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{isSuperAdmin ? "Buat distribution request" : "Ajukan transfer request"}</DialogTitle>
              <DialogDescription>
                {isSuperAdmin
                  ? `Kirim stock dari warehouse ke ${locationName}. Request langsung diteruskan ke tahap konfirmasi penerimaan.`
                  : `Ajukan kebutuhan stock dari store lain ke ${locationName}. Admin store sumber akan menerima tautan approval.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="stock-request-source">Lokasi sumber</Label>
                <Select
                  value={createForm.sourceLocationId}
                  onValueChange={(value) => setCreateForm((current) => ({
                    ...current,
                    sourceLocationId: value,
                    sourceProductStockId: "",
                    quantity: "1",
                  }))}
                >
                  <SelectTrigger id="stock-request-source" disabled={locationsQuery.isLoading || locationsQuery.isError}>
                    <SelectValue placeholder={locationsQuery.isLoading ? "Memuat lokasi..." : "Pilih lokasi sumber"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.location_name} · {location.location_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {locationsQuery.isError ? (
                  <p className="text-xs text-destructive">Lokasi gagal dimuat. Tutup dialog lalu coba lagi.</p>
                ) : sourceLocations.length === 0 && !locationsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Tidak ada lokasi sumber yang tersedia.</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-request-product">Produk dari stock sumber</Label>
                <Select
                  value={createForm.sourceProductStockId}
                  onValueChange={(value) => setCreateForm((current) => ({
                    ...current,
                    sourceProductStockId: value,
                    quantity: "1",
                  }))}
                >
                  <SelectTrigger
                    id="stock-request-product"
                    disabled={!createForm.sourceLocationId || sourceStocksQuery.isLoading || sourceStocksQuery.isError}
                  >
                    <SelectValue placeholder={sourceStocksQuery.isLoading ? "Memuat stock..." : "Pilih produk"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceStocks.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.master_product?.product_name} · tersedia {item.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sourceStocksQuery.isError ? (
                  <p className="text-xs text-destructive">Stock lokasi sumber gagal dimuat.</p>
                ) : createForm.sourceLocationId && !sourceStocksQuery.isLoading && sourceStocks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tidak ada produk dengan stock tersedia di lokasi ini.</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="stock-request-quantity">Jumlah</Label>
                  <Input
                    id="stock-request-quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={selectedSourceStock?.stock}
                    step={1}
                    value={createForm.quantity}
                    onChange={(event) => setCreateForm((current) => ({ ...current, quantity: event.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tersedia: {selectedSourceStock?.stock ?? "-"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Lokasi tujuan</Label>
                  <Input value={locationName} readOnly aria-label="Lokasi tujuan" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-request-notes">Catatan</Label>
                <Textarea
                  id="stock-request-notes"
                  maxLength={500}
                  value={createForm.notes}
                  onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Contoh: kebutuhan replenishment minggu ini"
                />
                <p className="text-right text-xs text-muted-foreground">{createForm.notes.length}/500</p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => setCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" className="gap-2" disabled={createMutation.isPending || !canManageCurrentStore}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {isSuperAdmin ? "Buat distribution" : "Kirim request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(approvalRequest)} onOpenChange={(open) => {
        if (!open && !approveMutation.isPending) setApprovalRequest(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Setujui ketersediaan stock?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda menyetujui penyediaan {approvalRequest?.quantity ?? 0} unit {approvalRequest?.master_product?.product_name || "produk"}
              {approvalRequest ? ` dari ${getLocationName(approvalRequest.from_location)}` : ""}. Stock baru dipindahkan setelah lokasi tujuan mengonfirmasi penerimaan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={approveMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (approvalRequest) approveMutation.mutate(approvalRequest.id);
              }}
            >
              {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Setujui request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(receiveRequest)} onOpenChange={(open) => {
        if (!open && !receiveMutation.isPending) setReceiveRequest(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi stock sudah diterima?</AlertDialogTitle>
            <AlertDialogDescription>
              Konfirmasi akan memindahkan {receiveRequest?.quantity ?? 0} unit {receiveRequest?.master_product?.product_name || "produk"} ke {locationName},
              mencatat mutation log, dan membuat surat persetujuan PDF. Lanjutkan hanya setelah barang fisik diterima.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={receiveMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={receiveMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (receiveRequest) receiveMutation.mutate(receiveRequest.id);
              }}
            >
              {receiveMutation.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                : <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />}
              Konfirmasi diterima
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(rejectRequest)} onOpenChange={(open) => {
        if (!open && !rejectMutation.isPending) {
          setRejectRequest(null);
          setRejectReason("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleReject} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Tolak stock request</DialogTitle>
              <DialogDescription>
                Berikan alasan yang jelas agar admin lokasi lain dapat menindaklanjuti request ini.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="stock-rejection-reason">Alasan penolakan</Label>
              <Textarea
                id="stock-rejection-reason"
                autoFocus
                required
                maxLength={500}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Tuliskan alasan penolakan"
              />
              <p className="text-right text-xs text-muted-foreground">{rejectReason.length}/500</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={rejectMutation.isPending} onClick={() => setRejectRequest(null)}>
                Batal
              </Button>
              <Button type="submit" variant="destructive" className="gap-2" disabled={rejectMutation.isPending || !rejectReason.trim()}>
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Tolak request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
