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

// Centralized helper: where should each role land after login / at "/" ?
function getHomeRouteForRole(role) {
  if (role === 'platform_owner') return '/platform';
  if (role === 'operator_admin') return '/admin';
  if (role === 'driver') return '/driver';
  // Both client_admin and client_user land on the "Solicitar TÃ¡xi" screen.
  // client_admin additionally sees a button there to open the admin dashboard (/portal).
  if (role === 'client_admin' || role === 'client_user') return '/solicitar';
  return '/login';
}

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
    // Redirect to appropriate home screen based on role
    return <Navigate to={getHomeRouteForRole(user?.role)} replace />;
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

  // If authenticated, redirect to role-appropriate home screen
  return <Navigate to={getHomeRouteForRole(user?.role)} replace />;
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

  // If already authenticated, redirect to appropriate destination
  if (isAuthenticated) {
    const from = location.state?.from?.pathname;

    // If there's a saved destination (e.g. user tried to open a specific page
    // before being asked to log in), go there instead of the default home.
    if (from && from !== '/login' && from !== '/') {
      return <Navigate to={from} replace />;
    }

    // Otherwise, go to role-appropriate home screen
    return <Navigate to={getHomeRouteForRole(user?.role)} replace />;
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
      
      {/* Public tracking routes (no auth required) - these are read-only tracking
          links shared after a trip is created, they do not allow creating new trips */}
      <Route path="/status/:requestId" element={<RequestStatus />} />
      <Route path="/acompanhamento" element={<TrackingPage />} />
      
      {/* Taxi request form - REQUIRES LOGIN so every request is linked to a
          user profile and appears in their trip history. This is the default
          landing screen for client_user and client_admin. */}
      <Route 
        path="/solicitar" 
        element={
          <ProtectedRoute allowedRoles={['client_admin', 'client_user', 'platform_owner', 'operator_admin']}>
            <PassengerPortal />
          </ProtectedRoute>
        } 
      />
      
      {/* Legacy Admin (password-protected panel) - REQUIRES LOGIN as
          platform_owner or operator_admin (ARC staff only). It can no longer
          be reached directly by typing the URL without being authenticated. */}
      <Route 
        path="/admin-control" 
        element={
          <ProtectedRoute allowedRoles={['platform_owner', 'operator_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      
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
      
      {/* Operator Admin Routes (ARC staff only) */}
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
      
      {/* Client Admin Dashboard (trip history/tracking for the client company).
          Only client_admin (not client_user) can access this, reached via a
          button inside the "Solicitar TÃ¡xi" screen. */}
      <Route 
        path="/portal" 
        element={
          <ProtectedRoute allowedRoles={['client_admin', 'platform_owner', 'operator_admin']}>
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