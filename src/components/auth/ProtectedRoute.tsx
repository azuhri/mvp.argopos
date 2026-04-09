import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: JSX.Element;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
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

  return children;
}
