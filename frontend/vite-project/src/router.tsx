import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { RegisterPage } from "./features/auth/pages/RegisterPage";
import { HomePage } from "./features/home/pages/HomePage";
import { PreProcessingPage } from "./features/preprocessing/pages/PreProcessingPage";
import { CorrelationAnalysisPage } from "./features/home/pages/CorrelationAnalysisPage";
import { ProtectedRoute } from "./features/auth/components/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import { RootLayout } from "./components/layout/RootLayout";

export const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: [
        {
          path: "/login",
          element: <LoginPage />,
        },
        {
          path: "/register",
          element: <RegisterPage />,
        },
        {
          path: "/",
          element: (
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          ),
          children: [
            {
              index: true,
              element: <HomePage />,
            },
            {
              path: ":fileId",
              element: <Navigate to="load-data" replace />,
            },
            {
              path: ":fileId/load-data",
              element: <HomePage />,
            },
            {
              path: ":fileId/pre-processing",
              element: <PreProcessingPage />,
            },
            {
              path: ":fileId/correlation",
              element: <CorrelationAnalysisPage />,
            },
          ],
        },
      ],
    },
    {
      path: "*",
      element: <Navigate to="/" replace />,
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);
