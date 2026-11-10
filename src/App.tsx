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
import PickupQrScanner from "./pages/PickupQrScanner";
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
import { CommerceLocationGate } from "./components/commerce/CommerceLocationGate";
import PaymentDetail from "./pages/PaymentDetail";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentMaintenance from "./pages/PaymentMaintenance";
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
            <Route path="/:locationCode/commerce" element={<CommerceLocationGate><Store /></CommerceLocationGate>} />
            <Route path="/:locationCode/commerce/cart" element={<CommerceLocationGate><StoreCart /></CommerceLocationGate>} />
            <Route path="/:locationCode/commerce/product/:productId" element={<CommerceLocationGate><StoreProductDetail /></CommerceLocationGate>} />
            <Route path="/:locationCode/commerce/payment/:transactionId" element={<PaymentDetail />} />
            <Route path="/:locationCode/commerce/payment-success/:transactionId" element={<PaymentSuccess />} />
            <Route path="/:locationCode/commerce/payment-maintenance/:transactionId?" element={<PaymentMaintenance />} />

            {/* Legacy Commerce Routes */}
            <Route path="/commerce" element={<CommerceLocationGate />} />
            <Route path="/commerce/locations" element={<CommerceLocationGate forceSelection />} />
            <Route path="/commerce/cart" element={<CommerceLocationGate />} />
            <Route path="/commerce/product/:productId" element={<CommerceLocationGate />} />

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
              <ProtectedRoute menuKey="dashboard">
                <Index />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/products" element={
              <ProtectedRoute menuKey="master_products">
                <ProductPage />
              </ProtectedRoute>
            } />

            <Route path="/transactions" element={
              <ProtectedRoute menuKey="transactions">
                <TransactionPage />
              </ProtectedRoute>
            } />
            <Route path="/transactions/pickup-scan" element={
              <ProtectedRoute menuKey="transactions" requireWrite>
                <PickupQrScanner />
              </ProtectedRoute>
            } />
            <Route path="/payments" element={
              <ProtectedRoute menuKey="payments">
                <Payments />
              </ProtectedRoute>
            } />

            <Route path="/customers" element={
              <ProtectedRoute menuKey="customers">
                <Customers />
              </ProtectedRoute>
            } />

            <Route path="/store" element={<Navigate to="/master/store" replace />} />

            <Route path="/master/store" element={
              <ProtectedRoute menuKey="koperasi">
                <KoperasiPage />
              </ProtectedRoute>
            } />

            <Route path="/master/store/:locationId" element={
              <ProtectedRoute menuKey={["koperasi", "master_stores"]}>
                <KoperasiDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/master/store/:locationId/payment-approval" element={
              <ProtectedRoute menuKey="transactions" requireWrite>
                <PaymentApprovalPage />
              </ProtectedRoute>
            } />

            <Route path="/products" element={
              <ProtectedRoute menuKey="master_products">
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
                <Navigate to="/commerce/cart" replace />
              </ProtectedRoute>
            } />

            <Route path="/master/users" element={
              <ProtectedRoute menuKey="master_users">
                <MasterUserManagement />
              </ProtectedRoute>
            } />

            <Route path="/master/locations" element={
              <ProtectedRoute menuKey="master_locations">
                <MasterLocations />
              </ProtectedRoute>
            } />

            <Route path="/master/roles/new" element={
              <ProtectedRoute menuKey="master_roles" requireWrite>
                <MasterRoles mode="create" />
              </ProtectedRoute>
            } />
            <Route path="/master/roles/:roleId/edit" element={
              <ProtectedRoute menuKey="master_roles" requireWrite>
                <MasterRoles mode="edit" />
              </ProtectedRoute>
            } />
            <Route path="/master/roles/:roleId" element={
              <ProtectedRoute menuKey="master_roles">
                <MasterRoles mode="view" />
              </ProtectedRoute>
            } />

            <Route path="/master/roles" element={
              <ProtectedRoute menuKey="master_roles">
                <MasterRoles />
              </ProtectedRoute>
            } />

            <Route path="/master/stocks" element={
              <ProtectedRoute menuKey="master_stock">
                <MasterStocks />
              </ProtectedRoute>
            } />

            <Route path="/master/stock-mutations" element={
              <ProtectedRoute menuKey="master_stock_mutations">
                <StockMutations />
              </ProtectedRoute>
            } />

            <Route path="/master/stores" element={
              <ProtectedRoute menuKey="master_stores">
                <StoreManagement />
              </ProtectedRoute>
            } />

            <Route path="/master/products" element={
              <ProtectedRoute menuKey="master_products">
                <MasterProducts />
              </ProtectedRoute>
            } />

            <Route path="/master/products/create" element={
              <ProtectedRoute menuKey="master_products" requireWrite>
                <CreateProduct />
              </ProtectedRoute>
            } />

            <Route path="/master/categories" element={
              <ProtectedRoute menuKey="master_products">
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
