import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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

// Protected Route Component - maintains session across navigation
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the intended destination for post-login redirect
    return <Navigate to="/login" state={{ from: location }} replace />;
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

// Root redirect component - Login is now the main entry point
function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  // If not authenticated, go to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, redirect to appropriate dashboard
  if (user?.role === 'platform_owner') return <Navigate to="/platform" replace />;
  if (user?.role === 'operator_admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'driver') return <Navigate to="/driver" replace />;
  if (user?.role === 'client_admin' || user?.role === 'client_user') return <Navigate to="/portal" replace />;
  
  // Fallback
  return <Navigate to="/login" replace />;
}

// Login route wrapper - redirects if already authenticated
function LoginRoute() {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  // If already authenticated, redirect to appropriate dashboard
  if (isAuthenticated) {
    const from = location.state?.from?.pathname;
    
    // If there's a saved destination, go there
    if (from && from !== '/login' && from !== '/') {
      return <Navigate to={from} replace />;
    }
    
    // Otherwise, go to role-appropriate dashboard
    if (user?.role === 'platform_owner') return <Navigate to="/platform" replace />;
    if (user?.role === 'operator_admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'driver') return <Navigate to="/driver" replace />;
    return <Navigate to="/portal" replace />;
  }

  return <LoginPage />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root - Login is now the main entry point */}
      <Route path="/" element={<RootRedirect />} />
      
      {/* Auth Routes */}
      <Route path="/login" element={<LoginRoute />} />
      
      {/* Public tracking routes (no auth required) */}
      <Route path="/status/:requestId" element={<RequestStatus />} />
      <Route path="/acompanhamento" element={<TrackingPage />} />
      
      {/* Legacy public taxi request form - accessible without login */}
      <Route path="/solicitar" element={<PassengerPortal />} />
      
      {/* Legacy Admin (still works with password) */}
      <Route path="/admin-control" element={<AdminDashboard />} />
      
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
      
      {/* Catch all - redirect to root (which goes to login if not authenticated) */}
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
