import { apiClient, Transaction, TransactionListParams } from '@/lib/api';

export interface TransactionListResultMeta {
  total: number;
  page: number;
  page_size: number;
}

export interface TransactionListResult {
  transactions: Transaction[];
  meta: TransactionListResultMeta;
}

class TransactionService {
  async listTransactions(params: TransactionListParams = {}): Promise<TransactionListResult> {
    const response = await apiClient.listTransactions(params);

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch transactions');
    }

    const data = response.data as { transactions?: Transaction[]; meta?: TransactionListResultMeta };
    const meta = data.meta || response.meta || {
      total: 0,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
    };

    return {
      transactions: data.transactions || [],
      meta,
    };
  }

  async approvePayment(transactionId: string): Promise<void> {
    const response = await apiClient.approveTransactionPayment(transactionId);
    if (!response.success) {
      throw new Error(response.message || 'Failed to approve payment');
    }
  }

  async approveDelivery(transactionId: string): Promise<void> {
    const response = await apiClient.approveTransactionDelivery(transactionId);
    if (!response.success) {
      throw new Error(response.message || 'Failed to approve delivery');
    }
  }
}

export const transactionService = new TransactionService();
