import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, RolePermissions } from '@/lib/api';
import { User, UserRole } from '@/types';
export type { User, UserRole };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  permissions: RolePermissions;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isVendor: boolean;
  isResident: boolean;
  isHelpdesk: boolean;
  canExport: boolean;
  hasPermission: (module: string, action?: 'view' | 'create' | 'edit' | 'delete') => boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  updateBranding: (branding: { associationName?: string; logoUrl?: string; themeColor?: string }) => void;
}

export interface LoginCredentials {
  username: string;
  password: string;
  acceptTerms?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<RolePermissions>({});

  const loadRolePermissions = async (role: string, associationId?: number) => {
    // Admin/super_admin have full access — no need to fetch
    if (['admin', 'super_admin', 'sub_admin'].includes(role)) {
      setPermissions({ complaints: { view: true, create: true, edit: true, delete: true }, work_orders: { view: true, create: true, edit: true, delete: true }, daily_reports: { view: true, create: true, edit: true, delete: true }, analytics: { view: true, create: true, edit: true, delete: true }, chat: { view: true, create: true, edit: true, delete: true }, export: true });
      return;
    }
    try {
      const res = await api.roles.getAll();
      if (res.success && res.data) {
        const match = res.data.find((r: any) => r.roleName?.toLowerCase() === role?.toLowerCase());
        if (match?.permissions) setPermissions(match.permissions);
      }
    } catch {}
  };

  useEffect(() => {
    // Restore session from localStorage
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      const u = JSON.parse(storedUser);
      setUser(u);
      loadRolePermissions(u.role, u.associationId);
    }
    setIsLoading(false);
  }, []);

  // Poll permissions every 30s so role changes apply without re-login
  useEffect(() => {
    if (!user || ['admin', 'super_admin', 'sub_admin'].includes(user.role)) return;
    const interval = setInterval(() => {
      loadRolePermissions(user.role, user.associationId);
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const login = async (
    credentials: LoginCredentials
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    setIsLoading(true);
    try {
      const response = await api.auth.login(credentials.username, credentials.password, credentials.acceptTerms);

      if (response.success && response.data) {
        const { token, user: apiUser } = response.data;
        
        const mappedUser: User = {
          id: apiUser.id,
          username: apiUser.username,
          fullName: apiUser.fullName,
          role: (apiUser.role ?? 'resident') as UserRole,
          associationId: apiUser.associationId,
          propertyId: apiUser.propertyId,
          buildingId: apiUser.buildingId,
          unitId: apiUser.unitId,
          hasAcceptedTerms: apiUser.termsStatus,
          createdAt: apiUser.createdAt || new Date().toISOString(),
          // Branding (optional from backend if needed)
          associationName: apiUser.associationName,
          logoUrl: apiUser.logoUrl,
          themeColor: apiUser.themeColor
        };

        setUser(mappedUser);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(mappedUser));
        await loadRolePermissions(mappedUser.role, mappedUser.associationId);
        setIsLoading(false);
        return { success: true, user: mappedUser };
      } else {
        setIsLoading(false);
        return { success: false, error: response.message || 'Login failed' };
      }
    } catch (error: any) {
      setIsLoading(false);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'An unexpected error occurred',
      };
    }
  };

  const logout = () => {
    // Clear daily report cache for the current user
    if (user) {
      const prefix = `daily_report_${user.id}_`;
      Object.keys(localStorage)
        .filter(k => k.startsWith(prefix))
        .forEach(k => localStorage.removeItem(k));
    }
    setUser(null);
    setPermissions({});
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  };

  const updateBranding = (branding: {
    associationName?: string;
    logoUrl?: string;
    themeColor?: string;
  }) => {
    if (!user) return;
    const updated = { ...user, ...branding };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  // Role helper flags — computed from current user
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'sub_admin';
  const isManager = user?.role === 'property_manager' || user?.role === 'facility_manager';
  const isStaff = user?.role === 'staff';
  const isVendor = user?.role === 'vendor';
  const isResident = user?.role === 'resident';
  const isHelpdesk = user?.role === 'helpdesk';
  const canExport = isSuperAdmin || isAdmin || (user?.role as any) === 'accountant' || !!(permissions as any).export;

  // Check if current user has a specific permission
  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view'): boolean => {
    // Admin-level roles have full access to everything
    if (isSuperAdmin || isAdmin || isManager || isHelpdesk) return true;
    
    const mod = (permissions as any)[module];
    if (!mod) return false;
    if (typeof mod === 'boolean') return mod;
    return !!(mod as any)[action];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        permissions,
        isSuperAdmin,
        isAdmin,
        isManager,
        isStaff,
        isVendor,
        isResident,
        isHelpdesk,
        canExport,
        hasPermission,
        login,
        logout,
        updateBranding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
