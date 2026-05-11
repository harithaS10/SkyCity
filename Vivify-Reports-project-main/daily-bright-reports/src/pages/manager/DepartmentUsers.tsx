import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { User, Search, Users, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const DepartmentUsers: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.departmentId) { setIsLoading(false); return; }
    api.departments.getUsers(user.departmentId)
      .then(res => { if (res.success && res.data) setUsers(res.data); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const headerBg = 'bg-primary';
  const headerText = 'text-white font-semibold h-11';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pt-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100">
            <Users className="h-6 w-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Department Users</h1>
            <p className="text-muted-foreground text-sm">
              {user?.departmentName
                ? `Read-only view — ${user.departmentName} department`
                : 'Read-only view of your department'}
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-sm">
          <Layers className="h-4 w-4 flex-shrink-0" />
          <span>Managers have <strong>read-only</strong> access to department user data. Contact an Admin to make changes.</span>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100/50"><Users className="h-5 w-5 text-sky-600" /></div>
            <div><p className="text-2xl font-bold">{users.length}</p><p className="text-sm text-muted-foreground">Department Members</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100/50"><User className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold">{users.filter(u => u.status === 'active').length}</p><p className="text-sm text-muted-foreground">Active Members</p></div>
          </CardContent></Card>
        </div>

        {/* Table (read-only) */}
        <Card className="overflow-hidden border-none shadow-md">
          <CardHeader className="bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg">Team Members</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border border-slate-200 m-6 mt-0 overflow-hidden">
              <Table>
                <TableHeader className={headerBg}>
                  <TableRow className="hover:bg-transparent border-none">
                    {['Member', 'Role', 'Status', 'Joined'].map(h => (
                      <TableHead key={h} className={headerText}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : !user?.departmentId ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">You are not assigned to a department.</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No members found.</TableCell></TableRow>
                  ) : filtered.map(u => (
                    <TableRow key={u.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.createdAt ? format(parseISO(u.createdAt), 'MMM dd, yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DepartmentUsers;
