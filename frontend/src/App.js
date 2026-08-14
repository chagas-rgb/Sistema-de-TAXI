import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Legacy Pages (existing)
import PassengerPortal from "@/pages/PassengerPortal";
import RequestStatus from "@/pages/RequestStatus";
import AdminDashboard from "@/pages/AdminDashboard";
import TrackingPage from "@/pages/TrackingPage";

// New Multi-tenant Pages
import LoginPage from "@/pages/LoginPage";
import PlatformDashboard from "@/pages/PlatformDashboard";
import OperatorAdminDashboard from "@/pages/OperatorAdminDashboard";
import DriverPortal from "@/pages/DriverPortal";
import ClientPortal from "@/pages/ClientPortal";

// Protected Route Component
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    // Redirect to appropriate dashboard based on role
    if (user?.role === 'platform_owner') return <Navigate to="/platform" replace />;
    if (user?.role === 'operator_admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'driver') return <Navigate to="/driver" replace />;
    return <Navigate to="/portal" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public/Legacy Routes */}
      <Route path="/" element={<PassengerPortal />} />
      <Route path="/status/:requestId" element={<RequestStatus />} />
      <Route path="/acompanhamento" element={<TrackingPage />} />
      
      {/* Legacy Admin (still works with password) */}
      <Route path="/admin-control" element={<AdminDashboard />} />
      
      {/* New Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Platform Owner Routes */}
      <Route 
        path="/platform" 
        element={
          <ProtectedRoute allowedRoles={['platform_owner']}>
            <PlatformDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/platform/operator/:operatorId" 
        element={
          <ProtectedRoute allowedRoles={['platform_owner']}>
            <PlatformDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Operator Admin Routes */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['platform_owner', 'operator_admin']}>
            <OperatorAdminDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Driver Routes */}
      <Route 
        path="/driver" 
        element={
          <ProtectedRoute allowedRoles={['driver', 'platform_owner', 'operator_admin']}>
            <DriverPortal />
          </ProtectedRoute>
        } 
      />
      
      {/* Client Portal Routes */}
      <Route 
        path="/portal" 
        element={
          <ProtectedRoute allowedRoles={['client_admin', 'client_user', 'platform_owner', 'operator_admin']}>
            <ClientPortal />
          </ProtectedRoute>
        } 
      />
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-slate-50">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
