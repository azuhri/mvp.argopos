import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpDown,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { locationService } from "@/lib/services/locationService";
import { productService } from "@/lib/services/productService";
import { stockService } from "@/lib/services/stockService";
import type {
  CreateStockTransferRequest,
  Location,
  Product,
  StockMutation,
  StockMutationFilters,
  StockTransferRequest,
  StockTransferRequestFilters,
} from "@/lib/api";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
};

const formatMovementLabel = (value: string) => (
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
);

const getLocationLabel = (location?: Location) => {
  if (!location) return "-";
  const type = location.type ? ` · ${location.type}` : "";
  return `${location.location_name || location.location_code}${type}`;
};

const getProductLabel = (product?: Product) => {
  if (!product) return "-";
  return product.product_code
    ? `${product.product_name} · ${product.product_code}`
    : product.product_name;
};

const mutationBadge = (mutation: StockMutation) => {
  if (mutation.type === "in") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <ArrowDownToLine className="h-3 w-3" />
        IN
      </Badge>
    );
  }

  return (
    <Badge className="gap-1 bg-rose-100 text-rose-700 hover:bg-rose-100">
      <ArrowUpFromLine className="h-3 w-3" />
      OUT
    </Badge>
  );
};

const statusBadge = (status: StockTransferRequest["status"]) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>;
    case "source_approved":
      return <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">Source Approved</Badge>;
    case "source_rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    case "cancelled":
      return <Badge variant="outline">Cancelled</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Requested</Badge>;
  }
};

const buildStockRange = (before?: number, after?: number) => {
  if (typeof before !== "number" && typeof after !== "number") return "-";
  return `${before ?? "-"} -> ${after ?? "-"}`;
};

export default function StockMutations() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("mutations");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [mutationPage, setMutationPage] = useState(1);
  const [mutationPageSize, setMutationPageSize] = useState(20);
  const [mutationFilters, setMutationFilters] = useState<StockMutationFilters>({
    start_date: "",
    end_date: "",
    location_id: "",
    movement_type: "all",
    type: "all",
    sort_order: "desc",
  });

  const [requestPage, setRequestPage] = useState(1);
  const [requestPageSize, setRequestPageSize] = useState(20);
  const [requestFilters, setRequestFilters] = useState<StockTransferRequestFilters>({
    start_date: "",
    end_date: "",
    location_id: "",
    movement_type: "all",
    status: "all",
    sort_order: "desc",
  });

  const [createForm, setCreateForm] = useState<CreateStockTransferRequest>({
    movement_type: "transfer",
    from_location_id: "",
    to_location_id: "",
    master_product_id: "",
    quantity: 1,
    notes: "",
  });

  const locationsQuery = useQuery({
    queryKey: ["stock-mutation-locations"],
    queryFn: () => locationService.getAllLocations(),
    staleTime: 5 * 60 * 1000,
  });

  const productsQuery = useQuery({
    queryKey: ["stock-mutation-products"],
    queryFn: () => productService.getAllProducts(),
    staleTime: 5 * 60 * 1000,
  });

  const mutationsQuery = useQuery({
    queryKey: ["stock-mutations", mutationPage, mutationPageSize, mutationFilters],
    queryFn: () => stockService.getStockMutations({
      ...mutationFilters,
      page: mutationPage,
      page_size: mutationPageSize,
    }),
  });

  const requestsQuery = useQuery({
    queryKey: ["stock-transfer-requests", requestPage, requestPageSize, requestFilters],
    queryFn: () => stockService.getStockTransferRequests({
      ...requestFilters,
      page: requestPage,
      page_size: requestPageSize,
    }),
  });

  const locations = locationsQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const mutations = mutationsQuery.data?.mutations ?? [];
  const mutationMeta = mutationsQuery.data?.meta ?? {
    page: mutationPage,
    page_size: mutationPageSize,
    total: 0,
    total_pages: 1,
  };
  const requests = requestsQuery.data?.requests ?? [];
  const requestMeta = requestsQuery.data?.meta ?? {
    page: requestPage,
    page_size: requestPageSize,
    total: 0,
    total_pages: 1,
  };

  const pendingRequests = requests.filter((request) => (
    request.status === "requested" || request.status === "source_approved"
  )).length;

  const invalidateStockMutationQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-mutations"] });
    queryClient.invalidateQueries({ queryKey: ["stock-transfer-requests"] });
    queryClient.invalidateQueries({ queryKey: ["stocks"] });
  };

  const createRequestMutation = useMutation({
    mutationFn: (request: CreateStockTransferRequest) => stockService.createStockTransferRequest(request),
    onSuccess: () => {
      toast.success("Stock request created");
      setIsCreateOpen(false);
      setCreateForm({
        movement_type: "transfer",
        from_location_id: "",
        to_location_id: "",
        master_product_id: "",
        quantity: 1,
        notes: "",
      });
      invalidateStockMutationQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create stock request");
    },
  });

  const approveSourceMutation = useMutation({
    mutationFn: (id: string) => stockService.approveStockTransferSource(id),
    onSuccess: () => {
      toast.success("Source approval saved");
      invalidateStockMutationQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve request");
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => (
      stockService.rejectStockTransferRequest(id, reason)
    ),
    onSuccess: () => {
      toast.success("Request rejected");
      invalidateStockMutationQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject request");
    },
  });

  const receiveRequestMutation = useMutation({
    mutationFn: (id: string) => stockService.receiveStockTransferRequest(id),
    onSuccess: () => {
      toast.success("Stock received and mutation logged");
      invalidateStockMutationQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to receive stock");
    },
  });

  const updateMutationFilter = (patch: Partial<StockMutationFilters>) => {
    setMutationFilters((current) => ({ ...current, ...patch }));
    setMutationPage(1);
  };

  const updateRequestFilter = (patch: Partial<StockTransferRequestFilters>) => {
    setRequestFilters((current) => ({ ...current, ...patch }));
    setRequestPage(1);
  };

  const handleCreateRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.from_location_id || !createForm.to_location_id || !createForm.master_product_id) {
      toast.error("Source, destination, and product are required");
      return;
    }
    if (createForm.from_location_id === createForm.to_location_id) {
      toast.error("Source and destination locations cannot be the same");
      return;
    }
    if (!createForm.quantity || createForm.quantity <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }

    createRequestMutation.mutate({
      ...createForm,
      quantity: Number(createForm.quantity),
    });
  };

  const isActionLoading = (
    approveSourceMutation.isPending ||
    rejectRequestMutation.isPending ||
    receiveRequestMutation.isPending
  );

  return (
    <AppLayout title="Stock Mutations">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">Stock Mutations</h1>
            <p className="text-sm text-muted-foreground">
              Monitor checkout, distribution, and store transfer stock movement.
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="admin-accent-button gap-2">
                <Plus className="h-4 w-4" />
                Request Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <form onSubmit={handleCreateRequest} className="space-y-5">
                <DialogHeader>
                  <DialogTitle>Create Stock Request</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="movement_type">Movement</Label>
                    <Select
                      value={createForm.movement_type}
                      onValueChange={(value: "distribution" | "transfer") => (
                        setCreateForm((current) => ({ ...current, movement_type: value }))
                      )}
                    >
                      <SelectTrigger id="movement_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer">Store to Store</SelectItem>
                        <SelectItem value="distribution">Warehouse to Store</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      value={createForm.quantity}
                      onChange={(event) => (
                        setCreateForm((current) => ({ ...current, quantity: Number(event.target.value) }))
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Source Location</Label>
                    <Select
                      value={createForm.from_location_id}
                      onValueChange={(value) => (
                        setCreateForm((current) => ({ ...current, from_location_id: value }))
                      )}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {getLocationLabel(location)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Destination Location</Label>
                    <Select
                      value={createForm.to_location_id}
                      onValueChange={(value) => (
                        setCreateForm((current) => ({ ...current, to_location_id: value }))
                      )}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {getLocationLabel(location)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Product</Label>
                    <Select
                      value={createForm.master_product_id}
                      onValueChange={(value) => (
                        setCreateForm((current) => ({ ...current, master_product_id: value }))
                      )}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {getProductLabel(product)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={createForm.notes ?? ""}
                      onChange={(event) => (
                        setCreateForm((current) => ({ ...current, notes: event.target.value }))
                      )}
                      placeholder="Optional request notes"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createRequestMutation.isPending} className="gap-2">
                    {createRequestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create Request
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
              Total Logs
            </div>
            <div className="mt-2 text-2xl font-semibold">{mutationMeta.total}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Pending Requests
            </div>
            <div className="mt-2 text-2xl font-semibold">{pendingRequests}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Completed Requests
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {requests.filter((request) => request.status === "completed").length}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="mutations">Mutation Logs</TabsTrigger>
            <TabsTrigger value="requests">Transfer Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="mutations" className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                Filters
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Input
                  type="date"
                  value={mutationFilters.start_date ?? ""}
                  onChange={(event) => updateMutationFilter({ start_date: event.target.value })}
                />
                <Input
                  type="date"
                  value={mutationFilters.end_date ?? ""}
                  onChange={(event) => updateMutationFilter({ end_date: event.target.value })}
                />
                <Select
                  value={mutationFilters.location_id || "all"}
                  onValueChange={(value) => updateMutationFilter({ location_id: value === "all" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {getLocationLabel(location)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={mutationFilters.movement_type ?? "all"}
                  onValueChange={(value) => updateMutationFilter({ movement_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Movements</SelectItem>
                    <SelectItem value="checkout">Checkout</SelectItem>
                    <SelectItem value="checkout_rollback">Checkout Rollback</SelectItem>
                    <SelectItem value="distribution">Distribution</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={mutationFilters.type ?? "all"}
                  onValueChange={(value) => updateMutationFilter({ type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">IN & OUT</SelectItem>
                    <SelectItem value="in">IN</SelectItem>
                    <SelectItem value="out">OUT</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={mutationFilters.sort_order ?? "desc"}
                  onValueChange={(value: "asc" | "desc") => updateMutationFilter({ sort_order: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-sm font-medium">Mutation Logs</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => mutationsQuery.refetch()}
                  disabled={mutationsQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${mutationsQuery.isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Timestamp</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="min-w-[150px]">Movement</TableHead>
                      <TableHead className="min-w-[220px]">Product</TableHead>
                      <TableHead className="min-w-[180px]">Location</TableHead>
                      <TableHead className="min-w-[180px]">From</TableHead>
                      <TableHead className="min-w-[180px]">To</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="min-w-[120px]">Stock</TableHead>
                      <TableHead className="min-w-[240px]">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mutationsQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Loading mutations
                        </TableCell>
                      </TableRow>
                    )}
                    {!mutationsQuery.isLoading && mutations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                          No stock mutations found
                        </TableCell>
                      </TableRow>
                    )}
                    {mutations.map((mutation) => (
                      <TableRow key={mutation.id}>
                        <TableCell>{formatDateTime(mutation.created_at)}</TableCell>
                        <TableCell>{mutationBadge(mutation)}</TableCell>
                        <TableCell>{formatMovementLabel(mutation.movement_type)}</TableCell>
                        <TableCell>{getProductLabel(mutation.product)}</TableCell>
                        <TableCell>{getLocationLabel(mutation.location)}</TableCell>
                        <TableCell>{getLocationLabel(mutation.from_location)}</TableCell>
                        <TableCell>{getLocationLabel(mutation.to_location)}</TableCell>
                        <TableCell className="text-right font-medium">{mutation.quantity}</TableCell>
                        <TableCell>{buildStockRange(mutation.stock_before, mutation.stock_after)}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{mutation.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {mutationMeta.page} of {Math.max(mutationMeta.total_pages, 1)} · {mutationMeta.total} rows
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(mutationPageSize)}
                    onValueChange={(value) => {
                      setMutationPageSize(Number(value));
                      setMutationPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[92px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mutationPage <= 1}
                    onClick={() => setMutationPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mutationPage >= Math.max(mutationMeta.total_pages, 1)}
                    onClick={() => setMutationPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                Filters
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Input
                  type="date"
                  value={requestFilters.start_date ?? ""}
                  onChange={(event) => updateRequestFilter({ start_date: event.target.value })}
                />
                <Input
                  type="date"
                  value={requestFilters.end_date ?? ""}
                  onChange={(event) => updateRequestFilter({ end_date: event.target.value })}
                />
                <Select
                  value={requestFilters.location_id || "all"}
                  onValueChange={(value) => updateRequestFilter({ location_id: value === "all" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {getLocationLabel(location)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={requestFilters.movement_type ?? "all"}
                  onValueChange={(value) => updateRequestFilter({ movement_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Movements</SelectItem>
                    <SelectItem value="distribution">Distribution</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={requestFilters.status ?? "all"}
                  onValueChange={(value) => updateRequestFilter({ status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="source_approved">Source Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="source_rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={requestFilters.sort_order ?? "desc"}
                  onValueChange={(value: "asc" | "desc") => updateRequestFilter({ sort_order: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-sm font-medium">Transfer Requests</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => requestsQuery.refetch()}
                  disabled={requestsQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${requestsQuery.isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Requested At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-[150px]">Movement</TableHead>
                      <TableHead className="min-w-[220px]">Product</TableHead>
                      <TableHead className="min-w-[180px]">Source</TableHead>
                      <TableHead className="min-w-[180px]">Destination</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="min-w-[220px]">Notes</TableHead>
                      <TableHead className="w-[150px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Loading requests
                        </TableCell>
                      </TableRow>
                    )}
                    {!requestsQuery.isLoading && requests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                          No stock transfer requests found
                        </TableCell>
                      </TableRow>
                    )}
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>{formatDateTime(request.created_at)}</TableCell>
                        <TableCell>{statusBadge(request.status)}</TableCell>
                        <TableCell>{formatMovementLabel(request.movement_type)}</TableCell>
                        <TableCell>{getProductLabel(request.master_product)}</TableCell>
                        <TableCell>{getLocationLabel(request.from_location)}</TableCell>
                        <TableCell>{getLocationLabel(request.to_location)}</TableCell>
                        <TableCell className="text-right font-medium">{request.quantity}</TableCell>
                        <TableCell className="max-w-[260px] truncate">
                          {request.rejection_reason || request.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {request.status === "requested" && (
                              <>
                                <Button
                                  title="Approve source"
                                  variant="outline"
                                  size="icon"
                                  disabled={isActionLoading}
                                  onClick={() => approveSourceMutation.mutate(request.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  title="Reject request"
                                  variant="outline"
                                  size="icon"
                                  disabled={isActionLoading}
                                  onClick={() => rejectRequestMutation.mutate({
                                    id: request.id,
                                    reason: "Rejected from stock mutation page",
                                  })}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {request.status === "source_approved" && (
                              <Button
                                title="Receive stock"
                                variant="outline"
                                size="icon"
                                disabled={isActionLoading}
                                onClick={() => receiveRequestMutation.mutate(request.id)}
                              >
                                <ArrowDownToLine className="h-4 w-4" />
                              </Button>
                            )}
                            {request.status !== "requested" && request.status !== "source_approved" && (
                              <Button title="No action" variant="ghost" size="icon" disabled>
                                <ArrowUpDown className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {requestMeta.page} of {Math.max(requestMeta.total_pages, 1)} · {requestMeta.total} rows
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(requestPageSize)}
                    onValueChange={(value) => {
                      setRequestPageSize(Number(value));
                      setRequestPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[92px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={requestPage <= 1}
                    onClick={() => setRequestPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={requestPage >= Math.max(requestMeta.total_pages, 1)}
                    onClick={() => setRequestPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
