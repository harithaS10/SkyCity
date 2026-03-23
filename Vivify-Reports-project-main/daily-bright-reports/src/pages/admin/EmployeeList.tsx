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
  Phone
} from "lucide-react";
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
  username: string;
  email: string;
  role: string;
  status: string;
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
        // Filter only active users with 'user' role (employees)
        const activeEmployees = response.data.filter(
          (user: Employee) => user.role === 'user' && user.status === 'active'
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
      const statsPromises = employees.map(async (employee) => {
        try {
          const response = await api.tasks.getUserTasks(employee.id);
          if (response.success && response.data) {
            const tasks = response.data;
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
            const pendingTasks = tasks.filter((t: any) => t.status === 'pending').length;
            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            
            return {
              employeeId: employee.id,
              stats: { totalTasks, completedTasks, pendingTasks, completionRate }
            };
          }
        } catch (error) {
          console.error(`Error fetching stats for employee ${employee.id}:`, error);
        }
        return {
          employeeId: employee.id,
          stats: { totalTasks: 0, completedTasks: 0, pendingTasks: 0, completionRate: 0 }
        };
      });

      const results = await Promise.all(statsPromises);
      const statsMap: Record<number, EmployeeStats> = {};
      results.forEach(({ employeeId, stats }) => {
        statsMap[employeeId] = stats;
      });
      setEmployeeStats(statsMap);
    } catch (error) {
      console.error("Error fetching employee stats:", error);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter((employee) =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewTasks = (employeeId: number, employeeName: string) => {
    navigate(`/admin/employee-tasks/${employeeId}`, { 
      state: { employeeName } 
    });
  };

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(emp => emp.status === 'active').length;
  const avgCompletionRate = employees.length > 0 
    ? Math.round(
        Object.values(employeeStats).reduce((sum, stats) => sum + stats.completionRate, 0) / employees.length
      ) 
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employee Task Management</h1>
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
                              <p className="font-medium">{employee.name}</p>
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
                            onClick={() => handleViewTasks(employee.id, employee.name)}
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EmployeeList;