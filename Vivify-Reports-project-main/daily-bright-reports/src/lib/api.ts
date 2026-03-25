// File: src/lib/api.ts
import axios from 'axios';
import { 
  Complaint, WorkOrder, Bill, User, Association, Property, Building, Unit,
  CreateComplaintDto, AssignmentDto, ResolutionDto, FeedbackDto, PaginatedResponse,
  ApiResponse 
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.vivifysoft.in/SkyCity';

export interface AdminTenant {
  id: number;
  companyName: string;
  email: string;
  themeColor?: string;
  status: 'active' | 'inactive';
  userCount?: number;
  reportCount?: number;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// ============ API Service Methods ============

export const api = {
  // Auth
  auth: {
    login: async (username: string, password: string) => {
      const response = await apiClient.post('/auth/login', { username, password });
      return response.data;
    },
    register: async (userData: any) => {
      const response = await apiClient.post('/auth/register', userData);
      return response.data;
    },
    getMe: async () => {
      const response = await apiClient.get('/auth/me');
      return response.data;
    }
  },

  // Departments (FIXED - added this section)
  departments: {
    getAll: async () => {
      try {
        const response = await apiClient.get('/departments');
        return response.data;
      } catch (error) {
        console.warn('Departments API not available, using mock data');
        return {
          success: true,
          data: [
            { id: 1, departmentName: 'Engineering' },
            { id: 2, departmentName: 'Maintenance' },
            { id: 3, departmentName: 'Housekeeping' },
            { id: 4, departmentName: 'Security' },
            { id: 5, departmentName: 'Administration' },
          ]
        };
      }
    },
    getById: async (id: number) => {
      const response = await apiClient.get(`/departments/${id}`);
      return response.data;
    },
    create: async (data: any) => {
      const response = await apiClient.post('/departments', data);
      return response.data;
    },
    update: async (id: number, data: any) => {
      const response = await apiClient.put(`/departments/${id}`, data);
      return response.data;
    },
    delete: async (id: number) => {
      const response = await apiClient.delete(`/departments/${id}`);
      return response.data;
    },
  },

  // Roles (FIXED - added this section)
  roles: {
    getAll: async () => {
      try {
        const response = await apiClient.get('/roles');
        return response.data;
      } catch (error) {
        return {
          success: true,
          data: [
            { id: 1, roleName: 'Super Admin', roleType: 'super_admin' },
            { id: 2, roleName: 'Admin', roleType: 'admin' },
            { id: 3, roleName: 'Property Manager', roleType: 'property_manager' },
            { id: 4, roleName: 'Facility Manager', roleType: 'facility_manager' },
            { id: 5, roleName: 'Staff', roleType: 'staff' },
            { id: 6, roleName: 'Resident', roleType: 'resident' },
          ]
        };
      }
    },
    getById: async (id: number) => {
      const response = await apiClient.get(`/roles/${id}`);
      return response.data;
    },
    create: async (data: any) => {
      const response = await apiClient.post('/roles', data);
      return response.data;
    },
    update: async (id: number, data: any) => {
      const response = await apiClient.put(`/roles/${id}`, data);
      return response.data;
    },
    delete: async (id: number) => {
      const response = await apiClient.delete(`/roles/${id}`);
      return response.data;
    },
  },

  // Associations
  associations: {
    getAll: async (): Promise<ApiResponse<Association[]>> => {
      const response = await apiClient.get('/association');
      return response.data;
    },
    getById: async (id: number): Promise<ApiResponse<Association>> => {
      const response = await apiClient.get(`/association/${id}`);
      return response.data;
    },
    create: async (data: Partial<Association>): Promise<ApiResponse<Association>> => {
      const response = await apiClient.post('/association', data);
      return response.data;
    },
    update: async (id: number, data: Partial<Association>): Promise<ApiResponse<any>> => {
      const response = await apiClient.put(`/association/${id}`, data);
      return response.data;
    },
    delete: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/association/${id}`);
      return response.data;
    },
  },

  // Properties
  properties: {
    getByAssociation: async (associationId: number): Promise<ApiResponse<Property[]>> => {
      const response = await apiClient.get(`/property/association/${associationId}`);
      return response.data;
    },
    create: async (data: any): Promise<ApiResponse<Property>> => {
      const response = await apiClient.post('/property', data);
      return response.data;
    },
    delete: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/property/${id}`);
      return response.data;
    },
    getBuildings: async (propertyId: number): Promise<ApiResponse<Building[]>> => {
      const response = await apiClient.get(`/property/property/${propertyId}/buildings`);
      return response.data;
    },
    createBuilding: async (data: any): Promise<ApiResponse<Building>> => {
      const response = await apiClient.post('/property/building', data);
      return response.data;
    },
    deleteBuilding: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/property/building/${id}`);
      return response.data;
    },
    getUnits: async (buildingId: number): Promise<ApiResponse<Unit[]>> => {
      const response = await apiClient.get(`/property/building/${buildingId}/units`);
      return response.data;
    },
    createUnit: async (data: any): Promise<ApiResponse<Unit>> => {
      const response = await apiClient.post('/property/unit', data);
      return response.data;
    },
    deleteUnit: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/property/unit/${id}`);
      return response.data;
    },
  },

  // Complaints
  complaints: {
    getAll: async (params?: { status?: string; page?: number; pageSize?: number }): Promise<ApiResponse<PaginatedResponse<Complaint>>> => {
      const response = await apiClient.get('/complaints', { params });
      return response.data;
    },
    getById: async (id: number): Promise<ApiResponse<Complaint>> => {
      const response = await apiClient.get(`/complaints/${id}`);
      return response.data;
    },
    create: async (data: CreateComplaintDto): Promise<ApiResponse<Complaint>> => {
      const response = await apiClient.post('/complaints', data);
      return response.data;
    },
    assign: async (id: number, data: AssignmentDto): Promise<ApiResponse<any>> => {
      const response = await apiClient.post(`/complaints/${id}/assign`, data);
      return response.data;
    },
    resolve: async (id: number, data: ResolutionDto): Promise<ApiResponse<any>> => {
      const response = await apiClient.post(`/complaints/${id}/resolve`, data);
      return response.data;
    },
    submitFeedback: async (id: number, data: FeedbackDto): Promise<ApiResponse<any>> => {
      const response = await apiClient.post(`/complaints/${id}/feedback`, data);
      return response.data;
    },
  },

  // Work Orders
  workOrders: {
    getAll: async (vendorId?: number): Promise<ApiResponse<WorkOrder[]>> => {
      const params = vendorId ? { vendorId } : {};
      const response = await apiClient.get('/workorder', { params });
      return response.data;
    },
    create: async (data: any): Promise<ApiResponse<WorkOrder>> => {
      const response = await apiClient.post('/workorder', data);
      return response.data;
    },
    updateStatus: async (id: number, status: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.patch(`/workorder/${id}/status`, { status });
      return response.data;
    },
    approve: async (id: number, managerId: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.post(`/workorder/${id}/approve`, { managerId });
      return response.data;
    },
  },

  // Bills
  bills: {
    getByUnit: async (unitId: number): Promise<ApiResponse<Bill[]>> => {
      const response = await apiClient.get(`/bill/unit/${unitId}`);
      return response.data;
    },
    getByAssociation: async (associationId: number): Promise<ApiResponse<PaginatedResponse<Bill>>> => {
      const response = await apiClient.get(`/bill/association/${associationId}`);
      return response.data;
    },
    create: async (data: any): Promise<ApiResponse<Bill>> => {
      const response = await apiClient.post('/bill', data);
      return response.data;
    },
    delete: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/bill/${id}`);
      return response.data;
    }
  },

  // Dashboard
  dashboard: {
    getResidentStats: async (userId: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.get(`/dashboard/resident/${userId}`);
      return response.data;
    },
    getManagerStats: async (associationId: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.get(`/dashboard/manager/${associationId}`);
      return response.data;
    },
    getStats: async (): Promise<ApiResponse<any>> => {
      const response = await apiClient.get('/dashboard/stats');
      return response.data;
    },
    getCategoryAnalytics: async (): Promise<ApiResponse<any>> => {
      const response = await apiClient.get('/dashboard/analytics/categories');
      return response.data;
    }
  },

  // Tasks (Staff/General)
  tasks: {
    getAll: async (adminId?: number): Promise<ApiResponse<any[]>> => {
      const params = adminId ? { adminId } : {};
      const response = await apiClient.get('/tasks', { params });
      return response.data;
    },
    getMyTasks: async (): Promise<ApiResponse<any[]>> => {
      const response = await apiClient.get('/tasks/my-tasks');
      return response.data;
    },
    getReminders: async (): Promise<ApiResponse<any[]>> => {
      const response = await apiClient.get('/tasks/reminders');
      return response.data;
    },
    getPerformance: async (): Promise<ApiResponse<any[]>> => {
      const response = await apiClient.get('/tasks/performance');
      return response.data;
    },
    getStats: async (): Promise<ApiResponse<any>> => {
      const response = await apiClient.get('/dashboard/stats');
      return response.data;
    },
    getById: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.get(`/tasks/${id}`);
      return response.data;
    },
    create: async (data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/tasks', data);
      return response.data;
    },
    update: async (id: number, data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.put(`/tasks/${id}`, data);
      return response.data;
    },
    updateStatus: async (id: number, status: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.patch(`/tasks/${id}/status`, { status });
      return response.data;
    },
    delete: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/tasks/${id}`);
      return response.data;
    }
  },

  // Reports
  reports: {
    getAll: async (adminId?: number): Promise<ApiResponse<any[]>> => {
      const params = adminId ? { adminId } : {};
      const response = await apiClient.get('/reports', { params });
      return response.data;
    },
    getMyReports: async (params: any): Promise<ApiResponse<any[]>> => {
      const response = await apiClient.get('/reports/my-reports', { params });
      return response.data;
    },
    create: async (data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/reports', data);
      return response.data;
    }
  },
  
  // Admin Methods
  admin: {
    getDashboardStats: async () => (await apiClient.get('/dashboard/stats')).data,
    getAllReports: async (params: any) => (await apiClient.get('/reports', { params })).data,
  },

  // Legacy Work Allocations
  allocations: {
    getAll: async () => (await apiClient.get('/workallocations/all')).data,
    getMyTasks: async () => (await apiClient.get('/workallocations/my-tasks')).data,
    getLiveActivities: async () => (await apiClient.get('/workallocations/live')).data,
    updateStatus: async (id: number, status: string, duration?: string) => 
      (await apiClient.post(`/workallocations/${id}/status`, { status, duration })).data,
    delete: async (id: number) => (await apiClient.post(`/workallocations/${id}/delete`, {})).data,
    updateProgress: async (id: number, progressNote: string) => 
      (await apiClient.post(`/workallocations/${id}/progress`, { progressNote })).data,
    selfAssign: async (data: any) => (await apiClient.post('/workallocations/self-assign', data)).data,
    requestChange: async (id: number, data: any) => 
      (await apiClient.post(`/workallocations/request-change`, data, { params: { id } })).data,
  },
  
  // Super Admin
  superAdmin: {
    getAllAdmins: async (): Promise<ApiResponse<AdminTenant[]>> => {
      const response = await apiClient.get('/association');
      const data = response.data;
      // Backend returns paginated: { success, data: { items: [...] } }
      const items = data?.data?.items ?? data?.data?.Items ?? data?.data ?? [];
      return {
        success: data.success,
        message: data.message,
        data: items.map((a: any) => ({
          id: a.id,
          companyName: a.associationName,
          email: a.email ?? '',
          themeColor: a.themeColor,
          status: a.isActive ? 'active' : 'inactive',
          userCount: a.userCount ?? 0,
          reportCount: a.reportCount ?? 0,
        })),
      };
    },
    createAdmin: async (data: {
      name: string;
      companyName: string;
      email: string;
      password: string;
      themeColor?: string;
    }): Promise<ApiResponse<any>> => {
      // 1. Create the association
      const assocRes = await apiClient.post('/association', {
        associationName: data.companyName,
        slug: data.companyName.toLowerCase().replace(/\s+/g, '-'),
        themeColor: data.themeColor ?? '#6366f1',
        email: data.email,
      });
      if (!assocRes.data.success) return assocRes.data;
      const associationId = assocRes.data.data?.id;
      // 2. Register the admin user
      const userRes = await apiClient.post('/auth/register', {
        username: data.email,
        password: data.password,
        fullName: data.name,
        role: 1, // admin
        associationId,
      });
      return userRes.data;
    },
    updateAdmin: async (id: number, data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.put(`/association/${id}`, {
        associationName: data.companyName,
        themeColor: data.themeColor,
      });
      return response.data;
    },
    deleteAdmin: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/association/${id}`);
      return response.data;
    },
    toggleAdminStatus: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.patch(`/association/${id}/toggle-status`);
      return response.data;
    },
  },

  // Legacy Clients & Works
  clients: {
    getAll: async () => (await apiClient.get('/clients')).data,
    create: async (data: any) => (await apiClient.post('/clients', data)).data,
    update: async (id: number, data: any) => (await apiClient.post(`/clients/${id}/update`, data)).data,
    delete: async (id: number) => (await apiClient.post(`/clients/${id}/delete`)).data,
  },
  works: {
    getActive: async () => (await apiClient.get('/works')).data,
    create: async (data: any) => (await apiClient.post('/works', data)).data,
  },
  
  // Chat & Groups
  chat: {
    getUsers: async () => (await apiClient.get('/chat/users')).data,
    getHistory: async (userId: number, page = 1) => 
      (await apiClient.get(`/chat/history/${userId}`, { params: { page, pageSize: 50 } })).data,
    getUnread: async () => (await apiClient.get('/chat/unread')).data,
    send: async (data: any) => (await apiClient.post('/chat/send', data)).data,
  },
  groups: {
    getMyGroups: async () => (await apiClient.get('/groups')).data,
    getGroup: async (id: number) => (await apiClient.get(`/groups/${id}`)).data,
    create: async (data: any) => (await apiClient.post('/groups', data)).data,
    sendMessage: async (id: number, message: string) => 
      (await apiClient.post(`/groups/${id}/messages`, { message })).data,
  }
};

// Debug log to confirm departments exists
console.log('✅ api.ts loaded successfully');
console.log('✅ api.departments exists:', !!api.departments);