// File: src/types/index.ts

export type UserRole = 
  | 'super_admin'
  | 'admin'
  | 'sub_admin'
  | 'property_manager'
  | 'facility_manager'
  | 'staff'
  | 'vendor'
  | 'resident'
  | 'accountant'
  | 'helpdesk';

export interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  role: UserRole;
  associationId?: number;
  propertyId?: number;
  buildingId?: number;
  unitId?: number;
  phone?: string;
  profilePicture?: string;
  isActive?: boolean;
  hasAcceptedTerms?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  // Branding
  associationName?: string;
  themeColor?: string;
  logoUrl?: string;
}

export interface Association {
  id: number;
  associationName: string;
  adminId: number;
  logoUrl?: string;
  themeColor: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  createdAt: string;
  isActive: boolean;
}

export interface Property {
  id: number;
  associationId: number;
  propertyName: string;
  address?: string;
  totalUnits: number;
  createdAt: string;
  association?: Association;
}

export interface Building {
  id: number;
  propertyId: number;
  buildingName: string;
  floors: number;
  createdAt: string;
  property?: Property;
}

export interface Unit {
  id: number;
  buildingId: number;
  unitNumber: string;
  floorNumber: number;
  area: number;
  residentId?: number;
  isOccupied: boolean;
  createdAt: string;
  building?: Building;
}

export interface ComplaintCategory {
  id: number;
  associationId: number;
  categoryName: string;
  department?: string;
  estimatedTime: number;
  isActive: boolean;
}

export interface Complaint {
  id: number;
  complaintNumber: string;
  residentId: number;
  unitId: number;
  categoryId: number;
  title: string;
  description?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed';
  assignedTo?: number;
  assignedBy?: number;
  assignedAt?: string;
  resolution?: string;
  resolutionNotes?: string;
  rating?: number;
  feedback?: string;
  createdAt: string;
  resolvedAt?: string;
  closedAt?: string;
  resident?: User;
  unit?: Unit;
  category?: ComplaintCategory;
  assignedStaff?: User;
}

// Complaint DTOs
export interface CreateComplaintDto {
  residentId: number;
  unitId: number;
  categoryId: number;
  title: string;
  description?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
}

export interface AssignmentDto {
  staffId: number;
  managerId: number;
}

export interface ResolutionDto {
  resolution: string;
  notes?: string;
}

export interface FeedbackDto {
  rating: number;
  feedback?: string;
}

export interface WorkOrder {
  id: number;
  workOrderNumber: string;
  complaintId: number;
  vendorId: number;
  workTitle: string;
  description?: string;
  estimatedCost?: number;
  actualCost?: number;
  status: 'Pending Approval' | 'Approved' | 'In Progress' | 'Completed' | 'Rejected';
  approvedBy?: number;
  approvedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// Work Order DTOs
export interface UpdateWorkOrderStatusDto {
  status: string;
}

export interface ApproveWorkOrderDto {
  managerId: number;
}

export interface Bill {
  id: number;
  associationId: number;
  unitId: number;
  billNumber: string;
  billType?: string;
  amount: number;
  tax: number;
  totalAmount: number;
  billingDate: string;
  dueDate: string;
  status: 'Pending' | 'Paid' | 'Overdue';
  paidAt?: string;
  paymentReference?: string;
  createdAt: string;
  unit?: Unit;
}

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  referenceId?: number;
  isRead: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: T[];
}
