import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  // Role helper flags
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isVendor: boolean;
  isResident: boolean;
  isHelpdesk: boolean;
  canExport: boolean;
  login: (
    credentials: LoginCredentials
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateBranding: (branding: {
    associationName?: string;
    logoUrl?: string;
    themeColor?: string;
  }) => void;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (
    credentials: LoginCredentials
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const response = await api.auth.login(credentials.username, credentials.password);

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
          createdAt: apiUser.createdAt || new Date().toISOString(),
          // Branding (optional from backend if needed)
          associationName: apiUser.associationName,
          logoUrl: apiUser.logoUrl,
          themeColor: apiUser.themeColor
        };

        setUser(mappedUser);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(mappedUser));
        setIsLoading(false);
        return { success: true };
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
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken'); // Legacy cleanup
    localStorage.removeItem('currentUser'); // Legacy cleanup
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
  
  // Only admin, super_admin, and managers (sometimes) can export data
  const canExport = isSuperAdmin || isAdmin || (user?.role as any) === 'accountant';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSuperAdmin,
        isAdmin,
        isManager,
        isStaff,
        isVendor,
        isResident,
        isHelpdesk,
        canExport,
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
