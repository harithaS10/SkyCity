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
  name: string;
  companyName: string;
  email: string;
  adminName?: string;
  adminPhone?: string;
  adminActive?: boolean;
  themeColor?: string;
  status: 'active' | 'inactive';
  userCount?: number;
  reportCount?: number;
}

export type PermissionSet = { view: boolean; create: boolean; edit: boolean; delete: boolean; };
export type RolePermissions = {
  complaints?: PermissionSet;
  work_orders?: PermissionSet;
  daily_reports?: PermissionSet;
  analytics?: PermissionSet;
  chat?: PermissionSet;
  export?: boolean;
  [key: string]: PermissionSet | boolean | undefined;
};
export interface CustomRole {
  id: number;
  roleName: string;
  permissions: RolePermissions;
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
      // Redirect to login if not already there
      if (!window.location.hash.includes('/login')) {
        window.location.hash = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============ API Service Methods ============

export const api = {
  // Auth
  auth: {
    login: async (username: string, password: string, acceptTerms: boolean = false) => {
      const response = await apiClient.post('/auth/login', { username, password, acceptTerms });
      return response.data;
    },
    checkTerms: async (username: string) => {
      const response = await apiClient.get(`/auth/check-terms/${username}`);
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
    bulkCreate: async (roles: Array<{ roleName: string; roleType?: string; permissions?: any }>) => {
      const response = await apiClient.post('/roles/bulk', { roles });
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
    update: async (id: number, data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.put(`/property/${id}`, data);
      return response.data;
    },
    bulkCreate: async (data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/property/bulk', data);
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
    createUnitsBulk: async (data: { buildingId: number; fromFloor: number; toFloor: number; unitsPerFloor: number }): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/property/units/bulk', data);
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
      const response = await apiClient.post(`/complaint-actions/${id}/assign`, data);
      return response.data;
    },
    updateStatus: async (id: number, status: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.patch(`/complaint-actions/${id}/status`, { status });
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
    getUserTasks: async (userId: number): Promise<ApiResponse<any[]>> => {
      const response = await apiClient.get('/tasks', { params: { assignedTo: userId } });
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
    },
    uploadAttachments: async (id: number, files: File[]): Promise<ApiResponse<any>> => {
      const toBase64 = (f: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
      const encoded = await Promise.all(files.map(async f => ({
        name: f.name, type: f.type, data: await toBase64(f)
      })));
      const response = await apiClient.post(`/tasks/${id}/attachments`, { files: encoded });
      return response.data;
    },
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
    },
    submit: async (data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/reports', data);
      return response.data;
    }
  },
  
  // Admin Methods
  admin: {
    getDashboardStats: async () => (await apiClient.get('/dashboard/stats')).data,
    getAllReports: async (params: any) => {
      const response = await apiClient.get('/reports', { params });
      const [usersRes, complaintsRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/complaints', { params }).catch(() => ({ data: { data: { items: [] } } })),
      ]);
      const raw = response.data;
      const userList = usersRes.data?.data ?? [];
      const userMap: Record<number, string> = {};
      userList.forEach((u: any) => { userMap[u.id] = u.fullName; });

      const complaints = complaintsRes.data?.data?.items ?? complaintsRes.data?.data ?? [];

      // Group allocations by user+date so each user appears once per day
      const grouped: Record<string, any> = {};
      (raw?.data ?? []).forEach((a: any) => {
        const day = a.createdAt ? a.createdAt.split('T')[0] : 'unknown';
        const key = `${a.assignedTo}_${day}`;
        const userComplaints = complaints.filter((c: any) => c.residentId === a.assignedTo);
        if (!grouped[key]) {
          grouped[key] = {
            id: a.id,
            userId: a.assignedTo,
            userName: userMap[a.assignedTo] || 'Unknown',
            date: a.createdAt,
            complaints: userComplaints,
            entries: [],
          };
        }
        grouped[key].entries.push({
          workTitle: a.title,
          description: a.description,
          status: a.status,
          hoursSpent: 0,
          dueDate: a.dueDate,
        });
      });
      const items = Object.values(grouped);
      return { success: true, data: items };
    },
    getAnalytics: async (params: any): Promise<ApiResponse<any>> => {
      try {
        const [allocRes, usersRes] = await Promise.all([
          apiClient.get('/workallocations/all'),
          apiClient.get('/users'),
        ]);
        const allocs = allocRes.data?.data ?? [];
        const users = usersRes.data?.data ?? [];

        // Filter by date range
        const start = params.startDate ? new Date(params.startDate) : null;
        const end = params.endDate ? new Date(params.endDate) : null;
        const filtered = allocs.filter((a: any) => {
          if (!start || !end) return true;
          const d = new Date(a.createdAt);
          return d >= start && d <= end;
        });

        // Build analytics
        const userMap: Record<number, string> = {};
        users.forEach((u: any) => { userMap[u.id] = u.fullName; });

        const productivity = users.map((u: any) => ({
          userId: u.id,
          userName: u.fullName,
          completed: filtered.filter((a: any) => a.assignedTo === u.id && a.status === 'completed').length,
          pending: filtered.filter((a: any) => a.assignedTo === u.id && a.status !== 'completed').length,
        })).filter(u => u.completed + u.pending > 0);

        const workDist: Record<string, number> = {};
        filtered.forEach((a: any) => {
          const key = a.title || 'Unknown';
          workDist[key] = (workDist[key] || 0) + 1;
        });
        const workDistribution = Object.entries(workDist)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Build trend data — group by date
        const trendMap: Record<string, number> = {};
        filtered.forEach((a: any) => {
          const day = a.createdAt ? a.createdAt.split('T')[0] : null;
          if (day) trendMap[day] = (trendMap[day] || 0) + 1;
        });
        const trendData = Object.entries(trendMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, workCount]) => ({ date, workCount }));

        return {
          success: true,
          data: {
            type: 'standard',
            totalUsers: users.length,
            reportsCount: filtered.length,
            workDensity: filtered.filter((a: any) => a.status === 'in-progress').length,
            entriesPerReport: users.length > 0 ? Math.round(filtered.length / users.length) : 0,
            productivity,
            workDistribution,
            data: trendData,
          }
        };
      } catch {
        return { success: false, data: null };
      }
    },
  },

  // Users
  users: {
    getAll: async (role?: string): Promise<ApiResponse<any[]>> => {
      const params = role ? { role } : {};
      const response = await apiClient.get('/users', { params });
      return response.data;
    },
    getById: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.get(`/users/${id}`);
      return response.data;
    },
    create: async (data: any): Promise<ApiResponse<any>> => {
      // Map role string to enum index
      const roleMap: Record<string, number> = {
        super_admin: 0, admin: 1, sub_admin: 2, property_manager: 3,
        facility_manager: 4, staff: 5, vendor: 6, resident: 7,
        accountant: 8, helpdesk: 9, user: 7
      };
      const response = await apiClient.post('/auth/register', {
        username: data.username || data.email,
        password: data.password,
        fullName: data.name || data.fullName,
        role: roleMap[data.role] ?? 7,
        associationId: data.associationId,
      });
      return response.data;
    },
    toggleStatus: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.patch(`/users/${id}/toggle-status`);
      return response.data;
    },
    update: async (id: number, data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.put(`/users/${id}`, data);
      return response.data;
    },
    delete: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/users/${id}`);
      return response.data;
    },
    bulkCreate: async (users: Array<{ username: string; password: string; fullName: string; role?: string }>): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/users/bulk', { users });
      return response.data;
    },
  },

  // AI Bot
  aiBot: {
    sendMessage: async (message: string) =>
      (await apiClient.post('/aibot/message', { message })).data,
  },

  // Assistance Requests
  assistance: {
    request: async (message: string) =>
      (await apiClient.post('/assistance', { message })).data,
    getAll: async () => (await apiClient.get('/assistance')).data,
    markRead: async (id: number) => (await apiClient.post(`/assistance/${id}/read`, {})).data,
  },

  // Branding
  branding: {
    get: async () => (await apiClient.get('/branding')).data,
    getPublic: async () => {
      try {
        return (await apiClient.get('/branding/public')).data;
      } catch {
        return { success: false, data: null };
      }
    },
    update: async (data: { associationName?: string; themeColor?: string; logoUrl?: string }) =>
      (await apiClient.post('/branding/update', data)).data,
  },

  // Terms and Conditions
  terms: {
    get: async (): Promise<ApiResponse<any>> => {
      try {
        const response = await apiClient.get('/terms');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch terms from backend:', error);
        return { success: false, message: 'Failed to load terms and conditions' };
      }
    },
    update: async (content: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/terms', { content });
      return response.data;
    }
  },

  // Daily Report Drafts
  dailyReportDrafts: {
    get: async (date: string) => (await apiClient.get('/daily-report-drafts', { params: { date } })).data,
    save: async (date: string, rowsJson: string, isSubmitted = false) =>
      (await apiClient.post('/daily-report-drafts', { date, rowsJson, isSubmitted })).data,
  },

  // Legacy Work Allocations
  allocations: {    getAll: async () => (await apiClient.get('/workallocations/all')).data,
    getMyTasks: async () => {
      const res = (await apiClient.get('/workallocations/my-tasks')).data;
      if (res.success && Array.isArray(res.data)) {
        res.data = res.data.map((a: any) => ({
          ...a,
          title: a.title || a.workTitle || '',
          workTitle: a.workTitle || a.title || '',
        }));
      }
      return res;
    },
    getLiveActivities: async () => (await apiClient.get('/workallocations/live')).data,
    create: async (data: any) => (await apiClient.post('/workallocations', data)).data,
    updateStatus: async (id: number, status: string, duration?: string) => 
      (await apiClient.post(`/workallocations/${id}/status`, { status, duration })).data,
    delete: async (id: number) => (await apiClient.post(`/workallocations/${id}/delete`, {})).data,
    updateProgress: async (id: number, progressNote: string) => 
      (await apiClient.post(`/workallocations/${id}/progress`, { progressNote })).data,
    selfAssign: async (data: any) => (await apiClient.post('/workallocations/self-assign', data)).data,
    uploadAttachments: async (id: number, files: File[]) => {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      return (await apiClient.post(`/workallocations/${id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })).data;
    },
    uploadAttachmentsBase64: async (id: number, files: File[]) => {
      const toBase64 = (f: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
      const encoded = await Promise.all(files.map(async f => ({
        name: f.name, type: f.type, data: await toBase64(f)
      })));
      return (await apiClient.post(`/workallocations/${id}/attachments-base64`, { files: encoded })).data;
    },
    deleteAttachments: async (id: number, attachmentName?: string) =>
      (await apiClient.post(`/workallocations/${id}/delete-attachments`, { attachmentName })).data,
    reassign: async (id: number, newUserId: number, reason?: string) =>
      (await apiClient.post(`/workallocations/${id}/reassign`, { newUserId, reason })).data,
    approveRequest: async (id: number) =>
      (await apiClient.post(`/workallocations/${id}/approve-request`, {})).data,
    denyRequest: async (id: number) =>
      (await apiClient.post(`/workallocations/${id}/deny-request`, {})).data,
    requestChange: async (id: number, data: any) => 
      (await apiClient.post(`/workallocations/${id}/request-change`, data)).data,
  },
  
  // Products
  products: {
    getAll: async (params?: { categoryId?: number; search?: string }): Promise<ApiResponse<any[]>> => {
      const response = await apiClient.get('/products', { params });
      return response.data;
    },
    getById: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.get(`/products/${id}`);
      return response.data;
    },
    create: async (data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/products', data);
      return response.data;
    },
    update: async (id: number, data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.put(`/products/${id}`, data);
      return response.data;
    },
    delete: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/products/${id}`);
      return response.data;
    },
    uploadImage: async (file: File): Promise<ApiResponse<string>> => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
  },

  // Categories (Complaint Categories)
  categories: {
    getAll: async (): Promise<ApiResponse<any[]>> => {
      const response = await apiClient.get('/categories');
      return response.data;
    },
    getById: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.get(`/categories/${id}`);
      return response.data;
    },
    create: async (data: { categoryName: string; department?: string; estimatedTime?: number; associationId?: number }): Promise<ApiResponse<any>> => {
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const response = await apiClient.post('/categories', {
        ...data,
        associationId: data.associationId ?? user?.associationId,
      });
      return response.data;
    },
    update: async (id: number, data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.put(`/categories/${id}`, data);
      return response.data;
    },
    delete: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/categories/${id}`);
      return response.data;
    },
  },

  // SubCategories
  subCategories: {
    getAll: async (categoryId?: number): Promise<ApiResponse<any[]>> => {
      const params = categoryId ? { categoryId } : {};
      const response = await apiClient.get('/subcategories', { params });
      return response.data;
    },
    create: async (data: { categoryId: number; subCategoryName: string; description?: string }): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/subcategories', data);
      return response.data;
    },
    update: async (id: number, data: any): Promise<ApiResponse<any>> => {
      const response = await apiClient.put(`/subcategories/${id}`, data);
      return response.data;
    },
    delete: async (id: number): Promise<ApiResponse<any>> => {
      const response = await apiClient.delete(`/subcategories/${id}`);
      return response.data;
    },
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
          name: a.associationName,
          companyName: a.associationName,
          email: a.admin?.username || a.email || '',
          adminName: a.admin?.fullName || '',
          adminPhone: a.admin?.phone || '',
          adminActive: a.admin?.isActive ?? true,
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
        id,
        associationName: data.companyName,
        themeColor: data.themeColor,
        email: data.email,
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
    bulkCreate: async (clients: any[]) => (await apiClient.post('/clients/bulk', { clients })).data,
  },
  works: {
    getActive: async () => (await apiClient.get('/works')).data,
    getAll: async () => (await apiClient.get('/works')).data,
    create: async (data: any) => (await apiClient.post('/works', data)).data,
    update: async (id: number, data: any) => (await apiClient.put(`/works/${id}`, data)).data,
    delete: async (id: number) => (await apiClient.delete(`/works/${id}`)).data,
    bulkCreate: async (works: Array<{ workCode: string; workTitle: string; workType?: string }>) =>
      (await apiClient.post('/works/bulk', { works })).data,
  },
  
  // Chat & Groups
  chat: {
    getUsers: async () => (await apiClient.get('/chat/users')).data,
    getHistory: async (userId: number, page = 1) => 
      (await apiClient.get(`/chat/history/${userId}`, { params: { page, pageSize: 50 } })).data,
    getUnread: async () => (await apiClient.get('/chat/unread')).data,
    send: async (receiverIdOrData: any, message?: string, type?: string, payload?: string) => {
      const data = typeof receiverIdOrData === 'object'
        ? receiverIdOrData
        : { receiverId: receiverIdOrData, message, type: type ?? 'text', payload };
      return (await apiClient.post('/chat/send', data)).data;
    },
    markRead: async (userId: number) => (await apiClient.post(`/chat/mark-read/${userId}`)).data,
    deleteMessage: async (messageId: number) => (await apiClient.delete(`/chat/messages/${messageId}`)).data,
  },
  groups: {
    getMyGroups: async () => (await apiClient.get('/chat/groups')).data,
    getGroup: async (id: number) => (await apiClient.get(`/chat/groups/${id}`)).data,
    getMessages: async (id: number) => (await apiClient.get(`/chat/groups/${id}/messages`)).data,
    create: async (data: any) => (await apiClient.post('/chat/groups', data)).data,
    sendMessage: async (id: number, message: string, type?: string, payload?: string) => 
      (await apiClient.post(`/chat/groups/${id}/messages`, { message, type: type ?? 'text', payload })).data,
  }
};

// Debug log to confirm departments exists
console.log('✅ api.ts loaded successfully');
console.log('✅ api.departments exists:', !!api.departments);