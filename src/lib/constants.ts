import { config } from './config';

// App constants derived from config
export const APP_CONFIG = {
  name: config.appName,
  url: config.appUrl,
  version: '1.0.0',
  
  // API endpoints
  api: {
    baseUrl: config.apiUrl,
    timeout: config.apiTimeout,
    endpoints: {
      auth: '/auth',
      users: '/users',
      products: '/products',
      customers: '/customers',
      transactions: '/transactions',
      koperasi: '/koperasi',
      reports: '/reports',
    }
  },
  
  // Business settings
  business: {
    name: config.businessName,
    email: config.businessEmail,
    phone: config.businessPhone,
    address: config.businessAddress,
    currency: config.defaultCurrency,
    locale: config.defaultLocale,
    taxRate: config.taxRate,
    serviceCharge: config.serviceCharge,
  },
  
  // UI settings
  ui: {
    pageSize: config.defaultPageSize,
    maxFileSize: config.maxFileSize,
    enableDarkMode: config.enableDarkMode,
    enableNotifications: config.enableNotifications,
    enableAnalytics: config.enableAnalytics,
  },
  
  // Cache settings
  cache: {
    expiration: config.cacheExpiration,
  },
  
  // Security settings
  security: {
    enableCSP: config.enableCSP,
    sessionTimeout: config.sessionTimeout,
  },
  
  // Environment
  env: {
    isDevelopment: config.isDevelopment,
    isProduction: config.isProduction,
    mode: config.mode,
  }
} as const;

// Export type for constants
export type AppConfig = typeof APP_CONFIG;

// Helper functions
export function getApiUrl(endpoint: string): string {
  return `${APP_CONFIG.api.baseUrl}${endpoint}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(APP_CONFIG.business.locale, {
    style: 'currency',
    currency: APP_CONFIG.business.currency,
  }).format(amount);
}

export function calculateTax(amount: number): number {
  return amount * APP_CONFIG.business.taxRate;
}

export function calculateServiceCharge(amount: number): number {
  return amount * APP_CONFIG.business.serviceCharge;
}

export function calculateTotalWithTaxAndService(amount: number): number {
  const tax = calculateTax(amount);
  const service = calculateServiceCharge(amount);
  return amount + tax + service;
}

// Validation helpers
export function isValidFileSize(size: number): boolean {
  return size <= APP_CONFIG.ui.maxFileSize;
}

export function isFileSizeExceeded(size: number): boolean {
  return size > APP_CONFIG.ui.maxFileSize;
}

export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}
