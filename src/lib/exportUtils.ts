import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Transaction, TransactionCart } from './api';

// Format currency to Indonesian Rupiah
export const formatCurrencyId = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value || 0);
};

// Format date to Indonesian locale
export const formatDateId = (date: string | Date) => {
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get payment method label
const getPaymentMethodLabel = (paymentType: string) => {
  switch (paymentType) {
    case 'qris': return 'QRIS';
    case 'cash': return 'Tunai';
    case 'transfer_rekening': return 'Transfer Bank';
    case 'cutoff_hutang': return 'Hutang/Cutoff';
    default: return paymentType || '-';
  }
};

// Get status label
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'WAITING_TO_PAYMENT': return 'Menunggu Pembayaran';
    case 'PAID': return 'Sudah Dibayar';
    case 'PREPARING_PRODUCT': return 'Sedang Disiapkan';
    case 'READY_TO_PICKUP': return 'Siap Diambil';
    case 'COMPLETED': return 'Selesai';
    case 'REJECTED': return 'Ditolak';
    default: return status || '-';
  }
};

// Export transactions to CSV
export const exportTransactionsToCSV = (transactions: Transaction[]) => {
  const headers = [
    'Transaction Code',
    'Customer',
    'Status',
    'Payment Method',
    'Total Amount',
    'Total Items',
    'Payment Code',
    'Created At',
    'Location',
  ];

  const rows = transactions.map((tx) => [
    tx.transaction_code || tx.id,
    tx.customer_name || 'Guest',
    getStatusLabel(tx.status),
    getPaymentMethodLabel(tx.payment_type),
    tx.total_amount?.toString() || '0',
    tx.total_item?.toString() || '0',
    tx.payment_code || '-',
    new Date(tx.created_at).toLocaleString('id-ID'),
    tx.location_name || '-',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  downloadFile(csvContent, 'transactions.csv', 'text/csv;charset=utf-8;');
};

// Export transactions to XLSX
export const exportTransactionsToXLSX = (transactions: Transaction[]) => {
  const data = transactions.map((tx) => ({
    'Transaction Code': tx.transaction_code || tx.id,
    'Customer': tx.customer_name || 'Guest',
    'Status': getStatusLabel(tx.status),
    'Payment Method': getPaymentMethodLabel(tx.payment_type),
    'Total Amount (IDR)': tx.total_amount || 0,
    'Total Items': tx.total_item || 0,
    'Payment Code': tx.payment_code || '-',
    'Created At': formatDateId(tx.created_at),
    'Location': tx.location_name || '-',
    'Paid At': tx.paid_at ? formatDateId(tx.paid_at) : '-',
    'Pickup At': tx.pickup_at ? formatDateId(tx.pickup_at) : '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Transaction Code
    { wch: 25 }, // Customer
    { wch: 20 }, // Status
    { wch: 15 }, // Payment Method
    { wch: 15 }, // Total Amount
    { wch: 12 }, // Total Items
    { wch: 15 }, // Payment Code
    { wch: 20 }, // Created At
    { wch: 20 }, // Location
    { wch: 20 }, // Paid At
    { wch: 20 }, // Pickup At
  ];

  XLSX.writeFile(workbook, 'transactions.xlsx');
};

// Export single transaction invoice to PDF
export const exportTransactionInvoiceToPDF = async (transaction: Transaction, cartItems: TransactionCart[]) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Transaction Code: ${transaction.transaction_code || transaction.id}`, 14, 35);
  doc.text(`Date: ${formatDateId(transaction.created_at)}`, 14, 42);
  doc.text(`Customer: ${transaction.customer_name || 'Guest'}`, 14, 49);
  doc.text(`Location: ${transaction.location_name || '-'}`, 14, 56);
  doc.text(`Status: ${getStatusLabel(transaction.status)}`, 14, 63);
  doc.text(`Payment Method: ${getPaymentMethodLabel(transaction.payment_type)}`, 14, 70);
  doc.text(`Payment Code: ${transaction.payment_code || '-'}`, 14, 77);

  // Divider
  doc.setLineWidth(0.5);
  doc.line(14, 85, 196, 85);

  // Cart Items Table
  const tableData = cartItems.map((item, index) => [
    (index + 1).toString(),
    item.product_details?.product_name || item.product_details?.product_code || 'Product',
    item.qty?.toString() || '0',
    formatCurrencyId(item.amount || 0),
    formatCurrencyId((item.qty || 0) * (item.amount || 0)),
  ]);

  autoTable(doc, {
    startY: 90,
    head: [['No', 'Product', 'Qty', 'Price', 'Subtotal']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 80 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 35 },
    },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable?.finalY || 120;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total Amount: ${formatCurrencyId(transaction.total_amount || 0)}`, 140, finalY + 15);
  doc.text(`Total Items: ${transaction.total_item || 0}`, 140, finalY + 22);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Generated by Celestore POS System', 14, finalY + 40);
  doc.text(formatDateId(new Date()), 14, finalY + 47);

  // Save
  const fileName = `Invoice_${transaction.transaction_code || transaction.id}.pdf`;
  doc.save(fileName);
};

// Export all transactions invoice to PDF (combined)
export const exportAllTransactionsInvoiceToPDF = async (transactions: Transaction[]) => {
  const doc = new jsPDF();
  let currentY = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Transactions Report', 105, currentY, { align: 'center' });
  currentY += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${formatDateId(new Date())}`, 105, currentY, { align: 'center' });
  doc.text(`Total Transactions: ${transactions.length}`, 105, currentY + 6, { align: 'center' });
  currentY += 20;

  // Summary by status
  const statusCounts = transactions.reduce((acc, tx) => {
    acc[tx.status] = (acc[tx.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  doc.setFontSize(10);
  doc.text('Summary by Status:', 14, currentY);
  currentY += 6;

  Object.entries(statusCounts).forEach(([status, count]) => {
    doc.text(`- ${getStatusLabel(status)}: ${count}`, 20, currentY);
    currentY += 5;
  });

  currentY += 10;

  // Table of all transactions
  const tableData = transactions.slice(0, 50).map((tx, index) => [
    (index + 1).toString(),
    tx.transaction_code || tx.id.slice(0, 8),
    tx.customer_name || 'Guest',
    getStatusLabel(tx.status),
    getPaymentMethodLabel(tx.payment_type),
    formatCurrencyId(tx.total_amount || 0),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Code', 'Customer', 'Status', 'Payment', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 30 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
    },
  });

  if (transactions.length > 50) {
    const finalY = (doc as any).lastAutoTable?.finalY || 0;
    doc.setFontSize(8);
    doc.text(`... and ${transactions.length - 50} more transactions`, 14, finalY + 10);
  }

  doc.save('transactions_report.pdf');
};

// Helper function to download file
const downloadFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};