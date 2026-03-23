export interface PredefinedWork {
  code: string;
  title: string;
}

export const predefinedWorks: PredefinedWork[] = [
  { code: '01', title: 'Client Meeting' },
  { code: '02', title: 'Project Development' },
  { code: '03', title: 'Code Review' },
  { code: '04', title: 'Documentation' },
  { code: '05', title: 'Testing & QA' },
  { code: '06', title: 'Bug Fixing' },
  { code: '07', title: 'Team Standup' },
  { code: '08', title: 'Training Session' },
  { code: 'A01', title: 'Administrative Tasks' },
  { code: 'A02', title: 'Email Communication' },
  { code: 'A03', title: 'Research & Analysis' },
  { code: 'A04', title: 'Presentation Preparation' },
  { code: 'B01', title: 'Database Maintenance' },
  { code: 'B02', title: 'Server Management' },
  { code: 'C01', title: 'Client Support' },
  { code: 'C02', title: 'Feature Planning' },
];

export interface WorkEntry {
  id: string;
  workCode: string;
  workDescription: string;
  timeSpent?: string;
  clientId?: string;
  status: 'completed' | 'pending';
  dueDate?: string;
  adminDueDate?: string;
}

export interface DailyReport {
  id: string;
  userId: string;
  date: string;
  entries: WorkEntry[];
  submittedAt: string;
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  enabled: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface WorkAllocation {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // userId
  assignedBy: string; // adminId
  clientId?: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  completedAt?: string;
  isSeen: boolean;
}

export const mockUsersData: MockUser[] = [
  { id: '1', email: 'admin@company.com', name: 'John Admin', role: 'admin', enabled: true, createdAt: '2024-01-01' },
  { id: '2', email: 'user@company.com', name: 'Jane Employee', role: 'user', enabled: true, createdAt: '2024-01-15' },
  { id: '3', email: 'mike@company.com', name: 'Mike Johnson', role: 'user', enabled: true, createdAt: '2024-02-01' },
  { id: '4', email: 'sarah@company.com', name: 'Sarah Williams', role: 'user', enabled: true, createdAt: '2024-02-15' },
  { id: '5', email: 'disabled@company.com', name: 'Disabled User', role: 'user', enabled: false, createdAt: '2024-03-01' },
];

export const mockClientsData: Client[] = [
  { id: 'c1', name: 'Acme Corporation', email: 'contact@acme.com', phone: '+1-555-0100', company: 'Acme Corp', status: 'active', createdAt: '2024-01-01' },
  { id: 'c2', name: 'Tech Solutions Inc', email: 'info@techsolutions.com', phone: '+1-555-0200', company: 'Tech Solutions', status: 'active', createdAt: '2024-01-15' },
  { id: 'c3', name: 'Global Industries', email: 'support@global.com', phone: '+1-555-0300', company: 'Global Industries', status: 'active', createdAt: '2024-02-01' },
  { id: 'c4', name: 'StartUp Hub', email: 'hello@startuphub.com', phone: '+1-555-0400', company: 'StartUp Hub', status: 'inactive', createdAt: '2024-02-15' },
];

export const mockWorkAllocations: WorkAllocation[] = [
  {
    id: 'wa1',
    title: 'Website Redesign',
    description: 'Complete redesign of the client website with modern UI',
    assignedTo: '2',
    assignedBy: '1',
    clientId: 'c1',
    dueDate: '2026-01-20',
    status: 'pending',
    priority: 'high',
    createdAt: '2024-01-10',
    isSeen: false,
  },
  {
    id: 'wa2',
    title: 'API Integration',
    description: 'Integrate payment gateway API with existing system',
    assignedTo: '2',
    assignedBy: '1',
    clientId: 'c2',
    dueDate: '2026-01-15',
    status: 'in-progress',
    priority: 'medium',
    createdAt: '2024-01-08',
    isSeen: true,
  },
  {
    id: 'wa3',
    title: 'Database Optimization',
    description: 'Optimize database queries for better performance',
    assignedTo: '3',
    assignedBy: '1',
    clientId: 'c1',
    dueDate: '2026-01-25',
    status: 'pending',
    priority: 'low',
    createdAt: '2024-01-12',
    isSeen: false,
  },
  {
    id: 'wa4',
    title: 'Security Audit',
    description: 'Perform comprehensive security audit of the application',
    assignedTo: '4',
    assignedBy: '1',
    clientId: 'c3',
    dueDate: '2026-01-05',
    status: 'completed',
    priority: 'high',
    createdAt: '2024-01-01',
    completedAt: '2024-01-04T14:30:00',
    isSeen: true,
  },
];

// Generate mock reports
export const generateMockReports = (): DailyReport[] => {
  const reports: DailyReport[] = [];
  const users = ['2', '3', '4'];

  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    users.forEach(userId => {
      if (Math.random() > 0.2) { // 80% chance of having a report
        const entryCount = Math.floor(Math.random() * 6) + 3;
        const entries: WorkEntry[] = [];

        for (let j = 0; j < entryCount; j++) {
          const work = predefinedWorks[Math.floor(Math.random() * predefinedWorks.length)];
          const status = Math.random() > 0.3 ? 'completed' : 'pending';
          const dueDate = status === 'pending'
            ? new Date(date.getTime() - (Math.random() * 10 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
            : undefined;

          entries.push({
            id: `${dateStr}-${userId}-${j}`,
            workCode: work.code,
            workDescription: work.title,
            timeSpent: `${Math.floor(Math.random() * 3) + 1}h`,
            clientId: mockClientsData[Math.floor(Math.random() * mockClientsData.length)].id,
            status,
            dueDate,
          });
        }

        reports.push({
          id: `${dateStr}-${userId}`,
          userId,
          date: dateStr,
          entries,
          submittedAt: `${dateStr}T18:00:00`,
        });
      }
    });
  }

  return reports;
};

export const mockReports = generateMockReports();
