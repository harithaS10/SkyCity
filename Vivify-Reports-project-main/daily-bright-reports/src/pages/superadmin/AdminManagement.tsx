import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, AdminTenant } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Crown, Building2, Users, Plus, MoreVertical, Pencil, Trash2, Search, Globe } from 'lucide-react';

const EMPTY_FORM = {
  name: '', email: '', password: '', companyName: '', themeColor: '#6366f1',
};

const AdminManagement: React.FC = () => {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminTenant | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await api.superAdmin.getAllAdmins();
      if (res.success && res.data) setTenants(res.data);
    } catch {
      // API may not exist yet — show empty state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = tenants.filter(
    t => t.name.toLowerCase().includes(search.toLowerCase()) ||
         t.companyName.toLowerCase().includes(search.toLowerCase()) ||
         t.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password || !form.companyName) {
      toast.error('Please fill in all required fields'); return;
    }
    try {
      const res = await api.superAdmin.createAdmin(form as any);
      if (res.success) {
        toast.success(`Admin "${form.companyName}" created`);
        setForm({ ...EMPTY_FORM });
        setIsCreateOpen(false);
        load();
      } else toast.error(res.message || 'Failed to create admin');
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    try {
      const res = await api.superAdmin.updateAdmin(editTarget.id, {
        name: form.name, companyName: form.companyName,
        email: form.email, themeColor: form.themeColor,
      });
      if (res.success) {
        toast.success('Admin updated');
        setEditTarget(null);
        load();
      } else toast.error(res.message || 'Failed');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete admin "${name}"? This will affect all their users.`)) return;
    try {
      const res = await api.superAdmin.deleteAdmin(id);
      if (res.success) {
        toast.success('Admin deleted');
        setTenants(prev => prev.filter(t => t.id !== id));
      } else toast.error(res.message || 'Failed');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.superAdmin.toggleAdminStatus(id);
      toast.success('Status updated');
      load();
    } catch { toast.error('Failed to update status'); }
  };

  const openEdit = (t: AdminTenant) => {
    setEditTarget(t);
    setForm({ name: t.name, email: t.email, password: '', companyName: t.companyName, themeColor: t.themeColor || '#6366f1' });
  };

  const headerBg = 'bg-primary';
  const headerText = 'text-white font-semibold h-11';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pt-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-500" />
              <h1 className="text-2xl font-bold">Admin Accounts</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Manage all tenant admin accounts across the platform
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> New Admin</Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Create New Admin Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {[
                  { id: 'name', label: 'Full Name *', ph: 'John Doe', field: 'name' },
                  { id: 'email', label: 'Email *', ph: 'admin@company.com', field: 'email' },
                  { id: 'password', label: 'Password *', ph: 'Min. 6 characters', field: 'password' },
                  { id: 'company', label: 'Company / Tenant Name *', ph: 'Acme Corp', field: 'companyName' },
                ].map(({ id, label, ph, field }) => (
                  <div key={id} className="space-y-2">
                    <Label htmlFor={id}>{label}</Label>
                    <Input
                      id={id}
                      type={field === 'password' ? 'password' : 'text'}
                      placeholder={ph}
                      value={(form as any)[field]}
                      onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="themeColor">Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="themeColor"
                      type="color"
                      value={form.themeColor}
                      onChange={e => setForm(p => ({ ...p, themeColor: e.target.value }))}
                      className="h-10 w-16 rounded border cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground">{form.themeColor}</span>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-row gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create Admin</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
            <DialogContent className="bg-card">
              <DialogHeader><DialogTitle>Edit Admin</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                {[
                  { id: 'eName', label: 'Full Name', ph: 'John Doe', field: 'name' },
                  { id: 'eEmail', label: 'Email', ph: 'admin@company.com', field: 'email' },
                  { id: 'eCompany', label: 'Company Name', ph: 'Acme Corp', field: 'companyName' },
                ].map(({ id, label, ph, field }) => (
                  <div key={id} className="space-y-2">
                    <Label htmlFor={id}>{label}</Label>
                    <Input
                      id={id}
                      placeholder={ph}
                      value={(form as any)[field]}
                      onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter className="flex-row gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button onClick={handleUpdate}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Tenants', value: tenants.length, icon: <Globe className="h-5 w-5 text-primary" />, bg: 'bg-primary/10' },
            { label: 'Active Admins', value: tenants.filter(t => t.status === 'active').length, icon: <Crown className="h-5 w-5 text-amber-500" />, bg: 'bg-amber-100/50' },
            { label: 'Total Users', value: tenants.reduce((s, t) => s + (t.userCount || 0), 0), icon: <Users className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-100/50' },
          ].map(({ label, value, icon, bg }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
                <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-none shadow-md">
          <CardHeader className="bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg">All Admin Tenants</CardTitle>
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
                    {['Company', 'Contact', 'Users', 'Actions'].map(h => (
                      <TableHead key={h} className={headerText}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      {tenants.length === 0 ? 'No admin tenants yet. Create one to get started.' : 'No results found.'}
                    </TableCell></TableRow>
                  ) : filtered.map(t => (
                    <TableRow key={t.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                            <Building2 className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-medium">{t.companyName}</p>
                            <p className="text-xs text-muted-foreground">ID: {t.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{t.adminName || t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                        {t.adminPhone && <p className="text-xs text-muted-foreground">{t.adminPhone}</p>}
                      </TableCell>
                      <TableCell><span className="font-semibold">{t.userCount ?? '—'}</span></TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDelete(t.id, t.companyName)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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

export default AdminManagement;
