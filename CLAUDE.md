# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Commerce App (formerly ArgoPOS) is a CMS + CRM + POS system for frozen food distribution to cooperativas. The frontend is a React + TypeScript + Vite application with glassmorphism UI, supporting both internal employees and external customers.

## Commands

```bash
npm run dev          # Start development server on port 8080
npm run build        # Production build
npm run build:dev    # Development build (unminified)
npm run lint         # Run ESLint
npm run test         # Run Vitest tests (once)
npm run test:watch   # Run Vitest in watch mode
npm run preview      # Preview production build
```

## Architecture

### Stack
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components (Radix UI)
- **State**: React Query for server state, React Context for auth/theme
- **Routing**: React Router v6 (with base path `/celestia`)
- **Forms**: React Hook Form + Zod validation
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Maps**: React Leaflet

### Directory Structure
```
src/
├── lib/              # Core utilities and API
│   ├── api.ts        # Axios-based API client with all endpoints
│   ├── auth.tsx      # Auth context + permission hooks
│   ├── navigation.ts # Sidebar nav config grouped by role
│   └── services/     # Service layer (productService, etc.)
├── components/
│   ├── ui/           # shadcn/ui components (47 components)
│   ├── layout/       # AppLayout, Sidebar, TopBar, MobileBottomNav
│   └── shared/       # GlassCard, AnimatedCounter, SkeletonLoader
├── pages/
│   ├── Index.tsx     # Dashboard (main entry point)
│   ├── dashboard/    # ProductPage, TransactionPage (mobile-optimized)
│   └── master/      # Admin pages (Users, Locations, Stocks, Products, etc.)
├── hooks/           # Custom hooks (useMobile, useToast)
└── types/            # TypeScript definitions
```

### Key Patterns

**API Client**: `src/lib/api.ts` exports `apiClient` singleton with methods for all backend endpoints. Auth token is injected automatically via axios interceptor.

**Authentication**: `AuthProvider` wraps the app and provides `useAuth()` hook with `login()`, `logout()`, `getPermission()`, `canRead()`, `canWrite()`.

**Permissions**: Role-based access with three modes: `hidden`, `read`, `write`. Permissions are fetched per role and cached for 5 minutes.

**Routing**: Two route categories:
- Public commerce routes (unauthenticated): `/:locationCode/commerce/*`
- Protected dashboard routes: Require authentication and permission checks

**Responsive Design**:
- Desktop (md:+): Sidebar + table views
- Mobile (<md): Bottom nav + card views
- Pattern: `hidden md:flex` for desktop, `flex md:hidden` for mobile

### API Configuration
- Base URL: `VITE_API_URL` from `.env` (default: `http://localhost:8090/backend/celestia`)
- All endpoints prefixed with `/`
- Backend: Separate Golang service (`be.argo.commerce.apps`)

### Theme
- CSS variables via `src/index.css` for HSL color tokens
- Dark mode via Tailwind `class` strategy
- Custom keyframes: `fade-in`, `scale-in`, `slide-in-left`, `count-up`

## Development Notes

- Path alias: `@/` maps to `./src/`
- `lovable-tagger` plugin active in development mode only
- `strictNullChecks: false` and `noImplicitAny: false` in tsconfig (lenient)
- Commerce catalog uses location-based routing: `/:locationCode/commerce`
- Transaction statuses: `WAITING_TO_PAYMENT` → `PAID` → `PREPARING_PRODUCT` → `READY_TO_PICKUP` → `COMPLETED`