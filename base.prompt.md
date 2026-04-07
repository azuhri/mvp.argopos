Build a modern, responsive web application for a **CMS + CRM + POS system** designed for managing frozen food distribution to koperasi (cooperatives), supporting both internal employees and external customers.

---

## 🎯 Core Objective

The system must handle:

* Customer management (internal & external)
* Koperasi management
* Product & inventory
* Transaction (POS + credit/hutang system)
* Role-based access control
* Analytics dashboard

---

## 🎨 UI/UX REQUIREMENTS

Design style:

* Modern **glassmorphism UI**
* Clean, minimal, premium SaaS feel (inspired by Stripe, Linear, Vercel)
* Soft blur backgrounds, layered transparency, subtle borders
* Use spacing and typography hierarchy for clarity

Theme:

* Support **light and dark mode**
* Smooth animated theme transition (fade + color interpolation)

---

## ✨ ANIMATION & MICRO-INTERACTIONS (VERY IMPORTANT)

Use elegant, subtle animations that enhance UX, not distract.

### Page & Layout Animations:

* Smooth **page transitions (fade + slight slide up)**
* Layout shift animation when switching between desktop and mobile layout
* Sidebar expand/collapse with smooth width transition

### Component Animations:

* Cards:

  * Hover: slight scale (1.02) + shadow elevation
  * Entry: fade + stagger animation
* Buttons:

  * Hover: smooth color transition + slight lift
  * Click: scale down (tap effect)
* Modals / Drawers:

  * Animate with **slide + fade + backdrop blur**
* Tables:

  * Row hover highlight with smooth transition
  * Skeleton shimmer while loading

### Data & Feedback Animations:

* Skeleton loaders with shimmer effect
* Number counters (for revenue, stats) animate counting up
* Chart animation on load (progressive draw)

### Transaction UX Animations:

* Add product → animate item entering cart
* Remove product → smooth collapse animation
* Success state:

  * Show animated success checkmark
  * Subtle confetti burst (optional but elegant, not excessive)

### Navigation:

* Bottom navbar (mobile):

  * Active tab indicator with smooth sliding animation
* Sidebar:

  * Active menu highlight with animated background

### Theme Transition:

* Smooth transition between light/dark (no flicker)
* Animate background and card colors gradually

---

## 📱 RESPONSIVE BEHAVIOR

The app must be **fully responsive with adaptive layout**:

### Desktop / Laptop:

* Sidebar navigation (left, glass style)
* Topbar with search, profile, theme toggle
* Dashboard layout with cards, charts, and tables

### Tablet / Mobile:

* Bottom navigation bar
* Card-based UI instead of tables
* Floating action button (FAB) for quick transaction
* Smooth transitions between tabs (like mobile apps)

---

## 🔐 ROLE & PERMISSION SYSTEM

Implement role-based access control:

* Each role has permissions:

  * read
  * write
  * hidden (no access)

Roles can be assigned to users and control feature visibility dynamically.

---

## 👤 CUSTOMER MANAGEMENT

Support two types of users:

1. Internal users:

   * Have `employee_id`
2. External users:

   * No employee_id

Features:

* Create, read, update, delete users
* Filter by internal/external
* Search and pagination
* Smooth table ↔ card transition on mobile

---

## 🏢 KOPERASI MANAGEMENT

Fields:

* koperasi_code (unique)
* name
* PIC name
* PIC contact

Features:

* CRUD koperasi
* Detail page with:

  * Transaction list
  * Revenue summary (animated counters)
  * Status breakdown with badges

---

## 📦 PRODUCT & INVENTORY

Fields:

* name
* category
* price
* stock

Features:

* CRUD product
* Stock management
* Low stock indicator with subtle alert animation

---

## 🧾 TRANSACTION (POS SYSTEM)

Support transaction creation with multiple payment methods:

### Payment methods:

1. Cash
2. Transfer / QRIS
3. Hutang (only for internal users)

### Transaction flow:

* Create transaction → status: pending
* If cash/transfer:

  * Requires supervisor approval → approved → paid
* If hutang:

  * Status = hutang → later becomes paid

Features:

* Add multiple products with animated cart interaction
* Quantity stepper with smooth update animation
* Auto total calculation (animated number change)
* Generate invoice
* Transaction history with filters

---

## 📊 DASHBOARD

Display:

* Revenue chart (animated draw)
* Transaction trends
* Top products (weekly/monthly)
* Recent transactions table

Filters:

* Date range
* Koperasi

---

## 🧱 COMPONENTS & DESIGN SYSTEM

Use reusable components:

* Glass cards with hover animation
* Responsive table → card transformation
* Forms with validation + animated feedback
* Modals / drawers with smooth transitions
* Dropdowns with fade + scale animation

---

## ⚙️ STATE & DATA HANDLING

* Handle loading, error, empty states
* Always show skeleton loaders during fetch
* Use optimistic UI updates where possible

---

## 🚀 PRIORITY (MVP)

Focus on:

1. User management
2. Koperasi management
3. Product management
4. Transaction creation (POS flow)
5. Dashboard overview

---

## 💡 UX PRINCIPLES

* Fast and efficient POS experience (minimal clicks)
* Mobile-first usability
* Clear visual hierarchy
* Use animation to guide attention, not distract
* Avoid overwhelming the user

---

## 🎯 OUTPUT EXPECTATION

Generate:

* Full UI screens
* Navigation system (desktop + mobile)
* Reusable components
* Clean design system
* Smooth animations across all interactions

The final result should feel like a **premium, elegant, production-ready SaaS dashboard with fluid animations and excellent UX**.
