import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Users,
  Search,
  UserCheck,
  Clock,
  TrendingUp,
  Loader2,
  ArrowRight,
  User,
  Building2,
  Mail,
  Phone,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Employee {
  id: number;
  name: string;
  fullName?: string;
  username: string;
  email: string;
  role: string;
  status: string;
  isActive?: boolean;
  department?: string;
  createdAt: string;
}

interface EmployeeStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
}

const EmployeeList: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeStats, setEmployeeStats] = useState<Record<number, EmployeeStats>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const response = await api.users.getAll();
      if (response.success && response.data) {
        // Filter staff/employee roles (exclude super_admin, admin, resident)
        const staffRoles = ['staff', 'helpdesk', 'property_manager', 'facility_manager', 'vendor', 'sub_admin', 'accountant'];
        const activeEmployees = response.data.filter(
          (user: Employee) => staffRoles.includes(user.role) && (user.isActive !== false)
        );
        setEmployees(activeEmployees);
        
        // Fetch stats for each employee
        await fetchEmployeeStats(activeEmployees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeeStats = async (employees: Employee[]) => {
    try {
      // Fetch all allocations once, then count per employee
      const allocRes = await api.allocations.getAll().catch(() => ({ success: false, data: [] }));
      const allAllocations: any[] = allocRes.success ? (allocRes.data || []) : [];

      const statsPromises = employees.map(async (employee) => {
        try {
          // Count from WorkAllocations
          const allocations = allAllocations.filter((a: any) => a.assignedTo === employee.id);
          const totalTasks = allocations.length;
          const completedTasks = allocations.filter((a: any) => a.status === 'completed').length;
          const pendingTasks = allocations.filter((a: any) => a.status === 'pending').length;
          const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          return { employeeId: employee.id, stats: { totalTasks, completedTasks, pendingTasks, completionRate } };
        } catch {}
        return { employeeId: employee.id, stats: { totalTasks: 0, completedTasks: 0, pendingTasks: 0, completionRate: 0 } };
      });

      const results = await Promise.all(statsPromises);
      const statsMap: Record<number, EmployeeStats> = {};
      results.forEach(({ employeeId, stats }) => { statsMap[employeeId] = stats; });
      setEmployeeStats(statsMap);
    } catch {}
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter((employee) =>
    (employee.fullName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (employee.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (employee.username ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewTasks = (employeeId: number, employeeName: string) => {
    navigate(`/admin/employee-tasks/${employeeId}`, { 
      state: { employeeName } 
    });
  };

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(emp => emp.isActive !== false).length;
  const avgCompletionRate = employees.length > 0 
    ? Math.round(
        Object.values(employeeStats).reduce((sum, stats) => sum + stats.completionRate, 0) / employees.length
      ) 
    : 0;

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-500 relative">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block space-y-8 mb-8 pt-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-primary dark:text-white">Employee Task Management</h1>
              <p className="text-sm text-muted-foreground max-w-[500px]">
                Manage and assign tasks to your team members. View individual performance and task allocation.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEmployees}</div>
                <p className="text-xs text-muted-foreground">Active team members</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Now</CardTitle>
                <UserCheck className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{activeEmployees}</div>
                <p className="text-xs text-muted-foreground">Currently active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{avgCompletionRate}%</div>
                <p className="text-xs text-muted-foreground">Team average</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <Clock className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {Object.values(employeeStats).reduce((sum, stats) => sum + stats.totalTasks, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Across all employees</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg">Employee Directory</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Total Tasks</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Completion Rate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => {
                      const stats = employeeStats[employee.id] || { 
                        totalTasks: 0, 
                        completedTasks: 0, 
                        pendingTasks: 0, 
                        completionRate: 0 
                      };
                      
                      return (
                        <TableRow key={employee.id} className="hover:bg-slate-50/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{employee.fullName}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {employee.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              EMP-{employee.id.toString().padStart(3, '0')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{employee.department || 'General'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{stats.totalTasks}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-emerald-600 font-medium">{stats.completedTasks}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-amber-600 font-medium">{stats.pendingTasks}</span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={`${
                                stats.completionRate >= 80 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                stats.completionRate >= 50 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                'bg-rose-100 text-rose-800 border-rose-200'
                              }`}
                            >
                              {stats.completionRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              onClick={() => handleViewTasks(employee.id, employee.fullName)}
                              size="sm"
                              className="gap-2"
                            >
                              View Tasks
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 dark:bg-slate-950 -mx-4 -mt-4 min-h-screen">
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-white tracking-tight truncate">Employees</h1>
                <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Task & Performance Management</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-1 opacity-70">
                  <Users className="h-3.5 w-3.5" />
                  <p className="text-[9px] uppercase font-bold tracking-widest">Total Staff</p>
                </div>
                <p className="text-xl font-black">{totalEmployees}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-1 opacity-70">
                  <UserCheck className="h-3.5 w-3.5" />
                  <p className="text-[9px] uppercase font-bold tracking-widest">Active Now</p>
                </div>
                <p className="text-xl font-black text-emerald-300">{activeEmployees}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-1 opacity-70">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <p className="text-[9px] uppercase font-bold tracking-widest">Avg Completion</p>
                </div>
                <p className="text-xl font-black text-blue-300">{avgCompletionRate}%</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-1 opacity-70">
                  <Clock className="h-3.5 w-3.5" />
                  <p className="text-[9px] uppercase font-bold tracking-widest">Total Tasks</p>
                </div>
                <p className="text-xl font-black text-purple-300">
                  {Object.values(employeeStats).reduce((sum, stats) => sum + stats.totalTasks, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 -mt-6 relative z-20 space-y-4 pb-8">
            {/* Search */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 p-2 flex items-center">
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-500 ml-3 shrink-0" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 focus:ring-0 text-sm h-10 px-3 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-2 shrink-0">
                  <X className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white dark:bg-slate-800 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Loading directory...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white dark:bg-slate-800 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <User className="h-8 w-8 mb-2 text-slate-400 dark:text-slate-500" />
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No employees found</p>
                </div>
              ) : (
                filteredEmployees.map((employee) => {
                  const stats = employeeStats[employee.id] || { 
                    totalTasks: 0, 
                    completedTasks: 0, 
                    pendingTasks: 0, 
                    completionRate: 0 
                  };
                  
                  // Clean up classes
                  return (
                    <div key={employee.id} className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary font-bold shadow-inner">
                            {(employee.fullName || employee.username || 'E').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 dark:text-white line-clamp-1">{employee.fullName || employee.username}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                EMP-{employee.id.toString().padStart(3, '0')}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[120px]">{employee.email}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 mt-1">
                        <div className="text-center">
                          <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest mb-1">Total</p>
                          <p className="text-sm font-black text-slate-700 dark:text-slate-300">{stats.totalTasks}</p>
                        </div>
                        <div className="text-center border-l border-r border-slate-200/60 dark:border-slate-700">
                          <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest mb-1">Done</p>
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{stats.completedTasks}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest mb-1">Rate</p>
                          <p className={cn("text-sm font-black", stats.completionRate >= 80 ? "text-emerald-600 dark:text-emerald-400" : stats.completionRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400")}>
                            {stats.completionRate}%
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleViewTasks(employee.id, employee.fullName || employee.username)}
                        className="w-full rounded-xl h-11 font-bold shadow-sm mt-1 bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600"
                      >
                        View Assigned Tasks <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployeeList;