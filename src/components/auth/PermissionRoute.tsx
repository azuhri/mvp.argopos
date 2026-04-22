import { Navigate } from "react-router-dom";
import { useAuth, type MenuKey } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldX } from "lucide-react";

interface PermissionRouteProps {
  menuKey: MenuKey;
  requireWrite?: boolean;
  children: JSX.Element;
  fallback?: JSX.Element;
}

export function PermissionRoute({ 
  menuKey, 
  requireWrite = false, 
  children,
  fallback 
}: PermissionRouteProps) {
  const { canRead, canWrite, loading } = useAuth();

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

  return children;
}
