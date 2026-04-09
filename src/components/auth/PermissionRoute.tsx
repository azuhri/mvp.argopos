import { Navigate } from "react-router-dom";
import { useAuth, type MenuKey } from "@/lib/auth";

interface PermissionRouteProps {
  menuKey: MenuKey;
  children: JSX.Element;
}

export function PermissionRoute({ menuKey, children }: PermissionRouteProps) {
  const { canRead } = useAuth();

  if (!canRead(menuKey)) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
}
