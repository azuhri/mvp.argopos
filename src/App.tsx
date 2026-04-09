import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PermissionRoute } from "@/components/auth/PermissionRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import AccessDenied from "./pages/AccessDenied";
import Customers from "./pages/Customers";
import KoperasiPage from "./pages/KoperasiPage";
import Products from "./pages/Products";
import Transactions from "./pages/Transactions";
import Store from "./pages/Store";
import StoreCart from "./pages/StoreCart";
import MasterUsers from "./pages/master/Users";
import MasterLocations from "./pages/master/Locations";
import MasterRoles from "./pages/master/Roles";
import MasterStocks from "./pages/master/Stocks";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/commerce" replace />} />
            <Route path="/commerce" element={<Store />} />
            <Route path="/auth/sign-in" element={<Login />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="dashboard">
                  <Index />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/customers" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="customers">
                  <Customers />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/koperasi" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="koperasi">
                  <KoperasiPage />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/products" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="products">
                  <Products />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/transactions" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="transactions">
                  <Transactions />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/store" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="store">
                  <Store />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/store/cart" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="cart">
                  <StoreCart />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/master/users" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="master_users">
                  <MasterUsers />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/master/locations" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="master_locations">
                  <MasterLocations />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/master/roles" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="master_roles">
                  <MasterRoles />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/master/stocks" element={
              <ProtectedRoute>
                <PermissionRoute menuKey="master_stock">
                  <MasterStocks />
                </PermissionRoute>
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
