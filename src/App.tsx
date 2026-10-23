import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PermissionRoute } from "@/components/auth/PermissionRoute";
import Index from "./pages/Index";
import ProductPage from "./pages/dashboard/ProductPage";
import TransactionPage from "./pages/dashboard/TransactionPage";
import TransactionApproval from "./pages/TransactionApproval";
import Login from "./pages/Login";
import AccessDenied from "./pages/AccessDenied";
import Customers from "./pages/Customers";
import KoperasiPage from "./pages/KoperasiPage";
import Products from "./pages/Products";
import Transactions from "./pages/Transactions";
import Store from "./pages/Store";
import StoreCart from "./pages/StoreCart";
import StoreProductDetail from "./pages/StoreProductDetail";
import MasterUsers from "./pages/master/Users";
import MasterUserManagement from "./pages/master/UsersManagement";
import MasterLocations from "./pages/master/Locations";
import MasterRoles from "./pages/master/Roles";
import MasterStocks from "./pages/master/Stocks";
import StockMutations from "./pages/master/StockMutations";
import MasterProducts from "./pages/master/Products";
import CreateProduct from "./pages/master/CreateProduct";
import MasterCategories from "./pages/master/Categories";
import StoreManagement from "./pages/master/StoreManagement";
import KoperasiDetailPage from "./pages/master/KoperasiDetailPage";
import PaymentApprovalPage from "./pages/master/PaymentApprovalPage";
import Payments from "./pages/Payments";
import CommerceCatalog from "./pages/CommerceCatalog";
import PaymentDetail from "./pages/PaymentDetail";
import PaymentSuccess from "./pages/PaymentSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/">
        <AuthProvider>
          <Routes>
            {/* Public Commerce Routes */}
            <Route path="/" element={<Navigate to="/commerce" replace />} />
            <Route path="/:locationCode/commerce" element={<CommerceCatalog />} />
            <Route path="/:locationCode/commerce/cart" element={<StoreCart />} />
            <Route path="/:locationCode/commerce/product/:productId" element={<StoreProductDetail />} />
            <Route path="/:locationCode/commerce/payment/:transactionId" element={<PaymentDetail />} />
            <Route path="/:locationCode/commerce/payment-success/:transactionId" element={<PaymentSuccess />} />

            {/* Legacy Commerce Routes */}
            <Route path="/commerce" element={<Store />} />
            <Route path="/commerce/cart" element={<StoreCart />} />
            <Route path="/commerce/product/:productId" element={<StoreProductDetail />} />

            <Route path="/transactions/:transactionId/approve-payment" element={
              <ProtectedRoute menuKey="transactions" requireWrite>
                <TransactionApproval />
              </ProtectedRoute>
            } />

            {/* Auth Routes */}
            <Route path="/auth/sign-in" element={<Login />} />
            <Route path="/access-denied" element={<AccessDenied />} />

            {/* Protected Dashboard Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/products" element={
              <ProtectedRoute>
                <ProductPage />
              </ProtectedRoute>
            } />

            <Route path="/transactions" element={
              <ProtectedRoute>
                <TransactionPage />
              </ProtectedRoute>
            } />
            <Route path="/payments" element={
              <ProtectedRoute menuKey="transactions">
                <Payments />
              </ProtectedRoute>
            } />

            <Route path="/customers" element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            } />

            <Route path="/store" element={<Navigate to="/master/store" replace />} />

            <Route path="/master/store" element={
              <ProtectedRoute>
                <KoperasiPage />
              </ProtectedRoute>
            } />

            <Route path="/master/store/:locationId" element={
              <ProtectedRoute>
                <KoperasiDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/master/store/:locationId/payment-approval" element={
              <ProtectedRoute>
                <PaymentApprovalPage />
              </ProtectedRoute>
            } />

            <Route path="/products" element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            } />

            {/* <Route path="/transactions" element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            } /> */}

            <Route path="/store" element={
              <ProtectedRoute>
                <Store />
              </ProtectedRoute>
            } />

            <Route path="/store/cart" element={
              <ProtectedRoute>
                <StoreCart />
              </ProtectedRoute>
            } />

            <Route path="/master/users" element={
              <ProtectedRoute>
                <MasterUserManagement />
              </ProtectedRoute>
            } />

            <Route path="/master/locations" element={
              <ProtectedRoute>
                <MasterLocations />
              </ProtectedRoute>
            } />

            <Route path="/master/roles" element={
              <ProtectedRoute>
                <MasterRoles />
              </ProtectedRoute>
            } />

            <Route path="/master/stocks" element={
              <ProtectedRoute>
                <MasterStocks />
              </ProtectedRoute>
            } />

            <Route path="/master/stock-mutations" element={
              <ProtectedRoute menuKey="master_stock_mutations" requireWrite>
                <StockMutations />
              </ProtectedRoute>
            } />

            <Route path="/master/stores" element={
              <ProtectedRoute>
                <StoreManagement />
              </ProtectedRoute>
            } />

            <Route path="/master/products" element={
              <ProtectedRoute>
                <MasterProducts />
              </ProtectedRoute>
            } />

            <Route path="/master/products/create" element={
              <ProtectedRoute>
                <CreateProduct />
              </ProtectedRoute>
            } />

            <Route path="/master/categories" element={
              <ProtectedRoute>
                <MasterCategories />
              </ProtectedRoute>
            } />

            {/* 404 Not Found - must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
