import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { ThemeProvider } from '@/components/theme-provider';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// ── Pages ────────────────────────────────────────────────────────────────────
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DailyReport from './pages/DailyReport';
import MyReports from './pages/MyReports';
import MyTasks from './pages/MyTasks';
import Complaints from './pages/Complaints';
import ComplaintList from './pages/complaints/ComplaintList';
import ComplaintDetail from './pages/complaints/ComplaintDetail';
import SecurityPage from './pages/SecurityPage';
import GroupChat from './pages/GroupChat';
import NotFound from './pages/NotFound';

// Admin pages
import UserManagement from './pages/admin/UserManagement';
import PropertyManagement from './pages/admin/PropertyManagement';
import ClientManagement from './pages/admin/ClientManagement';
import WorkManagement from './pages/admin/WorkManagement';
import WorkAllocation from './pages/admin/WorkAllocation';
import Analytics from './pages/admin/Analytics';
import AdminReportsPage from './pages/admin/AdminReports';
import EmployeeList from './pages/admin/EmployeeList';
import EmployeeTaskAssignment from './pages/admin/EmployeeTaskAssignment';
import CategoryManagement from './pages/admin/CategoryManagement';
import ProductManagement from './pages/admin/ProductManagement';
import ProductManagementDebug from './pages/admin/ProductManagementDebug';
import DepartmentManagement from './pages/admin/DepartmentManagement';
import RoleManagement from './pages/admin/RoleManagement';

// Super Admin pages
import AdminManagement from './pages/superadmin/AdminManagement';
import TenantOverview from './pages/superadmin/TenantOverview';

// Manager pages
import DepartmentUsers from './pages/manager/DepartmentUsers';
import ActivityLogs from './pages/manager/ActivityLogs';

// Resident pages
import ResidentDashboard from './pages/resident/Dashboard';

// ── Root Redirect (role-aware) ────────────────────────────────────────────────

const RootRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <Navigate to="/super-admin/overview" replace />;
  if (user.role === 'resident') return <Navigate to="/resident/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
};

// ── App ───────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="vivify-theme">
      <AuthProvider>
        {/* BrandingProvider must be inside AuthProvider so it can read user branding fields */}
        <BrandingProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <HashRouter>
              <Routes>
                {/* Public */}
                <Route path="/" element={<RootRedirect />} />
                <Route path="/login" element={<Login />} />

                {/* ── Super Admin ──────────────────────────────────────── */}
                <Route
                  path="/super-admin/overview"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <TenantOverview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/admins"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <AdminManagement />
                    </ProtectedRoute>
                  }
                />

                {/* ── Shared (all authenticated) ───────────────────── */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/resident/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['resident']}>
                      <ResidentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/complaints"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sub_admin', 'property_manager', 'facility_manager', 'staff', 'resident', 'helpdesk']}>
                      <Complaints />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/complaints/:id"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sub_admin', 'property_manager', 'facility_manager', 'staff', 'resident', 'helpdesk']}>
                      <ComplaintDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <GroupChat />
                    </ProtectedRoute>
                  }
                />

                {/* ── User-only ────────────────────────────────────── */}
                <Route
                  path="/daily-report"
                  element={
                    <ProtectedRoute allowedRoles={['staff', 'resident']}>
                      <DailyReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-reports"
                  element={
                    <ProtectedRoute allowedRoles={['staff', 'resident']}>
                      <MyReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-tasks"
                  element={
                    <ProtectedRoute allowedRoles={['staff', 'resident']}>
                      <MyTasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/security"
                  element={
                    <ProtectedRoute allowedRoles={['staff', 'resident']}>
                      <SecurityPage />
                    </ProtectedRoute>
                  }
                />

                {/* ── Manager-only ─────────────────────────────────── */}
                <Route
                  path="/manager/department-users"
                  element={
                    <ProtectedRoute allowedRoles={['property_manager', 'facility_manager']}>
                      <DepartmentUsers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/manager/activity-logs"
                  element={
                    <ProtectedRoute allowedRoles={['property_manager', 'facility_manager']}>
                      <ActivityLogs />
                    </ProtectedRoute>
                  }
                />

                {/* ── Admin-only ───────────────────────────────────── */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/properties"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sub_admin', 'property_manager']}>
                      <PropertyManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/clients"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ClientManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/works"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <WorkManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/work-allocation"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sub_admin', 'property_manager', 'facility_manager', 'staff']}>
                      <WorkAllocation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Analytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/employees"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <EmployeeList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/employee-tasks/:employeeId"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <EmployeeTaskAssignment />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/categories"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <CategoryManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/products"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ProductManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/products-debug"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ProductManagementDebug />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/departments"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <DepartmentManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/roles"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                      <RoleManagement />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </HashRouter>
          </TooltipProvider>
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
