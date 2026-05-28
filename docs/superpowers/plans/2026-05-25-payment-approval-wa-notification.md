# Payment Approval & WA Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create admin payment approval page and WA notification module - when admin approves payment, send WA notifications to both admin and customer.

**Architecture:** Expand existing notification service with WA capability, create admin-only payment approval page, trigger WA notifications on payment approval.

**Tech Stack:** Go backend (Fiber), React/TypeScript frontend, WA API (http://10.2.45.4:8082)

---

## File Structure

### Backend Files
- **Create:** `be.argo.commerce.apps/internal/domain/notification/service/wa_service.go` - WA API integration
- **Modify:** `be.argo.commerce.apps/internal/domain/notification/service/service.go` - Add WA notification methods
- **Modify:** `be.argo.commerce.apps/.env` - Add WA API config

### Frontend Files
- **Create:** `argopos/src/pages/master/PaymentApprovalPage.tsx` - Admin payment approval page
- **Modify:** `argopos/src/App.tsx` - Add route for payment approval page

---

## Task 1: Create WA Service Backend Module

**Files:**
- Create: `be.argo.commerce.apps/internal/domain/notification/service/wa_service.go`

- [ ] **Step 1: Create wa_service.go file**

```go
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// WAService handles WhatsApp notification sending
type WAService struct {
	baseURL string
	apiKey  string
}

// WAMessageRequest represents the WA API request body
type WAMessageRequest struct {
	Number string `json:"number"`
	Text   string `json:"text"`
}

// NewWAService creates a new WA service instance
func NewWAService() *WAService {
	return &WAService{
		baseURL: os.Getenv("WA_API_BASE_URL"),
		apiKey:  os.Getenv("WA_API_KEY"),
	}
}

// SendTextMessage sends a text message via WhatsApp API
func (s *WAService) SendTextMessage(ctx context.Context, phoneNumber string, message string) error {
	if s.baseURL == "" || s.apiKey == "" {
		return fmt.Errorf("WA API configuration missing")
	}

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

// FormatPhoneNumber formats phone number to WA format (62xxx@c.us)
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
	if len(result) > 0 && len(result) >= 2 && (result[0] != '6' || result[1] != '2') {
		result = "62" + result
	}

	return result + "@c.us"
}
```

- [ ] **Step 2: Add WA_API_* to .env**

Add to `be.argo.commerce.apps/.env`:
```bash
# WA Notification API
WA_API_BASE_URL=http://10.2.45.4:8082
WA_API_KEY=vWbzN9EclRbmq8406P1zFvVQFkoW1t
```

- [ ] **Step 3: Verify Go compiles**

Run: `cd /Users/macbook/Desktop/workspace/company/be.argo.commerce.apps && go build ./internal/domain/notification/...`

---

## Task 2: Enhance Notification Service with WA Methods

**Files:**
- Modify: `be.argo.commerce.apps/internal/domain/notification/service/service.go`

- [ ] **Step 1: Update service.go with WA notification methods**

Replace the entire service.go content with:

```go
package notification

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"be.argo.commerce.apps/internal/platform/rabbitmq"
)

type Service interface {
	SendNewTransactionNotification(ctx context.Context, to, recipientName, transactionCode, customerName, amount string) error
	SendPaymentConfirmationNotification(ctx context.Context, to, recipientName, transactionCode, amount string, attachments []rabbitmq.Attachment) error
	SendAdminApprovalNotification(ctx context.Context, params WANotificationParams, adminPhone string) error
	SendCustomerApprovalNotification(ctx context.Context, params WANotificationParams, customerPhone string) error
}

// WANotificationParams holds parameters for WA notification
type WANotificationParams struct {
	TransactionCode  string
	CustomerName     string
	CustomerPhone    string
	TotalPayment     string
	PaymentMethod    string
	TransactionDate  string
	Products         []ProductItem
	ApprovalLink     string
	StoreName        string
}

// ProductItem represents a product in the notification
type ProductItem struct {
	Name  string
	Qty   int
	Price string
}

type service struct {
	producer   *rabbitmq.Producer
	waService  *WAService
}

func NewService(producer *rabbitmq.Producer) Service {
	return &service{
		producer:  producer,
		waService: NewWAService(),
	}
}

func (s *service) SendNewTransactionNotification(ctx context.Context, to, recipientName, transactionCode, customerName, amount string) error {
	notification := rabbitmq.EmailNotification{
		To:            to,
		RecipientName: recipientName,
		Subject:       fmt.Sprintf("New Transaction: %s", transactionCode),
		Title:         "New Transaction Received",
		Message: fmt.Sprintf(
			"A new transaction has been created by customer %s.\n\nTransaction Code: %s\nAmount: %s\n\nPlease review and confirm the payment.",
			customerName, transactionCode, amount,
		),
		Metadata: map[string]string{
			"transaction_code": transactionCode,
			"type":             "new_transaction",
		},
	}

	return s.producer.PublishToNotificationQueue(ctx, notification)
}

func (s *service) SendPaymentConfirmationNotification(ctx context.Context, to, recipientName, transactionCode, amount string, attachments []rabbitmq.Attachment) error {
	notification := rabbitmq.EmailNotification{
		To:            to,
		RecipientName: recipientName,
		Subject:       fmt.Sprintf("Payment Confirmed: %s", transactionCode),
		Title:         "Payment Confirmation",
		Message: fmt.Sprintf(
			"Your payment has been confirmed.\n\nTransaction Code: %s\nAmount: %s\n\nThank you for your payment!",
			transactionCode, amount,
		),
		Attachments: attachments,
		Metadata: map[string]string{
			"transaction_code": transactionCode,
			"type":             "payment_confirmation",
		},
	}

	return s.producer.PublishToNotificationQueue(ctx, notification)
}

// SendAdminApprovalNotification sends WA notification to admin after payment approved
func (s *service) SendAdminApprovalNotification(ctx context.Context, params WANotificationParams, adminPhone string) error {
	if adminPhone == "" {
		return nil
	}

	message := s.formatAdminApprovalMessage(params)
	formattedPhone := s.waService.FormatPhoneNumber(adminPhone)
	return s.waService.SendTextMessage(ctx, formattedPhone, message)
}

// SendCustomerApprovalNotification sends WA notification to customer after payment approved
func (s *service) SendCustomerApprovalNotification(ctx context.Context, params WANotificationParams, customerPhone string) error {
	if customerPhone == "" {
		return nil
	}

	message := s.formatCustomerApprovalMessage(params)
	formattedPhone := s.waService.FormatPhoneNumber(customerPhone)
	return s.waService.SendTextMessage(ctx, formattedPhone, message)
}

func (s *service) formatAdminApprovalMessage(params WANotificationParams) string {
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

func (s *service) formatCustomerApprovalMessage(params WANotificationParams) string {
	var sb strings.Builder
	sb.WriteString("Halo " + params.CustomerName + ",\n\n")
	sb.WriteString("Kami informasikan bahwa pembayaran untuk transaksi dengan nomor *")
	sb.WriteString(params.TransactionCode)
	sb.WriteString("* telah berhasil diverifikasi oleh admin.\n\n")
	sb.WriteString("Pesanan Anda saat ini sedang diproses untuk pengiriman.\n\n")
	sb.WriteString("🛒 Detail Produk:\n")
	for _, p := range params.Products {
		sb.WriteString("\n* " + p.Name + " x" + strconv.Itoa(p.Qty) + " — " + p.Price)
	}
	sb.WriteString("\n\n💰 Total Pembayaran: " + params.TotalPayment + "\n")
	sb.WriteString("📅 Tanggal Pembayaran: " + time.Now().Format("02 Jan 2006, 15:04") + "\n\n")
	sb.WriteString("Terima kasih telah berbelanja di " + params.StoreName + ".")
	return sb.String()
}
```

- [ ] **Step 2: Verify Go compiles**

Run: `cd /Users/macbook/Desktop/workspace/company/be.argo.commerce.apps && go build ./internal/domain/notification/...`

---

## Task 3: Update Transaction Handler to Trigger WA Notification

**Files:**
- Modify: `be.argo.commerce.apps/internal/domain/transaction/handler/http.go`

- [ ] **Step 1: Update ApprovePayment handler to send WA notifications**

Add WA notification sending after payment approval. Find the ApprovePayment function and add notification logic:

```go
// ApprovePayment approves a transaction payment
func (h *Handler) ApprovePayment(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return fiber.NewError(fiber.StatusBadRequest, "transaction id is required")
	}

	// Get transaction details for notification
	transaction, err := h.svc.GetTransactionByID(c.Context(), id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "transaction not found")
	}

	// Approve payment
	if err := h.svc.ApprovePayment(c.Context(), id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	// Send WA notifications asynchronously
	go func() {
		ctx := context.Background()

		// Format payment method display
		paymentMethod := "Unknown"
		if transaction.PaymentType != "" {
			switch transaction.PaymentType {
			case "qris":
				paymentMethod = "QRIS"
			case "transfer_rekening":
				paymentMethod = "Transfer Bank"
			case "cutoff_hutang":
				paymentMethod = "Cutoff/Hutang"
			default:
				paymentMethod = transaction.PaymentType
			}
		}

		// Build notification params
		params := notificationservice.WANotificationParams{
			TransactionCode: transaction.TransactionCode,
			CustomerName:    transaction.CustomerName,
			TotalPayment:    formatCurrency(transaction.TotalAmount),
			PaymentMethod:   paymentMethod,
			TransactionDate: transaction.CreatedAt.Format("02 Jan 2006, 15:04"),
			StoreName:       "Toko Kami",
		}

		// Get product items
		for _, cart := range transaction.TransactionCarts {
			params.Products = append(params.Products, notificationservice.ProductItem{
				Name:  cart.ProductName,
				Qty:   cart.Qty,
				Price: formatCurrency(cart.Amount),
			})
		}

		// Send to admin(s)
		adminUsers, _ := h.userService.GetUsersByStore(ctx, transaction.MasterLocationID)
		for _, admin := range adminUsers {
			if admin.NoWA != nil && *admin.NoWA != "" {
				h.notificationService.SendAdminApprovalNotification(ctx, params, *admin.NoWA)
			}
		}

		// Send to customer
		if transaction.CustomerNoWA != "" {
			h.notificationService.SendCustomerApprovalNotification(ctx, params, transaction.CustomerNoWA)
		}
	}()

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Payment approved successfully",
	})
}
```

Note: You may need to adjust the transaction model to include CustomerNoWA field if not present.

- [ ] **Step 2: Add formatCurrency helper if needed**

Add at top of handler file:
```go
import (
	"fmt"
	// ... existing imports
)

func formatCurrency(amount int64) string {
	return fmt.Sprintf("Rp %d", amount)
}
```

- [ ] **Step 3: Verify Go compiles**

Run: `cd /Users/macbook/Desktop/workspace/company/be.argo.commerce.apps && go build ./internal/domain/transaction/...`

---

## Task 4: Create Payment Approval Page - Frontend

**Files:**
- Create: `argopos/src/pages/master/PaymentApprovalPage.tsx`

- [ ] **Step 1: Create PaymentApprovalPage.tsx**

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, CreditCard, CheckCircle, Package, Calendar, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface TransactionCart {
  id: string;
  product_stock_id: string;
  amount: number;
  qty: number;
  product_details?: {
    product_name: string;
    image_path: string;
  };
}

interface Transaction {
  id: string;
  transaction_code?: string;
  customer_name?: string;
  customer_no_wa?: string;
  status: string;
  payment_type?: string;
  total_amount: number;
  base_amount: number;
  created_at: string;
  transaction_carts?: TransactionCart[];
}

export default function PaymentApprovalPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const { getPermission, canRead } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingTransaction, setApprovingTransaction] = useState<Transaction | null>(null);
  const [approvingLoading, setApprovingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");

  useEffect(() => {
    if (locationId) {
      loadPendingTransactions();
    }
  }, [locationId]);

  const loadPendingTransactions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getStoreTransactions(locationId!, {
        status: 'WAITING_TO_PAYMENT',
        page: 1,
        page_size: 100,
      });

      if (response.success && response.data) {
        setTransactions(response.data as unknown as Transaction[]);
      }
    } catch (error) {
      toast.error("Failed to load pending transactions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (transaction: Transaction) => {
    setApprovingTransaction(transaction);
    setApproveDialogOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!approvingTransaction) return;

    try {
      setApprovingLoading(true);
      const response = await apiClient.approveTransactionPayment(approvingTransaction.id);

      if (response.success) {
        toast.success("Payment approved successfully");
        setApproveDialogOpen(false);
        setApprovingTransaction(null);
        loadPendingTransactions();
      } else {
        throw new Error("Failed to approve payment");
      }
    } catch (error) {
      toast.error("Failed to approve payment");
      console.error(error);
    } finally {
      setApprovingLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getPaymentMethodLabel = (type?: string) => {
    if (!type) return <Badge variant="secondary">Unknown</Badge>;
    switch (type) {
      case 'qris':
        return <Badge variant="secondary">QRIS</Badge>;
      case 'transfer_rekening':
        return <Badge variant="secondary">Transfer</Badge>;
      case 'cutoff_hutang':
        return <Badge variant="secondary">Cutoff</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (tx.transaction_code || '').toLowerCase().includes(query) ||
      (tx.customer_name || '').toLowerCase().includes(query)
    );
  }).filter((tx) => {
    if (paymentMethodFilter === 'all') return true;
    return tx.payment_type === paymentMethodFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(`/master/koperasi/${locationId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <h1 className="text-2xl font-bold">Approval Pembayaran</h1>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari transaksi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Metode Bayar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="qris">QRIS</SelectItem>
                <SelectItem value="transfer_rekening">Transfer</SelectItem>
                <SelectItem value="cutoff_hutang">Cutoff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* Transaction List */}
      <GlassCard className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaksi</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Metode Bayar</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div>
                      <p className="font-mono text-xs font-medium">{tx.transaction_code || tx.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{tx.customer_name || 'Guest'}</p>
                      {tx.customer_no_wa && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {tx.customer_no_wa}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getPaymentMethodLabel(tx.payment_type)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(tx.total_amount)}</TableCell>
                  <TableCell>{new Date(tx.created_at).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleApproveClick(tx)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Tidak ada transaksi yang menunggu approval
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-mono text-xs text-primary">{tx.transaction_code || tx.id}</p>
                  <h4 className="font-semibold">{tx.customer_name || 'Guest'}</h4>
                </div>
                {getPaymentMethodLabel(tx.payment_type)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground">Total:</span>{" "}
                  <span className="font-medium">{formatCurrency(tx.total_amount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tanggal:</span>{" "}
                  <span className="font-medium">{new Date(tx.created_at).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => handleApproveClick(tx)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Pembayaran
              </Button>
            </motion.div>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Tidak ada transaksi yang menunggu approval
          </div>
        )}
      </div>

      {/* Approval Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Pembayaran?</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mengapprove pembayaran untuk transaksi{" "}
              <span className="font-semibold">{approvingTransaction?.transaction_code}</span>?
            </DialogDescription>
          </DialogHeader>
          {approvingTransaction && (
            <div className="py-2">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span>{approvingTransaction.customer_name || 'Guest'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">{formatCurrency(approvingTransaction.total_amount)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleConfirmApprove}
              disabled={approvingLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {approvingLoading ? 'Memproses...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/macbook/Desktop/workspace/company/argopos && npx tsc --noEmit`

---

## Task 5: Add Route to App.tsx

**Files:**
- Modify: `argopos/src/App.tsx`

- [ ] **Step 1: Import PaymentApprovalPage component**

Add import:
```tsx
import PaymentApprovalPage from "./pages/master/PaymentApprovalPage";
```

- [ ] **Step 2: Add route for payment approval page**

Add after the KopiDetailPage route:
```tsx
<Route path="/master/koperasi/:locationId/payment-approval" element={
  <ProtectedRoute>
    <PaymentApprovalPage />
  </ProtectedRoute>
} />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/macbook/Desktop/workspace/company/argopos && npx tsc --noEmit`

---

## Task 6: Add Navigation Link

**Files:**
- Modify: `argopos/src/lib/navigation.ts` (or wherever sidebar nav is configured)

- [ ] **Step 1: Add link to payment approval page in navigation**

Add navigation item for payment approval (under store management section):
```tsx
{
  title: "Approval Pembayaran",
  icon: CreditCard,
  href: `/master/koperasi/${currentLocationId}/payment-approval`,
  permission: "write",
}
```

Note: Adjust according to your existing navigation structure.

---

## Verification Checklist

After all tasks complete:

- [ ] Backend compiles: `cd /Users/macbook/Desktop/workspace/company/be.argo.commerce.apps && go build ./...`
- [ ] Frontend compiles: `cd /Users/macbook/Desktop/workspace/company/argopos && npx tsc --noEmit`
- [ ] .env has WA_API_BASE_URL and WA_API_KEY
- [ ] Route `/master/koperasi/:id/payment-approval` accessible after login
- [ ] WA service created with SendTextMessage method
- [ ] Notification service has SendAdminApprovalNotification and SendCustomerApprovalNotification

---

## Dependencies

- Transaction service ApprovePayment method must exist (already implemented)
- User service GetUsersByStore method must exist (check if needed)
- Store transaction listing must support status filter