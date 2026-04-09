// Environment configuration
export const config = {
  // App Configuration
  appName: import.meta.env.VITE_APP_NAME || 'ArgoPOS',
  appNameCommerce: import.meta.env.VITE_APP_NAME_COMMERCE || 'ArgoPOS Commerce',
  appUrl: import.meta.env.VITE_APP_URL || 'http://localhost:5173',
  
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '10000'),
  
  // Feature Flags
  enableDarkMode: import.meta.env.VITE_ENABLE_DARK_MODE === 'true',
  enableNotifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  
  // UI Configuration
  defaultPageSize: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE || '10'),
  maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '5242880'), // 5MB in bytes
  
  // Development/Production
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  
  // External Services
  googleAnalyticsId: import.meta.env.VITE_GA_ID,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  
  // Currency and Locale
  defaultCurrency: import.meta.env.VITE_DEFAULT_CURRENCY || 'IDR',
  defaultLocale: import.meta.env.VITE_DEFAULT_LOCALE || 'id-ID',
  
  // Business Configuration
  businessName: import.meta.env.VITE_BUSINESS_NAME || 'ArgoPOS',
  businessEmail: import.meta.env.VITE_BUSINESS_EMAIL || 'info@argopos.com',
  businessPhone: import.meta.env.VITE_BUSINESS_PHONE || '+62 812-3456-7890',
  businessAddress: import.meta.env.VITE_BUSINESS_ADDRESS || '',
  
  // POS Configuration
  taxRate: parseFloat(import.meta.env.VITE_TAX_RATE || '0.11'), // 11% default tax
  serviceCharge: parseFloat(import.meta.env.VITE_SERVICE_CHARGE || '0'), // 0% default service charge
  
  // Cache Configuration
  cacheExpiration: parseInt(import.meta.env.VITE_CACHE_EXPIRATION || '3600000'), // 1 hour in ms
  
  // Security
  enableCSP: import.meta.env.VITE_ENABLE_CSP === 'true',
  sessionTimeout: parseInt(import.meta.env.VITE_SESSION_TIMEOUT || '3600000'), // 1 hour in ms
} as const;

// Type-safe environment variables
export type Config = typeof config;

// Helper function to get config value with fallback
export function getConfig<K extends keyof Config>(key: K): Config[K] {
  return config[key];
}

// Validation function for required environment variables
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate required fields
  if (!config.appName) errors.push('APP_NAME is required');
  if (!config.appUrl) errors.push('APP_URL is required');
  
  // Validate URL format
  try {
    new URL(config.appUrl);
  } catch {
    errors.push('APP_URL must be a valid URL');
  }
  
  try {
    new URL(config.apiUrl);
  } catch {
    errors.push('API_URL must be a valid URL');
  }
  
  // Validate numeric values
  if (isNaN(config.apiTimeout)) errors.push('API_TIMEOUT must be a number');
  if (isNaN(config.defaultPageSize)) errors.push('DEFAULT_PAGE_SIZE must be a number');
  if (isNaN(config.maxFileSize)) errors.push('MAX_FILE_SIZE must be a number');
  if (isNaN(config.taxRate)) errors.push('TAX_RATE must be a number');
  if (isNaN(config.serviceCharge)) errors.push('SERVICE_CHARGE must be a number');
  if (isNaN(config.cacheExpiration)) errors.push('CACHE_EXPIRATION must be a number');
  if (isNaN(config.sessionTimeout)) errors.push('SESSION_TIMEOUT must be a number');
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export configuration for easy access
export default config;
