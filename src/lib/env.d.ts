/// <reference types="vite/client" />

interface ImportMetaEnv {
  // App Configuration
  readonly VITE_APP_NAME: string
  readonly VITE_APP_URL: string
  
  // API Configuration
  readonly VITE_API_URL: string
  readonly VITE_API_TIMEOUT: string
  
  // Feature Flags
  readonly VITE_ENABLE_DARK_MODE: string
  readonly VITE_ENABLE_NOTIFICATIONS: string
  readonly VITE_ENABLE_ANALYTICS: string
  
  // UI Configuration
  readonly VITE_DEFAULT_PAGE_SIZE: string
  readonly VITE_MAX_FILE_SIZE: string
  
  // External Services
  readonly VITE_GA_ID?: string
  readonly VITE_SENTRY_DSN?: string
  
  // Currency and Locale
  readonly VITE_DEFAULT_CURRENCY: string
  readonly VITE_DEFAULT_LOCALE: string
  
  // Business Configuration
  readonly VITE_BUSINESS_NAME: string
  readonly VITE_BUSINESS_EMAIL: string
  readonly VITE_BUSINESS_PHONE: string
  readonly VITE_BUSINESS_ADDRESS?: string
  
  // POS Configuration
  readonly VITE_TAX_RATE: string
  readonly VITE_SERVICE_CHARGE: string
  
  // Cache Configuration
  readonly VITE_CACHE_EXPIRATION: string
  
  // Security
  readonly VITE_ENABLE_CSP: string
  readonly VITE_SESSION_TIMEOUT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
