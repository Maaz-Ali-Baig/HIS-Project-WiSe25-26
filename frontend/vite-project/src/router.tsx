import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/pages/LoginPage';
import { RegisterPage } from './features/auth/pages/RegisterPage';
import { HomePage } from './features/home/pages/HomePage';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';

import { DataTransformationPage } from './features/home/pages/DataTransformationPage';
import { CorrelationAnalysisPage } from './features/home/pages/CorrelationAnalysisPage';
import { VisualizationPage } from './features/home/pages/VisualizationPage';
import { ReportPage } from './features/home/pages/ReportPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    ),
  },
  {
    // Keep this if you want /:fileId to open the same HomePage with a selected file
    path: '/:fileId',
    element: (
      <ProtectedRoute>
        <HomePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/transform',
    element: (
      <ProtectedRoute>
        <DataTransformationPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/correlation',
    element: (
      <ProtectedRoute>
        <CorrelationAnalysisPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/visualization',
    element: (
      <ProtectedRoute>
        <VisualizationPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/report',
    element: (
      <ProtectedRoute>
        <ReportPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
