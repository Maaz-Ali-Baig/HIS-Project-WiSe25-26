import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../../store/auth";
import { getToken } from "../../../lib/cookies";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = getToken();

  // If no token and not authenticated, redirect to login
  if (!token && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
