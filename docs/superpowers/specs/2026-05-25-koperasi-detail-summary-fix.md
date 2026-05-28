# Fix Summary Metrics Fetch API - KoperasiDetailPage

**Date:** 2026-05-25
**Status:** Approved

## Context

The `KoperasiDetailPage.tsx` currently fetches summary metrics by manually loading all transactions and computing metrics client-side:

```typescript
const response = await storeService.getStoreTransactions(locationId!, {
  start_date: summaryStartDate,
  end_date: summaryEndDate,
  page: 1,
  page_size: 1000,
});
```

This approach:
- Fetches up to 1000 transactions just to calculate 4 numbers
- Inefficient and not scalable
- Computes `internal_customers` and `external_customers` client-side

The `dashboard_analytics` module already provides an efficient aggregated endpoint that can compute these metrics server-side.

## Objective

Replace the inefficient transaction list fetch with the `dashboard_analytics` API for the Summary tab.

## Design

### Backend Changes

**File:** `be.argo.commerce.apps/internal/domain/dashboard_analytics/model/model.go`

Modify `SummaryMetrics` to add `internal_customers` and `external_customers` fields:

```go
type SummaryMetrics struct {
	TotalRevenue      int64     `json:"total_revenue"`
	TotalTransactions int64     `json:"total_transactions"`
	UniqueCustomers   int64     `json:"unique_customers"`
	InternalCustomers int64    `json:"internal_customers"`  // NEW: has customer_id
	ExternalCustomers int64     `json:"external_customers"`  // NEW: no customer_id
	RevenueGrowth     float64   `json:"revenue_growth"`
	PreviousRevenue   int64     `json:"previous_revenue"`
	PeriodStart       time.Time `json:"period_start"`
	PeriodEnd         time.Time `json:"period_end"`
}
```

**File:** `be.argo.commerce.apps/internal/domain/dashboard_analytics/repository/repository.go`

Update `GetSummary` to compute internal vs external customers:

```go
func (r *gormRepo) GetSummary(ctx context.Context, filter Filter) (damodel.SummaryMetrics, error) {
	var result struct {
		TotalRevenue       int64
		TotalTransactions  int64
		UniqueCustomers    int64
		InternalCustomers  int64  // NEW
		ExternalCustomers  int64  // NEW
	}

	query := r.db.WithContext(ctx).
		Table("transactions AS t").
		Select(`
			COALESCE(SUM(t.total_amount), 0) AS total_revenue,
			COUNT(*) AS total_transactions,
			COUNT(DISTINCT COALESCE(t.customer_id::text, t.created_by::text)) AS unique_customers,
			COUNT(DISTINCT CASE WHEN t.customer_id IS NOT NULL THEN t.customer_id ELSE NULL END) AS internal_customers,
			COUNT(DISTINCT CASE WHEN t.customer_id IS NULL THEN t.created_by ELSE NULL END) AS external_customers`).
		Where("t.status IN ?", successStatuses).
		Where("t.created_at BETWEEN ? AND ?", filter.StartDate, filter.EndDate)

	query = applyStoreFilter(query, filter.StoreIDs)

	if err := query.Scan(&result).Error; err != nil {
		return damodel.SummaryMetrics{}, err
	}

	return damodel.SummaryMetrics{
		TotalRevenue:       result.TotalRevenue,
		TotalTransactions:  result.TotalTransactions,
		UniqueCustomers:     result.UniqueCustomers,
		InternalCustomers:   result.InternalCustomers,  // NEW
		ExternalCustomers:   result.ExternalCustomers,   // NEW
	}, nil
}
```

**File:** `be.argo.commerce.apps/internal/domain/dashboard_analytics/handler/http.go`

Update `GetOverview` to accept custom date range:

```go
func (h *Handler) GetOverview(c *fiber.Ctx) error {
	principal := middleware.GetPrincipal(c)
	if principal == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "unauthorized")
	}

	rangeDays := c.QueryInt("range_days", 30)
	storeID := c.Query("store_id")

	// Custom date range params (optional)
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")

	// ... pass to service
}
```

**File:** `be.argo.commerce.apps/internal/domain/dashboard_analytics/service/service.go`

Update service to pass custom date range:

```go
type AnalyticsParams struct {
	UserID        string
	Role          string
	RangeDays     int
	StoreID       string
	StartDate     *time.Time  // NEW
	EndDate       *time.Time  // NEW
}
```

### Frontend Changes

**File:** `argopos/src/pages/master/KoperasiDetailPage.tsx`

Update `loadSummaryData` to use the analytics API:

```typescript
const loadSummaryData = async () => {
  try {
    setSummaryLoading(true);

    // Calculate date range in days for the API
    const startDateObj = new Date(summaryStartDate);
    const endDateObj = new Date(summaryEndDate);
    const rangeDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

    // Use dashboard analytics API with store_id filter
    const response = await apiClient.getDashboardAnalytics({
      range_days: rangeDays,
      store_id: locationId,
    });

    if (response.success && response.data?.summary) {
      setSummaryData({
        total_transactions: response.data.summary.total_transactions,
        total_revenue: response.data.summary.total_revenue,
        internal_customers: response.data.summary.internal_customers,
        external_customers: response.data.summary.external_customers,
      });
    }
  } catch (error) {
    toast.error("Failed to load summary data");
    console.error(error);
  } finally {
    setSummaryLoading(false);
  }
};
```

**File:** `argopos/src/lib/api.ts`

Update interface to match new response:

```typescript
export interface DashboardAnalyticsSummary {
  total_revenue: number;
  total_transactions: number;
  unique_customers: number;
  internal_customers: number;  // NEW
  external_customers: number;  // NEW
  revenue_growth: number;
  previous_revenue: number;
  period_start: string;
  period_end: string;
}
```

## Scope

1. Backend: Modify model, repository, handler, service in `dashboard_analytics`
2. Frontend: Update `KoperasiDetailPage.tsx` to use analytics API
3. Frontend: Update TypeScript interfaces in `api.ts`

## Out of Scope

- Other tabs (Users, Transaction, Payment)
- Other pages using `dashboard_analytics` API
- Changes to revenue_trend, category_distribution, recent_transactions endpoints