# Payment Approval & WA Notification Feature

**Date:** 2026-05-25
**Status:** Approved (API key via .env)

## Context

There are two features needed:
1. **Admin Payment Approval Page** - A protected page for store admins to view and approve pending payments
2. **WA Notification Module** - Send WhatsApp notifications via API when payment is approved

### Feature 1: Admin Payment Approval Page

**Problem:** Customer payments are currently approved via a public link (`/transactions/:id/approve-payment`). Store admins need a protected page to manage pending payments.

**Solution:** Create `/master/koperasi/:locationId/payment-approval` page accessible only by assigned store admins.

### Feature 2: WA Notification Module

**Problem:** When payment is approved, both admin and customer need to be notified via WhatsApp.

**Solution:** Expand existing `notification` service with WA notification capability using external WA API.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend                                │
├─────────────────────────────────────────────────────────────┤
│  App.tsx: /master/koperasi/:locationId/payment-approval    │
│                  │                                           │
│  PaymentApprovalPage.tsx (new)                              │
│    └── TransactionCard list + Approve button                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend                                  │
├─────────────────────────────────────────────────────────────┤
│  Transaction Handler                                        │
│    └── ApprovePayment → WA Service → WA API                │
│                                                          │
│  Notification Service (expanded)                            │
│    └── SendAdminApprovalNotification()                     │
│    └── SendCustomerApprovalNotification()                  │
│                                                          │
│  WA API Integration                                         │
│    └── Base URL from .env                                  │
│    └── API Key from .env                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   External WA API                           │
│  http://10.2.45.4:8082/message/sendText/bot                │
└─────────────────────────────────────────────────────────────┘
```

## Design

### Backend Changes

#### 1. Environment Configuration

**File:** `be.argo.commerce.apps/.env`

```bash
# WA Notification API
WA_API_BASE_URL=http://10.2.45.4:8082
WA_API_KEY=vWbzN9EclRbmq8406P1zFvVQFkoW1t
```

#### 2. WA Service

**File:** `be.argo.commerce.apps/internal/domain/notification/service/wa_service.go` (new)

```go
package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type WAService struct {
	baseURL string
	apiKey  string
}

type WAMessageRequest struct {
	Number string `json:"number"`
	Text   string `json:"text"`
}

type WAService interface {
	SendTextMessage(ctx context.Context, phoneNumber string, message string) error
	FormatPhoneNumber(phone string) string
}

func NewWAService() WAService {
	return &WAService{
		baseURL: os.Getenv("WA_API_BASE_URL"),
		apiKey:  os.Getenv("WA_API_KEY"),
	}
}

func (s *WAService) SendTextMessage(ctx context.Context, phoneNumber string, message string) error {
	url := fmt.Sprintf("%s/message/sendText/bot", s.baseURL)

	body := WAMessageRequest{
		Number: phoneNumber,
		Text:   message,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send WA message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("WA API returned error status: %d", resp.StatusCode)
	}

	return nil
}

func (s *WAService) FormatPhoneNumber(phone string) string {
	// Remove all non-digit characters
	result := ""
	for _, c := range phone {
		if c >= '0' && c <= '9' {
			result += string(c)
		}
	}

	// If starts with "0", replace with "62"
	if len(result) > 0 && result[0] == '0' {
		result = "62" + result[1:]
	}

	// If doesn't start with "62", add it
	if len(result) > 0 && result[0] != '6' && result[1] != '2' {
		result = "62" + result
	}

	return result + "@c.us"
}
```

#### 3. Notification Service Enhancement

**File:** `be.argo.commerce.apps/internal/domain/notification/service/service.go`

Add methods for WA notification:

```go
package service

import (
	"context"
	"log"
	"strconv"
	"strings"
	"time"
)

// NotificationParams for templating
type NotificationParams struct {
	TransactionCode string
	CustomerName   string
	TotalPayment   string
	PaymentMethod  string
	TransactionDate string
	Products       []ProductItem
	ApprovalLink   string
	StoreName      string
}

type ProductItem struct {
	Name  string
	Qty   int
	Price string
}

// WAService interface for WA notifications
type WAService interface {
	SendTextMessage(ctx context.Context, phoneNumber string, message string) error
	FormatPhoneNumber(phone string) string
}

type service struct {
	// existing fields...
	waService WAService
}

// SendAdminApprovalNotification sends WA notification to admin after payment approved
func (s *service) SendAdminApprovalNotification(ctx context.Context, params NotificationParams, adminPhone string) error {
	message := s.formatAdminApprovalMessage(params)
	formattedPhone := s.waService.FormatPhoneNumber(adminPhone)
	return s.waService.SendTextMessage(ctx, formattedPhone, message)
}

// SendCustomerApprovalNotification sends WA notification to customer after payment approved
func (s *service) SendCustomerApprovalNotification(ctx context.Context, params NotificationParams, customerPhone string) error {
	message := s.formatCustomerApprovalMessage(params)
	formattedPhone := s.waService.FormatPhoneNumber(customerPhone)
	return s.waService.SendTextMessage(ctx, formattedPhone, message)
}

func (s *service) formatAdminApprovalMessage(params NotificationParams) string {
	var sb strings.Builder
	sb.WriteString("🔔 Notifikasi Transaksi Baru\n\n")
	sb.WriteString("Halo Admin,\n\n")
	sb.WriteString("Ada transaksi baru yang menunggu verifikasi pembayaran ✅\n\n")
	sb.WriteString("🧾 Detail Transaksi:\n")
	sb.WriteString("* No. Transaksi: " + params.TransactionCode + "\n")
	sb.WriteString("* Nama Customer: " + params.CustomerName + "\n")
	sb.WriteString("* Total Pembayaran: " + params.TotalPayment + "\n")
	sb.WriteString("* Metode Pembayaran: " + params.PaymentMethod + "\n")
	sb.WriteString("* Tanggal Transaksi: " + params.TransactionDate + "\n\n")
	sb.WriteString("🛒 Produk Dibeli:\n")
	for _, p := range params.Products {
		sb.WriteString("• " + p.Name + " x" + strconv.Itoa(p.Qty) + " — " + p.Price + "\n")
	}
	sb.WriteString("\nSilakan lakukan verifikasi pembayaran melalui link berikut:\n")
	sb.WriteString("👉 " + params.ApprovalLink + "\n\n")
	sb.WriteString("Terima kasih.")
	return sb.String()
}

func (s *service) formatCustomerApprovalMessage(params NotificationParams) string {
	var sb strings.Builder
	sb.WriteString("Halo " + params.CustomerName + ",\n\n")
	sb.WriteString("Kami informasikan bahwa pembayaran untuk transaksi dengan nomor *" + params.TransactionCode + "* telah berhasil diverifikasi oleh admin.\n\n")
	sb.WriteString("Pesanan Anda saat ini sedang diproses untuk pengiriman.\n\n")
	sb.WriteString("🛒 Detail Produk:\n")
	for _, p := range params.Products {
		sb.WriteString("\n* " + p.Name + " x" + strconv.Itoa(p.Qty) + " — " + p.Price + "\n")
	}
	sb.WriteString("\n💰 Total Pembayaran: " + params.TotalPayment + "\n")
	sb.WriteString("📅 Tanggal Pembayaran: " + time.Now().Format("02 Jan 2006, 15:04") + "\n\n")
	sb.WriteString("Terima kasih telah berbelanja di " + params.StoreName + ".")
	return sb.String()
}
```

#### 4. Transaction Service - Trigger WA Notification

**File:** `be.argo.commerce.apps/internal/domain/transaction/service/service.go`

Modify `ApprovePayment` to send WA notifications:

```go
// ApprovePayment approves a transaction payment (status becomes PAID)
func (s *service) ApprovePayment(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("transaction id is required")
	}

	// Get transaction with carts to reduce stock
	transaction, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get transaction: %w", err)
	}

	// Reduce stock for each cart item
	for _, cart := range transaction.TransactionCarts {
		if err := s.repo.ReduceStock(ctx, cart.ProductStockID, cart.Qty); err != nil {
			return fmt.Errorf("failed to reduce stock for product %s: %w", cart.ProductStockID, err)
		}
	}

	if err := s.repo.UpdateStatus(ctx, id, model.TransactionStatusPaid); err != nil {
		return err
	}

	// Send WA notifications asynchronously
	go func() {
		notifyCtx := context.Background()

		// Get admin phone numbers for this store
		adminUsers, _ := s.userRepo.GetUsersByStore(notifyCtx, transaction.MasterLocationID)
		for _, admin := range adminUsers {
			if admin.NoWA != nil && *admin.NoWA != "" {
				s.notificationService.SendAdminApprovalNotification(
					notifyCtx,
					buildNotificationParams(transaction),
					*admin.NoWA,
				)
			}
		}

		// Send notification to customer if they have WA number
		if transaction.Customer != nil && transaction.Customer.NoWA != "" {
			s.notificationService.SendCustomerApprovalNotification(
				notifyCtx,
				buildNotificationParams(transaction),
				transaction.Customer.NoWA,
			)
		}
	}()

	return nil
}
```

### Frontend Changes

#### 1. Route Registration

**File:** `argopos/src/App.tsx`

```tsx
<Route path="/master/koperasi/:locationId/payment-approval" element={
  <ProtectedRoute>
    <PaymentApprovalPage />
  </ProtectedRoute>
} />
```

#### 2. Payment Approval Page

**File:** `argopos/src/pages/master/PaymentApprovalPage.tsx`

Components:
- Filter bar (status, date range, payment method)
- Transaction list (card/table view)
- Approve payment button with confirmation dialog
- Pagination

Features:
- Fetch transactions with `WAITING_TO_PAYMENT` status
- Display transaction details (code, customer, amount, payment method)
- Approve button calls `PUT //transactions/:id/approve-payment`
- Loading states and error handling
- Responsive design (mobile card view, desktop table view)

#### 3. Navigation Update

Add link to payment approval page in sidebar navigation or KopiDetailPage tabs.

## Scope

### Backend
1. Create WA service module (`notification/service/wa_service.go`)
2. Enhance notification service with WA notification methods
3. Modify `ApprovePayment` to trigger WA notifications
4. Add environment variables for WA API config

### Frontend
1. Create `PaymentApprovalPage.tsx`
2. Add route in `App.tsx`
3. Add navigation link

## Out of Scope
- Email notifications (only WA)
- Push notifications
- SMS notifications
- Multiple admin notifications (first one only)

## API Endpoints

### Backend
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stores/:locationId/transactions?status=WAITING_TO_PAYMENT` | List pending transactions |
| PUT | `/transactions/:id/approve-payment` | Approve payment + trigger WA |

### Frontend
| Route | Description |
|-------|-------------|
| `/master/koperasi/:locationId/payment-approval` | Admin payment approval page |

## Success Criteria
1. Store admins can access payment approval page
2. Only assigned store admins can see pending transactions
3. Approve button triggers status change to PAID
4. Admin receives WA notification after approval
5. Customer receives WA notification after approval
6. All WA API credentials stored in .env