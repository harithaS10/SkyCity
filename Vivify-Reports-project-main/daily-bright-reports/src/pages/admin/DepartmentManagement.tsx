import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api, Department } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Layers, Plus, MoreVertical, Pencil, Trash2, Search, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const DepartmentManagement: React.FC = () => {
  const { hasPermission } = useAuth();
  const [depts, setDepts] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');

  const canCreate = hasPermission('departments', 'create');
  const canEdit = hasPermission('departments', 'edit');
  const canDelete = hasPermission('departments', 'delete');

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await api.departments.getAll();
      if (res.success && res.data) setDepts(res.data);
    } catch {} finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = depts.filter(d =>
    d.departmentName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!deptName.trim()) { toast.error('Department name is required'); return; }
    setIsCreating(true);
    try {
      const res = await api.departments.create({ departmentName: deptName.trim() });
      if (res.success) {
        toast.success(`Department "${deptName}" created`);
        if (res.data) setDepts(prev => [...prev, res.data]);
        setDeptName(''); setIsCreateOpen(false);
      } else toast.error(res.message || 'Failed');
    } catch (e: any) { toast.error(e.message); }
    finally { setIsCreating(false); }
  };

  const handleUpdate = async () => {
    if (!editTarget || !deptName.trim()) return;
    try {
      const res = await api.departments.update(editTarget.id, { departmentName: deptName.trim() });
      if (res.success) { toast.success('Department updated'); setEditTarget(null); setDeptName(''); load(); }
      else toast.error(res.message || 'Failed');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete department "${name}"? Users in this department will be unassigned.`)) return;
    try {
      const res = await api.departments.delete(id);
      if (res.success) { toast.success('Department deleted'); load(); }
      else toast.error(res.message || 'Failed');
    } catch (e: any) { toast.error(e.message); }
  };

  const headerBg = 'bg-primary';
  const headerText = 'text-white font-semibold h-11';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pt-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Department Management</h1>
              <p className="text-muted-foreground text-sm">Organise your workforce into departments</p>
            </div>
          </div>
          {canCreate && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />New Department</Button>
              </DialogTrigger>
              <DialogContent className="bg-card">
                <DialogHeader><DialogTitle>Create Department</DialogTitle></DialogHeader>
                <div className="space-y-3 py-4">
                  <Label htmlFor="newDept">Department Name *</Label>
                  <Input
                    id="newDept" placeholder="e.g. Engineering"
                    value={deptName} onChange={e => setDeptName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? 'Creating...' : 'Create'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Edit Dialog */}
          <Dialog open={!!editTarget} onOpenChange={v => { if (!v) { setEditTarget(null); setDeptName(''); } }}>
            <DialogContent className="bg-card">
              <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
              <div className="space-y-3 py-4">
                <Label htmlFor="editDept">Department Name</Label>
                <Input
                  id="editDept" value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditTarget(null); setDeptName(''); }}>Cancel</Button>
                <Button onClick={handleUpdate}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Layers className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{depts.length}</p><p className="text-sm text-muted-foreground">Total Departments</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100/50"><Users className="h-5 w-5 text-sky-600" /></div>
            <div><p className="text-2xl font-bold">{depts.reduce((s, d) => s + (d.memberCount ?? 0), 0)}</p><p className="text-sm text-muted-foreground">Total Members</p></div>
          </CardContent></Card>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-none shadow-md">
          <CardHeader className="bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg">Departments</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border border-slate-200 m-6 mt-0 overflow-hidden">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader className={headerBg}>

                  <TableRow className="hover:bg-transparent border-none">
                    {['Department Name', 'Members', 'Created', 'Actions'].map(h => (
                      <TableHead key={h} className={headerText}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      {depts.length === 0 ? 'No departments yet. Create your first one.' : 'No results.'}
                    </TableCell></TableRow>
                  ) : filtered.map(d => (
                    <TableRow key={d.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <Layers className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{d.departmentName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{d.memberCount ?? 0} members</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {d.createdAt ? format(parseISO(d.createdAt), 'MMM dd, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card">
                            {canEdit && (
                              <DropdownMenuItem onClick={() => { setEditTarget(d); setDeptName(d.departmentName); }} className="cursor-pointer">
                                <Pencil className="mr-2 h-4 w-4" />Edit
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem onClick={() => handleDelete(d.id, d.departmentName)} className="text-destructive cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
                            )}
                            {!canEdit && !canDelete && (
                              <DropdownMenuItem disabled>No Access</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DepartmentManagement;
