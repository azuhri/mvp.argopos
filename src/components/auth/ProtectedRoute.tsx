import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type MenuKey } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldX } from "lucide-react";

interface ProtectedRouteProps {
  children: JSX.Element;
  menuKey?: MenuKey;
  requireWrite?: boolean;
  fallback?: JSX.Element;
}

export function ProtectedRoute({ 
  children, 
  menuKey, 
  requireWrite = false,
  fallback 
}: ProtectedRouteProps) {
  const { user, loading, canRead, canWrite } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen p-6 bg-background">
        <div className="max-w-xl mx-auto mt-20 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/sign-in" replace state={{ from: location.pathname }} />;
  }

  // Check menu permissions if menuKey is provided
  if (menuKey) {
    const hasPermission = requireWrite ? canWrite(menuKey) : canRead(menuKey);
    
    if (!hasPermission) {
      if (fallback) {
        return fallback;
      }
      
      return (
        <div className="min-h-screen p-6 bg-background">
          <div className="max-w-md mx-auto mt-20">
            <Alert variant="destructive">
              <ShieldX className="h-4 w-4" />
              <AlertDescription>
                {requireWrite 
                  ? "You don't have permission to modify this page." 
                  : "You don't have permission to access this page."}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }
  }

  return children;
}
